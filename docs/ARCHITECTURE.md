# APEX CORTEX -- System Architecture

## Overview

APEX CORTEX is a real-time racing telemetry system that reads OBD-II data from a vehicle, processes it through a pipeline of algorithms, and presents the results on a live dashboard via WebSocket. The system is split into a Python backend (FastAPI) and a React frontend (Vite + Tailwind CSS).

---

## High-Level Data Flow

```
Vehicle OBD-II Port
  -> ELM327 Adapter (Bluetooth / WiFi / USB)
  -> core/obd/connector.py (python-obd, async)
  -> core/telemetry/collector.py (tiered polling: 10Hz / 2Hz / 0.5Hz)
  -> core/telemetry/processor.py (normalize, smooth, unit conversion)
  -> core/algorithms/* (8 computation modules, isolated)
  -> core/api/main.py (assembles payload)
  -> core/api/websocket.py (broadcasts JSON at ~10Hz)
  -> dashboard/src/hooks/useWebSocket.js (React receives via WS)
  -> dashboard/src/panels/* (live UI rendering)
```

---

## Architecture Diagram

```
+-----------------------------------------------------------------+
|                        APEX CORTEX                               |
|                                                                  |
|  +----------+   +----------+   +------------------------+       |
|  | Vehicle   |-->| ELM327   |-->| core/obd/connector.py  |       |
|  | OBD-II    |   | Adapter  |   | (python-obd)           |       |
|  +----------+   +----------+   +-----------+------------+       |
|                                             |                    |
|                     [Simulator Fallback]     |                   |
|                     core/obd/simulator.py --+                   |
|                                             |                    |
|                                 +-----------v------------+       |
|                                 | core/telemetry/        |       |
|                                 | collector.py           |       |
|                                 | (async tiered polling) |       |
|                                 +-----------+------------+       |
|                                             |                    |
|                                 +-----------v------------+       |
|                                 | core/telemetry/        |       |
|                                 | processor.py           |       |
|                                 | (normalize + smooth)   |       |
|                                 +-----------+------------+       |
|                                             |                    |
|                                 +-----------v------------+       |
|                                 | core/algorithms/       |       |
|                                 | __init__.py            |       |
|                                 | AlgorithmDispatcher    |       |
|                                 |                        |       |
|                                 | - performance.py       |       |
|                                 | - dynamics.py          |       |
|                                 | - fuel.py              |       |
|                                 | - braking.py           |       |
|                                 | - traction.py          |       |
|                                 | - thermal.py           |       |
|                                 | - shift_advisor.py     |       |
|                                 | - lap_timer.py         |       |
|                                 +-----------+------------+       |
|                                             |                    |
|  +------------------------+    +------------v-----------+        |
|  | dashboard/src/         |<---| core/api/main.py       |        |
|  | React + Vite + Tailwind| WS | FastAPI + WebSocket    |        |
|  |                        |10Hz| core/api/websocket.py  |        |
|  +------------------------+    +------------------------+        |
+-----------------------------------------------------------------+
```

---

## Backend Components

### OBD Layer (`core/obd/`)

| Module | Responsibility |
|--------|---------------|
| `connector.py` | Manages the physical connection to an ELM327 adapter. Supports Bluetooth serial, WiFi TCP, and USB serial. Implements auto-detection, retry with exponential backoff, and automatic fallback to the simulator. Thread-safe with `threading.RLock`. |
| `simulator.py` | Generates realistic OBD-II data without hardware. Implements a time-based state machine with four driving modes: IDLE, STREET, TRACK_SESSION, and LAUNCH_CONTROL. Produces all standard PIDs with physically plausible values that respect vehicle profile parameters. |
| `pid_registry.py` | Central registry of all Mode 01 PIDs with decode functions, units, valid ranges, and polling priorities. Each PID entry specifies whether it should be polled at 10Hz (critical), 2Hz (standard), or 0.5Hz (slow). |
| `protocols.py` | OBD-II protocol definitions and detection for ISO 15765 (CAN), ISO 14230 (KWP2000), ISO 9141, and SAE J1850. |

### Telemetry Layer (`core/telemetry/`)

| Module | Responsibility |
|--------|---------------|
| `collector.py` | Async polling loop that queries the OBD connector at tiered rates. Critical PIDs (RPM, speed, throttle) are polled at 10Hz; standard PIDs (temperatures, pressures) at 2Hz; slow PIDs (fuel level, ambient temp) at 0.5Hz. |
| `processor.py` | Normalizes raw PID values, applies unit conversions, and optionally smooths noisy sensors with an exponential moving average. |
| `logger.py` | Records telemetry sessions to JSON files in the `sessions/` directory. Supports start, stop, and export operations. |

### Algorithm Layer (`core/algorithms/`)

All algorithms implement the same interface:

