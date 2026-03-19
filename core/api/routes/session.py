"""
APEX CORTEX™ — Session Routes
Session recording management: start, stop, list, and retrieve sessions.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/session", tags=["session"])

# Default session save directory (overridden by SESSION_SAVE_PATH env var).
_DEFAULT_SESSIONS_DIR = Path(__file__).resolve().parents[3] / "sessions"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class SessionStartRequest(BaseModel):
    """Optional metadata when starting a session."""

    name: str | None = Field(None, description="Human-readable session name")
    track: str | None = Field(None, description="Track / circuit name")
    notes: str | None = Field(None, description="Driver notes")


class SessionStartResponse(BaseModel):
    session_id: str
    started_at: float = Field(..., description="Unix epoch timestamp")
    message: str = "Session recording started"


class SessionStopResponse(BaseModel):
    session_id: str
    started_at: float
    stopped_at: float
    duration_s: float
    snapshots: int = Field(..., description="Total telemetry snapshots captured")
    file: str | None = Field(None, description="Path to saved session file")
    message: str = "Session recording stopped and saved"


class SessionSummary(BaseModel):
    session_id: str
    name: str | None = None
    track: str | None = None
    started_at: float | None = None
    stopped_at: float | None = None
    duration_s: float | None = None
    snapshots: int | None = None
    file: str


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]
    total: int


class SessionDetailResponse(BaseModel):
    session_id: str
    meta: dict[str, Any] = {}
    data: list[dict[str, Any]] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sessions_dir(request: Request) -> Path:
    """Resolve the session save directory from app state or env."""
    custom = getattr(request.app.state, "session_save_path", None)
    if custom:
        p = Path(custom)
    else:
        p = Path(os.getenv("SESSION_SAVE_PATH", str(_DEFAULT_SESSIONS_DIR)))
    p.mkdir(parents=True, exist_ok=True)
    return p


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/start",
    response_model=SessionStartResponse,
    summary="Start recording session",
    description="Begin a new telemetry recording session. The SessionLogger "
                "(if available) will be instructed to start capturing snapshots.",
)
async def start_session(
    request: Request,
    body: SessionStartRequest | None = None,
) -> SessionStartResponse:
    """Start recording telemetry data."""

    state = request.app.state
    logger = getattr(state, "session_logger", None)

    # Prevent double-start
    if getattr(state, "_active_session", None) is not None:
        raise HTTPException(
            status_code=409,
            detail="A session is already recording. Stop it first.",
        )

    session_id = f"session_{int(time.time())}_{os.getpid()}"
    started_at = time.time()

    meta: dict[str, Any] = {
        "session_id": session_id,
        "started_at": started_at,
        "name": body.name if body else None,
        "track": body.track if body else None,
        "notes": body.notes if body else None,
    }

    # If a SessionLogger instance is attached, delegate to it.
    if logger is not None and callable(getattr(logger, "start", None)):
        try:
            logger.start(session_id=session_id, meta=meta)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Store active session info on app state for the telemetry loop.
    state._active_session = {
        "session_id": session_id,
        "started_at": started_at,
        "meta": meta,
        "snapshots": [],
    }

    return SessionStartResponse(session_id=session_id, started_at=started_at)


@router.post(
    "/stop",
    response_model=SessionStopResponse,
    summary="Stop recording session",
    description="Stop the current telemetry session, save it to disk, and "
                "return a summary of what was captured.",
)
async def stop_session(request: Request) -> SessionStopResponse:
    """Stop recording and persist session data."""

    state = request.app.state
    active = getattr(state, "_active_session", None)

    if active is None:
        raise HTTPException(status_code=404, detail="No active session to stop.")

    session_id: str = active["session_id"]
    started_at: float = active["started_at"]
    stopped_at: float = time.time()
    snapshots: list[dict] = active.get("snapshots", [])

    # Delegate to SessionLogger if available.
    logger = getattr(state, "session_logger", None)
    saved_file: str | None = None
    if logger is not None and callable(getattr(logger, "stop", None)):
        try:
            result = logger.stop()
            if isinstance(result, (str, Path)):
                saved_file = str(result)
        except Exception:
            pass  # Best-effort; we still save our own copy below.

    # Persist a JSON file as a fallback / canonical copy.
    if saved_file is None:
        sessions_dir = _sessions_dir(request)
        out_path = sessions_dir / f"{session_id}.json"
        payload = {
            "meta": active["meta"],
            "stopped_at": stopped_at,
            "duration_s": round(stopped_at - started_at, 3),
            "snapshot_count": len(snapshots),
            "data": snapshots,
        }
        try:
            out_path.write_text(json.dumps(payload, default=str), encoding="utf-8")
            saved_file = str(out_path)
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Failed to save session: {exc}") from exc

    # Clear active session.
    state._active_session = None

    return SessionStopResponse(
        session_id=session_id,
        started_at=started_at,
        stopped_at=stopped_at,
        duration_s=round(stopped_at - started_at, 3),
        snapshots=len(snapshots),
        file=saved_file,
    )


@router.get(
    "/list",
    response_model=SessionListResponse,
    summary="List saved sessions",
    description="Return a list of all saved session files with basic metadata.",
)
async def list_sessions(request: Request) -> SessionListResponse:
    """List previously saved sessions."""

    sessions_dir = _sessions_dir(request)
    summaries: list[SessionSummary] = []

    for path in sorted(sessions_dir.glob("session_*.json"), reverse=True):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        meta = raw.get("meta", {})
        summaries.append(
            SessionSummary(
                session_id=meta.get("session_id", path.stem),
                name=meta.get("name"),
                track=meta.get("track"),
                started_at=meta.get("started_at"),
                stopped_at=raw.get("stopped_at"),
                duration_s=raw.get("duration_s"),
                snapshots=raw.get("snapshot_count"),
                file=str(path),
            )
        )

    return SessionListResponse(sessions=summaries, total=len(summaries))


@router.get(
    "/{session_id}",
    response_model=SessionDetailResponse,
    summary="Get session data",
    description="Retrieve full telemetry data for a specific session.",
)
async def get_session(session_id: str, request: Request) -> SessionDetailResponse:
    """Return the full data payload for one session."""

    sessions_dir = _sessions_dir(request)
    path = sessions_dir / f"{session_id}.json"

    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read session: {exc}") from exc

    return SessionDetailResponse(
        session_id=session_id,
        meta=raw.get("meta", {}),
        data=raw.get("data", []),
    )
