"""
APEX CORTEX™ — Lap Timer Algorithm
GPS-based lap and sector detection, timing, and delta calculations.
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("apex.algorithms.lap_timer")

# Earth radius for Haversine distance (metres).
_EARTH_RADIUS_M: float = 6_371_000.0

# Default crossing radius for start/finish and sector waypoints (metres).
_DEFAULT_CROSSING_RADIUS_M: float = 25.0

# Minimum lap time to avoid false triggers (seconds).
_MIN_LAP_TIME_S: float = 10.0


@dataclass
class _GeoPoint:
    lat: float
    lon: float


@dataclass
class _SectorTime:
    sector_index: int
    time_ms: float


@dataclass
class _LapRecord:
    lap_number: int
    lap_time_ms: float
    sector_times: list[float]
    timestamp: float


# ---------------------------------------------------------------------------
# Module-level mutable state
# ---------------------------------------------------------------------------

@dataclass
class _LapTimerState:
    """Mutable state for the lap timer, persisting across calls."""

    # Configuration
    start_finish: _GeoPoint | None = None
    sector_waypoints: list[_GeoPoint] = field(default_factory=list)
    crossing_radius_m: float = _DEFAULT_CROSSING_RADIUS_M

    # Timing
    lap_start_time: float | None = None
    current_lap: int = 0
    current_sector: int = 0
    sector_start_time: float | None = None
    sector_times_current: list[float] = field(default_factory=list)

    # History
    laps: list[_LapRecord] = field(default_factory=list)
    session_best_ms: float | None = None
    session_best_sectors: list[float] = field(default_factory=list)

    # Debounce: prevent re-triggering at the same waypoint.
    was_in_start_zone: bool = False
    sector_crossed: list[bool] = field(default_factory=list)


_state = _LapTimerState()


def _haversine_m(p1: _GeoPoint, p2: _GeoPoint) -> float:
    """Great-circle distance between two GPS points in metres."""
    lat1, lon1 = math.radians(p1.lat), math.radians(p1.lon)
    lat2, lon2 = math.radians(p2.lat), math.radians(p2.lon)

    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return _EARTH_RADIUS_M * c


def configure(
    start_finish_lat: float,
    start_finish_lon: float,
    sector_waypoints: list[tuple[float, float]] | None = None,
    crossing_radius_m: float = _DEFAULT_CROSSING_RADIUS_M,
) -> None:
    """
    Configure the lap timer with track coordinates.

    Args:
        start_finish_lat: Latitude of start/finish line.
        start_finish_lon: Longitude of start/finish line.
        sector_waypoints: List of (lat, lon) tuples for sector boundaries.
        crossing_radius_m: Detection radius for waypoint crossing.
    """
    _state.start_finish = _GeoPoint(lat=start_finish_lat, lon=start_finish_lon)
    _state.sector_waypoints = [
        _GeoPoint(lat=lat, lon=lon) for lat, lon in (sector_waypoints or [])
    ]
    _state.crossing_radius_m = crossing_radius_m
    _state.sector_crossed = [False] * len(_state.sector_waypoints)

    logger.info(
        "Lap timer configured: start/finish=(%.6f, %.6f), %d sectors, radius=%.0fm",
        start_finish_lat,
        start_finish_lon,
        len(_state.sector_waypoints),
        crossing_radius_m,
    )


def reset_state() -> None:
    """Reset all lap timer state (new session)."""
    global _state
    sf = _state.start_finish
    waypoints = _state.sector_waypoints
    radius = _state.crossing_radius_m
    _state = _LapTimerState()
    # Preserve configuration across resets.
    _state.start_finish = sf
    _state.sector_waypoints = waypoints
    _state.crossing_radius_m = radius
    _state.sector_crossed = [False] * len(waypoints)
    logger.info("Lap timer state reset")


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def calculate(snapshot: dict[str, Any], vehicle: dict[str, Any]) -> dict[str, Any]:
    """
    Process a telemetry snapshot for lap/sector timing.

    The snapshot may contain GPS data under keys ``gps_lat`` and ``gps_lon``
    (either at the top level or inside ``pids``).

    Outputs:
        current_lap_time_ms   — elapsed time of current lap
        session_best_ms       — fastest lap in the session
        delta_ms              — current lap time minus session best
        current_sector        — current sector index (1-based)
        lap_count             — total completed laps
        last_lap_time_ms      — time of the most recent completed lap
        sector_times          — list of current lap sector times (ms)
        sector_deltas         — list of sector deltas vs best
    """
    pids = snapshot.get("pids", {})
    now = snapshot.get("timestamp") or time.monotonic()

    result: dict[str, Any] = {
        "current_lap_time_ms": None,
        "session_best_ms": _state.session_best_ms,
        "delta_ms": None,
        "current_sector": _state.current_sector + 1,  # 1-based
        "lap_count": len(_state.laps),
        "last_lap_time_ms": None,
        "sector_times": list(_state.sector_times_current),
        "sector_deltas": [],
    }

    # Extract GPS coordinates.
    lat = _safe_float(snapshot.get("gps_lat")) or _safe_float(pids.get("gps_lat"))
    lon = _safe_float(snapshot.get("gps_lon")) or _safe_float(pids.get("gps_lon"))

    if lat is None or lon is None:
        # Without GPS we can only report elapsed time on the current lap.
        if _state.lap_start_time is not None:
            elapsed_ms = (now - _state.lap_start_time) * 1000.0
            result["current_lap_time_ms"] = round(elapsed_ms, 1)
        return result

    if _state.start_finish is None:
        # Try to auto-configure from vehicle profile.
        sf_lat = _safe_float(vehicle.get("start_finish_lat"))
        sf_lon = _safe_float(vehicle.get("start_finish_lon"))
        if sf_lat is not None and sf_lon is not None:
            radius = _safe_float(vehicle.get("start_finish_radius")) or _DEFAULT_CROSSING_RADIUS_M
            wp_raw = vehicle.get("sector_waypoints", [])
            wp_tuples = []
            for wp in wp_raw:
                if isinstance(wp, dict):
                    wlat = _safe_float(wp.get("lat"))
                    wlon = _safe_float(wp.get("lon"))
                    if wlat is not None and wlon is not None:
                        wp_tuples.append((wlat, wlon))
            configure(sf_lat, sf_lon, wp_tuples or None, radius)
        else:
            return result

    current_pos = _GeoPoint(lat=lat, lon=lon)
    radius = _state.crossing_radius_m

    # --- Start / finish line crossing ---
    dist_to_sf = _haversine_m(current_pos, _state.start_finish)
    in_start_zone = dist_to_sf <= radius

    if in_start_zone and not _state.was_in_start_zone:
        # Crossed the start/finish line.
        if _state.lap_start_time is not None:
            lap_time_s = now - _state.lap_start_time

            if lap_time_s >= _MIN_LAP_TIME_S:
                lap_time_ms = lap_time_s * 1000.0

                # Close final sector.
                if _state.sector_start_time is not None:
                    sector_ms = (now - _state.sector_start_time) * 1000.0
                    _state.sector_times_current.append(round(sector_ms, 1))

                lap_record = _LapRecord(
                    lap_number=_state.current_lap,
                    lap_time_ms=round(lap_time_ms, 1),
                    sector_times=list(_state.sector_times_current),
                    timestamp=now,
                )
                _state.laps.append(lap_record)

                result["last_lap_time_ms"] = lap_record.lap_time_ms

                # Session best tracking.
                if (
                    _state.session_best_ms is None
                    or lap_time_ms < _state.session_best_ms
                ):
                    _state.session_best_ms = round(lap_time_ms, 1)
                    _state.session_best_sectors = list(
                        _state.sector_times_current
                    )
                    logger.info(
                        "New session best: lap %d — %.1f ms",
                        _state.current_lap,
                        lap_time_ms,
                    )

                result["session_best_ms"] = _state.session_best_ms

                # Delta to best.
                if _state.session_best_ms is not None:
                    result["delta_ms"] = round(
                        lap_time_ms - _state.session_best_ms, 1
                    )

                # Sector deltas vs best.
                if _state.session_best_sectors:
                    deltas: list[float | None] = []
                    for i, st in enumerate(_state.sector_times_current):
                        if i < len(_state.session_best_sectors):
                            deltas.append(
                                round(st - _state.session_best_sectors[i], 1)
                            )
                        else:
                            deltas.append(None)
                    result["sector_deltas"] = deltas

                _state.current_lap += 1
                logger.info(
                    "Lap %d completed: %.1f ms", lap_record.lap_number, lap_time_ms
                )
        else:
            # First crossing — start counting.
            _state.current_lap = 1

        # Begin new lap timing.
        _state.lap_start_time = now
        _state.sector_start_time = now
        _state.sector_times_current = []
        _state.current_sector = 0
        _state.sector_crossed = [False] * len(_state.sector_waypoints)

    _state.was_in_start_zone = in_start_zone

    # --- Sector waypoint crossing ---
    for idx, waypoint in enumerate(_state.sector_waypoints):
        if _state.sector_crossed[idx]:
            continue
        dist = _haversine_m(current_pos, waypoint)
        if dist <= radius:
            _state.sector_crossed[idx] = True
            if _state.sector_start_time is not None:
                sector_ms = (now - _state.sector_start_time) * 1000.0
                _state.sector_times_current.append(round(sector_ms, 1))
            _state.sector_start_time = now
            _state.current_sector = idx + 1
            logger.debug("Sector %d crossed at %.1f ms", idx, now * 1000)
            break  # process one waypoint per tick

    # Current lap elapsed time.
    if _state.lap_start_time is not None:
        elapsed_ms = (now - _state.lap_start_time) * 1000.0
        result["current_lap_time_ms"] = round(elapsed_ms, 1)

        # Live delta to best: compare elapsed vs sum of best sectors so far.
        if _state.session_best_ms is not None and _state.session_best_sectors:
            n_completed_sectors = len(_state.sector_times_current)
            if n_completed_sectors < len(_state.session_best_sectors):
                best_elapsed = sum(
                    _state.session_best_sectors[:n_completed_sectors + 1]
                )
            else:
                best_elapsed = _state.session_best_ms
            result["delta_ms"] = round(elapsed_ms - best_elapsed, 1)

    result["current_sector"] = _state.current_sector + 1  # 1-based
    result["sector_times"] = list(_state.sector_times_current)
    result["lap_count"] = len(_state.laps)

    return result
