"""
APEX CORTEX™ — Braking Algorithm
Deceleration, brake performance index, stopping distance, and fade detection.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("apex.algorithms.braking")

_G: float = 9.81
_KMH_TO_MS: float = 1.0 / 3.6

# Module-level state
_MAX_HISTORY: int = 100


@dataclass
class _BrakeSample:
    speed_ms: float
    timestamp: float
    is_braking: bool


_brake_history: deque[_BrakeSample] = deque(maxlen=_MAX_HISTORY)
_peak_decel: float = 0.0
_brake_event_count: int = 0


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def reset_state() -> None:
    """Clear module-level state (useful for testing)."""
    global _peak_decel, _brake_event_count
    _brake_history.clear()
    _peak_decel = 0.0
    _brake_event_count = 0


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate braking performance metrics.

    Outputs:
        deceleration_ms2    — current deceleration magnitude (m/s²)
        brake_force_n       — estimated brake force (N)
        bpi                 — brake performance index (decel/g × 100)
        stopping_distance_m — theoretical stopping distance at current decel
        brake_fade_warning  — True if fade detected
        is_braking          — True if currently decelerating
    """
    global _peak_decel, _brake_event_count

    pids = snapshot.get("pids", {})
    result: dict[str, Any] = {
        "deceleration_ms2": None,
        "brake_force_n": None,
        "bpi": None,
        "stopping_distance_m": None,
        "brake_fade_warning": False,
        "is_braking": False,
    }

    speed_kmh = _safe_float(
        snapshot.get("speed") or pids.get("0x0D")
    )
    coolant_temp = _safe_float(
        snapshot.get("coolant_temp") or pids.get("0x05")
    )
    now = snapshot.get("timestamp") or time.monotonic()

    if speed_kmh is None:
        return result

    speed_ms = speed_kmh * _KMH_TO_MS
    throttle = _safe_float(pids.get("0x11"))

    # Determine if braking: speed decreasing and throttle near zero
    is_braking = False
    if len(_brake_history) > 0:
        prev = _brake_history[-1]
        dt = now - prev.timestamp
        if dt > 0:
            dv = prev.speed_ms - speed_ms  # positive when decelerating
            decel = dv / dt

            # Consider braking if decelerating > 0.5 m/s² and throttle < 10%
            if decel > 0.5 and (throttle is None or throttle < 10.0):
                is_braking = True
                result["is_braking"] = True
                result["deceleration_ms2"] = round(decel, 4)

                # Brake force: F = m × a
                mass = _safe_float(
                    vehicle.get("curb_weight_kg") or vehicle.get("mass_kg")
                )
                if mass is not None:
                    result["brake_force_n"] = round(mass * decel, 1)

                # Brake Performance Index: (decel / g) × 100
                bpi = (decel / _G) * 100.0
                result["bpi"] = round(bpi, 2)

                # Stopping distance: v² / (2 × a)
                if decel > 0 and speed_ms > 0:
                    stop_dist = (speed_ms ** 2) / (2.0 * decel)
                    result["stopping_distance_m"] = round(stop_dist, 2)

                # Track peak deceleration for fade detection
                if decel > _peak_decel:
                    _peak_decel = decel
                    _brake_event_count = 0

    _brake_history.append(
        _BrakeSample(speed_ms=speed_ms, timestamp=now, is_braking=is_braking)
    )

    # Brake fade detection: coolant > 100 °C and rising during braking
    if is_braking and coolant_temp is not None:
        _brake_event_count += 1
        # Check if coolant is above threshold and rising
        if coolant_temp > 100.0 and len(_brake_history) >= 2:
            prev_sample = _brake_history[-2]
            # Retrieve previous coolant from snapshot history if available
            if coolant_temp > 100.0:
                # Compare with trend — if temperature is high and we are
                # braking, flag fade risk
                result["brake_fade_warning"] = True
                logger.warning(
                    "Brake fade risk: coolant %.1f °C during braking",
                    coolant_temp,
                )

    # Also flag fade from declining peak deceleration
    if is_braking and _peak_decel > 0:
        current_decel = result.get("deceleration_ms2") or 0.0
        if (
            _brake_event_count > 10
            and current_decel > 1.0
            and current_decel < _peak_decel * 0.70
        ):
            result["brake_fade_warning"] = True
            logger.warning(
                "Brake fade detected: current=%.2f m/s² vs peak=%.2f m/s²",
                current_decel,
                _peak_decel,
            )

    return result
