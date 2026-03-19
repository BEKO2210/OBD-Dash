"""
APEX CORTEX™ — OBD-II Connector
Async connection manager for ELM327 adapters via Bluetooth, WiFi, and USB serial.
Falls back to the simulator after exhausting retries.
"""

from __future__ import annotations

import asyncio
import logging
import platform
import threading
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import obd  # python-obd

from core.obd.pid_registry import PID_REGISTRY, get_pid_by_code
from core.obd.protocols import ProtocolDetector, ProtocolID

logger = logging.getLogger("apexcortex.connector")


# ---------------------------------------------------------------------------
# Connection transport type
# ---------------------------------------------------------------------------

class TransportType(Enum):
    USB_SERIAL = "usb_serial"
    BLUETOOTH = "bluetooth"
    WIFI_TCP = "wifi_tcp"
    UNKNOWN = "unknown"


# ---------------------------------------------------------------------------
# Query result wrapper
# ---------------------------------------------------------------------------

@dataclass
class OBDResponse:
    """Unified response returned by both the real connector and the simulator."""

    pid_code: int
    pid_name: str
    value: float | None
    unit: str
    timestamp: float  # time.time()
    is_simulated: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "pid_code": hex(self.pid_code),
            "pid_name": self.pid_name,
            "value": self.value,
            "unit": self.unit,
            "timestamp": self.timestamp,
            "is_simulated": self.is_simulated,
        }


# ---------------------------------------------------------------------------
# Port auto-detection
# ---------------------------------------------------------------------------

# Well-known ELM327 adapter ports
_BLUETOOTH_PORTS = ["/dev/rfcomm0", "/dev/rfcomm1"]
_USB_SERIAL_PORTS_LINUX = [
    "/dev/ttyUSB0", "/dev/ttyUSB1",
    "/dev/ttyACM0", "/dev/ttyACM1",
]
_USB_SERIAL_PORTS_MACOS = [
    "/dev/tty.usbserial-*",
    "/dev/tty.OBDLink*",
    "/dev/tty.OBDII*",
]
_WIFI_TCP_ADDRESSES = [
    ("192.168.0.10", 35000),   # OBDLink MX Wi-Fi default
    ("192.168.1.10", 35000),
    ("192.168.0.10", 23),      # Some cheap WiFi adapters
]

_MAX_RETRIES = 3
_INITIAL_BACKOFF_S = 1.0


def _detect_transport(port: str) -> TransportType:
    """Guess transport type from the port/address string."""
    if port.startswith("/dev/rfcomm"):
        return TransportType.BLUETOOTH
    if port.startswith("/dev/tty"):
        return TransportType.USB_SERIAL
    if ":" in port and not port.startswith("/"):
        return TransportType.WIFI_TCP
    return TransportType.UNKNOWN


def _candidate_ports() -> list[str]:
    """Return a prioritised list of candidate connection strings to try."""
    system = platform.system()
    candidates: list[str] = []

    # Bluetooth first (common for track-day setups)
    candidates.extend(_BLUETOOTH_PORTS)

    # USB serial
    if system == "Linux":
        candidates.extend(_USB_SERIAL_PORTS_LINUX)

    # WiFi TCP (formatted as host:port for python-obd)
    for host, port in _WIFI_TCP_ADDRESSES:
        candidates.append(f"{host}:{port}")

    # python-obd auto-scan as last resort
    try:
        scan_results = obd.scan_serial()
        for p in scan_results:
            if p not in candidates:
                candidates.append(p)
    except Exception:
        pass

    return candidates


# ---------------------------------------------------------------------------
# OBDConnector
# ---------------------------------------------------------------------------

