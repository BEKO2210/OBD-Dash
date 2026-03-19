# APEX CORTEX™ — AI Context Bible

> **This file is the permanent memory and context reference for every Claude Code agent
> working on this project. Read this FIRST before touching any code.**

---

## 1. PROJECT IDENTITY

| Field | Value |
|---|---|
| **Full Name** | APEX CORTEX™ |
| **Short Name** | AXCR |
| **Version** | 0.1.0-alpha |
| **Author Scaffold** | Belkis Aslani |
| **Purpose** | Professional real-time racing dashboard for road-legal vehicles with race mode |
| **Core Philosophy** | *"Every sensor read is a competitive advantage"* |
| **Tagline** | *"Every millisecond. Every molecule. Every edge."* |

**APEX** = Scheitelpunkt (curve apex in motorsport)
**CORTEX** = Brain, processing core

---

## 2. WHAT THIS PROJECT IS

- A **Python (FastAPI + WebSocket) backend** that connects to a vehicle via ELM327 OBD-II adapter (Bluetooth / WiFi / USB)
- A **React frontend dashboard** rendered in Electron or browser
- All racing-relevant PIDs are read, processed, and fed into calculation algorithms in **real time**
- The UI shows multiple panels: gauges, graphs, alerts, computed metrics
- Target vehicles: Mercedes-AMG, BMW M, Audi RS, Porsche GT-Street variants
- Default mode uses a **simulator** — no hardware required for development

---

## 3. WHAT EVERY AGENT MUST KNOW BEFORE TOUCHING CODE

| Component | Location | Purpose |
|---|---|---|
| OBD Connection | `core/obd/connector.py` | ELM327 connection manager (python-obd) |
| PID Definitions | `core/obd/pid_registry.py` | All PID definitions, decoders, units |
| OBD Protocols | `core/obd/protocols.py` | ISO 9141, ISO 14230, ISO 15765, SAE J1850 |
| OBD Simulator | `core/obd/simulator.py` | Dev-mode fake OBD data generator |
| Telemetry Collector | `core/telemetry/collector.py` | Async polling loop, PID scheduling |
| Telemetry Processor | `core/telemetry/processor.py` | Unit conversion, normalization, smoothing |
| Session Logger | `core/telemetry/logger.py` | Session recording to JSON/CSV |
| Algorithm Registry | `core/algorithms/__init__.py` | Algorithm registry + dispatcher |
| Performance Algo | `core/algorithms/performance.py` | Power [kW/HP], torque, engine load |
| Dynamics Algo | `core/algorithms/dynamics.py` | G-Force (3-axis), weight transfer, yaw |
| Fuel Algo | `core/algorithms/fuel.py` | AFR, Lambda, consumption, pit window |
| Braking Algo | `core/algorithms/braking.py` | BPI, stopping distance, fade warning |
| Traction Algo | `core/algorithms/traction.py` | Slip ratio, stability, ESP detection |
| Thermal Algo | `core/algorithms/thermal.py` | TRS, trend analysis, overheat prediction |
| Shift Advisor | `core/algorithms/shift_advisor.py` | Optimal shift points, gear efficiency |
| Lap Timer | `core/algorithms/lap_timer.py` | Lap/sector timing, delta, session best |
| FastAPI Entry | `core/api/main.py` | FastAPI application entry point |
| WebSocket Server | `core/api/websocket.py` | WebSocket broadcaster at ~10Hz |
| Session Routes | `core/api/routes/session.py` | Session start/stop/export endpoints |
| Vehicle Routes | `core/api/routes/vehicle.py` | Vehicle profile management |
| Status Routes | `core/api/routes/status.py` | OBD connection status |
| React App Root | `dashboard/src/App.jsx` | Root app, mode switcher |
| Race Mode Layout | `dashboard/src/layouts/RaceMode.jsx` | Full-screen race HUD |
| Telemetry Layout | `dashboard/src/layouts/TelemetryMode.jsx` | Engineer view with all data |
| Street Mode Layout | `dashboard/src/layouts/StreetMode.jsx` | Clean daily-drive view |
| WebSocket Hook | `dashboard/src/hooks/useWebSocket.js` | WebSocket connection + auto-reconnect |
| OBD Data Hook | `dashboard/src/hooks/useOBDData.js` | Parsed data hook with history buffer |
| Alerts Hook | `dashboard/src/hooks/useAlerts.js` | Alert state management |
| Vehicle Profiles | `config/vehicles/` | JSON vehicle profiles |
| PID Maps | `config/pid_maps/` | PID maps per manufacturer |
| Themes | `config/themes/` | UI theme configurations |
| Sessions | `sessions/` | Session recordings |

