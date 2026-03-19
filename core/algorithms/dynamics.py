"""
APEX CORTEX™ — Dynamics Algorithm
Longitudinal & lateral G-force estimation, weight transfer calculations.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("apex.algorithms.dynamics")

_G: float = 9.81  # m/s²
_KMH_TO_MS: float = 1.0 / 3.6

# Module-level state for speed history (persists across calls).
_MAX_HISTORY: int = 50


@dataclass
class _SpeedSample:
    speed_ms: float
    timestamp: float


_speed_history: deque[_SpeedSample] = deque(maxlen=_MAX_HISTORY)
_last_g_lateral: float = 0.0


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def reset_state() -> None:
    """Clear module-level history (useful for testing)."""
    global _last_g_lateral
    _speed_history.clear()
    _last_g_lateral = 0.0


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate vehicle dynamics metrics.

    Outputs:
        g_longitudinal           — longitudinal G-force (+ = acceleration)
        g_lateral                — estimated lateral G-force
        weight_transfer_front_kg — longitudinal weight transfer to front axle
        weight_transfer_lateral_kg — lateral weight transfer
        speed_ms                 — current speed in m/s
        acceleration_ms2         — raw acceleration in m/s²
    """
    global _last_g_lateral

    pids = snapshot.get("pids", {})
    result: dict[str, Any] = {
        "g_longitudinal": None,
        "g_lateral": None,
        "weight_transfer_front_kg": None,
        "weight_transfer_lateral_kg": None,
        "speed_ms": None,
        "acceleration_ms2": None,
    }

    speed_kmh = _safe_float(
        snapshot.get("speed") or pids.get("0x0D")
    )
    throttle = _safe_float(
        snapshot.get("throttle_pos") or pids.get("0x11")
    )
    now = snapshot.get("timestamp") or time.monotonic()

    if speed_kmh is None:
        return result

    speed_ms = speed_kmh * _KMH_TO_MS
    result["speed_ms"] = round(speed_ms, 3)

    # Record speed sample
    _speed_history.append(_SpeedSample(speed_ms=speed_ms, timestamp=now))

    # Need at least 2 samples for delta calculation
    if len(_speed_history) < 2:
        return result

    prev = _speed_history[-2]
    curr = _speed_history[-1]
    dt = curr.timestamp - prev.timestamp
    if dt <= 0:
        return result

    # Longitudinal acceleration / G-force
    dv = curr.speed_ms - prev.speed_ms
    acceleration_ms2 = dv / dt
    g_longitudinal = acceleration_ms2 / _G

    result["acceleration_ms2"] = round(acceleration_ms2, 4)
    result["g_longitudinal"] = round(g_longitudinal, 4)

    # Lateral G-force estimate
    # Without a dedicated yaw-rate sensor we estimate lateral G from
    # the rate of change of longitudinal speed combined with throttle position.
    # A more accurate value requires IMU data; this is a best-effort heuristic.
    # throttle already extracted above
    if throttle is not None and speed_ms > 2.0:
        # If throttle is moderate and speed is changing slowly, assume cornering.
        # Heuristic: lateral component is proportional to throttle-adjusted
        # residual between expected and actual deceleration.
        # Decay towards zero when no lateral stimulus is detected.
        expected_accel = (throttle / 100.0) * 3.0  # rough expected m/s² at full throttle
        residual = abs(acceleration_ms2 - expected_accel)
        g_lateral = residual / _G
        # Smooth lateral G with previous value
        g_lateral = 0.3 * g_lateral + 0.7 * abs(_last_g_lateral)
        _last_g_lateral = g_lateral
    else:
        g_lateral = abs(_last_g_lateral) * 0.9  # decay
        _last_g_lateral = g_lateral

    result["g_lateral"] = round(g_lateral, 4)

    # Weight transfer calculations
    mass = _safe_float(vehicle.get("curb_weight_kg") or vehicle.get("mass_kg"))
    cg_height = _safe_float(vehicle.get("cg_height_m"))
    wheelbase = _safe_float(vehicle.get("wheelbase_m"))
    track_width = _safe_float(vehicle.get("track_width_m"))

    if mass is not None and cg_height is not None:
        # Longitudinal weight transfer
        if wheelbase is not None and wheelbase > 0:
            wt_front = (mass * acceleration_ms2 * cg_height) / wheelbase
            result["weight_transfer_front_kg"] = round(wt_front, 2)

        # Lateral weight transfer
        if track_width is not None and track_width > 0:
            wt_lateral = (mass * g_lateral * _G * cg_height) / track_width
            result["weight_transfer_lateral_kg"] = round(wt_lateral, 2)

    return result
