"""
APEX CORTEX™ — OBD-II Package
Handles ELM327 connections, PID management, protocol detection, and simulation.
"""

from core.obd.connector import OBDConnector
from core.obd.simulator import OBDSimulator

__all__ = ["OBDConnector", "OBDSimulator"]
