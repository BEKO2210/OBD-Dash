# APEX CORTEX -- Algorithm Documentation

## Overview

APEX CORTEX processes raw OBD-II PID values through eight algorithm modules. Each module implements the same interface:

```python
def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]
```

- **snapshot**: Current telemetry data including `pids` dict (keyed by hex PID code) and `timestamp`.
- **vehicle**: Vehicle profile dict with specifications (mass, gear ratios, max power, etc.).
- **Returns**: Dict of computed metrics. All values are `None` when input data is insufficient.

Every algorithm handles missing or `None` PID values gracefully. Partial results are returned rather than failing entirely.

---

## 1. Performance Algorithm

**Module**: `core/algorithms/performance.py`

Estimates engine power, torque, and efficiency from OBD-II data.

### Inputs

| PID    | Name                   | Required | Fallback                           |
|--------|------------------------|----------|------------------------------------|
| `0x0C` | Engine RPM             | Yes      | --                                 |
| `0x04` | Engine Load            | Optional | Used when torque PIDs unavailable  |
| `0x62` | Actual Engine Torque % | Optional | Primary torque source              |
| `0x63` | Reference Torque (Nm)  | Optional | Primary torque source              |

**Vehicle profile fields**: `max_torque_nm`, `max_power_kw`

### Formulas

**Torque estimation (primary)**:
```
torque_nm = (actual_torque_pct / 100) * reference_torque_nm
```
Where `actual_torque_pct` is PID 0x62 and `reference_torque_nm` is PID 0x63.

**Torque estimation (fallback)**:
```
torque_nm = (engine_load / 100) * max_torque_nm
```
Where `engine_load` is PID 0x04 and `max_torque_nm` comes from the vehicle profile.

**Power estimation**:
```
power_kw = (torque_nm * rpm) / 9549
power_hp = power_kw * 1.34102
```

**Power delivery score**:
```
power_delivery_score = (power_kw / max_power_kw) * 100
```
Clamped to 0--100 range.

**Torque efficiency**:
```
torque_efficiency = estimated_torque_nm / reference_torque_nm
```

### Outputs

| Key                    | Unit | Range      | Description                               |
|------------------------|------|------------|-------------------------------------------|
| `estimated_torque_nm`  | Nm   | 0+         | Estimated engine torque                   |
| `estimated_power_kw`   | kW   | 0+         | Estimated power output                    |
| `estimated_power_hp`   | HP   | 0+         | Estimated power output (imperial)         |
| `engine_load_percent`  | %    | 0--100     | Direct from PID 0x04                      |
| `power_delivery_score` | %    | 0--100     | Current power as percentage of vehicle max|
| `torque_efficiency`    | ratio| 0--1+      | Actual vs reference torque ratio          |

### Limitations

- Torque estimation from engine load (fallback path) is approximate. Engine load correlates with torque but is not a direct measurement.
- Power calculation assumes no drivetrain losses. Actual wheel power is lower due to transmission, differential, and tire losses (typically 10--15% for RWD, 15--20% for AWD).
- PIDs 0x62 and 0x63 are not universally supported. Many vehicles only provide engine load (0x04).

---

## 2. Dynamics Algorithm

**Module**: `core/algorithms/dynamics.py`

Estimates G-forces and weight transfer from vehicle speed changes.

### Inputs

| PID    | Name              | Required | Notes                     |
|--------|-------------------|----------|---------------------------|
| `0x0D` | Vehicle Speed     | Yes      | Used for acceleration calc|
| `0x11` | Throttle Position | Optional | Used for lateral G estimate|

**Vehicle profile fields**: `curb_weight_kg`, `cg_height_m`, `wheelbase_m`, `track_width_m`

### Formulas

**Longitudinal acceleration**:
```
acceleration_ms2 = (speed_current - speed_previous) / delta_time
g_longitudinal = acceleration_ms2 / 9.81
```
Positive values indicate acceleration, negative values indicate deceleration.

**Lateral G-force estimation** (heuristic):
```
expected_accel = (throttle / 100) * 3.0
residual = |acceleration_ms2 - expected_accel|
g_lateral_raw = residual / 9.81
g_lateral = 0.3 * g_lateral_raw + 0.7 * g_lateral_previous
```
This is a best-effort estimate without IMU or yaw-rate sensor data. It detects lateral forces by comparing actual acceleration against throttle-expected acceleration. An exponential moving average (alpha=0.3) smooths the output.

