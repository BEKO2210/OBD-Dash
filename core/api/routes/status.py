"""
APEX CORTEX™ — Status Routes
GET /api/status: OBD-II connection status and system health.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["status"])


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class OBDStatusResponse(BaseModel):
    """Current OBD-II connection status."""

    connected: bool = Field(
        ..., description="Whether the OBD-II adapter is currently connected"
    )
    port: str | None = Field(
        None, description="Serial port or address of the adapter"
    )
    protocol: str | None = Field(
        None, description="Active OBD protocol (e.g. ISO 15765-4 CAN)"
    )
    simulator_mode: bool = Field(
        ..., description="True when running against the software simulator"
    )
    voltage: str | None = Field(
        None, description="Adapter-reported battery voltage"
    )
    status_message: str = Field(
        "OK", description="Human-readable status summary"
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/status",
    response_model=OBDStatusResponse,
    summary="OBD connection status",
    description="Returns the current OBD-II adapter connection state, active "
                "protocol, port, and whether the system is in simulator mode.",
)
async def get_status(request: Request) -> OBDStatusResponse:
    """Return live OBD-II connection status."""

    state = request.app.state

    # Determine connection details from the active connector.
    connector = getattr(state, "obd_connector", None)
    simulator_mode: bool = getattr(state, "simulator_mode", True)

    if connector is None:
        return OBDStatusResponse(
            connected=False,
            port=None,
            protocol=None,
            simulator_mode=simulator_mode,
            voltage=None,
            status_message="No OBD connector initialised",
        )

    # Both OBDConnector and OBDSimulator expose an `is_connected` method or
    # attribute and optional helpers for port / protocol.
    connected: bool = False
    port: str | None = None
    protocol: str | None = None
    voltage: str | None = None

    # is_connected --------------------------------------------------------
    if callable(getattr(connector, "is_connected", None)):
        connected = connector.is_connected()
    elif hasattr(connector, "is_connected"):
        connected = bool(connector.is_connected)

    # port ----------------------------------------------------------------
    if hasattr(connector, "port"):
        port = str(connector.port) if connector.port else None
    elif hasattr(connector, "port_name"):
        port = str(connector.port_name) if connector.port_name else None

    # protocol ------------------------------------------------------------
    if hasattr(connector, "protocol"):
        proto = connector.protocol
        protocol = str(proto) if proto else None
    elif hasattr(connector, "protocol_name"):
        protocol = str(connector.protocol_name) if connector.protocol_name else None

    # voltage -------------------------------------------------------------
    if callable(getattr(connector, "get_voltage", None)):
        try:
            voltage = connector.get_voltage()
        except Exception:
            voltage = None

    # Human-readable summary
    if simulator_mode:
        status_msg = "Simulator active"
    elif connected:
        status_msg = f"Connected via {protocol or 'unknown protocol'}"
    else:
        status_msg = "Disconnected"

    return OBDStatusResponse(
        connected=connected,
        port=port,
        protocol=protocol,
        simulator_mode=simulator_mode,
        voltage=voltage,
        status_message=status_msg,
    )