class OBDConnector:
    """
    Thread-safe, async-friendly OBD-II connector using python-obd.

    Supports Bluetooth serial, WiFi TCP, and USB serial adapters.
    On connection failure it retries with exponential backoff, then falls
    back to the built-in simulator.

    Usage::

        connector = OBDConnector()
        await connector.connect()
        response = await connector.query(0x0C)  # RPM
        await connector.disconnect()
    """

    def __init__(self) -> None:
        self._connection: obd.OBD | None = None
        self._lock = threading.RLock()
        self._transport: TransportType = TransportType.UNKNOWN
        self._port: str = ""
        self._protocol_detector = ProtocolDetector()
        self._using_simulator: bool = False
        self._simulator: Any | None = None  # Lazy import to avoid circular deps

    # -- Properties --------------------------------------------------------

    @property
    def port(self) -> str:
        return self._port

    @property
    def transport(self) -> TransportType:
        return self._transport

    @property
    def using_simulator(self) -> bool:
        return self._using_simulator

    # -- Connection state --------------------------------------------------

    def is_connected(self) -> bool:
        """Return True if there is an active OBD connection (real or simulated)."""
        if self._using_simulator:
            return True
        with self._lock:
            return self._connection is not None and self._connection.is_connected()

    def status(self) -> dict[str, Any]:
        """Return a JSON-serialisable status snapshot."""
        return {
            "connected": self.is_connected(),
            "port": self._port,
            "transport": self._transport.value,
            "using_simulator": self._using_simulator,
            "protocol": (
                str(self._connection.protocol_name())
                if self._connection and self._connection.is_connected()
                else None
            ),
        }

    # -- Connect / disconnect ----------------------------------------------

    async def connect(
        self,
        port: str | None = None,
        protocol: ProtocolID | None = None,
        baudrate: int | None = None,
    ) -> bool:
        """
        Establish an OBD-II connection.

        Tries the given *port* first, then auto-detects.  On failure, retries
        up to 3 times with exponential backoff before switching to the
        simulator.

        Args:
            port: Serial port or ``host:port`` for WiFi.  Auto-detected if None.
            protocol: Force a specific ELM327 protocol (auto if None).
            baudrate: Override baud rate (auto if None).

        Returns:
            True if the connection (or simulator fallback) is ready.
        """
        ports_to_try = [port] if port else _candidate_ports()
        last_error: Exception | None = None

        for candidate in ports_to_try:
            for attempt in range(1, _MAX_RETRIES + 1):
                backoff = _INITIAL_BACKOFF_S * (2 ** (attempt - 1))
                try:
                    logger.info(
                        "Connection attempt %d/%d on %s",
                        attempt, _MAX_RETRIES, candidate,
                    )
                    conn = await asyncio.get_event_loop().run_in_executor(
                        None,
                        self._sync_connect,
                        candidate,
                        protocol,
                        baudrate,
                    )
                    if conn is not None and conn.is_connected():
                        with self._lock:
                            self._connection = conn
                            self._port = candidate
                            self._transport = _detect_transport(candidate)
                            self._using_simulator = False
                        logger.info(
                            "Connected to %s via %s (protocol: %s)",
                            candidate,
                            self._transport.value,
                            conn.protocol_name(),
                        )
                        return True
                except Exception as exc:
                    last_error = exc
                    logger.warning(
                        "Attempt %d failed on %s: %s",
                        attempt, candidate, exc,
                    )

                if attempt < _MAX_RETRIES:
                    logger.debug("Backing off %.1fs before retry", backoff)
                    await asyncio.sleep(backoff)

        # All attempts exhausted — fall back to simulator
        logger.warning(
            "All connection attempts failed (last error: %s). Switching to simulator.",
            last_error,
        )
        return await self._activate_simulator()

    def _sync_connect(
        self,
        port: str,
        protocol: ProtocolID | None,
        baudrate: int | None,
    ) -> obd.OBD:
        """Blocking connect wrapper executed in a thread pool."""
        kwargs: dict[str, Any] = {"portstr": port, "fast": False}
        if protocol is not None:
            kwargs["protocol"] = str(protocol.value)
        if baudrate is not None:
            kwargs["baudrate"] = str(baudrate)

        return obd.OBD(**kwargs)

    async def disconnect(self) -> None:
        """Close the OBD connection (or shut down the simulator)."""
        with self._lock:
            if self._connection is not None:
                try:
                    self._connection.close()
                except Exception as exc:
                    logger.error("Error closing connection: %s", exc)
                finally:
                    self._connection = None
            if self._simulator is not None:
                self._simulator = None
            self._using_simulator = False
            self._port = ""
            self._transport = TransportType.UNKNOWN
        logger.info("Disconnected")

    # -- Query -------------------------------------------------------------

    async def query(self, pid_code: int) -> OBDResponse:
        """
        Query a single PID.

        If the simulator is active, delegates to ``OBDSimulator.query()``.
        Otherwise issues a real OBD command via python-obd.

        Args:
            pid_code: Integer PID code (e.g. 0x0C for RPM).

        Returns:
            An ``OBDResponse`` with the decoded value (or None on error).
        """
        import time

        pid_def = get_pid_by_code(pid_code)
        pid_name = pid_def["name"] if pid_def else f"PID_{hex(pid_code)}"
        unit = pid_def["unit"] if pid_def else ""

        # Simulator path
        if self._using_simulator and self._simulator is not None:
            return await self._simulator.query(pid_code)

        # Real OBD path
        with self._lock:
            conn = self._connection

        if conn is None or not conn.is_connected():
            logger.warning("query(%s) called but not connected", hex(pid_code))
            return OBDResponse(
                pid_code=pid_code,
                pid_name=pid_name,
                value=None,
                unit=unit,
                timestamp=time.time(),
            )

        try:
            cmd = obd.commands[1][pid_code]  # Mode 01
            raw_response = await asyncio.get_event_loop().run_in_executor(
                None, conn.query, cmd,
            )
            value: float | None = None
            if raw_response and not raw_response.is_null():
                value = raw_response.value.magnitude if hasattr(raw_response.value, "magnitude") else float(raw_response.value)

            return OBDResponse(
                pid_code=pid_code,
                pid_name=pid_name,
                value=value,
                unit=unit,
                timestamp=time.time(),
            )
        except Exception as exc:
            logger.error("Error querying %s: %s", hex(pid_code), exc)
            return OBDResponse(
                pid_code=pid_code,
                pid_name=pid_name,
                value=None,
                unit=unit,
                timestamp=time.time(),
            )

    async def query_batch(self, pid_codes: list[int]) -> dict[int, OBDResponse]:
        """Query multiple PIDs concurrently. Returns dict keyed by PID code."""
        tasks = [self.query(code) for code in pid_codes]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        batch: dict[int, OBDResponse] = {}
        for code, result in zip(pid_codes, results):
            if isinstance(result, Exception):
                import time
                pid_def = get_pid_by_code(code)
                batch[code] = OBDResponse(
                    pid_code=code,
                    pid_name=pid_def["name"] if pid_def else f"PID_{hex(code)}",
                    value=None,
                    unit=pid_def["unit"] if pid_def else "",
                    timestamp=time.time(),
                )
            else:
                batch[code] = result
        return batch

    # -- Simulator fallback ------------------------------------------------

    async def _activate_simulator(self) -> bool:
        """Import and start the OBD simulator as a fallback."""
        try:
            from core.obd.simulator import OBDSimulator, SimulatorMode
            self._simulator = OBDSimulator()
            await self._simulator.start()
            self._using_simulator = True
            self._port = "simulator"
            self._transport = TransportType.UNKNOWN
            logger.info("Simulator activated as fallback")
            return True
        except Exception as exc:
            logger.error("Failed to activate simulator: %s", exc)
            return False

    # -- Context manager ---------------------------------------------------

    async def __aenter__(self) -> "OBDConnector":
        await self.connect()
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.disconnect()
