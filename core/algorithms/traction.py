"""
APEX CORTEX™ — Traction Algorithm
Slip ratio estimation, stability state classification, and ESP detection.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass
from enum import Enum
from typing import Any

logger = logging.getLogger("apex.algorithms.traction")

_G: float = 9.81
_KMH_TO_MS: float = 1.0 / 3.6


class StabilityState(str, Enum):
    """Vehicle stability classification."""

    STABLE = "STABLE"
    MILD_SLIP = "MILD_SLIP"
    OVERSTEER = "OVERSTEER"
    UNDERSTEER = "UNDERSTEER"
    SPINNING = "SPINNING"


# Module-level state
_MAX_HISTORY: int = 30


@dataclass
class _TractionSample:
    speed_ms: float
    throttle: float
    rpm: float
    timestamp: float


_traction_history: deque[_TractionSample] = deque(maxlen=_MAX_HISTORY)
_esp_event_count: int = 0


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def reset_state() -> None:
    """Clear module-level state."""
    global _esp_event_count
    _traction_history.clear()
    _esp_event_count = 0


def _estimate_wheel_speed(
    rpm: float,
    gear_ratios: list[float],
    final_drive: float,
    tire_circ_mm: float,
    current_gear: int | None,
) -> float | None:
    """
    Estimate driven-wheel speed from engine RPM and drivetrain ratios.

    Returns speed in m/s, or None if calculation is not possible.
    """
    if not gear_ratios or final_drive <= 0 or tire_circ_mm <= 0:
        return None

    # If current gear is unknown, estimate from RPM + speed later.
    gear_idx = (current_gear or 1) - 1
    if gear_idx < 0 or gear_idx >= len(gear_ratios):
        gear_idx = 0

    ratio = gear_ratios[gear_idx]
    if ratio <= 0:
        return None

    # wheel_rpm = engine_rpm / (gear_ratio × final_drive)
    wheel_rpm = rpm / (ratio * final_drive)
    # wheel_speed_ms = wheel_rpm × tire_circumference / 60
    tire_circ_m = tire_circ_mm / 1000.0
    wheel_speed_ms = (wheel_rpm * tire_circ_m) / 60.0
    return wheel_speed_ms


def _classify_stability(
    slip_ratio: float,
    throttle: float,
    g_long: float | None,
    g_lat: float | None,
) -> StabilityState:
    """Classify vehicle stability from slip ratio and forces."""
    abs_slip = abs(slip_ratio)

    if abs_slip > 0.30:
        return StabilityState.SPINNING

    if abs_slip < 0.05:
        return StabilityState.STABLE

    if abs_slip < 0.15:
        return StabilityState.MILD_SLIP

    # Distinguish oversteer from understeer using lateral G and throttle.
    if g_lat is not None and g_lat > 0.3:
        if throttle > 50.0:
            # High throttle + high lateral G + slip = oversteer (rear breaks loose)
            return StabilityState.OVERSTEER
        else:
            # Low throttle + high lateral G + slip = understeer (front pushes wide)
            return StabilityState.UNDERSTEER

    # Default to oversteer for power-on slip without lateral context
    if throttle > 60.0:
        return StabilityState.OVERSTEER

    return StabilityState.UNDERSTEER


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate traction and stability metrics.

    Outputs:
        slip_ratio       — estimated tyre slip ratio (0 = no slip, 1 = locked/spinning)
        stability_state  — STABLE | MILD_SLIP | OVERSTEER | UNDERSTEER | SPINNING
        esp_intervention — True if ESP intervention is likely occurring
    """
    global _esp_event_count

    pids = snapshot.get("pids", {})
    result: dict[str, Any] = {
        "slip_ratio": None,
        "stability_state": StabilityState.STABLE.value,
        "esp_intervention": False,
    }

    speed_kmh = _safe_float(snapshot.get("speed") or pids.get("0x0D"))
    rpm = _safe_float(snapshot.get("rpm") or pids.get("0x0C"))
    throttle = _safe_float(snapshot.get("throttle_pos") or pids.get("0x11"))
    engine_load = _safe_float(snapshot.get("engine_load") or pids.get("0x04"))
    now = snapshot.get("timestamp") or time.monotonic()

    if speed_kmh is None or rpm is None or throttle is None:
        return result

    speed_ms = speed_kmh * _KMH_TO_MS

    # Store sample
    _traction_history.append(
        _TractionSample(
            speed_ms=speed_ms, throttle=throttle, rpm=rpm, timestamp=now
        )
    )

    # Slip ratio estimation
    gear_ratios = vehicle.get("gear_ratios", [])
    final_drive = _safe_float(vehicle.get("final_drive")) or 1.0
    tire_circ_mm = _safe_float(vehicle.get("tire_circumference_mm")) or 2000.0
    current_gear = vehicle.get("current_gear")  # may be None

    estimated_wheel_speed = _estimate_wheel_speed(
        rpm, gear_ratios, final_drive, tire_circ_mm, current_gear
    )

    slip_ratio: float = 0.0
    if estimated_wheel_speed is not None and speed_ms > 1.0:
        # slip = (wheel_speed - vehicle_speed) / max(wheel_speed, vehicle_speed)
        max_speed = max(abs(estimated_wheel_speed), abs(speed_ms))
        if max_speed > 0:
            slip_ratio = (estimated_wheel_speed - speed_ms) / max_speed
            result["slip_ratio"] = round(slip_ratio, 4)

    # Retrieve lateral G from dynamics algorithm results if available
    # (passed via snapshot from the dispatcher).
    g_long = _safe_float(snapshot.get("g_longitudinal"))
    g_lat = _safe_float(snapshot.get("g_lateral"))

    # Stability classification
    stability = _classify_stability(slip_ratio, throttle, g_long, g_lat)
    result["stability_state"] = stability.value

    # ESP intervention detection
    # Heuristic: sudden RPM drop with high throttle position suggests
    # the ESP/TC has cut engine power.
    if len(_traction_history) >= 3:
        h = list(_traction_history)
        recent_rpm = [s.rpm for s in h[-3:]]
        recent_throttle = [s.throttle for s in h[-3:]]

        if len(recent_rpm) == 3:
            rpm_drop = recent_rpm[-3] - recent_rpm[-1]
            avg_throttle = sum(recent_throttle) / 3.0

            # RPM dropped > 500 while throttle stays high => ESP
            if rpm_drop > 500 and avg_throttle > 50.0:
                result["esp_intervention"] = True
                _esp_event_count += 1
                logger.info(
                    "ESP intervention detected (event #%d): RPM drop=%.0f, throttle=%.1f%%",
                    _esp_event_count,
                    rpm_drop,
                    avg_throttle,
                )

    return result
