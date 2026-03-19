"""
APEX CORTEX™ — OBD-II PID Registry
Complete Mode 01 PID definitions with decode functions, units, ranges, and polling priorities.

Every PID entry contains:
    - name: human-readable short name
    - description: longer explanation
    - unit: measurement unit string
    - min_value / max_value: valid data range
    - sample_rate_hz: target polling frequency
    - priority: "critical" (10Hz), "standard" (2Hz), or "slow" (0.5Hz)
    - formula: human-readable decode formula string
    - decode: callable(data: bytes) -> float | None
"""

from __future__ import annotations

from typing import Callable


# ---------------------------------------------------------------------------
# Decode helpers
# ---------------------------------------------------------------------------

def _single_byte_percent(data: bytes) -> float | None:
    """A / 2.55  →  0-100 %"""
    if data is None or len(data) < 1:
        return None
    return round(data[0] * 100.0 / 255.0, 2)


def _single_byte_temp(data: bytes) -> float | None:
    """A - 40  →  -40 to 215 °C"""
    if data is None or len(data) < 1:
        return None
    return data[0] - 40


def _short_term_fuel_trim(data: bytes) -> float | None:
    """(A / 1.28) - 100  →  -100 to 99.2 %"""
    if data is None or len(data) < 1:
        return None
    return round(data[0] / 1.28 - 100.0, 2)


def _single_byte_kpa(data: bytes) -> float | None:
    """A  →  0-255 kPa"""
    if data is None or len(data) < 1:
        return None
    return float(data[0])


def _rpm(data: bytes) -> float | None:
    """((A * 256) + B) / 4  →  0-16383.75 rpm"""
    if data is None or len(data) < 2:
        return None
    return round((data[0] * 256 + data[1]) / 4.0, 2)


def _single_byte_value(data: bytes) -> float | None:
    """A  →  0-255"""
    if data is None or len(data) < 1:
        return None
    return float(data[0])


def _timing_advance(data: bytes) -> float | None:
    """(A / 2) - 64  →  -64 to 63.5 °"""
    if data is None or len(data) < 1:
        return None
    return round(data[0] / 2.0 - 64.0, 2)


def _maf_rate(data: bytes) -> float | None:
    """((A * 256) + B) / 100  →  0-655.35 g/s"""
    if data is None or len(data) < 2:
        return None
    return round((data[0] * 256 + data[1]) / 100.0, 2)


def _o2_voltage(data: bytes) -> float | None:
    """A / 200  →  0-1.275 V"""
    if data is None or len(data) < 1:
        return None
    return round(data[0] / 200.0, 3)


def _battery_voltage(data: bytes) -> float | None:
    """((A * 256) + B) / 1000  →  0-65.535 V"""
    if data is None or len(data) < 2:
        return None
    return round((data[0] * 256 + data[1]) / 1000.0, 3)


def _absolute_load(data: bytes) -> float | None:
    """((A * 256) + B) * 100 / 255  →  0-25700 %"""
    if data is None or len(data) < 2:
        return None
    return round((data[0] * 256 + data[1]) * 100.0 / 255.0, 2)


def _commanded_afr(data: bytes) -> float | None:
    """((A * 256) + B) / 32768  →  0-2 ratio (equivalence)"""
    if data is None or len(data) < 2:
        return None
    return round((data[0] * 256 + data[1]) / 32768.0, 4)


def _oil_temp(data: bytes) -> float | None:
    """A - 40  →  -40 to 210 °C"""
    if data is None or len(data) < 1:
        return None
    return data[0] - 40


def _signed_torque_percent(data: bytes) -> float | None:
    """A - 125  →  -125 to 130 %"""
    if data is None or len(data) < 1:
        return None
    return float(data[0] - 125)


def _reference_torque(data: bytes) -> float | None:
    """(A * 256) + B  →  0-65535 Nm"""
    if data is None or len(data) < 2:
        return None
    return float(data[0] * 256 + data[1])


# ---------------------------------------------------------------------------
# PID Registry — dict keyed by integer PID code
# ---------------------------------------------------------------------------