**Longitudinal weight transfer**:
```
weight_transfer_front_kg = (mass * acceleration_ms2 * cg_height) / wheelbase
```
Positive values mean weight transferring forward (braking), negative means rearward (acceleration).

**Lateral weight transfer**:
```
weight_transfer_lateral_kg = (mass * g_lateral * 9.81 * cg_height) / track_width
```

### Outputs

| Key                          | Unit  | Description                              |
|------------------------------|-------|------------------------------------------|
| `g_longitudinal`             | G     | Longitudinal G-force                     |
| `g_lateral`                  | G     | Estimated lateral G-force                |
| `weight_transfer_front_kg`   | kg    | Longitudinal weight transfer to front    |
| `weight_transfer_lateral_kg` | kg    | Lateral weight transfer                  |
| `speed_ms`                   | m/s   | Current speed in meters per second       |
| `acceleration_ms2`           | m/s^2 | Raw longitudinal acceleration            |

### Limitations

- Lateral G estimation is a heuristic. Without a dedicated IMU (accelerometer + gyroscope), true lateral force cannot be measured from OBD-II alone.
- Speed resolution is limited to 1 km/h (PID 0x0D is a single byte). This introduces quantization noise in acceleration calculations.
- The algorithm maintains a 50-sample speed history buffer. On first start, results are unavailable until at least 2 samples are collected.
- Weight transfer calculations assume a rigid body model with uniform mass distribution.

---

## 3. Fuel Algorithm

**Module**: `core/algorithms/fuel.py`

Calculates air-fuel ratio, fuel consumption, range, and pit window.

### Inputs

| PID    | Name               | Required | Notes                       |
|--------|--------------------|----------|-----------------------------|
| `0x14` | O2 Sensor 1 Voltage| Optional | Used for AFR calculation    |
| `0x10` | MAF Air Flow Rate  | Optional | Used for consumption calc   |
| `0x0D` | Vehicle Speed      | Optional | Used for L/100km            |
| `0x2F` | Fuel Tank Level    | Optional | Used for range estimation   |

**Vehicle profile fields**: `fuel_density_g_l` (default: 750 g/L for gasoline), `fuel_tank_liters`, `lap_distance_km`

### Formulas

**Lambda from O2 voltage** (narrowband approximation):
```
lambda = 1.0 + (0.45 - o2_voltage) * 2.222
lambda = clamp(lambda, 0.5, 2.0)
```
This maps: 0V -> ~2.0 (very lean), 0.45V -> 1.0 (stoichiometric), 0.9V -> ~0.0 (very rich).

**Air-fuel ratio**:
```
AFR = lambda * 14.7
```
Where 14.7 is the stoichiometric AFR for gasoline.

**AFR classification**:
| Range         | Status         | Racing Context                          |
|---------------|----------------|-----------------------------------------|
| AFR > 15.0    | `lean`         | Risk of detonation under load           |
| 14.2 -- 15.0  | `stoich`       | Maximum catalytic efficiency            |
| 12.5 -- 14.2  | `optimal_race` | Best power with adequate cooling        |
| AFR < 12.5    | `rich`         | Excess fuel, power loss, carbon buildup |

**Fuel consumption** (instantaneous):
```
fuel_consumption_l100km = (MAF_g_s * 3600) / (fuel_density_g_L * speed_km_h * 10)
```

**Range remaining**:
```
remaining_liters = fuel_tank_liters * (fuel_level_pct / 100)
range_km = (remaining_liters / fuel_consumption_l100km) * 100
```

**Pit window**:
```
pit_window_laps = range_km / lap_distance_km
```

### Outputs

| Key                       | Unit    | Description                           |
|---------------------------|---------|---------------------------------------|
| `lambda_val`              | ratio   | Lambda value from O2 sensor           |
| `afr`                     | ratio   | Air-fuel ratio                        |
| `afr_status`              | string  | lean / stoich / optimal_race / rich   |
| `fuel_consumption_l100km` | L/100km | Instantaneous fuel consumption        |
| `range_remaining_km`      | km      | Estimated range on remaining fuel     |
| `pit_window_laps`         | laps    | Estimated laps before pit stop needed |

### Limitations

- Narrowband O2 sensors only provide accurate readings near stoichiometric. Lambda estimates at extremes (very lean/rich) are approximate.
- Fuel consumption calculation requires MAF sensor data. Vehicles without MAF (speed-density systems) cannot provide this metric.
- Range estimation assumes constant driving conditions. Actual range varies with driving style.
- Fuel level PID (0x2F) updates slowly and may have poor resolution (some vehicles report in 10% increments).