```python
def calculate(snapshot: dict, vehicle: dict) -> dict:
```

Each algorithm is registered in the `AlgorithmDispatcher` and executed every telemetry tick. Exceptions in one algorithm do not affect others. See [ALGORITHMS.md](ALGORITHMS.md) for detailed formulas.

| Algorithm | Key Outputs |
|-----------|------------|
| Performance | power_kw, power_hp, torque_nm, torque_efficiency |
| Dynamics | g_longitudinal, g_lateral, g_vertical, weight_transfer |
| Fuel | afr, lambda_val, consumption_l100km, range_km, pit_window_laps |
| Braking | deceleration_ms2, brake_force_n, bpi, stopping_distance_m, brake_fade_warning |
| Traction | slip_ratio, stability_state, esp_intervention |
| Thermal | trs, trs_status, coolant_trend_c_per_s, predicted_overheat_sec |
| Shift Advisor | estimated_gear, optimal_shift_rpm, shift_now, gear_efficiency_score, missed_shift_count |
| Lap Timer | current_lap, lap_time_ms, session_best_ms, delta_to_best_ms, sector_times |

### API Layer (`core/api/`)

| Module | Responsibility |
|--------|---------------|
| `main.py` | FastAPI application entry point. Loads environment and vehicle profile at startup, initializes the OBD connector or simulator, starts the telemetry broadcast loop at ~10Hz, and exposes REST routes plus the WebSocket endpoint. |
| `websocket.py` | WebSocket manager that handles client connections, disconnections, and broadcasting. Each connected client receives the full telemetry payload every ~100ms. |
| `routes/status.py` | REST endpoint for connection status (is connected, port, protocol, simulator mode). |
| `routes/session.py` | REST endpoints for session management (start recording, stop, list, export). |
| `routes/vehicle.py` | REST endpoints for vehicle profile CRUD (list profiles, get active, switch profile). |

---

## Frontend Components

### Technology Stack

- **React 18** with functional components and hooks
- **Vite 6** for development server and production builds
- **Tailwind CSS 3.4** for utility-first styling (dark theme)
- **Recharts 2.15** for time-series charts
- **Lucide React** for icons

### Hooks

| Hook | Purpose |
|------|---------|
| `useWebSocket` | Manages the WebSocket connection to `ws://localhost:8000/ws/telemetry`. Handles auto-reconnection with exponential backoff. Returns raw JSON data, connection state, and error state. |
| `useOBDData` | Wraps `useWebSocket` and normalizes incoming data into a consistent shape. Maintains a rolling history buffer of 300 entries for charts and trend analysis. |
| `useAlerts` | Manages alert state from the telemetry stream. Handles deduplication, auto-dismissal, and severity classification. |

### Layouts

| Layout | Usage |
|--------|-------|
| `RaceMode.jsx` | Full-screen HUD optimized for track use. Large speed/gear display, shift lights, G-force ball, and lap timer. Minimal chrome, maximum information density. |
| `TelemetryMode.jsx` | Engineer/data-analysis view. Shows all available panels in a scrollable grid: gauges, charts, algorithm outputs, and raw data. Used for setup and post-session review. |
| `StreetMode.jsx` | Clean daily-driver layout. Shows only essential information: speed, RPM, coolant temperature, and fuel level. Designed for regular road use. |

### Panels

Each panel is a self-contained React component that receives `data` and optionally `history` as props. All panels handle null/missing data gracefully by displaying dashes or default states.

---

## Configuration

### Vehicle Profiles (`config/vehicles/`)

JSON files containing full vehicle specifications: engine parameters, gear ratios, dimensions, wheel sizes, brake specs, and OBD protocol settings. The active profile is selected via the `VEHICLE_PROFILE` environment variable.

### PID Maps (`config/pid_maps/`)

Manufacturer-specific extended PID definitions for Mode 22 access. Includes maps for BMW M, Mercedes-AMG, and Porsche.

### Themes (`config/themes/`)

JSON theme files defining colors, typography, spacing, effects, and gauge styles. Themes can change the entire visual appearance of the dashboard. Included themes: `race_dark` and `hud_amber`.

---

## Key Design Decisions

1. **Async-first**: All OBD reads and WebSocket operations are async to prevent blocking.
2. **Algorithm isolation**: Each algorithm runs independently; a crash in one does not affect others.
3. **Tiered polling**: PIDs are polled at different rates based on how quickly they change and how critical they are.
4. **Simulator parity**: The simulator produces the same data shape as the real connector, so the dashboard works identically in both modes.
5. **Module-level state**: Algorithms use module-level state (not class instances) for simplicity, with explicit `reset_state()` functions for testing.
6. **Profile-driven**: Vehicle-specific parameters (gear ratios, redline, weight) come from JSON profiles, not hardcoded values.