PID_REGISTRY: dict[int, dict] = {
    0x04: {
        "name": "engine_load",
        "description": "Calculated engine load",
        "unit": "%",
        "min_value": 0.0,
        "max_value": 100.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "A * 100 / 255",
        "decode": _single_byte_percent,
    },
    0x05: {
        "name": "coolant_temp",
        "description": "Engine coolant temperature",
        "unit": "°C",
        "min_value": -40.0,
        "max_value": 215.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "A - 40",
        "decode": _single_byte_temp,
    },
    0x06: {
        "name": "stft_bank1",
        "description": "Short-term fuel trim — Bank 1",
        "unit": "%",
        "min_value": -100.0,
        "max_value": 99.2,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "(A / 1.28) - 100",
        "decode": _short_term_fuel_trim,
    },
    0x07: {
        "name": "ltft_bank1",
        "description": "Long-term fuel trim — Bank 1",
        "unit": "%",
        "min_value": -100.0,
        "max_value": 99.2,
        "sample_rate_hz": 0.5,
        "priority": "slow",
        "formula": "(A / 1.28) - 100",
        "decode": _short_term_fuel_trim,
    },
    0x0B: {
        "name": "map",
        "description": "Intake manifold absolute pressure",
        "unit": "kPa",
        "min_value": 0.0,
        "max_value": 255.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "A",
        "decode": _single_byte_kpa,
    },
    0x0C: {
        "name": "rpm",
        "description": "Engine RPM",
        "unit": "rpm",
        "min_value": 0.0,
        "max_value": 16383.75,
        "sample_rate_hz": 10.0,
        "priority": "critical",
        "formula": "((A * 256) + B) / 4",
        "decode": _rpm,
    },
    0x0D: {
        "name": "speed",
        "description": "Vehicle speed",
        "unit": "km/h",
        "min_value": 0.0,
        "max_value": 255.0,
        "sample_rate_hz": 10.0,
        "priority": "critical",
        "formula": "A",
        "decode": _single_byte_value,
    },
    0x0E: {
        "name": "timing_advance",
        "description": "Timing advance relative to #1 cylinder",
        "unit": "°",
        "min_value": -64.0,
        "max_value": 63.5,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "(A / 2) - 64",
        "decode": _timing_advance,
    },
    0x0F: {
        "name": "iat",
        "description": "Intake air temperature",
        "unit": "°C",
        "min_value": -40.0,
        "max_value": 215.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "A - 40",
        "decode": _single_byte_temp,
    },
    0x10: {
        "name": "maf",
        "description": "Mass air flow sensor rate",
        "unit": "g/s",
        "min_value": 0.0,
        "max_value": 655.35,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "((A * 256) + B) / 100",
        "decode": _maf_rate,
    },
    0x11: {
        "name": "throttle_position",
        "description": "Throttle position",
        "unit": "%",
        "min_value": 0.0,
        "max_value": 100.0,
        "sample_rate_hz": 10.0,
        "priority": "critical",
        "formula": "A * 100 / 255",
        "decode": _single_byte_percent,
    },
    0x14: {
        "name": "o2_sensor_1",
        "description": "O2 sensor 1 voltage",
        "unit": "V",
        "min_value": 0.0,
        "max_value": 1.275,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "A / 200",
        "decode": _o2_voltage,
    },
    0x2F: {
        "name": "fuel_tank_level",
        "description": "Fuel tank level input",
        "unit": "%",
        "min_value": 0.0,
        "max_value": 100.0,
        "sample_rate_hz": 0.5,
        "priority": "slow",
        "formula": "A * 100 / 255",
        "decode": _single_byte_percent,
    },
    0x33: {
        "name": "baro_pressure",
        "description": "Barometric pressure (absolute)",
        "unit": "kPa",
        "min_value": 0.0,
        "max_value": 255.0,
        "sample_rate_hz": 0.5,
        "priority": "slow",
        "formula": "A",
        "decode": _single_byte_kpa,
    },
    0x42: {
        "name": "battery_voltage",
        "description": "Control module voltage (battery)",
        "unit": "V",
        "min_value": 0.0,
        "max_value": 65.535,
        "sample_rate_hz": 0.5,
        "priority": "slow",
        "formula": "((A * 256) + B) / 1000",
        "decode": _battery_voltage,
    },
    0x43: {
        "name": "absolute_load",
        "description": "Absolute load value",
        "unit": "%",
        "min_value": 0.0,
        "max_value": 25700.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "((A * 256) + B) * 100 / 255",
        "decode": _absolute_load,
    },
    0x44: {
        "name": "commanded_afr",
        "description": "Commanded equivalence ratio (lambda)",
        "unit": "ratio",
        "min_value": 0.0,
        "max_value": 2.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "((A * 256) + B) / 32768",
        "decode": _commanded_afr,
    },
    0x45: {
        "name": "rel_throttle",
        "description": "Relative throttle position",
        "unit": "%",
        "min_value": 0.0,
        "max_value": 100.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "A * 100 / 255",
        "decode": _single_byte_percent,
    },
    0x46: {
        "name": "ambient_temp",
        "description": "Ambient air temperature",
        "unit": "°C",
        "min_value": -40.0,
        "max_value": 215.0,
        "sample_rate_hz": 0.5,
        "priority": "slow",
        "formula": "A - 40",
        "decode": _single_byte_temp,
    },
    0x5C: {
        "name": "oil_temp",
        "description": "Engine oil temperature",
        "unit": "°C",
        "min_value": -40.0,
        "max_value": 210.0,
        "sample_rate_hz": 2.0,
        "priority": "standard",
        "formula": "A - 40",
        "decode": _oil_temp,
    },
    0x61: {
        "name": "driver_demand_torque",
        "description": "Driver's demand engine torque (percent)",
        "unit": "%",
        "min_value": -125.0,
        "max_value": 130.0,
        "sample_rate_hz": 10.0,
        "priority": "critical",
        "formula": "A - 125",
        "decode": _signed_torque_percent,
    },
    0x62: {
        "name": "actual_torque",
        "description": "Actual engine torque (percent)",
        "unit": "%",
        "min_value": -125.0,
        "max_value": 130.0,
        "sample_rate_hz": 10.0,
        "priority": "critical",
        "formula": "A - 125",
        "decode": _signed_torque_percent,
    },
    0x63: {
        "name": "reference_torque",
        "description": "Engine reference torque",
        "unit": "Nm",
        "min_value": 0.0,
        "max_value": 65535.0,
        "sample_rate_hz": 0.5,
        "priority": "slow",
        "formula": "(A * 256) + B",
        "decode": _reference_torque,
    },
}


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def get_critical_pids() -> dict[int, dict]:
    """Return all PIDs with priority == 'critical' (10 Hz polling)."""
    return {code: entry for code, entry in PID_REGISTRY.items() if entry["priority"] == "critical"}


def get_standard_pids() -> dict[int, dict]:
    """Return all PIDs with priority == 'standard' (2 Hz polling)."""
    return {code: entry for code, entry in PID_REGISTRY.items() if entry["priority"] == "standard"}


def get_slow_pids() -> dict[int, dict]:
    """Return all PIDs with priority == 'slow' (0.5 Hz polling)."""
    return {code: entry for code, entry in PID_REGISTRY.items() if entry["priority"] == "slow"}


def get_pid_by_code(code: int) -> dict | None:
    """
    Look up a PID definition by its integer code.

    Args:
        code: PID code as integer (e.g. 0x0C for RPM).

    Returns:
        The PID definition dict, or None if not found.
    """
    return PID_REGISTRY.get(code)


def get_pid_by_name(name: str) -> tuple[int, dict] | None:
    """
    Look up a PID definition by its short name (e.g. 'rpm').

    Returns:
        (code, entry) tuple, or None if not found.
    """
    for code, entry in PID_REGISTRY.items():
        if entry["name"] == name:
            return code, entry
    return None


def get_all_pid_names() -> list[str]:
    """Return a sorted list of all registered PID short names."""
    return sorted(entry["name"] for entry in PID_REGISTRY.values())
