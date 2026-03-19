# APEX CORTEX -- Algorithm Reference

All algorithms implement the standard interface:

```python
def calculate(snapshot: dict, vehicle: dict) -> dict:
```

- `snapshot`: Current telemetry data (PID values, timestamps, GPS).
- `vehicle`: Active vehicle profile (gear ratios, weight, engine specs).
- Returns a dict of computed metrics. All values may be `None` if input data is missing.

Each algorithm uses module-level state for tracking history and trends. Call `reset_state()` to clear state between sessions or tests.

---

## 1. Performance (`core/algorithms/performance.py`)

Estimates engine power and torque from OBD-II data.

### Key Formulas

```
Power [kW] = (Torque [Nm] * RPM) / 9549
Power [HP] = Power [kW] * 1.341

Torque [Nm] = (actual_torque_pct / 100) * reference_torque
Torque Efficiency = actual_torque_pct / driver_demand_torque_pct * 100
```

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `power_kw` | float | Estimated power in kilowatts |
| `power_hp` | float | Estimated power in horsepower |
| `torque_nm` | float | Estimated torque in Newton-metres |
| `torque_efficiency` | float | How much of demanded torque is delivered (0--100%) |
| `engine_load_pct` | float | Calculated engine load percentage |

---

## 2. Dynamics (`core/algorithms/dynamics.py`)

G-force estimation, weight transfer, and yaw rate calculation.

### Key Formulas

```
G_longitudinal = delta_speed_ms / delta_time / 9.81
G_lateral = estimated from steering angle + speed, or from accelerometer if available

Weight Transfer Front [N] = (mass * g_long * 9.81 * cg_height) / wheelbase
Weight Transfer Lateral [N] = (mass * g_lat * 9.81 * cg_height) / track_width
```

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `g_longitudinal` | float | Longitudinal G-force (positive = acceleration) |
| `g_lateral` | float | Lateral G-force (positive = right turn) |
| `g_vertical` | float | Vertical G-force |
| `g_combined` | float | Combined G-force magnitude |
| `weight_transfer_front_n` | float | Weight transfer to front axle (N) |
| `weight_transfer_lateral_n` | float | Lateral weight transfer (N) |

---

## 3. Fuel (`core/algorithms/fuel.py`)

Air-fuel ratio analysis, consumption, range estimation, and pit window calculation.

### Key Formulas

```
AFR = MAF_rate / fuel_flow_rate
Lambda = AFR / 14.7  (stoichiometric for gasoline)

Fuel Consumption [L/100km] = (MAF_g_s * 3600) / (fuel_density * speed_kmh * 10)
  where fuel_density_gasoline = 750 g/L

Range [km] = fuel_remaining_L / (consumption_L_per_km)
Pit Window [laps] = floor(fuel_remaining_L / fuel_per_lap_L)
```

### AFR Status Zones

| AFR Range | Status | Description |
|-----------|--------|-------------|
| < 11.5 | RICH_DANGER | Dangerously rich, risk of fouling |
| 11.5--12.5 | RICH | Rich mixture (power mode) |
| 12.5--13.5 | OPTIMAL_RACE | Optimal for peak power |
| 13.5--15.0 | STOICH | Near stoichiometric (efficient) |
| 15.0--16.5 | LEAN | Lean mixture (economy) |
| > 16.5 | LEAN_DANGER | Dangerously lean, risk of detonation |

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `afr` | float | Air-fuel ratio |
| `lambda_val` | float | Lambda value (1.0 = stoichiometric) |
| `afr_status` | str | AFR zone classification |
| `consumption_l100km` | float | Fuel consumption in L/100km |
| `range_km` | float | Estimated remaining range |
| `pit_window_laps` | int | Estimated laps until pit stop needed |

---

## 4. Braking (`core/algorithms/braking.py`)

Brake performance analysis, stopping distance, and fade detection.

### Key Formulas

