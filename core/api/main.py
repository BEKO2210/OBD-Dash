"""
APEX CORTEX™ — FastAPI Entry Point

Creates and configures the FastAPI application:
  - Loads environment variables from .env
  - Initialises OBD connector (or simulator when SIMULATOR_MODE=true)
  - Loads the active vehicle profile
  - Starts the async telemetry collection & broadcast loop at ~10Hz
  - Exposes REST routes and the /ws/telemetry WebSocket endpoint
  - Shuts down cleanly on SIGINT / SIGTERM

Run with:
    python -m core.api.main
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from core.api.websocket import WebSocketManager
from core.api.routes.status import router as status_router
from core.api.routes.session import router as session_router
from core.api.routes.vehicle import router as vehicle_router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)-20s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("apex.api")

# ---------------------------------------------------------------------------
# Project root (three levels up from this file)
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

# ---------------------------------------------------------------------------
# Safe dynamic imports
# ---------------------------------------------------------------------------
# The OBD, telemetry, and algorithm modules may not yet be fully implemented.
# We import them defensively so the API server can start regardless and
# degrade gracefully when pieces are missing.


def _try_import(dotted: str) -> Any:
    """Attempt to import *dotted* path; return None on failure."""
    try:
        parts = dotted.rsplit(".", 1)
        mod = __import__(parts[0], fromlist=[parts[1]] if len(parts) == 2 else [])
        return getattr(mod, parts[1]) if len(parts) == 2 else mod
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not import %s: %s", dotted, exc)
        return None


OBDConnector = _try_import("core.obd.connector.OBDConnector")
OBDSimulator = _try_import("core.obd.simulator.OBDSimulator")
TelemetryCollector = _try_import("core.telemetry.collector.TelemetryCollector")
TelemetryProcessor = _try_import("core.telemetry.processor.TelemetryProcessor")
SessionLogger = _try_import("core.telemetry.logger.SessionLogger")

# Algorithm modules — each exposes a ``calculate(snapshot, vehicle) -> dict``.
_ALGORITHM_NAMES = [
    "performance",
    "dynamics",
    "fuel",
    "braking",
    "thermal",
    "shift_advisor",
    "lap_timer",
    "traction",
]

_algorithms: dict[str, Any] = {}
for _name in _ALGORITHM_NAMES:
    _mod = _try_import(f"core.algorithms.{_name}")
    if _mod is not None:
        _algorithms[_name] = _mod


# ---------------------------------------------------------------------------
# Vehicle profile loader
# ---------------------------------------------------------------------------

def _load_vehicle_profile(profile_id: str | None) -> dict[str, Any] | None:
    """Load a vehicle profile JSON by its id (filename stem)."""
    if not profile_id:
        return None
    vehicles_dir = PROJECT_ROOT / "config" / "vehicles"
    path = vehicles_dir / f"{profile_id}.json"
    if not path.exists():
        logger.warning("Vehicle profile '%s' not found at %s", profile_id, path)
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        logger.info("Loaded vehicle profile: %s", profile_id)
        return data
    except (OSError, json.JSONDecodeError) as exc:
        logger.error("Failed to load vehicle profile '%s': %s", profile_id, exc)
        return None


# ---------------------------------------------------------------------------
# Telemetry broadcast loop
# ---------------------------------------------------------------------------

async def _telemetry_loop(app: FastAPI) -> None:
    """Collect telemetry, run algorithms, broadcast via WebSocket at ~10Hz.

    This coroutine runs for the lifetime of the application and is cancelled
    during shutdown.
    """
    state = app.state
    ws_manager: WebSocketManager = state.ws_manager
    connector = getattr(state, "obd_connector", None)
    collector = getattr(state, "telemetry_collector", None)
    processor = getattr(state, "telemetry_processor", None)
    vehicle: dict[str, Any] | None = getattr(state, "vehicle_profile", None)

    target_interval = 1.0 / 10.0  # 10 Hz

    logger.info("Telemetry loop started (target %.0f Hz)", 1.0 / target_interval)

    while True:
        loop_start = time.monotonic()

        try:
            # 1. Collect a raw snapshot from the OBD connector / simulator.
            snapshot: dict[str, Any] = {}

            if collector is not None and callable(getattr(collector, "collect", None)):
                snapshot = await _maybe_await(collector.collect())
            elif connector is not None:
                # Fallback: read directly from the connector.
                if callable(getattr(connector, "snapshot", None)):
                    snapshot = await _maybe_await(connector.snapshot())
                elif callable(getattr(connector, "get_snapshot", None)):
                    snapshot = await _maybe_await(connector.get_snapshot())

            # 2. Process / normalise (if processor is available).
            if processor is not None and callable(getattr(processor, "process", None)):
                snapshot = await _maybe_await(processor.process(snapshot))

            # Re-read vehicle profile in case it was changed at runtime.
            vehicle = getattr(state, "vehicle_profile", vehicle)

            # 3. Run every registered algorithm.
            calc: dict[str, Any] = {}
            for algo_key, algo_mod in _algorithms.items():
                calc_fn = getattr(algo_mod, "calculate", None)
                if calc_fn is None:
                    continue
                try:
                    result = await _maybe_await(calc_fn(snapshot, vehicle or {}))
                    if isinstance(result, dict):
                        calc[algo_key] = result
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Algorithm '%s' error: %s", algo_key, exc)

            # 4. Assemble the broadcast payload.
            alerts: list[dict[str, Any]] = _collect_alerts(calc)
            payload: dict[str, Any] = {
                "ts": time.time(),
                "obd": snapshot,
                "calc": calc,
                "alerts": alerts,
            }

            # 5. Append to active session recording (if any).
            active_session = getattr(state, "_active_session", None)
            if active_session is not None:
                active_session.setdefault("snapshots", []).append(payload)

            # 6. Broadcast to WebSocket clients.
            await ws_manager.broadcast(payload)

        except asyncio.CancelledError:
            logger.info("Telemetry loop cancelled — shutting down")
            return
        except Exception as exc:  # noqa: BLE001
            logger.error("Telemetry loop error: %s", exc, exc_info=True)

        # Maintain ~10 Hz cadence.
        elapsed = time.monotonic() - loop_start
        sleep_time = max(0.0, target_interval - elapsed)
        await asyncio.sleep(sleep_time)


async def _maybe_await(value: Any) -> Any:
    """If *value* is a coroutine or awaitable, await it; otherwise return as-is."""
    if asyncio.iscoroutine(value) or asyncio.isfuture(value):
        return await value
    return value


def _collect_alerts(calc: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract alert-worthy conditions from algorithm outputs."""
    alerts: list[dict[str, Any]] = []

    # Thermal alerts
    thermal = calc.get("thermal", {})
    trs = thermal.get("trs")
    if trs is not None and trs > 0.85:
        alerts.append({
            "type": "thermal",
            "severity": "critical" if trs > 0.95 else "warning",
            "message": f"Thermal risk score {trs:.2f} — "
                       f"{'CRITICAL OVERHEATING' if trs > 0.95 else 'high thermal load'}",
        })

    # Brake fade
    braking = calc.get("braking", {})
    if braking.get("brake_fade_warning"):
        alerts.append({
            "type": "braking",
            "severity": "warning",
            "message": "Brake fade detected — reduce brake intensity",
        })

    # Traction / stability
    traction = calc.get("traction", {})
    stability = traction.get("stability_state")
    if stability and stability not in ("STABLE", "stable"):
        alerts.append({
            "type": "traction",
            "severity": "warning",
            "message": f"Stability state: {stability}",
        })

    # Shift advisor
    shift = calc.get("shift_advisor", {})
    if shift.get("shift_now"):
        alerts.append({
            "type": "shift",
            "severity": "info",
            "message": f"SHIFT NOW — optimal RPM {shift.get('optimal_shift_rpm', 'N/A')}",
        })

    # Fuel
    fuel = calc.get("fuel", {})
    pit_window = fuel.get("pit_window_laps")
    if pit_window is not None and pit_window <= 3:
        alerts.append({
            "type": "fuel",
            "severity": "warning" if pit_window > 1 else "critical",
            "message": f"Pit window in {pit_window} lap(s)",
        })

    return alerts


