"""
APEX CORTEX™ — WebSocket Broadcaster
Manages connected WebSocket clients and broadcasts telemetry JSON at ~10Hz.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger("apex.websocket")


class WebSocketManager:
    """Fan-out broadcaster for real-time telemetry data.

    Usage:
        manager = WebSocketManager()

        # In a FastAPI WebSocket endpoint:
        await manager.connect(websocket)

        # From the telemetry loop (runs at ~10Hz):
        await manager.broadcast(payload_dict)
    """

    def __init__(self) -> None:
        self._clients: list[WebSocket] = []
        self._lock: asyncio.Lock = asyncio.Lock()
        self._broadcast_count: int = 0
        self._last_broadcast_ts: float = 0.0

    # ------------------------------------------------------------------
    # Connection lifecycle
    # ------------------------------------------------------------------

    async def connect(self, websocket: WebSocket) -> None:
        """Accept an incoming WebSocket and register it."""
        await websocket.accept()
        async with self._lock:
            self._clients.append(websocket)
        logger.info(
            "WebSocket client connected — %d active client(s)",
            len(self._clients),
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        """Unregister a WebSocket client."""
        async with self._lock:
            try:
                self._clients.remove(websocket)
            except ValueError:
                pass
        logger.info(
            "WebSocket client disconnected — %d active client(s)",
            len(self._clients),
        )

    async def handle_client(self, websocket: WebSocket) -> None:
        """Block while a client is connected, handling disconnect cleanly.

        Call this from the WebSocket endpoint so FastAPI keeps the
        connection alive. The client does not need to send data — this
        simply waits for the disconnect event.
        """
        await self.connect(websocket)
        try:
            while True:
                # Wait for any message (ping / pong / close).  We don't
                # expect the client to send meaningful data, but we need
                # the receive loop to detect disconnects.
                try:
                    await websocket.receive_text()
                except WebSocketDisconnect:
                    break
        finally:
            await self.disconnect(websocket)

    # ------------------------------------------------------------------
    # Broadcasting
    # ------------------------------------------------------------------

    async def broadcast(self, data: dict[str, Any]) -> None:
        """Send *data* as JSON to every connected client.

        Disconnected or errored clients are silently removed.
        """
        if not self._clients:
            return

        self._last_broadcast_ts = time.time()
        self._broadcast_count += 1

        stale: list[WebSocket] = []

        async with self._lock:
            clients_snapshot = list(self._clients)

        # Fan-out concurrently for lower latency.
        async def _send(ws: WebSocket) -> None:
            try:
                if ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_json(data)
                else:
                    stale.append(ws)
            except (WebSocketDisconnect, RuntimeError, Exception) as exc:
                logger.debug("Dropping stale WebSocket: %s", exc)
                stale.append(ws)

        await asyncio.gather(*(_send(ws) for ws in clients_snapshot))

        # Clean up disconnected clients.
        if stale:
            async with self._lock:
                for ws in stale:
                    try:
                        self._clients.remove(ws)
                    except ValueError:
                        pass
            logger.info(
                "Removed %d stale WebSocket client(s) — %d remaining",
                len(stale),
                len(self._clients),
            )

    # ------------------------------------------------------------------
    # Introspection
    # ------------------------------------------------------------------

    @property
    def client_count(self) -> int:
        """Number of currently connected clients."""
        return len(self._clients)

    @property
    def broadcast_count(self) -> int:
        """Total number of broadcast calls since creation."""
        return self._broadcast_count

    @property
    def last_broadcast_ts(self) -> float:
        """Unix timestamp of the most recent broadcast (0.0 if never)."""
        return self._last_broadcast_ts
