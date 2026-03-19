# APEX CORTEX -- Setup Guide

## Prerequisites

| Requirement | Minimum Version | Notes |
|------------|----------------|-------|
| Python | 3.11+ | 3.12 recommended |
| Node.js | 18+ | 20 LTS recommended |
| npm | 9+ | Comes with Node.js |
| Git | 2.30+ | For cloning the repository |

### Optional (for real vehicle connection)

| Hardware | Purpose |
|----------|---------|
| ELM327-compatible OBD-II adapter | Connects to the vehicle (Bluetooth, WiFi, or USB) |
| OBD-II to DB9 cable | Some adapters require a separate cable |
| Laptop/Raspberry Pi | Runs the dashboard in the vehicle |

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/apex-cortex.git
cd apex-cortex
```

### 2. Backend Setup

```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate        # Linux / macOS
# venv\Scripts\activate         # Windows

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Environment Configuration

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your settings:

```ini
# Connection mode: "true" for simulator, "false" for real OBD adapter
SIMULATOR_MODE=true

# Vehicle profile (filename stem from config/vehicles/)
VEHICLE_PROFILE=bmw_m3_g80

# OBD adapter settings (only needed when SIMULATOR_MODE=false)
OBD_PORT=auto                   # auto, /dev/rfcomm0, /dev/ttyUSB0, or IP:port
OBD_PROTOCOL=auto               # auto, or force a specific protocol
OBD_BAUDRATE=38400               # Usually 38400 for ELM327

# API server
API_HOST=0.0.0.0
API_PORT=8000

# Simulator settings
SIMULATOR_PROFILE=bmw_m3_g80    # Which vehicle to simulate

# Session recording
SESSION_SAVE_PATH=sessions
```

### 4. Frontend Setup

```bash
cd dashboard
npm install
cd ..
```

---

## Running the Application

### Development Mode (Simulator)

No vehicle or adapter needed. The simulator generates realistic telemetry data.

**Terminal 1 -- Backend:**

```bash
source venv/bin/activate
python -m core.api.main
```

You should see:

```
APEX CORTEX API ready  |  simulator=True  |  vehicle=bmw_m3_g80  |  algorithms=8
```

**Terminal 2 -- Frontend:**

```bash
cd dashboard
npm run dev
```

Open `http://localhost:5173` in your browser. The dashboard should display live simulated data.

### Production Mode (Real Vehicle)

1. Plug the ELM327 adapter into the vehicle's OBD-II port (usually under the dashboard on the driver's side).
2. Connect the adapter to your computer (pair Bluetooth, connect WiFi, or plug in USB).
3. Edit `.env`:

```ini
SIMULATOR_MODE=false
OBD_PORT=/dev/rfcomm0          # or your adapter's port
VEHICLE_PROFILE=your_car       # must match a file in config/vehicles/
```

4. Start the backend and frontend as above.

---

## Running the Simulator Standalone

The simulator can run independently for testing and development:

```bash
# Default: street driving with default vehicle
python -m core.obd.simulator

# Track session with a specific vehicle
python -m core.obd.simulator --mode track --profile bmw_m3_g80

# Idle mode
python -m core.obd.simulator --mode idle

# Launch control simulation
python -m core.obd.simulator --mode launch --profile porsche_911_gt3_rs
```

### Simulator Modes

| Mode | Behavior |
|------|----------|
| `idle` | Engine idling at ~700 RPM. Temperatures gradually warm up. No movement. |
| `street` | Normal driving with varying speed (0--80 km/h), traffic stops, moderate RPMs. |
| `track` | Aggressive driving: full-throttle straights, hard braking zones, high-G cornering. RPMs near redline. |
| `launch` | Standing-start launch simulation. Rev build-up, clutch drop, rapid acceleration through gears. |

---

## Creating a Vehicle Profile

1. Copy the template:

```bash
cp config/vehicles/template.json config/vehicles/my_car.json
```

2. Fill in your vehicle's specifications. Key fields:

```json
{
  "id": "my_car",
  "make": "YourMake",
  "model": "YourModel",
  "year": 2024,
  "engine": {
    "engine_cc": 2000,
    "cylinders": 4,
    "displacement_l": 2.0,
    "fuel_type": "gasoline",
    "turbo": true,
    "redline_rpm": 7000,
    "idle_rpm": 750,
    "shift_recommend_rpm": 6500,
    "max_power_kw": 200,
    "max_power_rpm": 5500,
    "max_torque_nm": 400,
    "max_torque_rpm": 3000
  },
  "transmission": {
    "gears": 6,
    "gear_ratios": [3.83, 2.36, 1.69, 1.31, 1.06, 0.87],
    "final_drive": 3.15
  },
  "dimensions": {
    "curb_weight_kg": 1500,
    "wheelbase_m": 2.70,
    "track_width_m": 1.55,
    "cg_height_m": 0.45
  },
  "wheels": {
    "tire_circumference_mm": 2000
  },
  "fuel": {
    "fuel_tank_liters": 55
  }
}
```

3. Set `VEHICLE_PROFILE=my_car` in `.env`.

### Where to Find Your Car's Specs

- **Gear ratios and final drive**: Owner's manual, manufacturer technical data, or community forums (e.g., bimmerpost.com, mbworld.org).
- **Curb weight**: Door jamb sticker or registration documents.
- **Tire circumference**: Measure directly, or calculate from tire size (e.g., 255/35R19 = ~2040mm).
- **Redline RPM**: Tachometer markings.
- **Power/Torque**: Manufacturer specs (use crank figures, not wheel).

---

## Dashboard Modes

### Race Mode

Full-screen HUD layout optimized for track use. Large central speed display, shift indicator with LED lights, G-force ball, and lap timer. Minimal distractions.

### Telemetry Mode

Engineer view showing all available panels in a scrollable grid. Includes gauges, charts, algorithm outputs, and session statistics. Best for setup, data review, and debugging.

### Street Mode

Clean daily-driver layout with just speed, RPM, coolant temperature, and fuel level. Designed for regular road use without visual overload.

Switch modes using the mode selector in the top navigation bar.

---

## Troubleshooting

### Backend will not start

| Symptom | Fix |
|---------|-----|
| `ModuleNotFoundError: No module named 'obd'` | Run `pip install -r requirements.txt` inside your virtual environment. |
| `ModuleNotFoundError: No module named 'core'` | Run from the project root directory, not from inside `core/`. |
| Port 8000 already in use | Change `API_PORT` in `.env` or stop the other process. |

### Frontend will not connect

| Symptom | Fix |
|---------|-----|
| "WebSocket connection failed" | Ensure the backend is running on port 8000. Check browser console for CORS errors. |
| Dashboard shows `--` for all values | Backend might not have data. Check backend console for errors. |
| Dashboard loads but no data updates | WebSocket may have disconnected. Refresh the page. |

### OBD Connection Issues

| Symptom | Fix |
|---------|-----|
| "No OBD adapter found" | Check adapter power and connection. See [OBD_PROTOCOLS.md](OBD_PROTOCOLS.md) for setup instructions. |
| Data is slow or intermittent | Use a quality adapter (OBDLink MX+). Cheap clones often cannot sustain 10Hz polling. |
| Wrong data values | Verify the vehicle profile matches your car. Check gear ratios and tire size. |

---

## Recommended Hardware Setup for Track Use

### Basic Setup

- Laptop with the dashboard running in fullscreen (Race Mode)
- OBDLink MX+ Bluetooth adapter
- RAM mount or tablet holder for the dashboard
- 12V car charger for the laptop

### Advanced Setup

- Raspberry Pi 4 (4GB+) with official touchscreen
- OBDLink EX (USB) for lowest latency
- 3D-printed dashboard mount
- External GPS module for more accurate lap timing (USB, outputting NMEA sentences)

### Display Recommendations

- Minimum 10" display for Race Mode
- 13"+ display for Telemetry Mode
- Brightness of 400+ nits for daylight visibility
- Anti-glare screen protector for outdoor use