# ---------------------------------------------------------------------------
# Application lifespan (startup + shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application startup and shutdown."""

    # ── Load environment ──────────────────────────────────────────────
    env_path = PROJECT_ROOT / ".env"
    load_dotenv(dotenv_path=env_path if env_path.exists() else None)
    logger.info("Environment loaded (PROJECT_ROOT=%s)", PROJECT_ROOT)

    simulator_mode = os.getenv("SIMULATOR_MODE", "true").lower() in ("true", "1", "yes")
    app.state.simulator_mode = simulator_mode

    # ── Load vehicle profile ──────────────────────────────────────────
    profile_id = os.getenv("SIMULATOR_PROFILE") or os.getenv("VEHICLE_PROFILE")
    vehicle_profile = _load_vehicle_profile(profile_id)
    app.state.vehicle_profile = vehicle_profile
    app.state.vehicle_profile_id = profile_id

    # ── Session save path ─────────────────────────────────────────────
    app.state.session_save_path = os.getenv("SESSION_SAVE_PATH", str(PROJECT_ROOT / "sessions"))
    app.state._active_session = None

    # ── OBD connector / simulator ─────────────────────────────────────
    connector = None
    if simulator_mode and OBDSimulator is not None:
        logger.info("Starting OBD simulator (profile=%s)", profile_id or "default")
        try:
            connector = OBDSimulator(vehicle_profile=vehicle_profile)
            if callable(getattr(connector, "connect", None)):
                await _maybe_await(connector.connect())
        except Exception as exc:
            logger.error("Simulator init failed: %s", exc)
    elif not simulator_mode and OBDConnector is not None:
        port = os.getenv("OBD_PORT", "auto")
        protocol = os.getenv("OBD_PROTOCOL", "auto")
        baudrate = int(os.getenv("OBD_BAUDRATE", "38400"))
        logger.info("Connecting to OBD adapter (port=%s, protocol=%s)", port, protocol)
        try:
            connector = OBDConnector(
                port=port if port != "auto" else None,
                protocol=protocol if protocol != "auto" else None,
                baudrate=baudrate,
            )
            if callable(getattr(connector, "connect", None)):
                await _maybe_await(connector.connect())
        except Exception as exc:
            logger.error("OBD connection failed: %s", exc)
    else:
        logger.warning(
            "No OBD connector available (simulator_mode=%s, "
            "OBDSimulator=%s, OBDConnector=%s)",
            simulator_mode,
            OBDSimulator,
            OBDConnector,
        )

    app.state.obd_connector = connector

    # ── Telemetry collector ───────────────────────────────────────────
    collector = None
    if TelemetryCollector is not None and connector is not None:
        try:
            collector = TelemetryCollector(connector=connector)
            if callable(getattr(collector, "start", None)):
                await _maybe_await(collector.start())
        except Exception as exc:
            logger.error("TelemetryCollector init failed: %s", exc)
    app.state.telemetry_collector = collector

    # ── Telemetry processor ───────────────────────────────────────────
    processor = None
    if TelemetryProcessor is not None:
        try:
            processor = TelemetryProcessor()
        except Exception as exc:
            logger.error("TelemetryProcessor init failed: %s", exc)
    app.state.telemetry_processor = processor

    # ── Session logger ────────────────────────────────────────────────
    session_logger = None
    if SessionLogger is not None:
        try:
            session_logger = SessionLogger(
                save_path=app.state.session_save_path,
            )
        except Exception as exc:
            logger.error("SessionLogger init failed: %s", exc)
    app.state.session_logger = session_logger

    # ── WebSocket manager ─────────────────────────────────────────────
    ws_manager = WebSocketManager()
    app.state.ws_manager = ws_manager

    # ── Start telemetry broadcast loop ────────────────────────────────
    telemetry_task = asyncio.create_task(_telemetry_loop(app))
    app.state._telemetry_task = telemetry_task

    logger.info(
        "APEX CORTEX API ready  |  simulator=%s  |  vehicle=%s  |  algorithms=%d",
        simulator_mode,
        profile_id or "(none)",
        len(_algorithms),
    )

    # ── Yield to application ──────────────────────────────────────────
    yield

    # ── Shutdown ──────────────────────────────────────────────────────
    logger.info("Shutting down APEX CORTEX API...")

    # Cancel telemetry loop.
    telemetry_task.cancel()
    try:
        await telemetry_task
    except asyncio.CancelledError:
        pass

    # Stop telemetry collector.
    if collector is not None and callable(getattr(collector, "stop", None)):
        try:
            await _maybe_await(collector.stop())
        except Exception as exc:
            logger.error("Collector stop error: %s", exc)

    # Disconnect OBD.
    if connector is not None and callable(getattr(connector, "disconnect", None)):
        try:
            await _maybe_await(connector.disconnect())
        except Exception as exc:
            logger.error("OBD disconnect error: %s", exc)

    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="APEX CORTEX API",
    description=(
        "Real-time racing telemetry API for the APEX CORTEX dashboard. "
        "Provides OBD-II data, algorithm outputs, session management, and "
        "vehicle profile configuration."
    ),
    version="0.1.0-alpha",
    lifespan=lifespan,
)

# ── CORS middleware (allow frontend dev server) ───────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # CRA / alternative
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include REST routers ─────────────────────────────────────────────────

app.include_router(status_router)
app.include_router(session_router)
app.include_router(vehicle_router)


# ── WebSocket endpoint ───────────────────────────────────────────────────

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket) -> None:
    """WebSocket endpoint that streams telemetry data at ~10Hz."""
    ws_manager: WebSocketManager = websocket.app.state.ws_manager
    await ws_manager.handle_client(websocket)


# ---------------------------------------------------------------------------
# Programmatic uvicorn runner
# ---------------------------------------------------------------------------

def main() -> None:
    """Run the API server via uvicorn."""
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))

    logger.info("Starting uvicorn on %s:%d", host, port)
    uvicorn.run(
        "core.api.main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info",
        ws="websockets",
    )


if __name__ == "__main__":
    main()


# Allow:  python -m core.api.main
# The __main__.py approach also works if you add a __main__.py to the package.
