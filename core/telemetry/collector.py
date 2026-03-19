"""
APEX CORTEX™ — Telemetry Collector
Async polling loop that reads OBD-II PIDs at tiered frequencies,
stores history in circular buffers, and dispatches algorithm processing.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable

logger = logging.getLogger("apex.telemetry.collector")

# ---------------------------------------------------------------------------
# PID tier definitions
# ---------------------------------------------------------------------------

CRITICAL_PIDS: list[str] = ["0x0C", "0x0D", "0x11", "0x04"]
STANDARD_PIDS: list[str] = ["0x05", "0x0B", "0x0F", "0x10", "0x14", "0x5C"]
SLOW_PIDS: list[str] = ["0x2F", "0x33", "0x42", "0x46"]

CRITICAL_HZ: float = 10.0
STANDARD_HZ: float = 2.0
SLOW_HZ: float = 0.5

DEFAULT_BUFFER_SIZE: int = 500


# ---------------------------------------------------------------------------
# Connector protocol — satisfied by OBDConnector and OBDSimulator
# ---------------------------------------------------------------------------

@runtime_checkable
class OBDSource(Protocol):
    """Minimal interface an OBD data source must satisfy."""

    async def query_pid(self, pid: str) -> Any:
        """Return the current value for *pid*, or ``None``."""
        ...


# ---------------------------------------------------------------------------
# Internal data structures
# ---------------------------------------------------------------------------

@dataclass
class PIDReading:
    """Single timestamped PID value with computed deltas."""

    pid: str
    value: Any
    timestamp: float
    delta: float | None = None
    rate_of_change: float | None = None


@dataclass
class _PIDBuffer:
    """Circular buffer for a single PID's history."""

    pid: str
    max_size: int = DEFAULT_BUFFER_SIZE
    readings: deque[PIDReading] = field(default_factory=lambda: deque(maxlen=DEFAULT_BUFFER_SIZE))

    def __post_init__(self) -> None:
        # Ensure the deque respects a custom max_size set after dataclass init
        if self.readings.maxlen != self.max_size:
            self.readings = deque(self.readings, maxlen=self.max_size)

    def append(self, reading: PIDReading) -> None:
        self.readings.append(reading)

    @property
    def latest(self) -> PIDReading | None:
        return self.readings[-1] if self.readings else None


# ---------------------------------------------------------------------------
# TelemetryCollector
# ---------------------------------------------------------------------------