---

## 4. ARCHITECTURE OVERVIEW

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system architecture diagram.

```
┌─────────────────────────────────────────────────────┐
│                    APEX CORTEX™                      │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │ Vehicle   │──▶│ ELM327   │──▶│ core/obd/        │ │
│  │ OBD-II    │   │ Adapter  │   │ connector.py     │ │
│  └──────────┘   └──────────┘   └────────┬─────────┘ │
│                                          │           │
│                              ┌───────────▼────────┐  │
│                              │ core/telemetry/    │  │
│                              │ collector.py       │  │
│                              └───────────┬────────┘  │
│                                          │           │
│                              ┌───────────▼────────┐  │
│                              │ core/telemetry/    │  │
│                              │ processor.py       │  │
│                              └───────────┬────────┘  │
│                                          │           │
│                              ┌───────────▼────────┐  │
│                              │ core/algorithms/*  │  │
│                              │ (8 modules)        │  │
│                              └───────────┬────────┘  │
│                                          │           │
│  ┌──────────────────┐  WS   ┌───────────▼────────┐  │
│  │ dashboard/src/   │◀──────│ core/api/          │  │
│  │ React Frontend   │ 10Hz  │ websocket.py       │  │
│  └──────────────────┘       └────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 5. DATA FLOW

```
Vehicle OBD-II Port
  → ELM327 Adapter (BT/WiFi/USB)
  → core/obd/connector.py (python-obd)
  → core/telemetry/collector.py (async polling loop)
  → core/telemetry/processor.py (normalization + unit conversion)
  → core/algorithms/* (all calculations fired here)
  → core/api/websocket.py (broadcasts JSON at ~10Hz)
  → dashboard/src/hooks/useWebSocket.js (React receives data)
  → dashboard/src/panels/* (live UI update)
```

---

## 6. ALGORITHM MODULES

See [docs/ALGORITHMS.md](docs/ALGORITHMS.md) for detailed formulas.

| Module | File | Outputs |
|---|---|---|
| Performance | `core/algorithms/performance.py` | power_kw, power_hp, engine_load, torque_efficiency |
| Dynamics | `core/algorithms/dynamics.py` | g_long, g_lat, g_vert, weight_transfer_front, weight_transfer_lateral |
| Fuel | `core/algorithms/fuel.py` | afr, lambda_val, afr_status, consumption_l100km, range_km, pit_window_laps |
| Braking | `core/algorithms/braking.py` | bpi, stopping_distance_m, brake_fade_warning, deceleration_ms2 |
| Traction | `core/algorithms/traction.py` | slip_ratio, stability_state, esp_intervention |
| Thermal | `core/algorithms/thermal.py` | trs, trs_status, coolant_trend, predicted_overheat_sec |
| Shift Advisor | `core/algorithms/shift_advisor.py` | optimal_shift_rpm, shift_now, current_gear_efficiency, missed_shift_count |
| Lap Timer | `core/algorithms/lap_timer.py` | current_lap_time_ms, session_best_ms, delta_ms, current_sector, sector_times |

---

## 7. KEY CONSTANTS & FORMULAS

| Constant/Formula | Value |
|---|---|
| Stoichiometric AFR (Gasoline) | 14.7:1 |
| Optimal Race AFR Range | 12.5–13.5:1 |
| G-Force Longitudinal | Δv/Δt / 9.81 |
| Shift Point | next_gear_rpm = (current_rpm × current_ratio) / next_ratio |
| Brake Force | F = m × a (where a = Δv/Δt) |
| Thermal Risk Score | weighted(coolant×0.35 + oil×0.25 + IAT×0.20 + brake_est×0.20) |
| Power Estimate | P[kW] = (torque[Nm] × RPM) / 9549 |
| Weight Transfer Front | ΔFz = (m × a × h_cg) / wheelbase |
| Fuel Consumption | L/100km = (MAF_g_s × 3600) / (fuel_density × speed_km_h × 10) |

---

## 8. OBD-II PIDs USED

See [docs/OBD_PROTOCOLS.md](docs/OBD_PROTOCOLS.md) for the complete PID table.

### Critical PIDs (10Hz polling)
| PID | Name | Unit | Range |
|---|---|---|---|
| 0x0C | Engine RPM | rpm | 0–16383 |
| 0x0D | Vehicle Speed | km/h | 0–255 |
| 0x11 | Throttle Position | % | 0–100 |
| 0x04 | Engine Load | % | 0–100 |

### Standard PIDs (2Hz polling)
| PID | Name | Unit | Range |
|---|---|---|---|
| 0x05 | Coolant Temp | °C | -40–215 |
| 0x0B | MAP | kPa | 0–255 |
| 0x0F | Intake Air Temp | °C | -40–215 |
| 0x10 | MAF Rate | g/s | 0–655.35 |
| 0x14 | O2 Sensor 1 | V | 0–1.275 |
| 0x5C | Oil Temp | °C | -40–210 |

### Slow PIDs (0.5Hz polling)
| PID | Name | Unit | Range |
|---|---|---|---|
| 0x2F | Fuel Tank Level | % | 0–100 |
| 0x33 | Baro Pressure | kPa | 0–255 |
| 0x42 | Battery Voltage | V | 0–65.535 |
| 0x46 | Ambient Temp | °C | -40–215 |

---

## 9. VEHICLE PROFILE SYSTEM

Each vehicle has a JSON profile in `config/vehicles/`. Schema:

```json
{
  "make": "Mercedes-AMG",
  "model": "C63 S",
  "year": 2020,
  "engine_cc": 3982,
  "cylinders": 8,
  "displacement": 3.982,
  "fuel_type": "gasoline",
  "turbo": true,
  "transmission_type": "automatic",
  "gear_ratios": [4.69, 3.14, 2.10, 1.67, 1.29, 1.00, 0.84],
  "final_drive": 2.82,
  "tire_circumference_mm": 2060,
  "curb_weight_kg": 1810,
  "fuel_tank_liters": 66,
  "redline_rpm": 7200,
  "shift_recommend_rpm": 6800,
  "max_power_kw": 375,
  "max_torque_nm": 700,
  "cg_height_m": 0.45,
  "wheelbase_m": 2.84,
  "track_width_m": 1.60,
  "manufacturer_pid_map": "mercedes_amg"
}
```

---

## 10. HOW TO ADD A NEW PANEL

1. Create `dashboard/src/panels/NewPanel.jsx`
2. Import `useWebSocket` hook
3. Subscribe to the relevant data key from the WebSocket stream
4. Register it in `dashboard/src/layouts/RaceMode.jsx` (or other layout)

```jsx
import { useOBDData } from '../hooks/useOBDData';

export default function NewPanel() {
  const { data } = useOBDData();
  return <div>{/* render data */}</div>;
}
```

---

## 11. HOW TO ADD A NEW ALGORITHM

1. Create `core/algorithms/new_module.py`
2. Implement: `calculate(data_snapshot: dict, vehicle_profile: dict) -> dict`
3. Register in `core/algorithms/__init__.py`
4. Add output keys to `docs/ALGORITHMS.md`

```python
def calculate(snapshot: dict, vehicle: dict) -> dict:
    """All values may be None — handle gracefully."""
    result = {}
    # ... compute ...
    return result
```

---

## 12. DEVELOPMENT MODE

Use the simulator to generate fake OBD data (no hardware required):

```bash
# Start backend in simulator mode (default)
SIMULATOR_MODE=true python -m core.api.main

# Or run simulator standalone
python core/obd/simulator.py --profile amg_c63_s --mode track_session
```

Simulator modes: `idle`, `street`, `track_session`, `launch_control`

---

## 13. IMPORTANT WARNINGS

- **Never block the async polling loop** — all OBD reads must be non-blocking
- **PID polling rate must be configurable** — default: 10Hz for critical, 2Hz standard, 0.5Hz slow
- **Some PIDs are vehicle-specific** (Mode 22) — always check the vehicle profile
- **CAN-Bus direct access** requires SocketCAN (Linux only) — see docs/OBD_PROTOCOLS.md
- **All temperatures internally in Celsius**, all speed in km/h, all power in kW — convert for display only
- **Every algorithm must handle None values** gracefully (missing PID data)
- **WebSocket must broadcast** even if OBD data is partially missing

---

## 14. QUICK START

```bash
# Backend
pip install -r requirements.txt
cp .env.example .env
python -m core.api.main

# Frontend (separate terminal)
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173` for the dashboard. Backend API at `http://localhost:8000`.
