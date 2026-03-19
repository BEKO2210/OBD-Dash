# APEX CORTEX

### *Every millisecond. Every molecule. Every edge.*

**Professional real-time racing dashboard for road-legal performance vehicles.**

APEX CORTEX transforms any OBD-II equipped performance car into a data-driven racing machine. Connect an ELM327 adapter, launch the dashboard, and get instant access to power estimates, G-force analysis, thermal risk scoring, optimal shift points, lap timing, and dozens more computed metrics -- all streaming live at 10 Hz.

Built for Mercedes-AMG, BMW M, Porsche GT, and Audi RS owners who want motorsport-grade telemetry without motorsport-grade budgets.

---

## Screenshots

> *Screenshots coming soon. The dashboard runs in three modes:*

| Mode | Description |
|------|-------------|
| **Race Mode** | Full-screen HUD with large RPM/speed, shift lights, G-force ball, and lap delta |
| **Telemetry Mode** | Engineer view with all gauges, graphs, algorithm outputs, and raw PID data |
| **Street Mode** | Clean daily-driver view with essential gauges and alert notifications |

```
┌──────────────────────────────────────────────────────────────────────┐
│  APEX CORTEX  |  RACE MODE  |  AMG C63 S  |  Session: 00:14:32     │
├──────────┬───────────┬───────────┬───────────────────────────────────┤
│          │           │           │                                   │
│   RPM    │   SPEED   │  THROTTLE │          G-FORCE PLOT             │
│  6,420   │  187 kph  │   94.2%   │            [graph]               │
│          │           │           │                                   │
├──────────┴───────────┴───────────┼───────────────────────────────────┤
│  POWER: 347 kW / 465 HP         │  SHIFT ▲  7th → optimal @ 6800   │
│  TORQUE EFF: 87.3%              │  BRAKE FADE: OK                   │
│  THERMAL RISK: 0.42 (nominal)   │  TRACTION: stable                 │
│  FUEL: 34.2L remaining          │  LAP: 1:42.318  DELTA: -0.412     │
└──────────────────────────────────┴───────────────────────────────────┘
```

---

## Features

### Real-Time OBD-II Telemetry
- Tiered PID polling: critical data at 10 Hz, standard at 2 Hz, slow at 0.5 Hz
- Automatic ELM327 adapter detection (Bluetooth, WiFi, USB)
- Support for ISO 15765 CAN, ISO 14230 KWP2000, ISO 9141, and SAE J1850 protocols
- Mode 22 extended PID support for manufacturer-specific data
- CAN-Bus direct access via SocketCAN on Linux

### Algorithm Engine (8 Modules)
- **Performance** -- estimated power (kW/HP), torque, engine load analysis
- **Dynamics** -- 3-axis G-force, weight transfer, yaw rate estimation
- **Fuel** -- air-fuel ratio, lambda, consumption (L/100km), range, pit window
- **Braking** -- brake pressure index, stopping distance, fade detection
- **Traction** -- slip ratio, stability state, ESP intervention detection
- **Thermal** -- thermal risk score, trend analysis, overheat prediction
- **Shift Advisor** -- optimal shift RPM, gear efficiency, missed shift counter
- **Lap Timer** -- lap/sector timing, delta to best, session management

### Dashboard UI
- Three display modes: Race, Telemetry, and Street
- Built with React 18, Vite, Tailwind CSS, and Recharts
- Live WebSocket connection with automatic reconnection
- Responsive layout for laptops, tablets, and mounted displays
- Customizable themes via JSON configuration

### Vehicle Profile System
- Pre-configured profiles for AMG C63 S, BMW M3 Competition, and Porsche 911 GT3 RS
- JSON-based vehicle profiles with full drivetrain specifications
- Template file for easy creation of new profiles
- Gear ratios, weight distribution, redline, and manufacturer PID maps

### Session Recording
- Record full telemetry sessions to JSON/CSV
- Session playback and analysis
- Export for external analysis tools

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- An ELM327-compatible OBD-II adapter (optional -- simulator mode works without hardware)

### Backend

```bash
# Clone the repository
git clone https://github.com/your-org/apex-cortex.git
cd apex-cortex

# Create a Python virtual environment
python -m venv venv
source venv/bin/activate    # Linux/macOS
# venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Start the backend (simulator mode by default)
python -m core.api.main
```

