# APEX CORTEX -- OBD-II Protocols Reference

## Overview

APEX CORTEX communicates with vehicle ECUs through the OBD-II diagnostic port using an ELM327-compatible adapter. This document covers the supported protocols, the complete PID reference table, ELM327 setup, and CAN-Bus direct access.

---

## OBD-II Protocol Summary

All OBD-II compliant vehicles (1996+ in the US, 2001+ in the EU) support at least one of the following communication protocols:

| Protocol ID | Name                                  | Baud Rate  | Era/Vehicles                        | ELM327 Cmd |
|-------------|---------------------------------------|------------|-------------------------------------|------------|
| 1           | SAE J1850 PWM                         | 41,600     | Ford (pre-2008)                     | `AT SP 1`  |
| 2           | SAE J1850 VPW                         | 10,400     | GM (pre-2008)                       | `AT SP 2`  |
| 3           | ISO 9141-2                            | 10,400     | European/Asian (1996-2004)          | `AT SP 3`  |
| 4           | ISO 14230-4 KWP2000 (5-baud init)     | 10,400     | European (2001-2007)                | `AT SP 4`  |
| 5           | ISO 14230-4 KWP2000 (fast init)       | 10,400     | European (2001-2007)                | `AT SP 5`  |
| 6           | ISO 15765-4 CAN (11-bit, 500 kbaud)   | 500,000    | Most modern vehicles (2008+)        | `AT SP 6`  |
| 7           | ISO 15765-4 CAN (29-bit, 500 kbaud)   | 500,000    | Trucks, heavy-duty                  | `AT SP 7`  |
| 8           | ISO 15765-4 CAN (11-bit, 250 kbaud)   | 250,000    | Some European vehicles              | `AT SP 8`  |
| 9           | ISO 15765-4 CAN (29-bit, 250 kbaud)   | 250,000    | Some trucks                         | `AT SP 9`  |

### Protocol by Manufacturer (Modern Vehicles)

| Manufacturer   | Typical Protocol                          | Notes                                    |
|----------------|-------------------------------------------|------------------------------------------|
| Mercedes-Benz  | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | All models 2008+                         |
| BMW            | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | All models 2008+                         |
| Porsche        | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | All models 2008+                         |
| Audi/VW        | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | Some older models use KWP2000            |
| Ford           | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | Pre-2008: SAE J1850 PWM                  |
| GM/Chevrolet   | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | Pre-2008: SAE J1850 VPW                  |
| Toyota/Lexus   | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | Some older models use KWP2000            |
| Honda/Acura    | ISO 15765-4 CAN 11-bit 500k (Protocol 6) | Some older models use ISO 9141-2         |

---

## Complete Mode 01 PID Reference

APEX CORTEX uses Mode 01 (Show Current Data) PIDs for standard OBD-II telemetry. The following table lists every PID polled by the system.

### Critical PIDs (10 Hz Polling)

These PIDs are polled at maximum rate for real-time responsiveness.

| PID    | Name                   | Formula             | Unit  | Range              | Bytes |
|--------|------------------------|---------------------|-------|--------------------|-------|
| `0x0C` | Engine RPM             | ((A*256)+B)/4       | rpm   | 0 -- 16,383.75     | 2     |
| `0x0D` | Vehicle Speed          | A                   | km/h  | 0 -- 255           | 1     |
| `0x11` | Throttle Position      | A*100/255           | %     | 0 -- 100           | 1     |
| `0x61` | Driver Demand Torque   | A-125               | %     | -125 -- 130        | 1     |
| `0x62` | Actual Engine Torque   | A-125               | %     | -125 -- 130        | 1     |

### Standard PIDs (2 Hz Polling)

Engine health and algorithm input data, polled at moderate rate.

