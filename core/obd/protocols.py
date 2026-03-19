"""
APEX CORTEX™ — OBD-II Protocol Definitions
Supports ISO 9141-2, ISO 14230-4 (KWP2000), ISO 15765-4 (CAN), and SAE J1850.
Includes automatic protocol detection logic.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger("apexcortex.protocols")


# ---------------------------------------------------------------------------
# Protocol identifiers (ELM327 AT SP codes)
# ---------------------------------------------------------------------------

class ProtocolID(Enum):
    """ELM327 protocol numbers used by the AT SP command."""
    AUTO = 0
    SAE_J1850_PWM = 1
    SAE_J1850_VPW = 2
    ISO_9141_2 = 3
    ISO_14230_4_KWP_5BAUD = 4
    ISO_14230_4_KWP_FAST = 5
    ISO_15765_4_CAN_11BIT_500K = 6
    ISO_15765_4_CAN_29BIT_500K = 7
    ISO_15765_4_CAN_11BIT_250K = 8
    ISO_15765_4_CAN_29BIT_250K = 9


# ---------------------------------------------------------------------------
# Protocol dataclass
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class OBDProtocol:
    """Describes a single OBD-II communication protocol."""

    id: ProtocolID
    name: str
    description: str
    baud_rate: int
    header_bytes: int
    max_data_bytes: int
    supported_pids: list[int] = field(default_factory=list)
    elm327_command: str = ""

    def __str__(self) -> str:
        return f"{self.name} ({self.baud_rate} baud)"


# ---------------------------------------------------------------------------
# Built-in protocol definitions
# ---------------------------------------------------------------------------

PROTOCOLS: dict[ProtocolID, OBDProtocol] = {
    ProtocolID.SAE_J1850_PWM: OBDProtocol(
        id=ProtocolID.SAE_J1850_PWM,
        name="SAE J1850 PWM",
        description="Pulse-width modulation signalling, primarily Ford vehicles (pre-2008)",
        baud_rate=41600,
        header_bytes=3,
        max_data_bytes=7,
        elm327_command="AT SP 1",
    ),
    ProtocolID.SAE_J1850_VPW: OBDProtocol(
        id=ProtocolID.SAE_J1850_VPW,
        name="SAE J1850 VPW",
        description="Variable pulse-width signalling, primarily GM vehicles (pre-2008)",
        baud_rate=10400,
        header_bytes=3,
        max_data_bytes=7,
        elm327_command="AT SP 2",
    ),
    ProtocolID.ISO_9141_2: OBDProtocol(
        id=ProtocolID.ISO_9141_2,
        name="ISO 9141-2",
        description="Asynchronous serial (K-line), common in European/Asian vehicles (1996-2004)",
        baud_rate=10400,
        header_bytes=3,
        max_data_bytes=7,
        elm327_command="AT SP 3",
    ),
    ProtocolID.ISO_14230_4_KWP_5BAUD: OBDProtocol(
        id=ProtocolID.ISO_14230_4_KWP_5BAUD,
        name="ISO 14230-4 KWP2000 (5-baud init)",
        description="Keyword Protocol 2000 with 5-baud initialization, European vehicles (2001-2007)",
        baud_rate=10400,
        header_bytes=3,
        max_data_bytes=7,
        elm327_command="AT SP 4",
    ),
    ProtocolID.ISO_14230_4_KWP_FAST: OBDProtocol(
        id=ProtocolID.ISO_14230_4_KWP_FAST,
        name="ISO 14230-4 KWP2000 (fast init)",
        description="Keyword Protocol 2000 with fast initialization, European vehicles (2001-2007)",
        baud_rate=10400,
        header_bytes=3,
        max_data_bytes=7,
        elm327_command="AT SP 5",
    ),
    ProtocolID.ISO_15765_4_CAN_11BIT_500K: OBDProtocol(
        id=ProtocolID.ISO_15765_4_CAN_11BIT_500K,
        name="ISO 15765-4 CAN (11-bit, 500 kbaud)",
        description="CAN bus with 11-bit identifiers at 500 kbaud — most modern vehicles (2008+)",
        baud_rate=500000,
        header_bytes=4,
        max_data_bytes=8,
        elm327_command="AT SP 6",
    ),
    ProtocolID.ISO_15765_4_CAN_29BIT_500K: OBDProtocol(
        id=ProtocolID.ISO_15765_4_CAN_29BIT_500K,
        name="ISO 15765-4 CAN (29-bit, 500 kbaud)",
        description="CAN bus with 29-bit identifiers at 500 kbaud — trucks, heavy-duty",
        baud_rate=500000,
        header_bytes=4,
        max_data_bytes=8,
        elm327_command="AT SP 7",
    ),
    ProtocolID.ISO_15765_4_CAN_11BIT_250K: OBDProtocol(
        id=ProtocolID.ISO_15765_4_CAN_11BIT_250K,
        name="ISO 15765-4 CAN (11-bit, 250 kbaud)",
        description="CAN bus with 11-bit identifiers at 250 kbaud — some European vehicles",
        baud_rate=250000,
        header_bytes=4,
        max_data_bytes=8,
        elm327_command="AT SP 8",
    ),
    ProtocolID.ISO_15765_4_CAN_29BIT_250K: OBDProtocol(
        id=ProtocolID.ISO_15765_4_CAN_29BIT_250K,
        name="ISO 15765-4 CAN (29-bit, 250 kbaud)",
        description="CAN bus with 29-bit identifiers at 250 kbaud — some trucks",
        baud_rate=250000,
        header_bytes=4,
        max_data_bytes=8,
        elm327_command="AT SP 9",
    ),
}


# ---------------------------------------------------------------------------
# Protocol detection helpers
# ---------------------------------------------------------------------------

# Year-based heuristic for initial protocol guess order
_DETECTION_ORDER: list[ProtocolID] = [
    ProtocolID.ISO_15765_4_CAN_11BIT_500K,   # Most common modern protocol
    ProtocolID.ISO_15765_4_CAN_29BIT_500K,
    ProtocolID.ISO_15765_4_CAN_11BIT_250K,
    ProtocolID.ISO_15765_4_CAN_29BIT_250K,
    ProtocolID.ISO_14230_4_KWP_FAST,
    ProtocolID.ISO_14230_4_KWP_5BAUD,
    ProtocolID.ISO_9141_2,
    ProtocolID.SAE_J1850_PWM,
    ProtocolID.SAE_J1850_VPW,
]

# Manufacturer-to-likely-protocol mapping
_MANUFACTURER_HINTS: dict[str, list[ProtocolID]] = {
    "mercedes": [ProtocolID.ISO_15765_4_CAN_11BIT_500K],
    "bmw": [ProtocolID.ISO_15765_4_CAN_11BIT_500K],
    "audi": [ProtocolID.ISO_15765_4_CAN_11BIT_500K],
    "porsche": [ProtocolID.ISO_15765_4_CAN_11BIT_500K],
    "ford": [ProtocolID.ISO_15765_4_CAN_11BIT_500K, ProtocolID.SAE_J1850_PWM],
    "gm": [ProtocolID.ISO_15765_4_CAN_11BIT_500K, ProtocolID.SAE_J1850_VPW],
    "chevrolet": [ProtocolID.ISO_15765_4_CAN_11BIT_500K, ProtocolID.SAE_J1850_VPW],
    "toyota": [ProtocolID.ISO_15765_4_CAN_11BIT_500K, ProtocolID.ISO_14230_4_KWP_FAST],
    "honda": [ProtocolID.ISO_15765_4_CAN_11BIT_500K, ProtocolID.ISO_9141_2],
    "volkswagen": [ProtocolID.ISO_15765_4_CAN_11BIT_500K, ProtocolID.ISO_14230_4_KWP_FAST],
}


def get_detection_order(manufacturer: str | None = None) -> list[ProtocolID]:
    """
    Return an ordered list of protocol IDs to try during auto-detection.

    If a manufacturer hint is provided, protocols known to be used by that
    manufacturer are tried first, followed by the remaining protocols.

    Args:
        manufacturer: Optional manufacturer name (lowercase) for hinting.

    Returns:
        Ordered list of ProtocolID values to attempt.
    """
    if manufacturer:
        key = manufacturer.lower().replace("-", "").replace(" ", "")
        # Partial match: "mercedes-amg" → "mercedes"
        hints: list[ProtocolID] = []
        for mfr_key, protos in _MANUFACTURER_HINTS.items():
            if mfr_key in key or key in mfr_key:
                hints = protos
                break

        if hints:
            remaining = [p for p in _DETECTION_ORDER if p not in hints]
            return hints + remaining

    return list(_DETECTION_ORDER)


def get_protocol(protocol_id: ProtocolID) -> OBDProtocol | None:
    """Look up a protocol definition by its ID."""
    return PROTOCOLS.get(protocol_id)


def get_protocol_by_name(name: str) -> OBDProtocol | None:
    """Look up a protocol definition by a partial name match (case-insensitive)."""
    name_lower = name.lower()
    for proto in PROTOCOLS.values():
        if name_lower in proto.name.lower():
            return proto
    return None


def is_can_protocol(protocol_id: ProtocolID) -> bool:
    """Return True if the protocol is CAN-based (ISO 15765-4)."""
    return protocol_id in {
        ProtocolID.ISO_15765_4_CAN_11BIT_500K,
        ProtocolID.ISO_15765_4_CAN_29BIT_500K,
        ProtocolID.ISO_15765_4_CAN_11BIT_250K,
        ProtocolID.ISO_15765_4_CAN_29BIT_250K,
    }


class ProtocolDetector:
    """
    Automatic OBD-II protocol detection.

    Uses ELM327 AT commands to negotiate the correct protocol with the vehicle
    ECU. Tries manufacturer-hinted protocols first, then falls through the
    full detection order.
    """

    def __init__(self, manufacturer: str | None = None) -> None:
        self._manufacturer = manufacturer
        self._detected: OBDProtocol | None = None
        self._detection_order = get_detection_order(manufacturer)

    @property
    def detected_protocol(self) -> OBDProtocol | None:
        """Return the most recently detected protocol, or None."""
        return self._detected

    def detect_from_elm_response(self, response: str) -> OBDProtocol | None:
        """
        Parse an ELM327 AT DPN (Describe Protocol by Number) response and
        return the matching OBDProtocol.

        The ELM327 responds to "AT DPN" with a single character 1-9 (or A-C).
        The leading 'A' prefix means auto-detected.

        Args:
            response: Raw string response from ELM327 AT DPN command.

        Returns:
            The detected OBDProtocol or None.
        """
        cleaned = response.strip().upper().lstrip("A")
        try:
            proto_num = int(cleaned)
            proto_id = ProtocolID(proto_num)
            self._detected = PROTOCOLS.get(proto_id)
            if self._detected:
                logger.info("Detected protocol: %s", self._detected.name)
            return self._detected
        except (ValueError, KeyError):
            logger.warning("Could not parse protocol from ELM327 response: %r", response)
            return None

    def get_next_protocol_to_try(self, tried: set[ProtocolID] | None = None) -> OBDProtocol | None:
        """
        Return the next protocol to attempt based on detection order.

        Args:
            tried: Set of already-attempted ProtocolID values.

        Returns:
            The next OBDProtocol to try, or None if all exhausted.
        """
        tried = tried or set()
        for proto_id in self._detection_order:
            if proto_id not in tried:
                proto = PROTOCOLS.get(proto_id)
                if proto:
                    logger.debug("Next protocol to try: %s", proto.name)
                    return proto
        logger.warning("All protocols exhausted during detection")
        return None

    def get_elm327_setup_commands(self, protocol_id: ProtocolID) -> list[str]:
        """
        Return the sequence of ELM327 AT commands needed to initialize
        communication on the given protocol.

        Args:
            protocol_id: The target protocol.

        Returns:
            List of AT command strings.
        """
        proto = PROTOCOLS.get(protocol_id)
        if proto is None:
            return []

        commands = [
            "AT Z",        # Reset
            "AT E0",       # Echo off
            "AT L0",       # Linefeeds off
            "AT S0",       # Spaces off (faster transfer)
            "AT H0",       # Headers off
            "AT AT1",      # Adaptive timing on
            proto.elm327_command,  # Set protocol
        ]

        # CAN protocols benefit from larger buffers
        if is_can_protocol(protocol_id):
            commands.append("AT CAF1")  # CAN auto-formatting on
            commands.append("AT ST 96")  # Timeout ~150ms for CAN

        return commands
