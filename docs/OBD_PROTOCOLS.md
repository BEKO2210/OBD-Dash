# APEX CORTEX -- OBD-II Protocols and PID Reference

## Overview

APEX CORTEX communicates with vehicles through the OBD-II diagnostic port using an ELM327-compatible adapter. This document covers the supported protocols, the complete PID table, adapter setup, and manufacturer-specific extensions.

---

## Supported OBD-II Protocols

| Protocol | Standard | Common Vehicles | Speed |
|----------|----------|----------------|-------|
| ISO 15765-4 CAN (11-bit, 500 kbaud) | CAN Bus | Most 2008+ European vehicles | 500 kbps |
| ISO 15765-4 CAN (29-bit, 500 kbaud) | CAN Bus | Some commercial vehicles | 500 kbps |
| ISO 14230-4 KWP2000 | K-Line | 2003-2010 European vehicles | 10.4 kbps |
| ISO 9141-2 | K-Line | Older European/Asian vehicles | 10.4 kbps |
| SAE J1850 PWM | Pulse-Width | Ford vehicles (pre-2008) | 41.6 kbps |
| SAE J1850 VPW | Variable Pulse | GM vehicles (pre-2008) | 10.4 kbps |

APEX CORTEX auto-detects the protocol via the ELM327 `ATSP0` (auto-search) command. You can also force a specific protocol via the `OBD_PROTOCOL` environment variable.

---

## ELM327 Adapter Setup

### Recommended Adapters

| Adapter | Interface | Notes |
|---------|-----------|-------|
| OBDLink MX+ | Bluetooth | Best overall. Fast, reliable, STN2120 chip. |
| OBDLink EX | USB | Fastest for stationary use. Low latency. |
| OBDLink MX Wi-Fi | WiFi | Good for iPad/tablet setups. |
| Vgate vLinker MC+ | Bluetooth LE | Budget-friendly, good CAN support. |

Avoid cheap "ELM327 v1.5" clones from generic sellers. They often have counterfeit chips that do not support all protocols and may drop data under high polling rates.

### Connection Methods

#### Bluetooth Serial (Linux)

```bash
# Pair the adapter
bluetoothctl
> scan on
> pair XX:XX:XX:XX:XX:XX
> trust XX:XX:XX:XX:XX:XX

# Bind to serial port
sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX

# The adapter appears at /dev/rfcomm0
OBD_PORT=/dev/rfcomm0 python -m core.api.main
```

#### USB Serial (Linux)

```bash
# Plug in the adapter -- it appears at /dev/ttyUSB0 or /dev/ttyACM0
ls /dev/ttyUSB*

# Grant permissions
sudo usermod -aG dialout $USER

OBD_PORT=/dev/ttyUSB0 python -m core.api.main
```

#### WiFi TCP

```bash
# Connect to the adapter's WiFi network (usually 192.168.0.10:35000)
OBD_PORT=192.168.0.10:35000 python -m core.api.main
```

---

## PID Reference -- Mode 01 (Standard)

All PIDs below are SAE J1979 standard Mode 01 PIDs. APEX CORTEX polls them at tiered rates based on how quickly the values change and how critical they are for real-time analysis.

### Critical PIDs (10 Hz Polling)

These PIDs change rapidly and are essential for real-time performance analysis.

| PID (hex) | Name | Unit | Range | Formula | Bytes |
|-----------|------|------|-------|---------|-------|
| `0x0C` | Engine RPM | rpm | 0--16383.75 | ((A*256)+B)/4 | 2 |
| `0x0D` | Vehicle Speed | km/h | 0--255 | A | 1 |
| `0x11` | Throttle Position | % | 0--100 | A*100/255 | 1 |
| `0x04` | Calculated Engine Load | % | 0--100 | A*100/255 | 1 |
| `0x61` | Driver Demand Torque | % | -125--130 | A-125 | 1 |
| `0x62` | Actual Engine Torque | % | -125--130 | A-125 | 1 |

### Standard PIDs (2 Hz Polling)

These PIDs change at moderate rates and are important for thermal and fuel analysis.

