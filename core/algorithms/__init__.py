"""
APEX CORTEX™ — Algorithm Registry & Dispatcher
Registers all algorithm modules and dispatches snapshot processing.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

from core.algorithms import (
    braking,
    dynamics,
    fuel,
    lap_timer,
    performance,
    shift_advisor,
    thermal,
    traction,
)

logger = logging.getLogger("apex.algorithms")

# Type alias for algorithm calculate functions.
AlgorithmFn = Callable[[dict[str, Any], dict[str, Any]], dict[str, Any]]


class AlgorithmDispatcher:
    """
    Central dispatcher that invokes every registered algorithm module
    against a telemetry snapshot and vehicle profile.

    Each algorithm is isolated — an exception in one does not affect the
    others.  Results from all algorithms are merged into a single dict.

    Usage::

        dispatcher = AlgorithmDispatcher()
        results = dispatcher.dispatch(snapshot, vehicle_profile)
    """

    def __init__(self) -> None:
        self._algorithms: dict[str, AlgorithmFn] = {}
        self._last_results: dict[str, Any] = {}
        self._register_defaults()

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, name: str, fn: AlgorithmFn) -> None:
        """Register an algorithm by *name*."""
        if name in self._algorithms:
            logger.warning("Overwriting existing algorithm: %s", name)
        self._algorithms[name] = fn
        logger.debug("Registered algorithm: %s", name)

    def unregister(self, name: str) -> None:
        """Remove an algorithm by *name*."""
        self._algorithms.pop(name, None)

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------

    def dispatch(
        self,
        snapshot: dict[str, Any],
        vehicle_profile: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Run every registered algorithm and return a merged results dict.

        The returned dict has top-level keys matching each algorithm name,
        plus a ``_meta`` key with timing information.
        """
        results: dict[str, Any] = {}
        timings: dict[str, float] = {}

        for name, fn in self._algorithms.items():
            t0 = time.monotonic()
            try:
                algo_result = fn(snapshot, vehicle_profile)
                results[name] = algo_result
            except Exception:
                logger.exception("Algorithm '%s' raised an exception", name)
                results[name] = {"_error": True}
            timings[name] = round((time.monotonic() - t0) * 1000, 3)

        results["_meta"] = {
            "algorithm_count": len(self._algorithms),
            "timings_ms": timings,
            "snapshot_timestamp": snapshot.get("timestamp"),
        }

        self._last_results = results
        return results

    @property
    def last_results(self) -> dict[str, Any]:
        """Return the results from the most recent dispatch call."""
        return dict(self._last_results)

    @property
    def registered_algorithms(self) -> list[str]:
        """Return names of all registered algorithms."""
        return list(self._algorithms.keys())

    # ------------------------------------------------------------------
    # Default registration
    # ------------------------------------------------------------------

    def _register_defaults(self) -> None:
        """Register the built-in APEX CORTEX algorithm suite."""
        self.register("performance", performance.calculate)
        self.register("dynamics", dynamics.calculate)
        self.register("fuel", fuel.calculate)
        self.register("braking", braking.calculate)
        self.register("traction", traction.calculate)
        self.register("thermal", thermal.calculate)
        self.register("shift_advisor", shift_advisor.calculate)
        self.register("lap_timer", lap_timer.calculate)
        logger.info(
            "Registered %d default algorithms", len(self._algorithms)
        )


__all__ = ["AlgorithmDispatcher"]