| PID    | Name                        | Formula             | Unit   | Range              | Bytes |
|--------|-----------------------------|---------------------|--------|--------------------|-------|
| `0x04` | Calculated Engine Load      | A/2.55              | %      | 0 -- 100           | 1     |
| `0x05` | Engine Coolant Temperature  | A-40                | deg C  | -40 -- 215         | 1     |
| `0x06` | Short-Term Fuel Trim Bank 1 | (A/1.28)-100        | %      | -100 -- 99.2       | 1     |
| `0x0B` | Intake Manifold Pressure    | A                   | kPa    | 0 -- 255           | 1     |
| `0x0E` | Timing Advance              | (A/2)-64            | deg    | -64 -- 63.5        | 1     |
| `0x0F` | Intake Air Temperature      | A-40                | deg C  | -40 -- 215         | 1     |
| `0x10` | MAF Air Flow Rate           | ((A*256)+B)/100     | g/s    | 0 -- 655.35        | 2     |
| `0x14` | O2 Sensor 1 Voltage         | A/200               | V      | 0 -- 1.275         | 1     |
| `0x43` | Absolute Load Value         | ((A*256)+B)*100/255 | %      | 0 -- 25,700        | 2     |
| `0x44` | Commanded Equiv. Ratio      | ((A*256)+B)/32768   | ratio  | 0 -- 2             | 2     |
| `0x45` | Relative Throttle Position  | A*100/255           | %      | 0 -- 100           | 1     |
| `0x5C` | Engine Oil Temperature      | A-40                | deg C  | -40 -- 210         | 1     |

### Slow PIDs (0.5 Hz Polling)

Slowly changing values that do not need frequent updates.

| PID    | Name                    | Formula             | Unit  | Range              | Bytes |
|--------|-------------------------|---------------------|-------|--------------------|-------|
| `0x07` | Long-Term Fuel Trim B1  | (A/1.28)-100        | %     | -100 -- 99.2       | 1     |
| `0x2F` | Fuel Tank Level Input   | A*100/255           | %     | 0 -- 100           | 1     |
| `0x33` | Barometric Pressure     | A                   | kPa   | 0 -- 255           | 1     |
| `0x42` | Control Module Voltage  | ((A*256)+B)/1000    | V     | 0 -- 65.535        | 2     |
| `0x46` | Ambient Air Temperature | A-40                | deg C | -40 -- 215         | 1     |
| `0x63` | Engine Reference Torque | (A*256)+B           | Nm    | 0 -- 65,535        | 2     |

### PID Byte Decoding

OBD-II responses contain raw data bytes (labeled A, B, C, D). Each PID has a formula that converts raw bytes into engineering units:

```
Request:  01 0C          (Mode 01, PID 0x0C = Engine RPM)
Response: 41 0C 1A F8    (Mode+0x40, PID, Byte A=0x1A, Byte B=0xF8)

A = 0x1A = 26 (decimal)
B = 0xF8 = 248 (decimal)

RPM = ((A * 256) + B) / 4
RPM = ((26 * 256) + 248) / 4
RPM = (6904) / 4
RPM = 1726 rpm
```

---

## Mode 22 Extended PIDs (Manufacturer-Specific)

Mode 22 (Read Data By Identifier) provides access to manufacturer-specific parameters not available through standard Mode 01. These PIDs vary by manufacturer and model.

APEX CORTEX includes extended PID maps for:

- **Mercedes-AMG** (`config/pid_maps/mercedes_amg.json`) -- Transmission temp, turbo boost, brake pad wear, ESP status, AMG performance data
- **BMW M** (`config/pid_maps/bmw_m.json`) -- Oil pressure, charge air temp, turbo wastegate, M Drive mode, DSC status
- **Porsche** (`config/pid_maps/porsche.json`) -- PSM status, PASM mode, rear-axle steering angle, PDK clutch temp, sport chrono data

### Mode 22 Request Format

```
Request:  22 XX XX       (Mode 22, 2-byte DID)
Response: 62 XX XX DD... (Mode+0x40, DID echo, data bytes)
```

Mode 22 uses 2-byte Data Identifiers (DIDs) instead of the single-byte PIDs used in Mode 01. The request and response headers are longer, but the data decoding follows the same byte-formula pattern.

### Enabling Mode 22 in APEX CORTEX