---

## 4. Braking Algorithm

**Module**: `core/algorithms/braking.py`

Measures braking performance and detects brake fade.

### Inputs

| PID    | Name              | Required | Notes                          |
|--------|-------------------|----------|--------------------------------|
| `0x0D` | Vehicle Speed     | Yes      | Used for deceleration calc     |
| `0x11` | Throttle Position | Optional | Used to confirm braking intent |

**Vehicle profile fields**: `curb_weight_kg`

### Formulas

**Braking detection**:
```
is_braking = (deceleration > 0.5 m/s^2) AND (throttle < 10%)
```

**Deceleration**:
```
deceleration_ms2 = (speed_previous - speed_current) / delta_time
```
Note: this is the magnitude of deceleration (positive when slowing down).

**Brake force**:
```
brake_force_N = curb_weight_kg * deceleration_ms2
```

**Brake Performance Index (BPI)**:
```
BPI = (deceleration_ms2 / 9.81) * 100
```
A BPI of 100 means decelerating at 1G. Performance cars typically achieve BPI of 80--120.

**Stopping distance** (theoretical at current deceleration):
```
stopping_distance_m = speed_ms^2 / (2 * deceleration_ms2)
```

**Brake fade detection**:
```
fade_warning = (event_count > 10) AND
               (current_decel > 1.0 m/s^2) AND
               (current_decel < peak_decel * 0.70)
```
Brake fade is flagged when the current deceleration drops below 70% of the session's peak deceleration, after at least 10 braking events. This indicates the brakes are losing effectiveness due to heat.

### Outputs

| Key                   | Unit  | Description                              |
|-----------------------|-------|------------------------------------------|
| `deceleration_ms2`    | m/s^2 | Current deceleration magnitude           |
| `brake_force_n`       | N     | Estimated total brake force              |
| `bpi`                 | score | Brake Performance Index (decel/g * 100)  |
| `stopping_distance_m` | m     | Theoretical stopping distance            |
| `brake_fade_warning`  | bool  | True if fade detected                    |
| `is_braking`          | bool  | True if currently braking                |

### Limitations

- Deceleration is derived from vehicle speed changes, not from a direct brake pressure sensor.
- Brake fade detection uses a simple threshold model. Gradual fade over many laps may not trigger the warning until the drop is significant.
- Stopping distance assumes constant deceleration and flat, dry road surface.
- The algorithm maintains a 100-sample history buffer. Session peak deceleration resets when `reset_state()` is called.

---

## 5. Traction Algorithm

**Module**: `core/algorithms/traction.py`

Estimates tire slip, traction state, and detects stability interventions.

### Inputs

| PID    | Name              | Required | Notes                          |
|--------|-------------------|----------|--------------------------------|
| `0x0C` | Engine RPM        | Yes      | Used with gear ratios for wheel speed estimate |
| `0x0D` | Vehicle Speed     | Yes      | GPS/wheel speed reference      |
| `0x11` | Throttle Position | Optional | Context for traction events    |
| `0x04` | Engine Load       | Optional | Context for traction events    |

**Vehicle profile fields**: `gear_ratios[]`, `final_drive_ratio`, `tire_diameter_m`

### Formulas

**Estimated wheel speed** (from engine RPM and gearing):
```
wheel_rpm = engine_rpm / (gear_ratio * final_drive_ratio)
wheel_speed_ms = wheel_rpm * pi * tire_diameter_m / 60
```
The current gear is inferred by finding the gear ratio that produces the closest match to the actual vehicle speed.

**Slip ratio**:
```
slip_ratio = (wheel_speed_ms - vehicle_speed_ms) / max(vehicle_speed_ms, 0.1)
```
- Slip ratio ~0: no slip (normal driving)
- Slip ratio > 0: wheel spin (acceleration traction loss)
- Slip ratio < 0: wheel lock (braking traction loss)

**Stability state classification**:
| Slip Ratio         | State         | Description                     |
|--------------------|---------------|---------------------------------|
| |slip| < 0.05      | `stable`      | Normal traction                 |
| 0.05 <= |slip| < 0.15 | `marginal` | Approaching traction limit      |
| |slip| >= 0.15     | `unstable`    | Significant traction loss       |

### Outputs

