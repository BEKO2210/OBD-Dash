"""
APEX CORTEX™ — Thermal Algorithm
Thermal Risk Score, temperature trend analysis, and overheat prediction.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass
from enum import Enum
from typing import Any

logger = logging.getLogger("apex.algorithms.thermal")


class TRSStatus(str, Enum):
    """Thermal Risk Score severity levels."""

    SAFE = "SAFE"
    WATCH = "WATCH"
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


# Module-level state for trend analysis.
_MAX_HISTORY: int = 60  # ~30 seconds at 2 Hz


@dataclass
class _TempSample:
    coolant: float | None
    oil: float | None
    iat: float | None
    timestamp: float


_temp_history: deque[_TempSample] = deque(maxlen=_MAX_HISTORY)

# Threshold for coolant overheat prediction.
_COOLANT_CRITICAL: float = 120.0


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def reset_state() -> None:
    """Clear module-level history."""
    _temp_history.clear()


def _linear_regression_slope(values: list[float], times: list[float]) -> float | None:
    """
    Compute the slope of a simple linear regression (°C per second).

    Returns ``None`` if fewer than 3 data points.
    """
    n = len(values)
    if n < 3:
        return None

    # Normalise times relative to first sample.
    t0 = times[0]
    ts = [t - t0 for t in times]

    sum_t = sum(ts)
    sum_v = sum(values)
    sum_tv = sum(t * v for t, v in zip(ts, values))
    sum_tt = sum(t * t for t in ts)

    denom = n * sum_tt - sum_t * sum_t
    if abs(denom) < 1e-9:
        return None

    slope = (n * sum_tv - sum_t * sum_v) / denom
    return slope


def _classify_trs(trs: float) -> TRSStatus:
    """Map TRS value to a status level."""
    if trs < 0.50:
        return TRSStatus.SAFE
    if trs < 0.70:
        return TRSStatus.WATCH
    if trs < 0.85:
        return TRSStatus.WARNING
    return TRSStatus.CRITICAL


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate thermal management metrics.

    Outputs:
        trs                     — thermal risk score (0.0–1.0+)
        trs_status              — SAFE | WATCH | WARNING | CRITICAL
        coolant_trend_c_per_s   — coolant temp slope (°C/s)
        oil_trend_c_per_s       — oil temp slope (°C/s)
        predicted_overheat_sec  — seconds until coolant hits critical (or None)
        coolant_temp_c          — current coolant (passthrough)
        oil_temp_c              — current oil temp (passthrough)
        iat_temp_c              — current intake air temp (passthrough)
    """
    pids = snapshot.get("pids", {})
    result: dict[str, Any] = {
        "trs": None,
        "trs_status": None,
        "coolant_trend_c_per_s": None,
        "oil_trend_c_per_s": None,
        "predicted_overheat_sec": None,
        "coolant_temp_c": None,
        "oil_temp_c": None,
        "iat_temp_c": None,
    }

    coolant = _safe_float(snapshot.get("coolant_temp") or pids.get("0x05"))
    oil = _safe_float(snapshot.get("oil_temp") or pids.get("0x5C"))
    iat = _safe_float(snapshot.get("intake_temp") or pids.get("0x0F"))
    now = snapshot.get("timestamp") or time.monotonic()

    result["coolant_temp_c"] = coolant
    result["oil_temp_c"] = oil
    result["iat_temp_c"] = iat

    # Record sample for trend analysis.
    _temp_history.append(
        _TempSample(coolant=coolant, oil=oil, iat=iat, timestamp=now)
    )

    # Thermal Risk Score (TRS)
    # trs = (coolant/120)*0.35 + (oil/150)*0.25 + (iat/60)*0.20 + (brake_est/400)*0.20
    # For brake temperature, we use an estimate based on recent braking intensity.
    # Default to 0 contribution if data is missing.
    # Clamp each raw ratio to [0, 1] before applying weight.
    coolant_component = min(max(coolant / 120.0, 0.0), 1.0) * 0.35 if coolant is not None else 0.0
    oil_component = min(max(oil / 150.0, 0.0), 1.0) * 0.25 if oil is not None else 0.0
    iat_component = min(max(iat / 60.0, 0.0), 1.0) * 0.20 if iat is not None else 0.0

    # Brake temperature estimate: use ambient + load heuristic.
    # Without a dedicated brake temp sensor, estimate from coolant and engine load.
    engine_load = _safe_float(snapshot.get("engine_load") or pids.get("0x04"))
    brake_est = 100.0  # baseline
    if coolant is not None:
        brake_est = max(brake_est, coolant * 0.8)
    if engine_load is not None:
        brake_est += engine_load * 1.5
    brake_component = min(max(brake_est / 400.0, 0.0), 1.0) * 0.20

    trs = coolant_component + oil_component + iat_component + brake_component
    trs = max(0.0, trs)
    result["trs"] = round(trs, 4)
    result["trs_status"] = _classify_trs(trs).value

    # Trend analysis via linear regression
    if len(_temp_history) >= 5:
        history = list(_temp_history)

        # Coolant trend
        coolant_vals = [
            (s.coolant, s.timestamp)
            for s in history
            if s.coolant is not None
        ]
        if len(coolant_vals) >= 3:
            vals, times = zip(*coolant_vals)
            slope = _linear_regression_slope(list(vals), list(times))
            if slope is not None:
                result["coolant_trend_c_per_s"] = round(slope, 4)

                # Predicted overheat: time for coolant to reach critical
                if coolant is not None and slope > 0.01:
                    delta_c = _COOLANT_CRITICAL - coolant
                    if delta_c > 0:
                        predicted_sec = delta_c / slope
                        result["predicted_overheat_sec"] = round(predicted_sec, 1)
                    else:
                        # Already at or above critical
                        result["predicted_overheat_sec"] = 0.0

        # Oil trend
        oil_vals = [
            (s.oil, s.timestamp) for s in history if s.oil is not None
        ]
        if len(oil_vals) >= 3:
            vals, times = zip(*oil_vals)
            slope = _linear_regression_slope(list(vals), list(times))
            if slope is not None:
                result["oil_trend_c_per_s"] = round(slope, 4)

    return result
