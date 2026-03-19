"""
APEX CORTEX™ — Session Logger
Records telemetry sessions to JSON and CSV for post-session analysis.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import os
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger("apex.telemetry.logger")

# Default sessions root relative to project root.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_SESSIONS_DIR = _PROJECT_ROOT / "sessions"


@dataclass
class SessionMeta:
    """Metadata for a recorded telemetry session."""

    session_id: str
    vehicle_make: str
    vehicle_model: str
    vehicle_year: int | None
    start_time: float
    end_time: float | None = None
    snapshot_count: int = 0
    file_json: str | None = None
    file_csv: str | None = None


class SessionLogger:
    """
    Records live telemetry snapshots to disk.

    Usage::

        sl = SessionLogger()
        sid = sl.start_session(vehicle_profile)
        sl.log_snapshot(snapshot)
        sl.stop_session()
        sl.export_session(sid, format="csv")
    """

    def __init__(self, sessions_dir: str | Path | None = None) -> None:
        self._sessions_dir = Path(sessions_dir) if sessions_dir else _SESSIONS_DIR
        self._sessions_dir.mkdir(parents=True, exist_ok=True)

        self._current_session: SessionMeta | None = None
        self._snapshots: list[dict[str, Any]] = []
        self._session_file: Path | None = None

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def start_session(self, vehicle_profile: dict[str, Any]) -> str:
        """
        Begin a new recording session.

        Returns the generated *session_id*.
        """
        if self._current_session is not None:
            logger.warning(
                "Starting new session while session %s is still active — auto-stopping",
                self._current_session.session_id,
            )
            self.stop_session()

        session_id = self._generate_session_id()
        session_dir = self._sessions_dir / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        self._current_session = SessionMeta(
            session_id=session_id,
            vehicle_make=vehicle_profile.get("make", "Unknown"),
            vehicle_model=vehicle_profile.get("model", "Unknown"),
            vehicle_year=vehicle_profile.get("year"),
            start_time=time.time(),
        )
        self._snapshots = []
        self._session_file = session_dir / "data.json"

        logger.info(
            "Session started: %s (%s %s)",
            session_id,
            self._current_session.vehicle_make,
            self._current_session.vehicle_model,
        )
        return session_id

    def stop_session(self) -> str | None:
        """
        Finalise and flush the current session to disk.

        Returns the *session_id* or ``None`` if no session was active.
        """
        if self._current_session is None:
            logger.warning("No active session to stop")
            return None

        self._current_session.end_time = time.time()
        self._current_session.snapshot_count = len(self._snapshots)

        session_id = self._current_session.session_id
        session_dir = self._sessions_dir / session_id

        # Write JSON
        json_path = session_dir / "data.json"
        self._write_json(json_path)
        self._current_session.file_json = str(json_path)

        # Write CSV
        csv_path = session_dir / "data.csv"
        self._write_csv(csv_path)
        self._current_session.file_csv = str(csv_path)

        # Write session metadata
        meta_path = session_dir / "meta.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(asdict(self._current_session), f, indent=2)

        logger.info(
            "Session stopped: %s — %d snapshots recorded",
            session_id,
            self._current_session.snapshot_count,
        )

        self._current_session = None
        self._snapshots = []
        self._session_file = None
        return session_id

    # ------------------------------------------------------------------
    # Snapshot logging
    # ------------------------------------------------------------------

    def log_snapshot(self, snapshot: dict[str, Any]) -> None:
        """Append a snapshot to the current session buffer."""
        if self._current_session is None:
            logger.debug("log_snapshot called with no active session — ignored")
            return

        self._snapshots.append(snapshot)

        # Periodic flush every 100 snapshots to avoid data loss.
        if len(self._snapshots) % 100 == 0 and self._session_file is not None:
            self._write_json(self._session_file)
            logger.debug("Intermediate flush at %d snapshots", len(self._snapshots))

    # ------------------------------------------------------------------
    # Export & listing
    # ------------------------------------------------------------------

    def export_session(
        self,
        session_id: str,
        format: str = "json",  # noqa: A002 — shadows builtin on purpose
    ) -> str:
        """
        Export a previously recorded session.

        Returns the file content as a string.
        """
        session_dir = self._sessions_dir / session_id
        if not session_dir.exists():
            raise FileNotFoundError(f"Session not found: {session_id}")

        if format == "csv":
            csv_path = session_dir / "data.csv"
            if not csv_path.exists():
                # Regenerate from JSON
                json_path = session_dir / "data.json"
                if not json_path.exists():
                    raise FileNotFoundError(f"No data files for session {session_id}")
                with open(json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                snapshots = data.get("snapshots", [])
                self._write_csv_from_snapshots(csv_path, snapshots)
            return csv_path.read_text(encoding="utf-8")

        # Default: JSON
        json_path = session_dir / "data.json"
        if not json_path.exists():
            raise FileNotFoundError(f"No JSON data for session {session_id}")
        return json_path.read_text(encoding="utf-8")

    def list_sessions(self) -> list[dict[str, Any]]:
        """Return metadata for all recorded sessions."""
        sessions: list[dict[str, Any]] = []
        if not self._sessions_dir.exists():
            return sessions

        for entry in sorted(self._sessions_dir.iterdir()):
            if not entry.is_dir():
                continue
            meta_path = entry / "meta.json"
            if meta_path.exists():
                try:
                    with open(meta_path, "r", encoding="utf-8") as f:
                        sessions.append(json.load(f))
                except (json.JSONDecodeError, OSError) as exc:
                    logger.warning("Failed to read meta for %s: %s", entry.name, exc)
            else:
                # Minimal metadata from directory name
                sessions.append({"session_id": entry.name, "status": "incomplete"})

        return sessions

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _generate_session_id() -> str:
        ts = time.strftime("%Y%m%d_%H%M%S")
        short_uuid = uuid.uuid4().hex[:8]
        return f"{ts}_{short_uuid}"

    def _write_json(self, path: Path) -> None:
        payload: dict[str, Any] = {
            "session": asdict(self._current_session) if self._current_session else {},
            "snapshots": self._snapshots,
        }
        tmp_path = path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, default=str)
        tmp_path.replace(path)

    def _write_csv(self, path: Path) -> None:
        self._write_csv_from_snapshots(path, self._snapshots)

    @staticmethod
    def _write_csv_from_snapshots(
        path: Path,
        snapshots: list[dict[str, Any]],
    ) -> None:
        if not snapshots:
            path.write_text("", encoding="utf-8")
            return

        # Collect all PID keys across all snapshots.
        all_pids: set[str] = set()
        for snap in snapshots:
            pids = snap.get("pids", {})
            all_pids.update(pids.keys())

        sorted_pids = sorted(all_pids)
        fieldnames = ["timestamp"] + sorted_pids

        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for snap in snapshots:
                row: dict[str, Any] = {"timestamp": snap.get("timestamp", "")}
                pids = snap.get("pids", {})
                for pid in sorted_pids:
                    row[pid] = pids.get(pid, "")
                writer.writerow(row)
