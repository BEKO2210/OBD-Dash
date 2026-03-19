"""
APEX CORTEX™ — Shift Advisor Algorithm
Optimal shift points, gear efficiency scoring, and missed-shift detection.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("apex.algorithms.shift_advisor")

# Module-level state for missed shift tracking.
_missed_shift_count: int = 0
_last_rpm: float | None = None
_last_was_above_redline: bool = False


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def reset_state() -> None:
    """Clear module-level state."""
    global _missed_shift_count, _last_rpm, _last_was_above_redline
    _missed_shift_count = 0
    _last_rpm = None
    _last_was_above_redline = False


def _estimate_current_gear(
    rpm: float,
    speed_kmh: float,
    gear_ratios: list[float],
    final_drive: float,
    tire_circ_mm: float,
) -> int | None:
    """
    Estimate the current gear from RPM, speed, and drivetrain ratios.

    Returns 1-based gear index, or ``None`` if estimation fails.
    """
    if speed_kmh < 3.0 or rpm < 500 or not gear_ratios:
        return None

    speed_ms = speed_kmh / 3.6
    tire_circ_m = tire_circ_mm / 1000.0
    if tire_circ_m <= 0:
        return None

    # wheel RPM from vehicle speed
    wheel_rpm = (speed_ms * 60.0) / tire_circ_m

    if wheel_rpm <= 0:
        return None

    # For each gear, compute the expected engine RPM and find the closest match.
    best_gear: int | None = None
    best_error: float = float("inf")

    for i, ratio in enumerate(gear_ratios):
        expected_rpm = wheel_rpm * ratio * final_drive
        error = abs(expected_rpm - rpm)
        if error < best_error:
            best_error = error
            best_gear = i + 1  # 1-based

    # Reject if error is too large (> 15% of current RPM)
    if best_gear is not None and best_error > rpm * 0.15:
        return None

    return best_gear


def _compute_optimal_shift_rpm(
    current_gear: int,
    gear_ratios: list[float],
    peak_torque_rpm: float,
    redline_rpm: float,
) -> float | None:
    """
    Compute the RPM at which shifting to the next gear is optimal.

    Formula:
        optimal_shift_rpm = (peak_torque_rpm × current_ratio) / next_ratio

    This ensures that after the upshift the engine lands at the peak-torque
    RPM in the next gear, maximising acceleration.
    """
    idx = current_gear - 1  # 0-based
    if idx < 0 or idx + 1 >= len(gear_ratios):
        return None  # already in top gear

    current_ratio = gear_ratios[idx]
    next_ratio = gear_ratios[idx + 1]

    if next_ratio <= 0 or current_ratio <= 0:
        return None

    optimal = (peak_torque_rpm * current_ratio) / next_ratio

    # Clamp to not exceed redline
    return min(optimal, redline_rpm)


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate shift advisor metrics.

    Outputs:
        estimated_gear         — estimated current gear (1-based)
        optimal_shift_rpm      — RPM at which to upshift
        shift_now              — True if RPM >= optimal shift point
        gear_efficiency_score  — how efficiently the current gear is being used (0-100)
        missed_shift_count     — session total of missed shifts (RPM exceeded redline)
    """
    global _missed_shift_count, _last_rpm, _last_was_above_redline

    pids = snapshot.get("pids", {})
    result: dict[str, Any] = {
        "estimated_gear": None,
        "optimal_shift_rpm": None,
        "shift_now": False,
        "gear_efficiency_score": None,
        "missed_shift_count": _missed_shift_count,
    }

    rpm = _safe_float(snapshot.get("rpm") or pids.get("0x0C"))
    speed_kmh = _safe_float(snapshot.get("speed") or pids.get("0x0D"))
    gear_ratios: list[float] = vehicle.get("gear_ratios", [])
    final_drive = _safe_float(vehicle.get("final_drive")) or 1.0
    tire_circ_mm = _safe_float(vehicle.get("tire_circumference_mm")) or 2000.0
    redline_rpm = _safe_float(vehicle.get("redline_rpm")) or 7000.0
    shift_recommend_rpm = _safe_float(vehicle.get("shift_recommend_rpm"))

    if rpm is None or speed_kmh is None:
        return result

    # Estimate current gear
    current_gear = _estimate_current_gear(
        rpm, speed_kmh, gear_ratios, final_drive, tire_circ_mm
    )
    result["estimated_gear"] = current_gear

    # Missed shift detection: RPM exceeded redline
    is_above_redline = rpm >= redline_rpm
    if is_above_redline and not _last_was_above_redline:
        _missed_shift_count += 1
        result["missed_shift_count"] = _missed_shift_count
        logger.warning(
            "Missed shift #%d: RPM=%.0f exceeds redline=%.0f",
            _missed_shift_count,
            rpm,
            redline_rpm,
        )
    _last_was_above_redline = is_above_redline
    _last_rpm = rpm

    if current_gear is None:
        return result

    # Optimal shift RPM
    peak_torque = _safe_float(vehicle.get("peak_torque_rpm")) or (redline_rpm * 0.75)
    optimal = _compute_optimal_shift_rpm(current_gear, gear_ratios, peak_torque, redline_rpm)

    if optimal is not None:
        result["optimal_shift_rpm"] = round(optimal, 0)
        result["shift_now"] = rpm >= optimal
    elif shift_recommend_rpm is not None:
        # Fallback to manufacturer recommendation
        result["optimal_shift_rpm"] = shift_recommend_rpm
        result["shift_now"] = rpm >= shift_recommend_rpm

    # Gear efficiency score:
    # How close RPM is to the peak torque band (0-100).
    # 100 at peak_torque_rpm, drops off linearly with distance.
    if peak_torque > 0:
        band_width = peak_torque * 0.20  # +/-20% is the sweet spot
        distance = abs(rpm - peak_torque)
        if distance <= band_width:
            efficiency = 100.0
        else:
            efficiency = max(
                0.0,
                100.0 - ((distance - band_width) / peak_torque) * 100.0,
            )

        result["gear_efficiency_score"] = round(max(0.0, min(100.0, efficiency)), 1)

    return result