| Key               | Unit   | Description                          |
|-------------------|--------|--------------------------------------|
| `slip_ratio`      | ratio  | Tire slip ratio                      |
| `stability_state` | string | stable / marginal / unstable         |
| `estimated_gear`  | int    | Estimated current gear number        |
| `wheel_speed_ms`  | m/s    | Estimated driven wheel speed         |

### Limitations

- Gear estimation can be inaccurate during gear changes, clutch slip, or torque converter slip.
- Without individual wheel speed sensors, only drive-wheel average slip can be estimated.
- OBD-II vehicle speed (PID 0x0D) is typically derived from a non-driven wheel or transmission output shaft, introducing measurement differences.

---

## 6. Thermal Algorithm

**Module**: `core/algorithms/thermal.py`

Scores thermal risk across engine subsystems and predicts overheating.

### Inputs

| PID    | Name                      | Required | Notes                    |
|--------|---------------------------|----------|--------------------------|
| `0x05` | Engine Coolant Temperature| Optional | Primary thermal indicator|
| `0x5C` | Engine Oil Temperature    | Optional | Secondary thermal input  |
| `0x0F` | Intake Air Temperature    | Optional | Ambient heat soak        |
| `0x46` | Ambient Air Temperature   | Optional | Environmental baseline   |

**Vehicle profile fields**: `coolant_temp_normal`, `coolant_temp_warning`, `oil_temp_normal`, `oil_temp_warning`

### Formulas

**Thermal risk score** (0.0 -- 1.0):
```
coolant_risk = normalize(coolant_temp, normal_range, warning_range)
oil_risk     = normalize(oil_temp, normal_range, warning_range)
iat_risk     = normalize(iat, ambient + 20, ambient + 60)

thermal_risk = max(coolant_risk * 0.5 + oil_risk * 0.3 + iat_risk * 0.2)
```

Where `normalize()` maps a temperature into 0.0 (at or below normal) to 1.0 (at or above warning threshold).

**Trend analysis**:
```
trend = "rising"  if temp_delta > +1.0 deg C over last 30 seconds
trend = "falling" if temp_delta < -1.0 deg C over last 30 seconds
trend = "stable"  otherwise
```

**Overheat prediction**:
```
if trend == "rising" and rate > 0:
    time_to_warning = (warning_temp - current_temp) / rate_per_second
```

### Outputs

| Key                    | Unit    | Description                           |
|------------------------|---------|---------------------------------------|
| `risk_score`           | 0--1    | Combined thermal risk score           |
| `coolant_risk`         | 0--1    | Coolant-specific risk                 |
| `oil_risk`             | 0--1    | Oil-specific risk                     |
| `trend`                | string  | rising / stable / falling             |
| `time_to_warning_sec`  | seconds | Predicted time until warning temp     |
| `overheat_warning`     | bool    | True if risk_score > 0.8             |

### Limitations

- Temperature sensors have slow response times (especially oil temperature).
- Risk score weighting (50% coolant, 30% oil, 20% IAT) is a general-purpose calibration. Track-specific tuning may be needed.
- Overheat prediction assumes linear temperature rise, which is not always accurate (cooling system behavior is non-linear).

---

## 7. Shift Advisor Algorithm

**Module**: `core/algorithms/shift_advisor.py`

Recommends optimal shift points based on engine RPM and estimated power curve.

### Inputs

| PID    | Name         | Required | Notes                          |
|--------|--------------|----------|--------------------------------|
| `0x0C` | Engine RPM   | Yes      | Current RPM for shift decision |
| `0x0D` | Vehicle Speed| Optional | Context for gear estimation    |
| `0x11` | Throttle     | Optional | Only advise under load         |

**Vehicle profile fields**: `redline_rpm`, `optimal_shift_rpm`, `gear_ratios[]`, `power_band_start_rpm`, `power_band_end_rpm`

### Formulas

**Shift recommendation**:
```
if rpm >= redline_rpm:
    action = "SHIFT NOW" (urgent)
elif rpm >= optimal_shift_rpm:
    action = "SHIFT" (recommended)
elif rpm >= power_band_start:
    action = "HOLD" (in power band)
else:
    action = "DOWNSHIFT" (below power band, if throttle > 50%)
```

**Gear efficiency**:
```
gear_efficiency = 1.0 if power_band_start <= rpm <= power_band_end
gear_efficiency = rpm / power_band_start  (if below power band)
gear_efficiency = power_band_end / rpm    (if above power band)
```