The API server starts at `http://localhost:8000`. WebSocket telemetry streams at `ws://localhost:8000/ws`.

### Frontend

```bash
# In a separate terminal
cd dashboard
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. The dashboard connects to the backend WebSocket automatically.

### Verify It Works

1. Start the backend -- you should see `Telemetry polling started` in the console
2. Start the frontend -- the Vite dev server opens at port 5173
3. The dashboard should display simulated data (RPM climbing, speed changing, temperatures fluctuating)
4. Switch between Race, Telemetry, and Street modes using the mode selector

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                       APEX CORTEX                           │
│                                                             │
│  ┌──────────┐   ┌──────────┐   ┌────────────────────────┐  │
│  │ Vehicle   │──>│ ELM327   │──>│ core/obd/connector.py  │  │
│  │ OBD-II    │   │ Adapter  │   │ (python-obd)           │  │
│  └──────────┘   └──────────┘   └──────────┬─────────────┘  │
│                                            │                │
│                                ┌───────────v────────────┐   │
│                                │ core/telemetry/        │   │
│                                │ collector.py           │   │
│                                │ (async tiered polling) │   │
│                                └───────────┬────────────┘   │
│                                            │                │
│                                ┌───────────v────────────┐   │
│                                │ core/telemetry/        │   │
│                                │ processor.py           │   │
│                                │ (normalize + smooth)   │   │
│                                └───────────┬────────────┘   │
│                                            │                │
│                                ┌───────────v────────────┐   │
│                                │ core/algorithms/*      │   │
│                                │ (8 computation modules)│   │
│                                └───────────┬────────────┘   │
│                                            │                │
│  ┌────────────────────────┐    ┌───────────v────────────┐   │
│  │ dashboard/src/         │<───│ core/api/websocket.py  │   │
│  │ React + Vite + Tailwind│ WS │ (FastAPI + WebSocket)  │   │
│  │                        │10Hz│                        │   │
│  └────────────────────────┘    └────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

For the full architecture document with data flow diagrams, technology decisions, and component descriptions, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Supported Vehicles

APEX CORTEX works with any OBD-II compliant vehicle (1996+ in the US, 2001+ in the EU). Pre-built profiles are included for:

| Vehicle | Profile ID | Engine | Power |
|---------|-----------|--------|-------|
| Mercedes-AMG C 63 S (W205) | `amg_c63_s` | 4.0L V8 Twin-Turbo | 375 kW / 510 HP |
| BMW M3 Competition (G80) | `bmw_m3_g80` | 3.0L I6 Twin-Turbo | 375 kW / 510 HP |
| Porsche 911 GT3 RS (992) | `porsche_911_gt3_rs` | 4.0L Flat-6 NA | 386 kW / 525 HP |

To add your own vehicle, copy `config/vehicles/template.json` and fill in your car's specifications. See [docs/SETUP.md](docs/SETUP.md) for a step-by-step guide.

---

## Development Mode (Simulator)

No car? No adapter? No problem. APEX CORTEX includes a full OBD-II simulator that generates realistic telemetry data.

```bash
# Start backend with simulator (default behavior)
SIMULATOR_MODE=true python -m core.api.main