| PID (hex) | Name | Unit | Range | Formula | Bytes |
|-----------|------|------|-------|---------|-------|
| `0x05` | Engine Coolant Temp | C | -40--215 | A-40 | 1 |
| `0x06` | Short-Term Fuel Trim Bank 1 | % | -100--99.2 | (A/1.28)-100 | 1 |
| `0x07` | Long-Term Fuel Trim Bank 1 | % | -100--99.2 | (A/1.28)-100 | 1 |
| `0x0B` | Intake Manifold Pressure | kPa | 0--255 | A | 1 |
| `0x0E` | Timing Advance | deg | -64--63.5 | (A/2)-64 | 1 |
| `0x0F` | Intake Air Temperature | C | -40--215 | A-40 | 1 |
| `0x10` | MAF Air Flow Rate | g/s | 0--655.35 | ((A*256)+B)/100 | 2 |
| `0x14` | O2 Sensor 1 Voltage | V | 0--1.275 | A/200 | 1 |
| `0x43` | Absolute Load Value | % | 0--25700 | ((A*256)+B)*100/255 | 2 |
| `0x44` | Commanded Equivalence Ratio | ratio | 0--2 | ((A*256)+B)/32768 | 2 |
| `0x45` | Relative Throttle Position | % | 0--100 | A*100/255 | 1 |
| `0x5C` | Engine Oil Temperature | C | -40--210 | A-40 | 1 |

### Slow PIDs (0.5 Hz Polling)

These PIDs change slowly and are used for background monitoring.

| PID (hex) | Name | Unit | Range | Formula | Bytes |
|-----------|------|------|-------|---------|-------|
| `0x2F` | Fuel Tank Level | % | 0--100 | A*100/255 | 1 |
| `0x33` | Barometric Pressure | kPa | 0--255 | A | 1 |
| `0x42` | Control Module Voltage | V | 0--65.535 | ((A*256)+B)/1000 | 2 |
| `0x46` | Ambient Air Temperature | C | -40--215 | A-40 | 1 |
| `0x63` | Reference Torque | Nm | 0--65535 | (A*256)+B | 2 |

---

## Mode 22 -- Manufacturer Extended PIDs

Mode 22 PIDs are manufacturer-specific and provide access to data not available through standard OBD-II. APEX CORTEX loads these from JSON files in `config/pid_maps/`.

### BMW M (`config/pid_maps/bmw_m.json`)

Extended PIDs for BMW M vehicles, accessed via UDS (Unified Diagnostic Services). Includes boost pressure, transmission oil temp, individual cylinder timing, and M-specific torque data.

### Mercedes-AMG (`config/pid_maps/mercedes_amg.json`)

Extended PIDs for AMG vehicles. Includes turbo boost per bank, transmission mode, AMG-specific performance counters, and active exhaust valve status.

### Porsche (`config/pid_maps/porsche.json`)

Extended PIDs for Porsche vehicles. Includes PDK transmission data, PASM suspension mode, rear-axle steering angle, and Sport Chrono timer data.

---

## CAN Bus Direct Access (Linux)

For advanced users, APEX CORTEX supports direct CAN bus access via SocketCAN on Linux. This bypasses the ELM327 adapter entirely and provides the lowest possible latency.

### Setup

```bash
# Load the CAN kernel module
sudo modprobe can
sudo modprobe can-raw
sudo modprobe vcan  # for virtual CAN (testing)

# Set up a CAN interface
sudo ip link set can0 type can bitrate 500000
sudo ip link set up can0

# Verify
cansend can0 7DF#0201050000000000    # query coolant temp
candump can0                         # watch raw frames
```

### Requirements

- Linux kernel 3.6+ with CONFIG_CAN enabled
- `python-can` library (included in requirements.txt)
- Physical CAN interface (e.g., PCAN-USB, Kvaser Leaf Light)

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No OBD adapter found" | Check adapter power (LED should be on). Verify Bluetooth pairing or WiFi connection. |
| "Connection refused" on WiFi | Ensure you are connected to the adapter's WiFi network, not your home network. |
| Slow or missing data | Use a quality adapter (OBDLink MX+). Cheap clones cannot sustain 10Hz polling. |
| Protocol mismatch | Set `OBD_PROTOCOL` in `.env` to force the correct protocol for your vehicle. |
| Permission denied on `/dev/ttyUSB0` | Run `sudo usermod -aG dialout $USER` and re-login. |
| Simulator not starting | Check that `SIMULATOR_MODE=true` is set in `.env`. |
