# APEX CORTEX -- Setup Guide

## Hardware Recommendations

### OBD-II Adapter Selection

An ELM327-compatible adapter is required to connect APEX CORTEX to your vehicle. The adapter plugs into the vehicle's OBD-II port (usually located under the dashboard on the driver's side) and communicates with the backend software via Bluetooth, USB, or WiFi.

#### Recommended Adapters

| Adapter              | Interface  | CAN Support | Polling Speed | Track Use | Price  |
|----------------------|------------|-------------|---------------|-----------|--------|
| **OBDLink MX+**      | Bluetooth  | Yes         | Fast          | Best      | ~$100  |
| **OBDLink EX**       | USB        | Yes         | Fastest       | Best      | ~$70   |
| **OBDLink LX**       | Bluetooth  | Yes         | Fast          | Good      | ~$80   |
| **Veepeak BLE+**     | BLE        | Yes         | Moderate      | Adequate  | ~$30   |
| **Generic ELM327**   | Bluetooth  | Partial     | Slow          | Not Ideal | ~$15   |

**For track use**, the OBDLink MX+ or EX is strongly recommended. Generic ELM327 adapters often use counterfeit chips with limited protocol support, slower response times, and connection stability issues under high polling rates.

#### Adapter Placement

- Plug the adapter into the OBD-II port before starting the vehicle
- Ensure the adapter LED indicates power (usually solid blue or green)
- For track use, secure the adapter with a zip tie or Velcro to prevent it from disconnecting during hard cornering or braking
- Some adapters protrude significantly from the OBD-II port; use a short OBD-II extension cable if the adapter interferes with pedal area

### Computer / Host Device

| Device                | Suitability | Notes                                          |
|-----------------------|-------------|-------------------------------------------------|
| **Raspberry Pi 5**    | Best        | Compact, low power, GPIO for future sensors     |
| **Raspberry Pi 4**    | Good        | 2 GB RAM minimum, 4 GB recommended              |
| **Linux Laptop**      | Great       | Best for development and debugging              |
| **MacBook**           | Good        | USB or WiFi adapter only (no rfcomm on macOS)   |
| **Windows Laptop**    | Adequate    | COM port setup required for Bluetooth adapters  |

### Display Options

| Display                          | Resolution | Interface | Notes                           |
|----------------------------------|------------|-----------|---------------------------------|
| Official Raspberry Pi 7" Touch   | 800x480    | DSI       | Compact, touchscreen, low cost  |
| Waveshare 10.1" IPS             | 1280x800   | HDMI      | Larger, better viewing angle    |
| Laptop screen                   | Any        | Built-in  | Simplest setup                  |
| Tablet (browser)                | Any        | WiFi      | Connect to backend over network |
| Phone (browser)                 | Any        | WiFi      | Emergency fallback              |

### Mounting Hardware

For track use, secure mounting is essential:

- **RAM Mount X-Grip**: Universal phone/tablet holder with suction cup or bolt mount
- **ProClip**: Vehicle-specific mounting brackets (available for most performance cars)
- **3D Printed bracket**: Custom-fit for Raspberry Pi + touchscreen enclosures

### Power Supply

- **OBD-II power**: The adapter draws power from the OBD-II port (12V vehicle power)
- **Host device power**: Use a high-quality USB-C car charger (at least 3A for Raspberry Pi 5)
- **Display power**: Most touchscreens can be powered from the Pi's USB ports
- **UPS hat** (optional): A battery-backed UPS HAT for Raspberry Pi prevents data corruption from sudden power loss when the ignition is turned off

---

## Software Prerequisites

### Python Backend

| Requirement     | Minimum Version | Recommended        |
|-----------------|-----------------|---------------------|
| Python          | 3.11            | 3.12+              |
| pip             | 23.0            | Latest              |
| git             | 2.0             | Latest              |

### Frontend Dashboard

| Requirement     | Minimum Version | Recommended        |
|-----------------|-----------------|---------------------|
| Node.js         | 18.0            | 20 LTS or 22 LTS  |
| npm             | 9.0             | Latest              |

