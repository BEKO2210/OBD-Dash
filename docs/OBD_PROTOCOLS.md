# APEX CORTEX™ — OBD-II Protocols & PID Reference

## Supported OBD-II PIDs (Mode 01 — Standard)

### Critical PIDs (10Hz Polling)

| PID | Name | Formula | Unit | Range | Description |
|---|---|---|---|---|---|
| 0x0C | Engine RPM | ((A×256)+B)/4 | rpm | 0–16,383 | Engine rotational speed |
| 0x0D | Vehicle Speed | A | km/h | 0–255 | Current vehicle speed |
| 0x11 | Throttle Position | A×100/255 | % | 0–100 | Absolute throttle position |
| 0x04 | Engine Load | A×100/255 | % | 0–100 | Calculated engine load |
| 0x61 | Driver Demand Torque | A-125 | % | -125–130 | Driver demanded torque |
| 0x62 | Actual Torque | A-125 | % | -125–130 | Actual engine torque |

### Standard PIDs (2Hz Polling)

| PID | Name | Formula | Unit | Range | Description |
|---|---|---|---|---|---|
| 0x05 | Coolant Temp | A-40 | °C | -40–215 | Engine coolant temperature |
| 0x06 | STFT Bank 1 | (A-128)×100/128 | % | -100–99.2 | Short term fuel trim |
| 0x0B | MAP | A | kPa | 0–255 | Intake manifold absolute pressure |
| 0x0E | Timing Advance | A/2-64 | ° | -64–63.5 | Ignition timing advance |
| 0x0F | Intake Air Temp | A-40 | °C | -40–215 | Intake air temperature |
| 0x10 | MAF Rate | ((A×256)+B)/100 | g/s | 0–655.35 | Mass air flow sensor rate |
| 0x14 | O2 Sensor 1 | A/200 | V | 0–1.275 | O2 sensor voltage (Bank 1) |
| 0x43 | Abs Engine Load | ((A×256)+B)×100/255 | % | 0–25,700 | Absolute engine load |
| 0x44 | Commanded AFR | ((A×256)+B)/32768 | ratio | 0–2 | Commanded air-fuel ratio |
| 0x45 | Rel. Throttle | A×100/255 | % | 0–100 | Relative throttle position |
| 0x5C | Oil Temp | A-40 | °C | -40–210 | Engine oil temperature |

### Slow PIDs (0.5Hz Polling)

| PID | Name | Formula | Unit | Range | Description |
|---|---|---|---|---|---|
| 0x07 | LTFT Bank 1 | (A-128)×100/128 | % | -100–99.2 | Long term fuel trim |
| 0x2F | Fuel Tank Level | A×100/255 | % | 0–100 | Fuel tank level input |
| 0x33 | Baro Pressure | A | kPa | 0–255 | Barometric pressure |
| 0x42 | Battery Voltage | ((A×256)+B)/1000 | V | 0–65.535 | Control module voltage |
| 0x46 | Ambient Temp | A-40 | °C | -40–215 | Ambient air temperature |
| 0x63 | Reference Torque | (A×256)+B | Nm | 0–65,535 | Engine reference torque |

## ELM327 Connection Guide

### Bluetooth Pairing (Linux)

```bash
# 1. Scan for Bluetooth devices
bluetoothctl scan on

# 2. Pair with ELM327 (typical name: OBDII, OBD2, ELM327)
bluetoothctl pair XX:XX:XX:XX:XX:XX

# 3. Trust the device
bluetoothctl trust XX:XX:XX:XX:XX:XX

# 4. Bind to serial port
sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX

# 5. Device available at /dev/rfcomm0
```

### WiFi Setup

Most WiFi ELM327 adapters create a WiFi hotspot:
1. Connect to the adapter's WiFi network (typically `WiFi_OBDII` or `CLKDevices`)
2. Default IP: `192.168.0.10`
3. Default port: `35000`
4. Set in `.env`: `OBD_PORT=192.168.0.10:35000`

### USB Serial

```bash
# Identify the USB serial device
ls /dev/ttyUSB*   # Linux
ls /dev/tty.usbserial*   # macOS

# Set in .env
OBD_PORT=/dev/ttyUSB0
```

## Protocol Selection Guide

| Protocol | Standard | Vehicles | Speed |
|---|---|---|---|
| **ISO 15765-4 CAN** | 2008+ mandatory | All modern vehicles | 500 kbps |
| **ISO 14230-4 KWP** | 2003–2010 | European vehicles | 10.4 kbps |
| **ISO 9141-2** | 1996–2004 | European, Asian | 10.4 kbps |
| **SAE J1850 PWM** | 1996–2008 | Ford | 41.6 kbps |
| **SAE J1850 VPW** | 1996–2008 | GM | 10.4 kbps |

**Recommendation**: Set `OBD_PROTOCOL=auto` and let the ELM327 auto-detect.

## CAN-Bus Direct Access (Advanced)

For advanced users who want to bypass the ELM327 and read CAN-Bus directly:

### Requirements
- Linux with SocketCAN support
- CAN-Bus compatible USB adapter (e.g., PEAK PCAN-USB, CANtact)
- `python-can` library

### SocketCAN Setup

```bash
# Load CAN kernel module
sudo modprobe can
sudo modprobe can_raw
sudo modprobe vcan  # for virtual CAN (testing)

# Setup physical CAN interface
sudo ip link set can0 type can bitrate 500000
sudo ip link set up can0

# Or create virtual CAN for testing
sudo ip link add dev vcan0 type vcan
sudo ip link set up vcan0
```

## Mode 22 Extended PIDs (Manufacturer-Specific)

Extended PIDs use Mode 22 (Service $22) for manufacturer-specific data not available in standard OBD-II. These require the correct vehicle profile to be loaded.

See `config/pid_maps/` for manufacturer-specific PID definitions:
- `mercedes_amg.json` — Transmission temp, turbo boost, AMG performance data
- `bmw_m.json` — Oil pressure, charge air temp, M Drive modes
- `porsche.json` — PSM status, PDK clutch temp, Sport Chrono

## Troubleshooting

| Issue | Cause | Solution |
|---|---|---|
| Cannot connect | Wrong port | Try `OBD_PORT=auto` for auto-detection |
| No data returned | Ignition off | Turn ignition to ON (engine can be off) |
| Partial data | Unsupported PIDs | Check vehicle's supported PIDs with Mode 01 PID 00 |
| Slow response | Too many PIDs | Reduce polling rate or number of polled PIDs |
| Connection drops | Bluetooth interference | Move adapter closer or use WiFi/USB |