**Missed shift detection**:
```
missed_shift = rpm exceeded redline_rpm for more than 0.5 seconds
```

### Outputs

| Key                  | Unit   | Description                          |
|----------------------|--------|--------------------------------------|
| `action`             | string | SHIFT NOW / SHIFT / HOLD / DOWNSHIFT |
| `optimal_shift_rpm`  | rpm    | Recommended shift point              |
| `gear_efficiency`    | 0--1   | How well the current RPM uses the power band |
| `missed_shift_count` | int    | Session total of missed shifts       |
| `current_gear`       | int    | Estimated current gear               |

### Limitations

- Optimal shift RPM is taken from the vehicle profile, not calculated from a dyno-measured torque curve. For best results, set this value based on your vehicle's actual power peak.
- Shift detection during rapid sequential shifts may lag due to PID polling rate.
- Automatic/DCT transmissions will show shift recommendations even though the transmission manages its own shift points. Consider the advisor informational in these cases.

---

## 8. Lap Timer Algorithm

**Module**: `core/algorithms/lap_timer.py`

Provides lap and sector timing with delta-to-best calculations.

### Inputs

| Source            | Required | Notes                                  |
|-------------------|----------|----------------------------------------|
| GPS coordinates   | Optional | Primary lap trigger (start/finish line)|
| Manual trigger    | Optional | Button press for lap mark              |
| Speed + distance  | Optional | Odometer-based lap detection           |

**Vehicle profile fields**: `lap_distance_km`, `sector_distances_km[]`

### Formulas

**Lap time**:
```
lap_time = lap_end_timestamp - lap_start_timestamp
```

**Delta to best**:
```
delta = current_elapsed - best_lap_elapsed_at_same_distance
```
Negative delta means the current lap is ahead of the best lap. Positive delta means behind.

**Sector times**:
```
sector_time[n] = sector_end_timestamp - sector_start_timestamp
```

**Predicted lap time**:
```
if sector_1_complete:
    predicted = sector_1_time + best_remaining_sectors_time
```

### Outputs

| Key                  | Unit    | Description                          |
|----------------------|---------|--------------------------------------|
| `current_lap_time`   | seconds | Elapsed time on current lap          |
| `last_lap_time`      | seconds | Most recent completed lap time       |
| `best_lap_time`      | seconds | Session best lap time                |
| `delta_to_best`      | seconds | Current delta vs best lap            |
| `lap_count`          | int     | Number of completed laps             |
| `sector_times`       | list    | Current lap sector times             |
| `predicted_lap_time` | seconds | Predicted lap time based on sectors  |

### Limitations

- Without GPS, lap detection relies on manual triggers or distance estimation from vehicle speed integration (subject to drift).
- Delta calculation requires at least one completed lap for comparison.
- Sector timing requires sector distances defined in the vehicle profile or track configuration.
- Speed-integrated distance accumulates error over time (~2--5% per lap) due to PID 0x0D resolution.

---

## Algorithm Dispatch Flow

All algorithms are executed in sequence on each telemetry snapshot:

```
telemetry snapshot arrives (10 Hz)
    |
    v
┌──────────────────────────────┐
│  Algorithm Dispatcher        │
│  core/algorithms/__init__.py │
│                              │
│  1. performance.calculate()  │
│  2. dynamics.calculate()     │
│  3. fuel.calculate()         │
│  4. braking.calculate()      │
│  5. traction.calculate()     │
│  6. thermal.calculate()      │
│  7. shift_advisor.calculate()│
│  8. lap_timer.calculate()    │
└──────────────┬───────────────┘
               |
               v
merged results dict -> WebSocket broadcast
```

Total algorithm execution time target: < 5ms per snapshot (to maintain 10 Hz without frame drops).

---

## Adding a New Algorithm

1. Create `core/algorithms/your_module.py`
2. Implement the standard interface:

```python
def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Args:
        snapshot: {"pids": {"0x0C": 6420, ...}, "timestamp": 1700000000.0}
        vehicle: {"max_power_kw": 375, "curb_weight_kg": 1810, ...}

    Returns:
        {"your_metric_1": value, "your_metric_2": value, ...}
    """
    result = {"your_metric_1": None, "your_metric_2": None}
    # ... compute ...
    return result
```

3. Register in `core/algorithms/__init__.py`
4. Handle `None` values for every PID input
5. Document formulas, inputs, outputs, and limitations in this file
6. Add corresponding dashboard panel in `dashboard/src/panels/`