### Linux-Specific (for Bluetooth)

| Package          | Purpose                              |
|------------------|--------------------------------------|
| `bluez`          | Bluetooth protocol stack             |
| `rfcomm`         | Serial port binding for BT adapters  |
| `python3-dev`    | Required for python-obd compilation  |
| `libbluetooth-dev`| Bluetooth development headers       |

Install on Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y bluez rfcomm python3-dev libbluetooth-dev
```

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/apex-cortex.git
cd apex-cortex
```

### Step 2: Set Up the Python Backend

```bash
# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

The `requirements.txt` includes:
- `fastapi` -- API framework
- `uvicorn[standard]` -- ASGI server
- `python-obd` -- OBD-II communication
- `python-can` -- CAN-Bus direct access (optional)
- `numpy` -- Numerical computations
- `scipy` -- Signal processing and smoothing
- `websockets` -- WebSocket support

### Step 3: Set Up the Frontend Dashboard

```bash
cd dashboard
npm install
cd ..
```

### Step 4: Environment Configuration

```bash
# Copy the environment template
cp .env.example .env
```

Edit `.env` to configure:

```bash
# OBD Connection
OBD_PORT=auto                   # auto, /dev/rfcomm0, /dev/ttyUSB0, or IP:port
OBD_PROTOCOL=auto               # auto, or 1-9 for specific protocol
OBD_BAUDRATE=auto               # auto, or specific baud rate

# Simulator
SIMULATOR_MODE=true              # true = start in simulator mode
SIMULATOR_PROFILE=amg_c63_s      # Vehicle profile for simulator
SIMULATOR_DRIVE_MODE=track_session  # idle, street, track_session, launch_control

# API Server
API_HOST=127.0.0.1
API_PORT=8000

# Telemetry
TELEMETRY_CRITICAL_HZ=10        # Critical PID polling rate
TELEMETRY_STANDARD_HZ=2         # Standard PID polling rate
TELEMETRY_SLOW_HZ=0.5           # Slow PID polling rate

# Session Recording
RECORD_SESSIONS=true             # Automatically record telemetry sessions
SESSION_DIR=sessions             # Directory for session files
```

---

## First Run

### Simulator Mode (No Hardware Required)

Start the backend and frontend in separate terminals:

**Terminal 1 -- Backend:**
```bash
source venv/bin/activate
python -m core.api.main
```

Expected output:
```
INFO:     APEX CORTEX starting...
INFO:     Vehicle profile loaded: amg_c63_s
INFO:     Simulator activated as fallback
INFO:     Telemetry polling started (critical=10Hz, standard=2Hz, slow=0.5Hz)
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**Terminal 2 -- Frontend:**
```bash
cd dashboard
npm run dev
```

Expected output:
```
  VITE v6.x.x  ready in XXXms

  > Local:   http://localhost:5173/
  > Network: use --host to expose
```

**Open your browser** to `http://localhost:5173`. You should see:

1. The APEX CORTEX dashboard with simulated data
2. RPM gauge climbing and falling as the simulator runs
3. Speed, throttle, and temperature gauges updating in real-time
4. Algorithm outputs (power, G-force, fuel) computing from simulated data
5. A "SIMULATOR" indicator showing that no real vehicle is connected

### Switching Simulator Modes

The simulator supports four driving modes:

```bash
# Idle -- engine idling, stable temps
SIMULATOR_DRIVE_MODE=idle python -m core.api.main

# Street -- casual driving
SIMULATOR_DRIVE_MODE=street python -m core.api.main

# Track session -- aggressive driving with braking zones and cornering
SIMULATOR_DRIVE_MODE=track_session python -m core.api.main

# Launch control -- full-throttle standing start
SIMULATOR_DRIVE_MODE=launch_control python -m core.api.main
```

### Hardware Mode (Real Vehicle)

