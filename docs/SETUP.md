# APEX CORTEX™ — Setup Guide

## Hardware Requirements

### ELM327 OBD-II Adapter

| Adapter | Connection | Price | Notes |
|---|---|---|---|
| **OBDLink MX+** | Bluetooth | ~$100 | Best overall — genuine chip, fast |
| **BAFX Products 34t5** | Bluetooth | ~$25 | Best budget option |
| **Vgate iCar Pro** | WiFi/BT | ~$30 | Good WiFi option |
| **OBDLink SX** | USB | ~$30 | Lowest latency |

**Avoid**: Cheap (<$10) ELM327 clones — counterfeit chips with slow response.

### Host System
- Python 3.11+
- Node.js 18+
- Bluetooth or WiFi capability
- Modern web browser

## Software Setup

### 1. Install Dependencies

```bash
# Python backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd dashboard
npm install
cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

For development (no hardware):
```
SIMULATOR_MODE=true
SIMULATOR_PROFILE=amg_c63_s
```

For real OBD:
```
SIMULATOR_MODE=false
OBD_PORT=auto
```

## First Run (Simulator Mode)

### Terminal 1 — Backend
```bash
source venv/bin/activate
python -m core.api.main
```
API at `http://localhost:8000`

### Terminal 2 — Frontend
```bash
cd dashboard
npm run dev
```
Dashboard at `http://localhost:5173`

## Connecting Hardware

### Bluetooth (Linux)
```bash
bluetoothctl scan on
bluetoothctl pair XX:XX:XX:XX:XX:XX
bluetoothctl trust XX:XX:XX:XX:XX:XX
sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX
# Set OBD_PORT=/dev/rfcomm0
```

### WiFi
1. Connect to adapter's WiFi network
2. Set `OBD_PORT=192.168.0.10:35000`

### USB
1. Plug in adapter
2. Find port: `ls /dev/ttyUSB*`
3. Set `OBD_PORT=/dev/ttyUSB0`

## Creating a Vehicle Profile

```bash
cp config/vehicles/template.json config/vehicles/my_car.json
```

Edit with your vehicle's specs (gear ratios, weight, redline, etc.). See `config/vehicles/template.json` for all fields.

Key fields for accuracy:
- **gear_ratios** + **final_drive**: Critical for gear detection
- **tire_circumference_mm**: Affects speed/RPM calculations
- **curb_weight_kg**: Used in G-force and weight transfer

## Troubleshooting

| Issue | Solution |
|---|---|
| Backend won't start | Check Python 3.11+: `python3 --version` |
| No WebSocket data | Ensure backend is running on port 8000 |
| Bluetooth won't pair | `bluetoothctl power off && power on` |
| Permission denied | `sudo usermod -aG dialout $USER` |
