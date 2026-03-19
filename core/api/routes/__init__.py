"""
APEX CORTEX™ — API Routes Package
REST endpoint routers for status, session management, and vehicle profiles.
"""

from core.api.routes.status import router as status_router
from core.api.routes.session import router as session_router
from core.api.routes.vehicle import router as vehicle_router

__all__ = ["status_router", "session_router", "vehicle_router"]
