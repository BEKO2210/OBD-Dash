# APEX CORTEX™ — Algorithm Documentation

## Table of Contents

1. [Performance](#performance)
2. [Dynamics](#dynamics)
3. [Fuel](#fuel)
4. [Braking](#braking)
5. [Traction](#traction)
6. [Thermal](#thermal)
7. [Shift Advisor](#shift-advisor)
8. [Lap Timer](#lap-timer)
9. [Key Constants](#key-constants)

---

## Performance

**File**: `core/algorithms/performance.py`
**Purpose**: Calculate engine power, torque, and efficiency metrics.

### Input PIDs
- 0x0C: Engine RPM
- 0x04: Engine Load (%)
- 0x62: Actual Engine Torque (%)
- 0x63: Reference Torque (Nm)

### Formulas

| Output | Formula | Unit |
|---|---|---|
| `torque_nm` | actual_torque_pct × reference_torque / 100 | Nm |
| `power_kw` | (torque_nm × RPM) / 9549 | kW |
| `power_hp` | power_kw × 1.341 | HP |
| `engine_load` | PID 0x04 value | % |
| `power_delivery_score` | (power_kw / vehicle.max_power_kw) × 100 | % |
| `torque_efficiency` | actual_torque_pct / 100 | ratio |

### Limitations
- Torque estimate depends on PIDs 0x62/0x63 which may not be supported on all vehicles
- Power calculation assumes no drivetrain losses (actual wheel power is ~15% lower)

---

## Dynamics

**File**: `core/algorithms/dynamics.py`
**Purpose**: Calculate G-forces and weight transfer.

### Input PIDs
- 0x0D: Vehicle Speed (km/h)
- Historical speed data for delta calculation

### Formulas

| Output | Formula | Unit |
|---|---|---|
| `g_long` | (Δspeed_m/s / Δtime) / 9.81 | G |
| `g_lat` | Estimated from speed and steering dynamics | G |
| `g_vert` | 0 (requires accelerometer) | G |
| `weight_transfer_front` | (mass_kg × g_long × cg_height_m) / wheelbase_m | kg |
| `weight_transfer_lateral` | (mass_kg × g_lat × cg_height_m) / track_width_m | kg |

### Limitations
- Lateral G-force is estimated without steering angle sensor — accuracy is limited
- Vertical G requires external accelerometer hardware

---

## Fuel

**File**: `core/algorithms/fuel.py`
**Purpose**: Calculate air-fuel ratio, consumption, and race fuel strategy.

### Input PIDs
- 0x14: O2 Sensor Voltage (V)
- 0x10: MAF Rate (g/s)
- 0x0D: Vehicle Speed (km/h)
- 0x2F: Fuel Tank Level (%)

### Formulas

| Output | Formula | Unit |
|---|---|---|
| `lambda_val` | Mapped from O2 voltage | ratio |
| `afr` | lambda_val × 14.7 | ratio |
| `afr_status` | Classification by AFR range | string |
| `consumption_l100km` | (MAF × 3600) / (750 × speed × 10) | L/100km |
| `range_km` | (fuel_level/100 × tank_liters) / (consumption/100) | km |
| `pit_window_laps` | range_km / avg_lap_length_km | laps |

### AFR Status Classification
- **lean**: AFR > 15.0
- **stoich**: AFR 14.2–15.0
- **optimal_race**: AFR 12.5–14.2
- **rich**: AFR < 12.5

---

## Braking

**File**: `core/algorithms/braking.py`
**Purpose**: Analyze braking performance and fade detection.

### Formulas

| Output | Formula | Unit |
|---|---|---|
| `deceleration_ms2` | abs(Δspeed_m/s) / Δtime | m/s² |
| `brake_force_n` | vehicle_mass_kg × deceleration | N |
| `bpi` | (deceleration / 9.81) × 100 | % of 1G |
| `stopping_distance_m` | speed_m/s² / (2 × deceleration) | m |
| `brake_fade_warning` | True if coolant > 100°C and rising | bool |

---

## Traction

**File**: `core/algorithms/traction.py`
**Purpose**: Estimate tire slip and stability state.

### Stability States

| State | Slip Ratio | Description |
|---|---|---|
| STABLE | < 5% | Normal grip |
| MILD_SLIP | 5–15% | Minor traction loss |
| OVERSTEER | 15–30% | Rear sliding |
| UNDERSTEER | 15–30% | Front pushing |
| SPINNING | > 30% | Severe loss |

---

## Thermal

**File**: `core/algorithms/thermal.py`
**Purpose**: Thermal Risk Score and overheat prediction.

### TRS Formula

```
TRS = (coolant_temp/120) × 0.35
    + (oil_temp/150) × 0.25
    + (intake_air_temp/60) × 0.20
    + (brake_temp_est/400) × 0.20
```

Each component clamped to 0–1 range.

### TRS Status

| Status | TRS Range | Action |
|---|---|---|
| SAFE | < 0.50 | Normal |
| WATCH | 0.50–0.70 | Monitor |
| WARNING | 0.70–0.85 | Reduce intensity |
| CRITICAL | > 0.85 | Cool down immediately |

### Overheat Prediction
```
predicted_overheat_sec = (120 - coolant_temp) / coolant_trend_slope
```
Only calculated when `coolant_trend > 0` (temperature rising).

---

## Shift Advisor

**File**: `core/algorithms/shift_advisor.py`
**Purpose**: Optimal shift points and gear efficiency.

### Gear Detection
```
theoretical_rpm = (speed_kmh × 1000 / 60) / (tire_circ_m) × gear_ratio × final_drive
current_gear = gear with minimum |theoretical - actual| RPM
```

### Shift Point
```
optimal_shift_rpm = (peak_torque_rpm × current_gear_ratio) / next_gear_ratio
```

---

## Lap Timer

**File**: `core/algorithms/lap_timer.py`
**Purpose**: GPS-based lap and sector timing.

### Outputs
- `current_lap_time_ms`: Time since crossing start/finish
- `session_best_ms`: Best lap in session
- `delta_ms`: Current vs. best (negative = faster)
- `lap_count`: Completed laps

### Requirements
- GPS module with minimum 1Hz update rate (10Hz recommended)
- Configured start/finish coordinates in `.env`

---

## Key Constants

| Constant | Value | Usage |
|---|---|---|
| Gravity | 9.81 m/s² | G-force calculations |
| Stoichiometric AFR | 14.7:1 | Fuel calculations |
| Optimal Race AFR | 12.5–13.5:1 | AFR classification |
| Gasoline Density | 750 g/L | Fuel consumption |
| Power Factor | 9549 | kW from Nm × RPM |
| HP Conversion | 1.341 | kW to HP |
| Coolant Danger | 120 °C | TRS baseline |
| Oil Danger | 150 °C | TRS baseline |