1. Select a vehicle profile that includes a `manufacturer_pid_map` field
2. The system automatically loads the corresponding PID map from `config/pid_maps/`
3. Extended PIDs are polled in the standard tier (2 Hz) unless overridden in the PID map

---

## ELM327 Adapter Guide

### What is ELM327?

The ELM327 is a programmed microcontroller that translates OBD-II protocols into a simple serial command interface. It handles all the low-level protocol negotiation (CAN framing, ISO timing, J1850 signaling) so that APEX CORTEX only needs to send ASCII commands and parse ASCII responses.

### Recommended Adapters

| Adapter                | Interface  | Speed    | Reliability | Price    |
|------------------------|------------|----------|-------------|----------|
| OBDLink MX+            | Bluetooth  | Fast     | Excellent   | ~$100    |
| OBDLink EX             | USB        | Fastest  | Excellent   | ~$70     |
| OBDLink LX             | Bluetooth  | Fast     | Very Good   | ~$80     |
| Veepeak OBDCheck BLE+  | BLE        | Moderate | Good        | ~$30     |
| Generic ELM327 v1.5    | Bluetooth  | Slow     | Variable    | ~$15     |

**Important**: Many cheap "ELM327 v2.1" adapters on Amazon/eBay are counterfeit and use cloned chips with limited protocol support. For track use, invest in an OBDLink adapter.

### ELM327 Initialization Sequence

APEX CORTEX sends the following AT commands during connection setup:

```
AT Z         Reset the ELM327 to defaults
AT E0        Turn echo off (faster communication)
AT L0        Turn linefeeds off
AT S0        Turn spaces off in responses (faster parsing)
AT H0        Turn headers off (cleaner data)
AT AT1       Enable adaptive timing (auto-adjusts response timeout)
AT SP 6      Set protocol to ISO 15765-4 CAN 11-bit 500k (or auto)
AT CAF1      CAN auto-formatting on (CAN protocols only)
AT ST 96     Set timeout to ~150ms (CAN protocols only)
```

### Auto-Detection

When no specific protocol is configured, APEX CORTEX uses `AT SP 0` (auto-detect) and lets the ELM327 negotiate with the vehicle. After connection, it queries the detected protocol with `AT DPN` (Describe Protocol by Number).

The `ProtocolDetector` class in `core/obd/protocols.py` implements manufacturer-hinted detection: if the vehicle profile specifies a manufacturer, the most likely protocol for that manufacturer is tried first.

### Connection Transports

| Transport      | Port Format           | Notes                                    |
|----------------|-----------------------|------------------------------------------|
| Bluetooth SPP  | `/dev/rfcomm0`        | Most common for track use. Pair first.   |
| USB Serial     | `/dev/ttyUSB0`        | Fastest and most reliable. No pairing.   |
| WiFi TCP       | `192.168.0.10:35000`  | Wireless but higher latency than BT.     |

### Bluetooth Pairing (Linux)

```bash
# Scan for the adapter
bluetoothctl scan on

# Pair with the adapter (PIN is usually 1234 or 0000)
bluetoothctl pair XX:XX:XX:XX:XX:XX
bluetoothctl trust XX:XX:XX:XX:XX:XX

# Bind to a serial port
sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX

# Verify the port exists
ls -l /dev/rfcomm0
```

### Troubleshooting

| Problem                         | Cause                                    | Solution                                  |
|---------------------------------|------------------------------------------|-------------------------------------------|
| "Unable to connect"             | Wrong port or adapter not paired         | Check `ls /dev/rfcomm*` or `ls /dev/ttyUSB*` |
| "UNABLE TO CONNECT" from ELM327 | Vehicle ignition off or wrong protocol  | Turn ignition to ON (not ACC). Try `AT SP 0` |
| Timeout errors                  | Slow protocol or bus congestion          | Increase timeout: `AT ST FF`              |
| "NO DATA" responses             | PID not supported by this vehicle        | Query `01 00` to check supported PIDs     |
| Garbled responses               | Baud rate mismatch                       | Try `AT BRD 23` for 115200 baud           |
| Slow response times             | Spaces/echo still on                     | Verify `AT S0` and `AT E0` are set        |

