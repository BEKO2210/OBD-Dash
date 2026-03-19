"""
APEX CORTEX™ — Performance Algorithm
Estimated power, torque efficiency, engine load, and power delivery scoring.

Uses OBD-II PIDs:
    0x04  — Calculated engine load (%)
    0x0C  — Engine RPM
    0x62  — Actual engine torque (percent)
    0x63  — Engine reference torque (Nm)
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("apex.algorithms.performance")

# Constants
_KW_TO_HP: float = 1.34102
_TORQUE_RPM_TO_KW: float = 9549.0


def _safe_float(value: Any) -> float | None:
    """Convert *value* to float, returning ``None`` on failure."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate performance metrics from the current telemetry snapshot.

    Torque is derived from OBD-II Mode-01 PIDs when available:
        torque_nm = (actual_torque_pct / 100) * reference_torque_nm

    Falls back to engine_load * max_torque_nm from the vehicle profile
    when the OBD torque PIDs are unavailable.

    Returns
    -------
    dict with keys:
        estimated_torque_nm      — estimated engine torque (Nm)
        estimated_power_kw       — estimated power (kW)
        estimated_power_hp       — estimated power (hp)
        engine_load_percent      — direct from PID 0x04
        power_delivery_score     — current power as % of vehicle max (0-100)
        torque_efficiency        — actual vs reference torque ratio (0-1+)
    """
    result: dict[str, Any] = {
        "estimated_torque_nm": None,
        "estimated_power_kw": None,
        "estimated_power_hp": None,
        "engine_load_percent": None,
        "power_delivery_score": None,
        "torque_efficiency": None,
    }

    # ── Extract PID values ─────────────────────────────────────────────
    # Support both top-level keys and nested "pids" dict for flexibility.
    rpm = _safe_float(snapshot.get("rpm") or snapshot.get("pids", {}).get("0x0C"))
    engine_load = _safe_float(
        snapshot.get("engine_load") or snapshot.get("pids", {}).get("0x04")
    )
    actual_torque_pct = _safe_float(
        snapshot.get("actual_torque_pct") or snapshot.get("pids", {}).get("0x62")
    )
    reference_torque_nm = _safe_float(
        snapshot.get("reference_torque") or snapshot.get("pids", {}).get("0x63")
    )

    max_torque_nm = _safe_float(vehicle.get("max_torque_nm"))
    max_power_kw = _safe_float(vehicle.get("max_power_kw"))

    # ── Engine load (direct passthrough) ───────────────────────────────
    result["engine_load_percent"] = engine_load

    # ── Torque estimation ──────────────────────────────────────────────
    estimated_torque_nm: float | None = None

    # Primary: use OBD-II torque PIDs 0x62 × 0x63
    if actual_torque_pct is not None and reference_torque_nm is not None:
        estimated_torque_nm = (actual_torque_pct / 100.0) * reference_torque_nm
        logger.debug(
            "Torque from OBD PIDs: %.1f%% × %.1f Nm = %.1f Nm",
            actual_torque_pct,
            reference_torque_nm,
            estimated_torque_nm,
        )
    # Fallback: engine_load × vehicle max torque
    elif engine_load is not None and max_torque_nm is not None:
        estimated_torque_nm = (engine_load / 100.0) * max_torque_nm
        logger.debug(
            "Torque from load fallback: %.1f%% × %.1f Nm = %.1f Nm",
            engine_load,
            max_torque_nm,
            estimated_torque_nm,
        )

    if estimated_torque_nm is not None:
        result["estimated_torque_nm"] = round(estimated_torque_nm, 2)

    # ── Power estimation: P = (T × RPM) / 9549 ────────────────────────
    if estimated_torque_nm is not None and rpm is not None and rpm > 0:
        power_kw = (estimated_torque_nm * rpm) / _TORQUE_RPM_TO_KW
        power_hp = power_kw * _KW_TO_HP
        result["estimated_power_kw"] = round(power_kw, 2)
        result["estimated_power_hp"] = round(power_hp, 2)

        # Power delivery score: current / max × 100
        if max_power_kw is not None and max_power_kw > 0:
            score = (power_kw / max_power_kw) * 100.0
            result["power_delivery_score"] = round(min(score, 100.0), 2)

    # ── Torque efficiency ──────────────────────────────────────────────
    ref = reference_torque_nm if reference_torque_nm else max_torque_nm
    if estimated_torque_nm is not None and ref is not None and ref > 0:
        result["torque_efficiency"] = round(estimated_torque_nm / ref, 4)

    return result
