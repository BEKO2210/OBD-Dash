"""
APEX CORTEX™ — Vehicle Routes
Vehicle profile management: list, select, and inspect profiles.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/vehicle", tags=["vehicle"])

# Default vehicle profile directory.
_DEFAULT_VEHICLES_DIR = Path(__file__).resolve().parents[3] / "config" / "vehicles"


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class VehicleProfileSummary(BaseModel):
    """Lightweight summary used in listing responses."""

    id: str = Field(..., description="Profile filename stem (e.g. 'amg_c63_s')")
    make: str | None = None
    model: str | None = None
    year: int | None = None
    variant: str | None = None
    file: str = Field(..., description="Absolute path to profile JSON")


class VehicleProfileListResponse(BaseModel):
    profiles: list[VehicleProfileSummary]
    total: int


class VehicleSelectRequest(BaseModel):
    profile_id: str = Field(
        ..., description="Profile id (filename stem) to activate"
    )


class VehicleSelectResponse(BaseModel):
    profile_id: str
    make: str | None = None
    model: str | None = None
    year: int | None = None
    message: str = "Vehicle profile activated"


class VehicleProfileDetailResponse(BaseModel):
    """Full profile payload."""

    profile_id: str
    profile: dict[str, Any]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _vehicles_dir() -> Path:
    """Resolve the vehicle profiles directory."""
    return Path(os.getenv("VEHICLE_PROFILES_DIR", str(_DEFAULT_VEHICLES_DIR)))


def _load_profile(profile_id: str) -> dict[str, Any]:
    """Load and return a single vehicle profile dict. Raises HTTPException on error."""
    vdir = _vehicles_dir()
    path = vdir / f"{profile_id}.json"
    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Vehicle profile '{profile_id}' not found at {path}",
        )
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load profile: {exc}",
        ) from exc


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/profiles",
    response_model=VehicleProfileListResponse,
    summary="List vehicle profiles",
    description="Return every vehicle profile found in the config/vehicles directory.",
)
async def list_profiles() -> VehicleProfileListResponse:
    """Enumerate available vehicle profiles."""

    vdir = _vehicles_dir()
    summaries: list[VehicleProfileSummary] = []

    if not vdir.is_dir():
        return VehicleProfileListResponse(profiles=[], total=0)

    for path in sorted(vdir.glob("*.json")):
        # Skip the empty template file.
        if path.stem == "template":
            continue
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue

        summaries.append(
            VehicleProfileSummary(
                id=raw.get("id", path.stem),
                make=raw.get("make"),
                model=raw.get("model"),
                year=raw.get("year") if raw.get("year") else None,
                variant=raw.get("variant"),
                file=str(path),
            )
        )

    return VehicleProfileListResponse(profiles=summaries, total=len(summaries))


@router.post(
    "/select",
    response_model=VehicleSelectResponse,
    summary="Select active vehicle profile",
    description="Set the active vehicle profile used by all algorithms.",
)
async def select_profile(
    body: VehicleSelectRequest,
    request: Request,
) -> VehicleSelectResponse:
    """Activate a vehicle profile by its id."""

    profile = _load_profile(body.profile_id)

    # Store on app state so the telemetry loop and algorithms can reference it.
    request.app.state.vehicle_profile = profile
    request.app.state.vehicle_profile_id = body.profile_id

    return VehicleSelectResponse(
        profile_id=body.profile_id,
        make=profile.get("make"),
        model=profile.get("model"),
        year=profile.get("year") if profile.get("year") else None,
    )


@router.get(
    "/current",
    response_model=VehicleProfileDetailResponse,
    summary="Get current vehicle profile",
    description="Return the full JSON of the currently active vehicle profile.",
)
async def get_current_profile(request: Request) -> VehicleProfileDetailResponse:
    """Return the active vehicle profile."""

    profile = getattr(request.app.state, "vehicle_profile", None)
    profile_id = getattr(request.app.state, "vehicle_profile_id", None)

    if profile is None:
        raise HTTPException(
            status_code=404,
            detail="No vehicle profile is currently active. "
                   "Use POST /api/vehicle/select to set one.",
        )

    return VehicleProfileDetailResponse(
        profile_id=profile_id or "unknown",
        profile=profile,
    )
