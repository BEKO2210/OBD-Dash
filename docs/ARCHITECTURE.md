# APEX CORTEX™ — System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      APEX CORTEX™ v0.1.0                        │
│                                                                  │
│  ┌──────────┐   ┌──────────┐   ┌────────────────────────────┐  │
│  │ Vehicle   │──▶│ ELM327   │──▶│ core/obd/connector.py      │  │
│  │ OBD-II    │   │ Adapter  │   │ (python-obd / simulator)   │  │
│  │ Port      │   │ BT/WiFi/ │   └─────────────┬──────────────┘  │
│  └──────────┘   │ USB      │                   │                 │
│                  └──────────┘                   ▼                 │
│                                    ┌────────────────────────┐    │
│                                    │ core/telemetry/        │    │
│                                    │ collector.py           │    │
│                                    │ (async polling loop)   │    │
│                                    │ 10Hz/2Hz/0.5Hz         │    │
│                                    └───────────┬────────────┘    │
│                                                │                 │
│                                    ┌───────────▼────────────┐    │
│                                    │ core/telemetry/        │    │
│                                    │ processor.py           │    │
│                                    │ (normalize + smooth)   │    │
│                                    └───────────┬────────────┘    │
│                                                │                 │
│                                    ┌───────────▼────────────┐    │
│                                    │ core/algorithms/       │    │
│                                    │ ├─ performance.py      │    │
│                                    │ ├─ dynamics.py         │    │
│                                    │ ├─ fuel.py             │    │
│                                    │ ├─ braking.py          │    │
│                                    │ ├─ traction.py         │    │
│                                    │ ├─ thermal.py          │    │
│                                    │ ├─ shift_advisor.py    │    │
│                                    │ └─ lap_timer.py        │    │
│                                    └───────────┬────────────┘    │
│                                                │                 │
│  ┌────────────────────────┐  WS   ┌───────────▼────────────┐    │
│  │ dashboard/src/         │◀──────│ core/api/              │    │
│  │ React + Vite +         │ 10Hz  │ main.py (FastAPI)      │    │
│  │ Tailwind               │ JSON  │ websocket.py           │    │
│  │                        │       │ routes/                │    │
│  │ ├─ layouts/            │       └────────────────────────┘    │
│  │ │  ├─ RaceMode.jsx     │                                     │
│  │ │  ├─ TelemetryMode    │       ┌────────────────────────┐    │
│  │ │  └─ StreetMode       │       │ core/telemetry/        │    │
│  │ ├─ panels/ (14 panels) │       │ logger.py              │    │
│  │ ├─ hooks/              │       │ → sessions/*.json      │    │
│  │ └─ utils/              │       └────────────────────────┘    │
│  └────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

```
Vehicle OBD-II Port
  → ELM327 Adapter (Bluetooth / WiFi / USB)
  → core/obd/connector.py (python-obd library)
  → core/telemetry/collector.py (async polling: 10Hz critical, 2Hz standard, 0.5Hz slow)
  → core/telemetry/processor.py (normalization, unit conversion, EMA smoothing)
  → core/algorithms/* (8 algorithm modules compute derived metrics)
  → core/api/websocket.py (broadcasts JSON snapshot at ~10Hz)
  → dashboard/src/hooks/useWebSocket.js (React receives + parses)
  → dashboard/src/panels/* (live UI update via React state)
```

## Technology Stack

### Backend (Python 3.11+)

| Technology | Purpose | Why |
|---|---|---|
| **FastAPI** | REST API + WebSocket server | Native async support, automatic OpenAPI docs, high performance |
| **python-obd** | ELM327 OBD-II communication | Most mature Python OBD library, supports all standard protocols |
| **asyncio** | Async polling and broadcasting | Non-blocking I/O for real-time data collection |
| **NumPy** | Numerical computations | Fast array operations for algorithm calculations |
| **SciPy** | Statistical functions | Linear regression for trend analysis (thermal prediction) |
| **Pydantic** | Data validation | Request/response models, config validation |
| **uvicorn** | ASGI server | Production-grade async server for FastAPI |

### Frontend (React + Vite)

| Technology | Purpose | Why |
|---|---|---|
| **React 18** | UI framework | Component-based, efficient re-rendering for real-time data |
| **Vite** | Build tool | Fast HMR, instant server start, optimized builds |
| **Tailwind CSS** | Styling | Utility-first, rapid UI development, small bundle |
| **Recharts** | Data visualization | React-native charting, responsive, customizable |
| **lucide-react** | Icons | Lightweight, consistent icon set |

### Communication

| Protocol | Endpoint | Rate | Purpose |
|---|---|---|---|
| **WebSocket** | `/ws/telemetry` | ~10Hz | Real-time telemetry broadcast |
| **REST** | `/api/*` | On demand | Session management, vehicle profiles, status |

## Hardware Requirements

### ELM327 OBD-II Adapter
- **Minimum**: ELM327 v1.5 compatible (Bluetooth or WiFi)
- **Recommended**: OBDLink MX+ or BAFX Products 34t5 (genuine ELM327 chip)
- **For CAN-Bus direct**: SocketCAN compatible adapter (Linux only)

### Host System
- **CPU**: Any modern multi-core processor
- **RAM**: 2GB minimum (4GB recommended)
- **OS**: Linux (recommended), macOS, Windows
- **Python**: 3.11 or newer
- **Node.js**: 18 or newer

## Security Considerations

- OBD-II access is **read-only** — the system never sends write commands to the vehicle
- WebSocket connections are local only (localhost by default)
- No authentication required for local development
- Session data stored locally in `sessions/` directory
- No telemetry or data is sent to external servers