# Run the simulator standalone with a specific vehicle and driving mode
python core/obd/simulator.py --profile amg_c63_s --mode track_session
```

### Simulator Modes

| Mode | Description |
|------|-------------|
| `idle` | Engine idling at ~700 RPM, stable temperatures |
| `street` | Normal street driving with varying speed and load |
| `track_session` | Aggressive track driving with high RPM, braking zones, cornering forces |
| `launch_control` | Full-throttle launch simulation with traction events |

The simulator respects the selected vehicle profile, so RPM ranges, gear ratios, and power curves match the configured car.

---

## Project Structure

```
OBD-Dash/
├── CLAUDE.md                    # AI context document
├── README.md                    # This file
├── requirements.txt             # Python dependencies
├── package.json                 # Root workspace config
├── config/
│   ├── vehicles/                # Vehicle profile JSONs
│   │   ├── template.json
│   │   ├── amg_c63_s.json
│   │   ├── bmw_m3_g80.json
│   │   └── porsche_911_gt3_rs.json
│   ├── pid_maps/                # Manufacturer-specific PID maps
│   └── themes/                  # UI theme configurations
├── core/
│   ├── __init__.py
│   ├── obd/
│   │   ├── connector.py         # ELM327 connection manager
│   │   ├── pid_registry.py      # PID definitions + decoders
│   │   ├── protocols.py         # OBD protocol handlers
│   │   └── simulator.py         # Development data generator
│   ├── telemetry/
│   │   ├── collector.py         # Async tiered polling loop
│   │   ├── processor.py         # Data normalization + smoothing
│   │   └── logger.py            # Session recording
│   ├── algorithms/
│   │   ├── __init__.py          # Algorithm registry + dispatcher
│   │   ├── performance.py       # Power, torque, load
│   │   ├── dynamics.py          # G-force, weight transfer, yaw
│   │   ├── fuel.py              # AFR, consumption, range
│   │   ├── braking.py           # BPI, stopping distance, fade
│   │   ├── traction.py          # Slip ratio, stability, ESP
│   │   ├── thermal.py           # Thermal risk, trend, prediction
│   │   ├── shift_advisor.py     # Shift points, gear efficiency
│   │   └── lap_timer.py         # Lap/sector timing, delta
│   └── api/
│       ├── main.py              # FastAPI application
│       ├── websocket.py         # WebSocket broadcaster
│       └── routes/
│           ├── session.py       # Session management endpoints
│           ├── vehicle.py       # Vehicle profile endpoints
│           └── status.py        # Connection status endpoints
├── dashboard/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── hooks/
│       │   ├── useWebSocket.js
│       │   ├── useOBDData.js
│       │   └── useAlerts.js
│       ├── layouts/
│       │   ├── RaceMode.jsx
│       │   ├── TelemetryMode.jsx
│       │   └── StreetMode.jsx
│       ├── panels/              # Individual dashboard panels
│       └── utils/               # Helper utilities
├── sessions/                    # Recorded telemetry sessions
└── docs/
    ├── ARCHITECTURE.md
    ├── OBD_PROTOCOLS.md
    ├── ALGORITHMS.md
    └── SETUP.md
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture, data flow, technology decisions |
| [OBD-II Protocols](docs/OBD_PROTOCOLS.md) | Complete PID reference, protocol guide, ELM327 setup |
| [Algorithms](docs/ALGORITHMS.md) | All algorithm formulas, inputs, outputs, and limitations |
| [Setup Guide](docs/SETUP.md) | Hardware recommendations, installation, first run |

---

## Contributing

Contributions are welcome. Here is how to get started:

1. **Fork** the repository and create a feature branch from `main`
2. **Read** `CLAUDE.md` for the full project context and coding conventions
3. **Set up** your development environment using the simulator (see [docs/SETUP.md](docs/SETUP.md))
4. **Test** your changes with all three dashboard modes (Race, Telemetry, Street)
5. **Submit** a pull request with a clear description of what you changed and why

### Development Guidelines

- All OBD reads must be non-blocking -- never block the async polling loop
- Every algorithm must handle `None` values gracefully (PIDs may be unavailable)
- Temperatures internally in Celsius, speed in km/h, power in kW -- convert only for display
- WebSocket must continue broadcasting even with partial data
- New algorithms follow the `calculate(snapshot, vehicle) -> dict` interface
- New panels import `useOBDData` and subscribe to relevant data keys

### Adding a New Algorithm

1. Create `core/algorithms/your_module.py`
2. Implement `calculate(snapshot: dict, vehicle: dict) -> dict`
3. Register in `core/algorithms/__init__.py`
4. Document in `docs/ALGORITHMS.md`

### Adding a New Vehicle Profile

1. Copy `config/vehicles/template.json` to `config/vehicles/your_car.json`
2. Fill in all specifications (engine, transmission, dimensions, etc.)
3. Set the `manufacturer_pid_map` if your car supports extended PIDs

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Backend | Python | 3.11+ |
| API Framework | FastAPI | 0.110+ |
| ASGI Server | Uvicorn | 0.27+ |
| OBD Library | python-obd | 0.7+ |
| CAN Bus | python-can | 4.3+ |
| Numerical | NumPy, SciPy | 1.26+, 1.12+ |
| Frontend | React | 18.3 |
| Build Tool | Vite | 6.0 |
| Styling | Tailwind CSS | 3.4 |
| Charts | Recharts | 2.15 |
| Icons | Lucide React | 0.468 |

---

## License

MIT License

Copyright (c) 2024 Belkis Aslani

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