```
Deceleration [m/s^2] = abs(delta_speed_ms) / delta_time
  (only computed when vehicle is decelerating and throttle < 10%)

Brake Force [N] = mass_kg * deceleration_ms2
BPI (Brake Performance Index) = (deceleration / 9.81) * 100
Stopping Distance [m] = speed_ms^2 / (2 * deceleration)
```

### Brake Fade Detection

Fade is detected when:
1. Coolant temperature exceeds 100 C during braking (thermal fade risk).
2. Current deceleration drops below 70% of the session peak while braking intensity remains high (performance fade).

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `deceleration_ms2` | float | Current deceleration magnitude (m/s^2) |
| `brake_force_n` | float | Estimated brake force (Newtons) |
| `bpi` | float | Brake performance index (0--100+) |
| `stopping_distance_m` | float | Theoretical stopping distance at current decel |
| `brake_fade_warning` | bool | True if brake fade is detected |
| `is_braking` | bool | True if vehicle is currently braking |

---

## 5. Traction (`core/algorithms/traction.py`)

Tyre slip ratio estimation, stability classification, and ESP intervention detection.

### Slip Ratio

```
wheel_rpm = engine_rpm / (gear_ratio * final_drive)
wheel_speed_ms = wheel_rpm * tire_circumference_m / 60

slip_ratio = (wheel_speed - vehicle_speed) / max(wheel_speed, vehicle_speed)
```

A slip ratio of 0 means no slip (pure grip). Values above 0.05 indicate the tyres are breaking traction.

### Stability States

| State | Slip Ratio | Condition |
|-------|-----------|-----------|
| STABLE | < 0.05 | Normal grip |
| MILD_SLIP | 0.05--0.15 | Light traction loss |
| OVERSTEER | 0.15--0.30 | Rear slides out (high throttle + lateral G) |
| UNDERSTEER | 0.15--0.30 | Front pushes wide (low throttle + lateral G) |
| SPINNING | > 0.30 | Significant traction loss |

### ESP Intervention Detection

Heuristic: a sudden RPM drop (> 500 rpm) while throttle remains high (> 50%) suggests the ESP or traction control system has intervened by cutting engine power.

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `slip_ratio` | float | Estimated tyre slip ratio (0--1) |
| `stability_state` | str | STABLE, MILD_SLIP, OVERSTEER, UNDERSTEER, or SPINNING |
| `esp_intervention` | bool | True if ESP intervention is detected |

---

## 6. Thermal (`core/algorithms/thermal.py`)

Thermal Risk Score, temperature trend analysis, and overheat prediction.

### Thermal Risk Score (TRS)

```
trs = (coolant/120) * 0.35
    + (oil/150) * 0.25
    + (iat/60) * 0.20
    + (brake_est/400) * 0.20

Each component is clamped to [0, 1] before applying its weight.
```

Brake temperature is estimated from coolant temperature and engine load when no dedicated sensor is available.

### TRS Status Levels

| TRS Range | Status | Action |
|-----------|--------|--------|
| < 0.50 | SAFE | Normal operation |
| 0.50--0.70 | WATCH | Monitor temperatures |
| 0.70--0.85 | WARNING | Reduce intensity |
| >= 0.85 | CRITICAL | Cool-down lap required |

### Overheat Prediction

Uses linear regression over the most recent temperature samples to compute `coolant_trend_c_per_s` (degrees Celsius per second). If the trend is positive, `predicted_overheat_sec` estimates how many seconds until coolant reaches the critical threshold of 120 C.

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `trs` | float | Thermal risk score (0.0--1.0+) |
| `trs_status` | str | SAFE, WATCH, WARNING, or CRITICAL |
| `coolant_trend_c_per_s` | float | Coolant temperature slope (C/s) |
| `oil_trend_c_per_s` | float | Oil temperature slope (C/s) |
| `predicted_overheat_sec` | float | Seconds until coolant reaches 120 C (or None) |
| `coolant_temp_c` | float | Current coolant temperature |
| `oil_temp_c` | float | Current oil temperature |
| `iat_temp_c` | float | Current intake air temperature |