1. **Plug in the OBD-II adapter** to your vehicle
2. **Turn the ignition to ON** (engine running or just accessories for basic tests)
3. **Pair Bluetooth** (if using Bluetooth adapter):
   ```bash
   bluetoothctl scan on
   # Find your adapter (usually named "OBDLink", "OBDII", or "Vlink")
   bluetoothctl pair XX:XX:XX:XX:XX:XX
   bluetoothctl trust XX:XX:XX:XX:XX:XX
   sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX
   ```
4. **Configure the port** in `.env`:
   ```bash
   OBD_PORT=/dev/rfcomm0          # Bluetooth
   # OBD_PORT=/dev/ttyUSB0        # USB
   # OBD_PORT=192.168.0.10:35000  # WiFi
   SIMULATOR_MODE=false
   ```
5. **Start the backend**:
   ```bash
   source venv/bin/activate
   python -m core.api.main
   ```
6. **Check connection**: The console should show:
   ```
   INFO:     Connected to /dev/rfcomm0 via bluetooth (protocol: ISO 15765-4 CAN)
   INFO:     Telemetry polling started
   ```

---

## Vehicle Profile Creation

Vehicle profiles define the physical characteristics of your car, enabling algorithms to produce accurate results.

### Step 1: Copy the Template

```bash
cp config/vehicles/template.json config/vehicles/your_car.json
```

### Step 2: Fill In Specifications

Open `config/vehicles/your_car.json` and fill in all fields. Here is a guide to each section:

#### Identification

```json
{
  "id": "your_car_id",
  "name": "Make Model Variant (Generation)",
  "manufacturer": "make",
  "year": 2024
}
```

The `manufacturer` field is used for protocol detection hints and extended PID map selection.

#### Engine

```json
{
  "engine": {
    "displacement_cc": 3982,
    "cylinders": 6,
    "configuration": "flat-6",
    "aspiration": "naturally_aspirated",
    "max_power_kw": 386,
    "max_power_rpm": 8500,
    "max_torque_nm": 465,
    "max_torque_rpm": 6300,
    "redline_rpm": 9000,
    "idle_rpm": 700
  }
}
```

Where to find this data: vehicle owner's manual, manufacturer's press kit, or automotive databases.

#### Transmission

```json
{
  "transmission": {
    "type": "dual_clutch",
    "gears": 7,
    "gear_ratios": [3.91, 2.29, 1.58, 1.19, 0.97, 0.82, 0.68],
    "final_drive_ratio": 3.44,
    "reverse_ratio": 3.55
  }
}
```

Gear ratios can be found in the vehicle's technical specifications or service manual.

#### Dimensions and Weight

```json
{
  "dimensions": {
    "curb_weight_kg": 1435,
    "wheelbase_m": 2.457,
    "track_width_front_m": 1.587,
    "track_width_rear_m": 1.557,
    "cg_height_m": 0.46,
    "weight_distribution_front": 0.38
  }
}
```

Center of gravity height is typically not published. Estimates: sports cars 0.40--0.50m, sedans 0.50--0.55m, SUVs 0.60--0.70m.

#### Tires

```json
{
  "tires": {
    "front": "265/35ZR20",
    "rear": "325/30ZR21",
    "tire_diameter_m": 0.684
  }
}
```

Tire diameter can be calculated from the tire size: `diameter = (2 * (width_mm * aspect_ratio / 100) + rim_diameter_inches * 25.4) / 1000`

#### Fuel

```json
{
  "fuel": {
    "type": "gasoline",
    "fuel_tank_liters": 64,
    "fuel_density_g_l": 750
  }
}
```

#### Thermal Thresholds

```json
{
  "thermal": {
    "coolant_temp_normal": 90,
    "coolant_temp_warning": 110,
    "oil_temp_normal": 100,
    "oil_temp_warning": 130
  }
}
```

#### Performance Reference

```json
{
  "performance": {
    "max_power_kw": 386,
    "optimal_shift_rpm": 8500,
    "power_band_start_rpm": 6500,
    "power_band_end_rpm": 8900
  }
}
```

#### Extended PID Map (Optional)

