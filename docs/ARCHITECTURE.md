# APEX CORTEX -- Architecture

## System Overview

APEX CORTEX is a real-time racing telemetry dashboard that reads OBD-II data from a vehicle, processes it through a chain of algorithm modules, and displays the results in a browser-based dashboard over WebSocket.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          APEX CORTEX ARCHITECTURE                           │
│                                                                             │
│   ┌──────────┐    ┌──────────────┐    ┌──────────────────────────────────┐  │
│   │ Vehicle  │    │  ELM327      │    │  Python Backend                  │  │
│   │ ECU      │───>│  Adapter     │───>│                                  │  │
│   │ (CAN Bus)│    │  (BT/WiFi/   │    │  ┌────────────────────────────┐  │  │
│   └──────────┘    │   USB)       │    │  │ core/obd/connector.py      │  │  │
│                   └──────────────┘    │  │ python-obd + auto-detect   │  │  │
│                                       │  └────────────┬───────────────┘  │  │
│                                       │               │                  │  │
│   ┌──────────┐                        │  ┌────────────v───────────────┐  │  │
│   │ Simulator│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─>  │ core/telemetry/collector   │  │  │
│   │ (fallback│                        │  │ Async tiered polling:      │  │  │
│   │  mode)   │                        │  │   Critical PIDs: 10 Hz    │  │  │
│   └──────────┘                        │  │   Standard PIDs:  2 Hz    │  │  │
│                                       │  │   Slow PIDs:      0.5 Hz  │  │  │
│                                       │  └────────────┬───────────────┘  │  │
│                                       │               │                  │  │
│                                       │  ┌────────────v───────────────┐  │  │
│                                       │  │ core/telemetry/processor   │  │  │
│                                       │  │ Normalization + smoothing  │  │  │
│                                       │  │ Unit conversion            │  │  │
│                                       │  └────────────┬───────────────┘  │  │
│                                       │               │                  │  │
│                                       │  ┌────────────v───────────────┐  │  │
│                                       │  │ core/algorithms/*          │  │  │
│                                       │  │                            │  │  │
│                                       │  │ performance.py  dynamics.py│  │  │
│                                       │  │ fuel.py         braking.py │  │  │
│                                       │  │ traction.py     thermal.py │  │  │
│                                       │  │ shift_advisor.py           │  │  │
│                                       │  │ lap_timer.py               │  │  │
│                                       │  └────────────┬───────────────┘  │  │
│                                       │               │                  │  │
│                                       │  ┌────────────v───────────────┐  │  │
│                                       │  │ core/api/                  │  │  │
│                                       │  │ FastAPI + Uvicorn          │  │  │
│                                       │  │                            │  │  │
│                                       │  │ REST: /api/status          │  │  │
│                                       │  │       /api/vehicle         │  │  │
│                                       │  │       /api/session         │  │  │
│                                       │  │                            │  │  │
│                                       │  │ WS:   /ws (10 Hz stream)  │  │  │
│                                       │  └────────────┬───────────────┘  │  │
│                                       └───────────────┼──────────────────┘  │
│                                                       │ WebSocket (JSON)    │
│   ┌───────────────────────────────────────────────────v──────────────────┐  │
│   │  React Dashboard (Vite + Tailwind CSS)                               │  │
│   │                                                                       │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │  │
│   │  │  Race Mode  │  │  Telemetry  │  │  Street     │                  │  │
│   │  │  HUD view   │  │  Mode       │  │  Mode       │                  │  │
│   │  │  RPM/speed  │  │  All gauges │  │  Essential  │                  │  │
│   │  │  G-force    │  │  Graphs     │  │  gauges     │                  │  │
│   │  │  Shift light│  │  Raw PIDs   │  │  Alerts     │                  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                  │  │
│   │                                                                       │  │
│   │  Hooks: useWebSocket.js, useOBDData.js, useAlerts.js                 │  │
│   └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. OBD-II Data Acquisition

```
Vehicle ECU
    |
    |  CAN frames (ISO 15765-4)
    v
ELM327 Adapter
    |
    |  Serial / Bluetooth / WiFi TCP
    v
OBDConnector (core/obd/connector.py)
    |
    |  Uses python-obd library
    |  Auto-detects port: /dev/rfcomm0, /dev/ttyUSB0, 192.168.0.10:35000
    |  Retries 3x with exponential backoff
    |  Falls back to OBDSimulator on failure
    v
OBDResponse { pid_code, pid_name, value, unit, timestamp, is_simulated }
```

### 2. Tiered Polling Loop

The telemetry collector runs three concurrent polling loops to balance data freshness against OBD-II bus bandwidth:

| Tier     | Rate    | PIDs                                          | Purpose                    |
|----------|---------|-----------------------------------------------|----------------------------|
| Critical | 10 Hz   | RPM (0x0C), Speed (0x0D), Throttle (0x11), Torque (0x61, 0x62) | Core driving data          |
| Standard | 2 Hz    | Coolant temp, IAT, MAF, MAP, Fuel trims, O2, Oil temp, Timing | Engine health + algorithms |
| Slow     | 0.5 Hz  | Fuel level, Baro pressure, Battery, Ambient temp, Ref torque   | Slowly changing values     |

### 3. Processing Pipeline

```
Raw PID values (per-poll)
    |
    v
Processor: Normalize + smooth
    |  - EMA smoothing (alpha = 0.3) for noisy sensors
    |  - Unit normalization (always Celsius, km/h, kPa internally)
    |  - Timestamp alignment across tiers
    v
Snapshot dict { "pids": { "0x0C": 6420, "0x0D": 187, ... }, "timestamp": ... }
    |
    v
Algorithm dispatcher: runs all 8 modules
    |  Each module: calculate(snapshot, vehicle) -> dict
    |
    v
Merged result dict
    |  { "performance": {...}, "dynamics": {...}, "fuel": {...}, ... }
    |
    v
WebSocket broadcaster
    |  JSON frame every 100ms (10 Hz)
    v
All connected browser clients
```

### 4. WebSocket Frame Structure

Each frame sent to the dashboard contains the full telemetry snapshot:

```json
{
  "timestamp": 1700000000.123,
  "connection": {
    "connected": true,
    "port": "/dev/rfcomm0",
    "transport": "bluetooth",
    "using_simulator": false,
    "protocol": "ISO 15765-4 CAN (11-bit, 500 kbaud)"
  },
  "vehicle": {
    "id": "amg_c63_s",
    "name": "Mercedes-AMG C 63 S (W205)"
  },
  "pids": {
    "0x0C": { "value": 6420, "unit": "rpm", "name": "rpm" },
    "0x0D": { "value": 187, "unit": "km/h", "name": "speed" },
    "0x11": { "value": 94.2, "unit": "%", "name": "throttle_position" }
  },
  "algorithms": {
    "performance": {
      "estimated_power_kw": 347,
      "estimated_power_hp": 465,
      "estimated_torque_nm": 516,
      "torque_efficiency": 0.873,
      "power_delivery_score": 92.5
    },
    "dynamics": {
      "g_longitudinal": 0.42,
      "g_lateral": 0.87,
      "weight_transfer_front_kg": 124.5
    },
    "fuel": { "afr": 12.8, "afr_status": "optimal_race" },
    "braking": { "bpi": 0, "brake_fade_warning": false },
    "traction": { "slip_ratio": 0.02, "stability_state": "stable" },
    "thermal": { "risk_score": 0.42, "trend": "stable" },
    "shift_advisor": { "action": "hold", "optimal_shift_rpm": 6800 },
    "lap_timer": { "current_lap_time": 102.318, "delta_to_best": -0.412 }
  }
}
```

---

## Component Details

### Backend: core/obd/

| File             | Responsibility                                                  |
|------------------|-----------------------------------------------------------------|
| `connector.py`   | Async ELM327 connection manager with auto-detect and retry      |
| `pid_registry.py`| Mode 01 PID definitions with decode functions and poll priority |
| `protocols.py`   | Protocol definitions (CAN, KWP, ISO, J1850) and auto-detection |
| `simulator.py`   | Realistic OBD-II data generator for development                 |

### Backend: core/telemetry/

| File           | Responsibility                                          |
|----------------|---------------------------------------------------------|
| `collector.py` | Async tiered polling loop (critical/standard/slow)      |
| `processor.py` | EMA smoothing, unit normalization, timestamp alignment  |
| `logger.py`    | Session recording to JSON/CSV files                     |

### Backend: core/algorithms/

| Module             | Outputs                                                     |
|--------------------|-------------------------------------------------------------|
| `performance.py`   | Estimated power (kW/HP), torque (Nm), load, efficiency      |
| `dynamics.py`      | Longitudinal/lateral G-force, weight transfer               |
| `fuel.py`          | AFR, lambda, consumption (L/100km), range, pit window       |
| `braking.py`       | Deceleration, BPI, stopping distance, fade detection        |
| `traction.py`      | Slip ratio, stability state, ESP intervention               |
| `thermal.py`       | Risk score, trend analysis, overheat prediction             |
| `shift_advisor.py` | Optimal shift RPM, gear efficiency, missed shift counter    |
| `lap_timer.py`     | Lap/sector timing, delta to best, session management        |

All algorithm modules implement the same interface:

```python
def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    ...
```

### Backend: core/api/

| File               | Responsibility                                 |
|--------------------|-------------------------------------------------|
| `main.py`          | FastAPI application bootstrap and lifecycle     |
| `websocket.py`     | WebSocket endpoint and broadcast loop           |
| `routes/status.py` | GET /api/status -- connection and health info   |
| `routes/vehicle.py`| GET/PUT /api/vehicle -- profile management      |
| `routes/session.py`| Session start/stop/list/export endpoints        |

### Frontend: dashboard/src/

| Directory/File             | Responsibility                               |
|----------------------------|----------------------------------------------|
| `main.jsx`                 | React entry point                            |
| `App.jsx`                  | Root component, mode selector, theme provider|
| `hooks/useWebSocket.js`    | WebSocket connection with auto-reconnect     |
| `hooks/useOBDData.js`      | Telemetry state management and subscriptions |
| `hooks/useAlerts.js`       | Alert threshold detection and notification   |
| `layouts/RaceMode.jsx`     | Full-screen HUD layout                       |
| `layouts/TelemetryMode.jsx`| Engineer/analysis layout                     |
| `layouts/StreetMode.jsx`   | Daily-driver layout                          |
| `panels/`                  | Individual gauge and graph components        |
| `utils/`                   | Theme loader, unit formatters, math helpers  |

### Configuration: config/

| Directory    | Contents                                              |
|--------------|-------------------------------------------------------|
| `vehicles/`  | JSON vehicle profiles (engine, gearing, dimensions)   |
| `pid_maps/`  | Manufacturer-specific Mode 22 PID definitions         |
| `themes/`    | UI theme JSON files (colors, typography, effects)     |

---

## Technology Decisions

### Python + FastAPI (Backend)

- **Why Python**: The python-obd library is the most mature OBD-II library available. Python async/await integrates cleanly with concurrent polling loops. NumPy/SciPy provide efficient numerical computation for algorithm modules.
- **Why FastAPI**: Native async support, built-in WebSocket handling, automatic OpenAPI docs, and high performance via Uvicorn ASGI server.
- **Why not Node.js for the backend**: python-obd has no equivalent in the Node ecosystem. Serial port access is more reliable in Python on Linux.

### React + Vite + Tailwind (Frontend)

- **Why React 18**: Component model maps naturally to dashboard panels. Concurrent rendering handles high-frequency state updates without frame drops.
- **Why Vite**: Sub-second HMR for rapid UI iteration. No Webpack configuration overhead.
- **Why Tailwind CSS**: Utility-first approach allows rapid gauge styling without maintaining a separate CSS architecture. Dark theme support via CSS custom properties injected from theme JSON.
- **Why Recharts**: Lightweight charting library built on React components. Handles real-time streaming data with good performance.

### WebSocket (Data Transport)

- **Why WebSocket over HTTP polling**: 10 Hz telemetry requires persistent low-latency connections. WebSocket eliminates per-request overhead and provides server-push semantics.
- **Frame rate**: Fixed at 10 Hz (100ms intervals). Higher rates provide diminishing returns for human perception while increasing CPU load.

### JSON Configuration Files

- **Vehicle profiles**: JSON allows non-developers to create profiles by copying a template and filling in values from their vehicle specification sheet.
- **Themes**: JSON themes can be hot-reloaded without restarting the dashboard. The schema matches CSS custom property injection.
- **PID maps**: Manufacturer-specific PIDs are separated from the core registry to keep the codebase modular and allow community contributions.

### Tiered Polling Architecture

- **Why three tiers**: OBD-II bus bandwidth is limited. Polling all PIDs at 10 Hz would saturate the bus on older protocols (ISO 9141 at 10.4 kbaud). Critical PIDs (RPM, speed, throttle) need high frequency for responsive gauges. Slowly changing values (fuel level, ambient temp) waste bus time at high poll rates.
- **Adaptive rate**: The collector can downshift all tiers when bus congestion is detected (response timeouts increase).

---

## Hardware Requirements

### Minimum

| Component          | Requirement                                                   |
|--------------------|---------------------------------------------------------------|
| Computer           | Raspberry Pi 4 (2 GB RAM) or any Linux/macOS/Windows laptop  |
| OBD-II Adapter     | Any ELM327 v1.5+ compatible (Bluetooth, WiFi, or USB)        |
| Vehicle            | OBD-II compliant (1996+ US, 2001+ EU)                        |
| Display            | Any screen with a modern web browser                         |

### Recommended for Track Use

| Component          | Recommendation                                               |
|--------------------|---------------------------------------------------------------|
| Computer           | Raspberry Pi 5 (4 GB) or laptop with SSD                     |
| OBD-II Adapter     | OBDLink MX+ (Bluetooth) or OBDLink EX (USB)                  |
| Display            | 7-10 inch IPS touchscreen, 800x480 minimum                   |
| Mounting           | RAM mount or ProClip for dashboard/windshield                 |
| Power              | OBD-II splitter + USB power for Pi/display                   |
| Cooling            | Heatsink case for Pi (engine bay heat soak)                  |

### Network Topology

```
                     ┌────────────┐
                     │  Vehicle   │
                     │  OBD-II    │
                     │  Port      │
                     └──────┬─────┘
                            |
                     ┌──────v─────┐
                     │  ELM327    │
                     │  Adapter   │
                     └──────┬─────┘
                            |  Bluetooth / USB / WiFi
                     ┌──────v─────┐
                     │  Raspberry │
                     │  Pi / PC   │
                     │  (Backend) │
                     └──────┬─────┘
                            |  localhost:8000
                     ┌──────v─────┐
                     │  Browser   │
                     │  Dashboard │
                     │  (Frontend)│
                     └────────────┘
```

For multi-display setups (driver HUD + pit wall monitor), multiple browsers can connect to the same WebSocket endpoint. Each receives the same 10 Hz telemetry stream.

---

## Session Recording

Telemetry sessions are recorded to the `sessions/` directory:

```
sessions/
  2024-11-15_track_session_001/
    metadata.json       # Session info, vehicle, duration
    telemetry.json      # Full timestamped telemetry log
    telemetry.csv       # Flat CSV export for spreadsheet analysis
    summary.json        # Aggregated statistics (peak power, max G, etc.)
```

Session files can be replayed through the dashboard for post-session analysis. The CSV export is compatible with external tools like MoTeC i2, Race Studio 3, and custom Python/R analysis scripts.

---

## Security Considerations

- OBD-II is a read-only diagnostic interface in Mode 01. APEX CORTEX never sends write commands to the vehicle ECU.
- The WebSocket server binds to `localhost` by default. Exposing it on a network requires explicit configuration.
- No authentication is implemented. This is a single-user tool running on a local network. Do not expose the API to the public internet.
- Vehicle profiles and session data are stored as plain JSON files on disk. No database is used.