---

## Protocol Selection Logic

APEX CORTEX uses a multi-stage approach to select the communication protocol:

### Stage 1: Vehicle Profile Hint

If the loaded vehicle profile specifies a manufacturer, the system looks up the manufacturer in its protocol hint table:

```python
_MANUFACTURER_HINTS = {
    "mercedes": [ISO_15765_4_CAN_11BIT_500K],
    "bmw":      [ISO_15765_4_CAN_11BIT_500K],
    "porsche":  [ISO_15765_4_CAN_11BIT_500K],
    "ford":     [ISO_15765_4_CAN_11BIT_500K, SAE_J1850_PWM],
    "gm":       [ISO_15765_4_CAN_11BIT_500K, SAE_J1850_VPW],
    ...
}
```

Hinted protocols are tried first, followed by the remaining protocols in default order.

### Stage 2: ELM327 Auto-Detection

If no hint is available or hinted protocols fail, the system falls back to `AT SP 0` (auto-detect). The ELM327 cycles through all protocols until it gets a valid response from the ECU.

### Stage 3: Default Order

If auto-detection fails, protocols are tried sequentially in this order:

1. ISO 15765-4 CAN 11-bit 500k (most common modern protocol)
2. ISO 15765-4 CAN 29-bit 500k
3. ISO 15765-4 CAN 11-bit 250k
4. ISO 15765-4 CAN 29-bit 250k
5. ISO 14230-4 KWP2000 (fast init)
6. ISO 14230-4 KWP2000 (5-baud init)
7. ISO 9141-2
8. SAE J1850 PWM
9. SAE J1850 VPW

### Stage 4: Simulator Fallback

If all protocol attempts are exhausted after 3 retries with exponential backoff, APEX CORTEX activates the built-in OBD-II simulator. The simulator generates realistic telemetry data based on the selected vehicle profile and driving mode.

---

## CAN-Bus Direct Access

For advanced users, APEX CORTEX supports direct CAN-Bus access via SocketCAN on Linux, bypassing the ELM327 adapter entirely.

### Hardware Requirements

- A SocketCAN-compatible adapter (e.g., PEAK PCAN-USB, Kvaser Leaf Light, Canable)
- Linux with SocketCAN kernel module loaded

### SocketCAN Setup

```bash
# Load the CAN kernel modules
sudo modprobe can
sudo modprobe can_raw
sudo modprobe vcan       # Virtual CAN for testing

# Configure the interface (example: PEAK PCAN-USB)
sudo ip link set can0 type can bitrate 500000
sudo ip link set can0 up

# Verify
ip -details link show can0

# Monitor raw CAN traffic
candump can0
```

### CAN Frame Structure

OBD-II over CAN uses specific arbitration IDs:

| Direction        | 11-bit ID | 29-bit ID         | Purpose            |
|------------------|-----------|-------------------|--------------------|
| Request (tester) | 0x7DF     | 0x18DB33F1        | Broadcast request  |
| Request (ECU)    | 0x7E0     | 0x18DA00F1        | Specific ECU       |
| Response         | 0x7E8     | 0x18DAF100        | ECU response       |

### CAN OBD-II Request Example

```
CAN ID: 0x7DF
Data:   02 01 0C 00 00 00 00 00
        |  |  |
        |  |  └── PID: 0x0C (RPM)
        |  └───── Mode: 01 (Current Data)
        └──────── Length: 02 (2 bytes of OBD data follow)

Response:
CAN ID: 0x7E8
Data:   04 41 0C 1A F8 00 00 00
        |  |  |  |  |
        |  |  |  |  └── Byte B: 0xF8 = 248
        |  |  |  └───── Byte A: 0x1A = 26
        |  |  └──────── PID echo: 0x0C
        |  └─────────── Mode+0x40: 0x41
        └────────────── Length: 04 (4 bytes of OBD data follow)

RPM = ((26 * 256) + 248) / 4 = 1726 rpm
```

### Virtual CAN for Development