```json
{
  "manufacturer_pid_map": "porsche"
}
```

This links to the corresponding file in `config/pid_maps/`. Set to `null` or omit if your vehicle does not have a manufacturer-specific PID map.

### Step 3: Load Your Profile

Set the profile in `.env`:

```bash
SIMULATOR_PROFILE=your_car_id
```

Or select it through the dashboard vehicle selector.

### Step 4: Verify

Start the backend and check that the vehicle name appears in the console and dashboard header. Run in simulator mode first to verify all algorithm outputs look reasonable for your vehicle's specifications.

---

## Raspberry Pi Setup

### Complete Pi Installation

```bash
# Start with Raspberry Pi OS Lite (64-bit) or Desktop
# Update the system
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y \
    python3 python3-pip python3-venv python3-dev \
    git bluez libbluetooth-dev \
    nodejs npm \
    chromium-browser  # For kiosk mode display

# Clone APEX CORTEX
git clone https://github.com/your-org/apex-cortex.git
cd apex-cortex

# Backend setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend setup
cd dashboard
npm install
npm run build    # Build production bundle
cd ..
```

### Auto-Start on Boot

Create a systemd service to start APEX CORTEX automatically:

```bash
sudo tee /etc/systemd/system/apex-cortex.service << EOF
[Unit]
Description=APEX CORTEX Racing Dashboard
After=bluetooth.target network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/apex-cortex
Environment=PATH=/home/pi/apex-cortex/venv/bin:/usr/bin
ExecStart=/home/pi/apex-cortex/venv/bin/python -m core.api.main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable apex-cortex
sudo systemctl start apex-cortex
```

### Kiosk Mode (Full-Screen Dashboard)

For a dedicated track display, configure Chromium to open the dashboard in kiosk mode:

```bash
# Create autostart entry
mkdir -p ~/.config/autostart
tee ~/.config/autostart/apex-kiosk.desktop << EOF
[Desktop Entry]
Type=Application
Name=APEX CORTEX Dashboard
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars http://localhost:5173
EOF
```

### Performance Tuning for Pi

```bash
# Disable unnecessary services
sudo systemctl disable avahi-daemon
sudo systemctl disable triggerhappy

# Set CPU governor to performance
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Increase GPU memory for smooth rendering
echo "gpu_mem=128" | sudo tee -a /boot/config.txt

# Overclock Pi 5 (optional, requires active cooling)
# echo "arm_freq=2800" | sudo tee -a /boot/config.txt
```

---

## Troubleshooting

### Backend Issues

| Symptom                          | Solution                                           |
|----------------------------------|----------------------------------------------------|
| `ModuleNotFoundError: obd`       | Activate venv: `source venv/bin/activate`          |
| `Permission denied: /dev/rfcomm0`| Add user to `dialout` group: `sudo usermod -aG dialout $USER` then log out/in |
| `Connection refused` on port 8000| Check if another process uses port 8000: `lsof -i :8000` |
| Simulator starts instead of real connection | Set `SIMULATOR_MODE=false` and check OBD_PORT |
| Slow PID responses               | Use a better adapter (OBDLink MX+) or reduce polling rates |

### Frontend Issues

| Symptom                          | Solution                                           |
|----------------------------------|----------------------------------------------------|
| Dashboard shows "Disconnected"   | Check backend is running on port 8000              |
| WebSocket connection drops       | Check for firewall rules blocking WebSocket        |
| Gauges show "N/A"                | PID not supported by vehicle or not yet received   |
| Slow UI rendering                | Close browser dev tools, use production build       |

### Vehicle Connection Issues

| Symptom                          | Solution                                           |
|----------------------------------|----------------------------------------------------|
| No PIDs returning data           | Vehicle ignition must be ON (not just ACC)          |
| Only some PIDs work              | Normal -- not all vehicles support all PIDs         |
| Extended PIDs (Mode 22) fail     | Verify correct manufacturer PID map is selected     |
| Intermittent disconnections      | Secure adapter in OBD-II port, check cable/antenna  |