---

## 7. Shift Advisor (`core/algorithms/shift_advisor.py`)

Gear estimation, optimal shift point calculation, and missed-shift tracking.

### Gear Estimation

```
wheel_rpm = (speed_ms * 60) / tire_circumference_m

For each gear ratio:
    expected_engine_rpm = wheel_rpm * gear_ratio * final_drive

The gear whose expected RPM is closest to actual RPM (within 15% tolerance) is selected.
```

### Optimal Shift RPM

```
optimal_shift_rpm = (peak_torque_rpm * current_gear_ratio) / next_gear_ratio
```

This formula ensures the engine lands at peak-torque RPM after the upshift, maximizing acceleration. The value is clamped to not exceed redline.

### Gear Efficiency Score

A 0--100 score indicating how well the current RPM utilizes the engine's torque band. 100 = at peak torque RPM. Score decreases linearly as RPM moves away from the optimal band.

### Missed Shift Detection

A missed shift is counted when RPM exceeds the redline. The counter increments once per redline crossing event.

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `estimated_gear` | int | Current gear (1-based, None if unknown) |
| `optimal_shift_rpm` | float | RPM at which to upshift |
| `shift_now` | bool | True if RPM >= optimal shift point |
| `gear_efficiency_score` | float | Gear utilization score (0--100) |
| `missed_shift_count` | int | Total missed shifts this session |

---

## 8. Lap Timer (`core/algorithms/lap_timer.py`)

GPS-based lap and sector detection, timing, and delta calculations.

### Lap Detection

Uses GPS coordinates (`gps_lat`, `gps_lon`) and a configured start/finish point. A lap crossing is detected when the vehicle enters a radius around the start/finish point (default: 25 metres). A minimum lap time of 10 seconds prevents false triggers.

### Configuration

```python
from core.algorithms import lap_timer

lap_timer.configure(
    start_finish_lat=50.3356,
    start_finish_lon=6.9475,
    sector_waypoints=[
        (50.3340, 6.9500),  # Sector 1->2 boundary
        (50.3320, 6.9450),  # Sector 2->3 boundary
    ],
    crossing_radius_m=25.0,
)
```

### Delta Calculation

- `delta_to_best_ms`: Difference between current lap elapsed time and the session best at the same point. Negative = ahead of best.
- `sector_deltas`: Per-sector time differences versus the best lap's sector times.

### Outputs

| Key | Type | Description |
|-----|------|-------------|
| `current_lap` | int | Current lap number |
| `current_sector` | int | Current sector index (0-based) |
| `lap_time_ms` | float | Elapsed time of current lap (ms) |
| `last_lap_time_ms` | float | Most recently completed lap time (ms) |
| `delta_to_best_ms` | float | Delta vs session best (negative = faster) |
| `session_best_ms` | float | Session best lap time (ms) |
| `sector_times` | list[float] | Current lap sector times (ms) |
| `sector_deltas` | list[float] | Sector deltas vs best lap |
| `total_laps` | int | Total completed laps |

---

## Adding a New Algorithm

1. Create `core/algorithms/your_module.py`.
2. Implement `calculate(snapshot: dict, vehicle: dict) -> dict`.
3. Add a `reset_state()` function to clear any module-level state.
4. Register in `core/algorithms/__init__.py` inside `AlgorithmDispatcher._register_defaults()`.
5. Add the algorithm name to the `_ALGORITHM_NAMES` list in `core/api/main.py`.
6. Document the outputs in this file.

### Requirements

- Handle `None` values for all inputs gracefully.
- Return a dict with consistent keys (use `None` for unavailable outputs, not omit keys).
- Do not perform blocking I/O.
- Keep computation lightweight (target < 1ms per call).