class TelemetryCollector:
    """
    Asynchronous telemetry collector that polls OBD PIDs at tiered
    frequencies and maintains per-PID circular history buffers.

    Usage::

        collector = TelemetryCollector(source=obd_connector, vehicle_profile=profile)
        await collector.start()
        ...
        snapshot = collector.get_snapshot()
        ...
        await collector.stop()
    """

    def __init__(
        self,
        source: OBDSource,
        vehicle_profile: dict[str, Any],
        *,
        buffer_size: int = DEFAULT_BUFFER_SIZE,
        algorithm_dispatcher: Any | None = None,
    ) -> None:
        self._source = source
        self._vehicle = vehicle_profile
        self._buffer_size = buffer_size
        self._dispatcher = algorithm_dispatcher

        # Per-PID circular buffers, guarded by a re-entrant lock for
        # thread-safe reads from the API / WebSocket layer.
        self._lock = threading.RLock()
        self._buffers: dict[str, _PIDBuffer] = {}

        # Current assembled snapshot (latest value per PID).
        self._snapshot: dict[str, Any] = {}
        self._snapshot_timestamp: float = 0.0

        # Asyncio tasks for each polling tier.
        self._tasks: list[asyncio.Task[None]] = []
        self._running = False

        # Initialise buffers for all known PIDs.
        for pid in CRITICAL_PIDS + STANDARD_PIDS + SLOW_PIDS:
            self._buffers[pid] = _PIDBuffer(pid=pid, max_size=buffer_size)

        logger.info(
            "TelemetryCollector initialised — buffer_size=%d, vehicle=%s %s",
            buffer_size,
            vehicle_profile.get("make", "?"),
            vehicle_profile.get("model", "?"),
        )

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the tiered polling loops."""
        if self._running:
            logger.warning("Collector already running")
            return

        self._running = True
        self._tasks = [
            asyncio.create_task(
                self._poll_loop(CRITICAL_PIDS, CRITICAL_HZ, "critical"),
                name="poll-critical",
            ),
            asyncio.create_task(
                self._poll_loop(STANDARD_PIDS, STANDARD_HZ, "standard"),
                name="poll-standard",
            ),
            asyncio.create_task(
                self._poll_loop(SLOW_PIDS, SLOW_HZ, "slow"),
                name="poll-slow",
            ),
        ]
        logger.info("Telemetry polling started")

    async def stop(self) -> None:
        """Cancel all polling tasks and wait for clean shutdown."""
        if not self._running:
            return

        self._running = False
        for task in self._tasks:
            task.cancel()

        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()
        logger.info("Telemetry polling stopped")

    # ------------------------------------------------------------------
    # Data access (thread-safe)
    # ------------------------------------------------------------------

    def get_snapshot(self) -> dict[str, Any]:
        """Return a copy of the latest assembled snapshot."""
        with self._lock:
            return {
                "timestamp": self._snapshot_timestamp,
                "pids": dict(self._snapshot),
            }

    def get_history(self, pid: str, count: int | None = None) -> list[dict[str, Any]]:
        """
        Return the last *count* readings for *pid* as plain dicts.
        If *count* is ``None``, return the full buffer.
        """
        with self._lock:
            buf = self._buffers.get(pid)
            if buf is None:
                return []
            readings = list(buf.readings)
            if count is not None:
                readings = readings[-count:]
            return [
                {
                    "pid": r.pid,
                    "value": r.value,
                    "timestamp": r.timestamp,
                    "delta": r.delta,
                    "rate_of_change": r.rate_of_change,
                }
                for r in readings
            ]

    # ------------------------------------------------------------------
    # Internal polling
    # ------------------------------------------------------------------

    async def _poll_loop(
        self,
        pids: list[str],
        hz: float,
        tier_name: str,
    ) -> None:
        """Continuously poll *pids* at *hz* frequency."""
        interval = 1.0 / hz
        logger.debug("Polling tier '%s' started — %s PIDs @ %.1f Hz", tier_name, len(pids), hz)

        while self._running:
            loop_start = time.monotonic()
            for pid in pids:
                try:
                    raw_value = await self._source.query_pid(pid)
                except Exception:
                    logger.exception("Error querying PID %s", pid)
                    raw_value = None

                now = time.monotonic()
                self._record(pid, raw_value, now)

            # After each batch, fire algorithm dispatcher for critical tier
            if tier_name == "critical" and self._dispatcher is not None:
                try:
                    snapshot = self.get_snapshot()
                    self._dispatcher.dispatch(snapshot, self._vehicle)
                except Exception:
                    logger.exception("Algorithm dispatcher error")

            elapsed = time.monotonic() - loop_start
            sleep_time = max(0.0, interval - elapsed)
            await asyncio.sleep(sleep_time)

    def _record(self, pid: str, value: Any, timestamp: float) -> None:
        """Store a new reading, computing delta and rate-of-change."""
        with self._lock:
            buf = self._buffers.get(pid)
            if buf is None:
                buf = _PIDBuffer(pid=pid, max_size=self._buffer_size)
                self._buffers[pid] = buf

            previous = buf.latest
            delta: float | None = None
            roc: float | None = None

            if (
                previous is not None
                and previous.value is not None
                and value is not None
            ):
                try:
                    delta = float(value) - float(previous.value)
                    dt = timestamp - previous.timestamp
                    roc = delta / dt if dt > 0 else None
                except (TypeError, ValueError, ZeroDivisionError):
                    delta = None
                    roc = None

            reading = PIDReading(
                pid=pid,
                value=value,
                timestamp=timestamp,
                delta=delta,
                rate_of_change=roc,
            )
            buf.append(reading)

            # Update assembled snapshot.
            self._snapshot[pid] = value
            self._snapshot_timestamp = timestamp
