"""
APEX CORTEX™ — Fuel Algorithm
Air-fuel ratio, lambda, consumption, range estimation, and pit window.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("apex.algorithms.fuel")

# Constants
_STOICH_AFR: float = 14.7
_GASOLINE_DENSITY_G_L: float = 750.0  # g/litre


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _classify_afr(afr: float) -> str:
    """
    Classify the air-fuel ratio for racing context.

    - lean:          AFR > 15.0
    - stoich:        14.2 <= AFR <= 15.0
    - optimal_race:  12.5 <= AFR < 14.2
    - rich:          AFR < 12.5
    """
    if afr > 15.0:
        return "lean"
    if afr >= 14.2:
        return "stoich"
    if afr >= 12.5:
        return "optimal_race"
    return "rich"


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Calculate fuel-related metrics.

    Outputs:
        lambda_val              — lambda value from O2 sensor
        afr                     — air-fuel ratio
        afr_status              — lean | stoich | optimal_race | rich
        fuel_consumption_l100km — instantaneous consumption (L/100km)
        range_remaining_km      — estimated range on remaining fuel
        pit_window_laps         — estimated laps before pit needed
    """
    pids = snapshot.get("pids", {})
    result: dict[str, Any] = {
        "lambda_val": None,
        "afr": None,
        "afr_status": None,
        "fuel_consumption_l100km": None,
        "range_remaining_km": None,
        "pit_window_laps": None,
    }

    # Lambda from O2 sensor voltage (narrowband approximation).
    # Narrowband O2: ~0.45V = stoich, <0.45V = lean, >0.45V = rich.
    o2_voltage = _safe_float(
        snapshot.get("o2_voltage") or pids.get("0x14")
    )
    if o2_voltage is not None:
        # Linear approximation: lambda ≈ 1 + (0.45 - voltage) * 2.22
        # This maps 0V→~2.0 (very lean), 0.45V→1.0 (stoich), 0.9V→0.0 (very rich)
        lambda_val = max(0.5, min(2.0, 1.0 + (0.45 - o2_voltage) * 2.222))
        afr = lambda_val * _STOICH_AFR
        result["lambda_val"] = round(lambda_val, 4)
        result["afr"] = round(afr, 2)
        result["afr_status"] = _classify_afr(afr)

    # Fuel consumption: L/100km = (MAF × 3600) / (fuel_density × speed × 10)
    maf = _safe_float(snapshot.get("maf") or pids.get("0x10"))
    speed_kmh = _safe_float(snapshot.get("speed") or pids.get("0x0D"))
    fuel_density = _safe_float(vehicle.get("fuel_density_g_l")) or _GASOLINE_DENSITY_G_L
    fuel_level_pct = _safe_float(
        snapshot.get("fuel_level") or pids.get("0x2F")
    )

    if maf is not None and speed_kmh is not None and speed_kmh > 1.0:
        consumption = (maf * 3600.0) / (fuel_density * speed_kmh * 10.0)
        result["fuel_consumption_l100km"] = round(consumption, 2)

        # Range remaining
        tank_liters = _safe_float(vehicle.get("fuel_tank_liters")) or 55.0

        if fuel_level_pct is not None and consumption > 0:
            remaining_liters = tank_liters * (fuel_level_pct / 100.0)
            range_km = (remaining_liters / consumption) * 100.0
            result["range_remaining_km"] = round(range_km, 1)

            # Pit window: estimated laps before needing to pit.
            lap_distance_km = (
                _safe_float(vehicle.get("lap_distance_km"))
                or _safe_float(vehicle.get("avg_lap_length_km"))
                or 5.0  # default lap length
            )
            if lap_distance_km > 0:
                pit_laps = range_km / lap_distance_km
                result["pit_window_laps"] = max(0, int(pit_laps))

    return result