```bash
# Create a virtual CAN interface for testing
sudo ip link add dev vcan0 type vcan
sudo ip link set vcan0 up

# Send a simulated OBD response (in another terminal)
cansend vcan0 7E8#0441 0C1AF80000

# APEX CORTEX can connect to vcan0 for development without a real vehicle
```

---

## Supported PID Discovery

Not all vehicles support all PIDs. APEX CORTEX queries PID support bitmasks at startup:

| Query  | Response PIDs | Description                |
|--------|---------------|----------------------------|
| `01 00`| 0x01 -- 0x20  | PIDs supported [01-20]     |
| `01 20`| 0x21 -- 0x40  | PIDs supported [21-40]     |
| `01 40`| 0x41 -- 0x60  | PIDs supported [41-60]     |
| `01 60`| 0x61 -- 0x80  | PIDs supported [61-80]     |

The response is a 4-byte bitmask where each bit indicates whether the corresponding PID is supported:

```
Request:  01 00
Response: 41 00 BE 3E B8 11

Binary: 1011 1110  0011 1110  1011 1000  0001 0001
        ^^^^^^^^   ^^^^^^^^   ^^^^^^^^   ^^^^^^^^
        PIDs 01-08 PIDs 09-16 PIDs 17-24 PIDs 25-32

Bit 1 (0x01): supported = 1 -> PID 0x01 supported
Bit 2 (0x02): supported = 0 -> PID 0x02 not supported
Bit 3 (0x03): supported = 1 -> PID 0x03 supported
...
```

APEX CORTEX only polls PIDs confirmed as supported, avoiding "NO DATA" responses that waste bus time.

---

## OBD-II Modes Reference

APEX CORTEX primarily uses Modes 01 and 22, but the full OBD-II mode list is provided for reference:

| Mode | Name                        | Used by APEX CORTEX | Notes                          |
|------|-----------------------------|---------------------|--------------------------------|
| 01   | Show Current Data           | Yes (primary)       | Real-time PID values           |
| 02   | Show Freeze Frame Data      | No                  | Snapshot at last DTC           |
| 03   | Show Stored DTCs            | No                  | Diagnostic trouble codes       |
| 04   | Clear DTCs and Stored Values| No                  | Clears codes (not used)        |
| 05   | Test Results (O2 sensors)   | No                  | O2 sensor monitoring           |
| 06   | Test Results (non-CAN)      | No                  | On-board monitoring results    |
| 07   | Show Pending DTCs           | No                  | Pending trouble codes          |
| 08   | Control On-board Systems    | No                  | Actuator tests (not used)      |
| 09   | Vehicle Information         | No                  | VIN, calibration IDs           |
| 0A   | Permanent DTCs              | No                  | Emissions-related DTCs         |
| 22   | Read Data by Identifier     | Yes (extended)      | Manufacturer-specific data     |

---

## Data Rate Considerations

### Bus Bandwidth

| Protocol                    | Theoretical Max  | Practical OBD Rate | PIDs/second |
|-----------------------------|------------------|--------------------|-------------|
| SAE J1850 (PWM/VPW)        | 41.6 / 10.4 kbps| ~5 kbps            | ~5          |
| ISO 9141-2 / KWP2000       | 10.4 kbps        | ~3 kbps            | ~5          |
| ISO 15765-4 CAN (500k)     | 500 kbps         | ~50 kbps           | ~50         |
| ISO 15765-4 CAN (250k)     | 250 kbps         | ~25 kbps           | ~25         |

### APEX CORTEX Polling Budget

At 10 Hz critical + 2 Hz standard + 0.5 Hz slow, the system issues approximately:

```
Critical: 5 PIDs * 10 Hz  = 50 requests/sec
Standard: 12 PIDs * 2 Hz  = 24 requests/sec
Slow:     6 PIDs * 0.5 Hz =  3 requests/sec
                            ────────────────
Total:                      77 requests/sec
```

This fits comfortably within CAN-Bus bandwidth (~50 PIDs/sec practical). On older protocols (ISO 9141, KWP2000), the collector automatically reduces polling rates to avoid bus saturation.
