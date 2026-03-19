"""
APEX CORTEX™ — Telemetry Processor
Unit conversion, EMA smoothing, normalization, and outlier filtering.

All internal units:
    Temperature → °C
    Speed       → km/h
    Pressure    → kPa
    Power       → kW
    Mass flow   → g/s
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("apex.telemetry.processor")

# ---------------------------------------------------------------------------
# PID metadata: (internal_unit, raw_unit, conversion_fn | None)
# ``None`` means the raw value is already in internal units.
# ---------------------------------------------------------------------------

_IDENTITY = None  # sentinel — no conversion needed

_PID_UNITS: dict[str, tuple[str, str, Any]] = {
    "0x04": ("%", "%", _IDENTITY),
    "0x05": ("°C", "°C", _IDENTITY),
    "0x0B": ("kPa", "kPa", _IDENTITY),
    "0x0C": ("rpm", "rpm", _IDENTITY),
    "0x0D": ("km/h", "km/h", _IDENTITY),
    "0x0F": ("°C", "°C", _IDENTITY),
    "0x10": ("g/s", "g/s", _IDENTITY),
    "0x11": ("%", "%", _IDENTITY),
    "0x14": ("V", "V", _IDENTITY),
    "0x2F": ("%", "%", _IDENTITY),
    "0x33": ("kPa", "kPa", _IDENTITY),
    "0x42": ("V", "V", _IDENTITY),
    "0x46": ("°C", "°C", _IDENTITY),
    "0x5C": ("°C", "°C", _IDENTITY),
}

# Valid value ranges per PID for outlier detection.
_PID_RANGES: dict[str, tuple[float, float]] = {
    "0x04": (0.0, 100.0),
    "0x05": (-40.0, 215.0),
    "0x0B": (0.0, 255.0),
    "0x0C": (0.0, 16383.0),
    "0x0D": (0.0, 255.0),
    "0x0F": (-40.0, 215.0),
    "0x10": (0.0, 655.35),
    "0x11": (0.0, 100.0),
    "0x14": (0.0, 1.275),
    "0x2F": (0.0, 100.0),
    "0x33": (0.0, 255.0),
    "0x42": (0.0, 65.535),
    "0x46": (-40.0, 215.0),
    "0x5C": (-40.0, 210.0),
}

# Default EMA alpha per tier (higher = less smoothing).
_DEFAULT_ALPHA_CRITICAL: float = 0.6
_DEFAULT_ALPHA_STANDARD: float = 0.4
_DEFAULT_ALPHA_SLOW: float = 0.3

_CRITICAL_PIDS = {"0x0C", "0x0D", "0x11", "0x04"}
_STANDARD_PIDS = {"0x05", "0x0B", "0x0F", "0x10", "0x14", "0x5C"}
_SLOW_PIDS = {"0x2F", "0x33", "0x42", "0x46"}


def _alpha_for_pid(pid: str) -> float:
    if pid in _CRITICAL_PIDS:
        return _DEFAULT_ALPHA_CRITICAL
    if pid in _STANDARD_PIDS:
        return _DEFAULT_ALPHA_STANDARD
    return _DEFAULT_ALPHA_SLOW


# ---------------------------------------------------------------------------
# Outlier detection helpers
# ---------------------------------------------------------------------------

@dataclass
class _OutlierState:
    """Tracks running stats for spike detection per PID."""

    last_valid: float | None = None
    consecutive_outliers: int = 0

    # Maximum allowable jump between consecutive readings (percentage of range).
    MAX_JUMP_FRACTION: float = 0.40


def _is_outlier(
    pid: str,
    value: float,
    state: _OutlierState,
) -> bool:
    """
    Return ``True`` if *value* looks like an outlier.

    Uses two strategies:
    1. Range check — is it within the known PID range?
    2. Jump check — is the delta from the last valid reading unreasonably large?
    """
    rng = _PID_RANGES.get(pid)
    if rng is not None:
        lo, hi = rng
        if value < lo or value > hi:
            return True

    if state.last_valid is not None and rng is not None:
        span = rng[1] - rng[0]
        if span > 0:
            jump = abs(value - state.last_valid) / span
            if jump > state.MAX_JUMP_FRACTION:
                state.consecutive_outliers += 1
                # Allow through after 3 consecutive "outliers" — the sensor
                # may have legitimately shifted rapidly.
                return state.consecutive_outliers < 3

    state.consecutive_outliers = 0
    return False


# ---------------------------------------------------------------------------
# TelemetryProcessor
# ---------------------------------------------------------------------------

class TelemetryProcessor:
    """
    Stateful processor that converts, normalises, smooths, and filters
    raw PID snapshot data.

    Usage::

        processor = TelemetryProcessor()
        clean = processor.process(raw_snapshot)
    """

    def __init__(self, *, ema_overrides: dict[str, float] | None = None) -> None:
        self._ema_state: dict[str, float] = {}
        self._outlier_state: dict[str, _OutlierState] = {}
        self._ema_overrides: dict[str, float] = ema_overrides or {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def process(self, raw_data: dict[str, Any]) -> dict[str, Any]:
        """
        Process a raw snapshot dict.

        *raw_data* is expected to have the shape produced by
        ``TelemetryCollector.get_snapshot()``::

            {"timestamp": float, "pids": {"0x0C": 3500, ...}}

        Returns a dict with the same shape but cleaned values, plus a
        ``"_processing"`` metadata key.
        """
        pids: dict[str, Any] = raw_data.get("pids", {})
        processed: dict[str, Any] = {}
        filtered_count = 0
        converted_count = 0

        for pid, raw_value in pids.items():
            if raw_value is None:
                processed[pid] = None
                continue

            try:
                value = float(raw_value)
            except (TypeError, ValueError):
                logger.debug("Non-numeric PID %s value: %r", pid, raw_value)
                processed[pid] = raw_value
                continue

            # 1. Unit conversion
            value = self._convert(pid, value)
            converted_count += 1

            # 2. Outlier filter
            state = self._outlier_state.setdefault(pid, _OutlierState())
            if _is_outlier(pid, value, state):
                logger.debug("Outlier filtered: PID %s value=%.4f", pid, value)
                # Replace with last known good value (or None).
                value_to_use = state.last_valid
                if value_to_use is None:
                    processed[pid] = None
                    filtered_count += 1
                    continue
                value = value_to_use
                filtered_count += 1
            else:
                state.last_valid = value

            # 3. Normalise (clamp to valid range)
            value = self._normalise(pid, value)

            # 4. EMA smoothing
            value = self._smooth(pid, value)

            processed[pid] = round(value, 4)

        return {
            "timestamp": raw_data.get("timestamp", 0.0),
            "pids": processed,
            "_processing": {
                "converted": converted_count,
                "filtered": filtered_count,
            },
        }

    def reset(self) -> None:
        """Clear all internal state (EMA history, outlier trackers)."""
        self._ema_state.clear()
        self._outlier_state.clear()
        logger.info("Processor state reset")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _convert(pid: str, value: float) -> float:
        """Apply unit conversion for *pid* if one is registered."""
        entry = _PID_UNITS.get(pid)
        if entry is None:
            return value
        _internal, _raw, fn = entry
        if fn is None:
            return value
        return fn(value)  # type: ignore[operator]

    @staticmethod
    def _normalise(pid: str, value: float) -> float:
        """Clamp *value* to the valid range for *pid*."""
        rng = _PID_RANGES.get(pid)
        if rng is None:
            return value
        lo, hi = rng
        return max(lo, min(hi, value))

    def _smooth(self, pid: str, value: float) -> float:
        """Exponential moving average smoothing."""
        alpha = self._ema_overrides.get(pid, _alpha_for_pid(pid))
        prev = self._ema_state.get(pid)
        if prev is None:
            smoothed = value
        else:
            smoothed = alpha * value + (1.0 - alpha) * prev
        self._ema_state[pid] = smoothed
        return smoothed
