"""
APEX CORTEX™ — OBD-II Data Simulator
Generates realistic OBD-II telemetry data for development and testing.

Provides an OBDSimulator class with an async query(pid_code) interface
that mirrors OBDConnector, allowing seamless swapping between real and
simulated data sources.

Supports multiple driving modes via a time-based state machine:
    IDLE           — engine idling, stationary
    STREET         — normal street driving
    TRACK_SESSION  — aggressive track driving with high RPMs and G-forces
    LAUNCH_CONTROL — standing start with full-throttle launch

Run standalone for CLI output:
    python -m core.obd.simulator --mode track --profile bmw_m3_g80
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import random
import time
from enum import Enum
from pathlib import Path
from typing import Any

from core.obd.pid_registry import PID_REGISTRY, get_pid_by_code

logger = logging.getLogger("apex.obd.simulator")

PROJECT_ROOT = Path(__file__).resolve().parents[2]


# ---------------------------------------------------------------------------
# Simulator modes
# ---------------------------------------------------------------------------

class SimulatorMode(str, Enum):
    IDLE = "idle"
    STREET = "street"
    TRACK_SESSION = "track"
    LAUNCH_CONTROL = "launch"


# ---------------------------------------------------------------------------
# Internal state
# ---------------------------------------------------------------------------

class _SimState:
    """Mutable driving state for the simulator."""

    def __init__(self) -> None:
        self.mode: SimulatorMode = SimulatorMode.IDLE
        self.time_in_mode: float = 0.0
        self.last_tick: float = time.monotonic()

        # Engine
        self.rpm: float = 750.0
        self.target_rpm: float = 750.0
        self.speed_kmh: float = 0.0
        self.target_speed: float = 0.0
        self.throttle: float = 0.0
        self.engine_load: float = 15.0

        # Temperatures (°C)
        self.coolant_temp: float = 25.0
        self.oil_temp: float = 25.0
        self.iat: float = 28.0
        self.ambient_temp: float = 25.0

        # Fuel
        self.fuel_level: float = 85.0

        # Dynamics
        self.g_lat: float = 0.0
        self.g_long: float = 0.0

        # GPS (dummy track — Nurburgring GP start/finish area)
        self.gps_lat: float = 50.3356
        self.gps_lon: float = 6.9475
        self.heading: float = 0.0

        # Gear
        self.gear: int = 0
        self.shift_cooldown: float = 0.0

        # Timing
        self.phase_timer: float = 0.0
        self.cycle_position: float = 0.0


# ---------------------------------------------------------------------------
# OBDSimulator
# ---------------------------------------------------------------------------

class OBDSimulator:
    """
    Simulates an OBD-II adapter, producing realistic time-varying PID values.

    Usage::

        sim = OBDSimulator(vehicle_profile=profile_dict)
        await sim.start()
        response = await sim.query(0x0C)   # RPM
        snapshot = await sim.snapshot()     # all PIDs at once
        await sim.stop()
    """

    def __init__(
        self,
        vehicle_profile: dict[str, Any] | None = None,
        mode: SimulatorMode = SimulatorMode.IDLE,
        tick_hz: float = 20.0,
    ) -> None:
        self._profile = vehicle_profile or {}
        self._state = _SimState()
        self._state.mode = mode
        self._tick_interval = 1.0 / tick_hz
        self._running = False
        self._tick_task: asyncio.Task | None = None

        # Extract vehicle parameters.
        engine = self._profile.get("engine", {})
        self._redline = float(engine.get("redline_rpm", 7000))
        self._idle_rpm = float(engine.get("idle_rpm", 750))
        self._max_power_rpm = float(engine.get("max_power_rpm", 5500))

        trans = self._profile.get("transmission", {})
        self._gear_ratios: list[float] = trans.get(
            "gear_ratios", [3.5, 2.1, 1.4, 1.0, 0.8, 0.65]
        )
        self._num_gears = len(self._gear_ratios)

        dims = self._profile.get("dimensions", {})
        self._mass_kg = float(dims.get("curb_weight_kg", 1500))

    # -- Lifecycle ---------------------------------------------------------

    async def start(self) -> None:
        """Start the internal simulation tick loop."""
        if self._running:
            return
        self._running = True
        self._state.last_tick = time.monotonic()
        self._tick_task = asyncio.create_task(self._tick_loop())
        logger.info("Simulator started (mode=%s)", self._state.mode.value)

    async def stop(self) -> None:
        """Stop the simulation loop."""
        self._running = False
        if self._tick_task is not None:
            self._tick_task.cancel()
            try:
                await self._tick_task
            except asyncio.CancelledError:
                pass
            self._tick_task = None
        logger.info("Simulator stopped")

    async def connect(self) -> None:
        """Compatibility shim — starts the simulator."""
        await self.start()

    async def disconnect(self) -> None:
        """Compatibility shim — stops the simulator."""
        await self.stop()

    def is_connected(self) -> bool:
        return self._running

    def set_mode(self, mode: SimulatorMode) -> None:
        """Switch driving mode."""
        if mode != self._state.mode:
            logger.info(
                "Mode change: %s -> %s", self._state.mode.value, mode.value
            )
            self._state.mode = mode
            self._state.time_in_mode = 0.0
            self._state.phase_timer = 0.0

    # -- Query interface ---------------------------------------------------

    async def query(self, pid_code: int | str) -> Any:
        """
        Query a single PID value.

        Args:
            pid_code: Integer PID code (e.g. 0x0C) or hex string.

        Returns:
            An OBDResponse-compatible object.
        """
        if isinstance(pid_code, str):
            pid_code = (
                int(pid_code, 16)
                if pid_code.startswith("0x")
                else int(pid_code)
            )

        value = self._get_pid_value(pid_code)
        pid_def = get_pid_by_code(pid_code)

        return _SimulatedResponse(
            pid_code=pid_code,
            pid_name=pid_def["name"] if pid_def else f"PID_{hex(pid_code)}",
            value=value,
            unit=pid_def["unit"] if pid_def else "",
            timestamp=time.time(),
        )

    async def snapshot(self) -> dict[str, Any]:
        """
        Return a complete telemetry snapshot with all simulated values.

        Keys match the naming conventions used by TelemetryCollector.
        """
        s = self._state
        return {
            "timestamp": time.time(),
            "is_simulated": True,
            "rpm": s.rpm,
            "speed": s.speed_kmh,
            "throttle_pos": s.throttle,
            "engine_load": s.engine_load,
            "coolant_temp": s.coolant_temp,
            "oil_temp": s.oil_temp,
            "intake_temp": s.iat,
            "ambient_temp": s.ambient_temp,
            "fuel_level": s.fuel_level,
            "g_lateral": s.g_lat,
            "g_longitudinal": s.g_long,
            "gps_lat": s.gps_lat,
            "gps_lon": s.gps_lon,
            "gear": s.gear,
            "pids": {
                "0x04": s.engine_load,
                "0x05": s.coolant_temp,
                "0x0B": max(30.0, 101.3 + s.throttle * 1.5),
                "0x0C": s.rpm,
                "0x0D": s.speed_kmh,
                "0x0F": s.iat,
                "0x10": s.engine_load * 2.5,
                "0x11": s.throttle,
                "0x2F": s.fuel_level,
                "0x46": s.ambient_temp,
                "0x5C": s.oil_temp,
            },
        }

    async def get_snapshot(self) -> dict[str, Any]:
        """Alias for snapshot() for compatibility."""
        return await self.snapshot()

    # -- Internal PID value resolver ---------------------------------------

    def _get_pid_value(self, pid_code: int) -> float | None:
        s = self._state
        pid_map: dict[int, float | None] = {
            0x04: s.engine_load,
            0x05: s.coolant_temp,
            0x06: random.uniform(-5.0, 5.0),
            0x07: random.uniform(-3.0, 3.0),
            0x0B: max(30.0, 101.3 + s.throttle * 1.5),
            0x0C: s.rpm,
            0x0D: s.speed_kmh,
            0x0E: random.uniform(5.0, 35.0),
            0x0F: s.iat,
            0x10: s.engine_load * 2.5,
            0x11: s.throttle,
            0x14: random.uniform(0.1, 0.9),
            0x2F: s.fuel_level,
            0x33: 101.3 + random.uniform(-1.0, 1.0),
            0x42: 13.8 + random.uniform(-0.3, 0.3),
            0x43: s.engine_load * 1.5,
            0x44: 1.0 + random.uniform(-0.05, 0.05),
            0x45: s.throttle * 0.9,
            0x46: s.ambient_temp,
            0x5C: s.oil_temp,
            0x61: s.throttle * 1.3 - 25.0,
            0x62: s.engine_load * 0.8,
            0x63: self._mass_kg * 0.4,
        }
        return pid_map.get(pid_code)

    # -- Simulation tick loop ----------------------------------------------

    async def _tick_loop(self) -> None:
        """Background loop that advances the simulation state."""
        while self._running:
            now = time.monotonic()
            dt = now - self._state.last_tick
            self._state.last_tick = now
            self._state.time_in_mode += dt
            self._state.phase_timer += dt
            self._state.cycle_position += dt

            try:
                self._advance(dt)
            except Exception:
                logger.exception("Simulator tick error")

            await asyncio.sleep(self._tick_interval)

    def _advance(self, dt: float) -> None:
        """Advance simulation state by dt seconds."""
        mode = self._state.mode

        if mode == SimulatorMode.IDLE:
            self._advance_idle(dt)
        elif mode == SimulatorMode.STREET:
            self._advance_street(dt)
        elif mode == SimulatorMode.TRACK_SESSION:
            self._advance_track(dt)
        elif mode == SimulatorMode.LAUNCH_CONTROL:
            self._advance_launch(dt)

        self._advance_temperatures(dt)
        self._advance_fuel(dt)
        self._advance_dynamics(dt)
        self._advance_gps(dt)

    # -- Mode-specific state machines --------------------------------------

    def _advance_idle(self, dt: float) -> None:
        s = self._state
        s.target_rpm = self._idle_rpm + random.uniform(-30, 30)
        s.target_speed = 0.0
        s.throttle = random.uniform(0.0, 2.0)
        s.engine_load = random.uniform(12.0, 20.0)
        s.gear = 0

        s.rpm += (s.target_rpm - s.rpm) * min(1.0, 3.0 * dt)
        s.speed_kmh *= max(0, 1.0 - 2.0 * dt)

    def _advance_street(self, dt: float) -> None:
        s = self._state
        cycle = math.sin(s.cycle_position * 0.15) * 0.5 + 0.5

        s.target_speed = 30.0 + cycle * 50.0
        if math.sin(s.cycle_position * 0.05) > 0.9:
            s.target_speed = 0.0  # traffic light

        speed_diff = s.target_speed - s.speed_kmh
        accel = max(-8.0, min(3.0, speed_diff * 0.5))
        s.speed_kmh = max(0.0, s.speed_kmh + accel * dt)

        s.throttle = max(0.0, min(100.0, 15.0 + accel * 10.0))
        s.engine_load = max(10.0, min(80.0, 20.0 + s.throttle * 0.5))

        self._update_gear_and_rpm(
            dt, shift_up_rpm=3500, shift_down_rpm=1200
        )

    def _advance_track(self, dt: float) -> None:
        s = self._state
        t = s.phase_timer

        # Track cycle: acceleration, braking, cornering, exit.
        phase = (t % 20.0) / 20.0

        if phase < 0.45:
            # Straight — full throttle.
            s.target_speed = min(220.0, s.speed_kmh + 40.0 * dt)
            s.throttle = 85.0 + random.uniform(0, 15.0)
            s.engine_load = 70.0 + random.uniform(0, 30.0)
            s.g_long = random.uniform(0.2, 0.6)
            s.g_lat = random.uniform(-0.2, 0.2)
        elif phase < 0.55:
            # Hard braking.
            s.target_speed = max(60.0, s.speed_kmh - 80.0 * dt)
            s.throttle = random.uniform(0.0, 3.0)
            s.engine_load = random.uniform(5.0, 15.0)
            s.g_long = random.uniform(-1.2, -0.6)
            s.g_lat = random.uniform(-0.3, 0.3)
        elif phase < 0.80:
            # Corner — high lateral G.
            s.target_speed = 80.0 + random.uniform(-10, 10)
            s.throttle = 30.0 + random.uniform(0, 20.0)
            s.engine_load = 40.0 + random.uniform(0, 20.0)
            s.g_long = random.uniform(-0.1, 0.2)
            corner_dir = 1.0 if math.sin(t * 0.3) > 0 else -1.0
            s.g_lat = corner_dir * random.uniform(0.6, 1.4)
        else:
            # Corner exit.
            s.target_speed = min(180.0, s.speed_kmh + 20.0 * dt)
            s.throttle = 50.0 + random.uniform(0, 30.0)
            s.engine_load = 55.0 + random.uniform(0, 25.0)
            s.g_long = random.uniform(0.1, 0.4)
            s.g_lat *= 0.85

        speed_diff = s.target_speed - s.speed_kmh
        s.speed_kmh = max(
            0.0, s.speed_kmh + speed_diff * min(1.0, 2.0 * dt)
        )

        self._update_gear_and_rpm(
            dt,
            shift_up_rpm=self._redline * 0.93,
            shift_down_rpm=3000,
        )

    def _advance_launch(self, dt: float) -> None:
        s = self._state
        t = s.time_in_mode

        if t < 2.0:
            # Build-up: revving on the line.
            s.rpm = self._idle_rpm + (
                self._redline * 0.6 - self._idle_rpm
            ) * (t / 2.0)
            s.speed_kmh = 0.0
            s.throttle = 60.0 + t * 20.0
            s.gear = 1
            s.g_long = 0.0
        elif t < 12.0:
            # Launch: rapid acceleration.
            elapsed = t - 2.0
            s.target_speed = min(200.0, elapsed * 20.0)
            speed_diff = s.target_speed - s.speed_kmh
            s.speed_kmh = max(
                0.0, s.speed_kmh + speed_diff * min(1.0, 3.0 * dt)
            )
            s.throttle = 95.0 + random.uniform(0, 5.0)
            s.engine_load = 85.0 + random.uniform(0, 15.0)
            s.g_long = random.uniform(0.4, 1.0)

            self._update_gear_and_rpm(
                dt,
                shift_up_rpm=self._redline * 0.95,
                shift_down_rpm=2000,
            )
        else:
            # Transition to street after launch sequence.
            self.set_mode(SimulatorMode.STREET)

    # -- Shared helpers ----------------------------------------------------

    def _update_gear_and_rpm(
        self, dt: float, shift_up_rpm: float, shift_down_rpm: float
    ) -> None:
        """Update gear selection and compute RPM from speed + gear ratio."""
        s = self._state

        if s.speed_kmh < 3.0:
            s.gear = 0
            s.rpm += (self._idle_rpm - s.rpm) * min(1.0, 5.0 * dt)
            return

        if s.gear < 1:
            s.gear = 1

        s.shift_cooldown = max(0.0, s.shift_cooldown - dt)

        speed_ms = s.speed_kmh / 3.6
        tire_circ_m = (
            float(
                self._profile.get("wheels", {}).get(
                    "tire_circumference_mm", 2000
                )
            )
            / 1000.0
        )
        final_drive = float(
            self._profile.get("transmission", {}).get("final_drive", 3.0)
        )

        wheel_rpm = (
            (speed_ms / tire_circ_m) * 60.0 if tire_circ_m > 0 else 0.0
        )
        gear_idx = max(0, min(s.gear - 1, len(self._gear_ratios) - 1))
        target_rpm = wheel_rpm * self._gear_ratios[gear_idx] * final_drive

        # Shift logic.
        if s.shift_cooldown <= 0:
            if target_rpm >= shift_up_rpm and s.gear < self._num_gears:
                s.gear += 1
                s.shift_cooldown = 0.4
                gear_idx = s.gear - 1
                target_rpm = (
                    wheel_rpm * self._gear_ratios[gear_idx] * final_drive
                )
            elif target_rpm <= shift_down_rpm and s.gear > 1:
                s.gear -= 1
                s.shift_cooldown = 0.3
                gear_idx = s.gear - 1
                target_rpm = (
                    wheel_rpm * self._gear_ratios[gear_idx] * final_drive
                )

        target_rpm = max(
            self._idle_rpm, min(self._redline * 1.02, target_rpm)
        )
        s.rpm += (target_rpm - s.rpm) * min(1.0, 8.0 * dt)

    def _advance_temperatures(self, dt: float) -> None:
        """Gradually change temperatures based on engine load and speed."""
        s = self._state
        load_factor = s.engine_load / 100.0

        target_coolant = 85.0 + load_factor * 20.0
        if s.speed_kmh > 100:
            target_coolant -= 3.0
        s.coolant_temp += (target_coolant - s.coolant_temp) * 0.01 * dt

        target_oil = s.coolant_temp + 5.0 + load_factor * 10.0
        s.oil_temp += (target_oil - s.oil_temp) * 0.005 * dt

        target_iat = s.ambient_temp + load_factor * 25.0
        if s.speed_kmh > 60:
            target_iat -= 5.0
        s.iat += (target_iat - s.iat) * 0.02 * dt

    def _advance_fuel(self, dt: float) -> None:
        """Decrease fuel level based on consumption."""
        s = self._state
        consumption_rate = (
            0.00003 + (s.engine_load / 100.0) * 0.00015
        )
        if s.speed_kmh > 0:
            s.fuel_level -= consumption_rate * dt
        s.fuel_level = max(0.0, s.fuel_level)

    def _advance_dynamics(self, dt: float) -> None:
        """Smooth G-force values with noise."""
        s = self._state
        s.g_lat += random.gauss(0, 0.02)
        s.g_long += random.gauss(0, 0.02)
        if s.mode not in (
            SimulatorMode.TRACK_SESSION,
            SimulatorMode.LAUNCH_CONTROL,
        ):
            s.g_lat *= 0.95
            s.g_long *= 0.95

    def _advance_gps(self, dt: float) -> None:
        """Simulate GPS movement along a rough oval."""
        s = self._state
        if s.speed_kmh < 1.0:
            return

        speed_ms = s.speed_kmh / 3.6
        distance_m = speed_ms * dt

        s.heading += s.g_lat * 15.0 * dt
        s.heading %= 360.0

        heading_rad = math.radians(s.heading)
        dlat = (distance_m * math.cos(heading_rad)) / 111_320.0
        dlon = (distance_m * math.sin(heading_rad)) / (
            111_320.0 * math.cos(math.radians(s.gps_lat))
        )

        s.gps_lat += dlat
        s.gps_lon += dlon


# ---------------------------------------------------------------------------
# Simulated response object
# ---------------------------------------------------------------------------

class _SimulatedResponse:
    """Mimics OBDResponse from connector.py."""

    def __init__(
        self,
        pid_code: int,
        pid_name: str,
        value: float | None,
        unit: str,
        timestamp: float,
    ) -> None:
        self.pid_code = pid_code
        self.pid_name = pid_name
        self.value = value
        self.unit = unit
        self.timestamp = timestamp
        self.is_simulated = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "pid_code": hex(self.pid_code),
            "pid_name": self.pid_name,
            "value": self.value,
            "unit": self.unit,
            "timestamp": self.timestamp,
            "is_simulated": True,
        }


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _load_profile(profile_id: str) -> dict[str, Any]:
    """Load a vehicle profile by ID."""
    path = PROJECT_ROOT / "config" / "vehicles" / f"{profile_id}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    logger.warning("Profile '%s' not found, using defaults", profile_id)
    return {}


async def _cli_main(args: argparse.Namespace) -> None:
    """Run the simulator in CLI mode, printing snapshots to stdout."""
    profile = _load_profile(args.profile) if args.profile else {}
    mode_map = {
        "idle": SimulatorMode.IDLE,
        "street": SimulatorMode.STREET,
        "track": SimulatorMode.TRACK_SESSION,
        "launch": SimulatorMode.LAUNCH_CONTROL,
    }
    mode = mode_map.get(args.mode, SimulatorMode.STREET)

    sim = OBDSimulator(vehicle_profile=profile, mode=mode)
    await sim.start()

    print(
        f"APEX CORTEX Simulator | mode={mode.value} "
        f"| profile={args.profile or 'default'}"
    )
    print("-" * 70)

    try:
        while True:
            snap = await sim.snapshot()
            rpm = snap.get("rpm", 0)
            speed = snap.get("speed", 0)
            throttle = snap.get("throttle_pos", 0)
            gear = snap.get("gear", 0)
            coolant = snap.get("coolant_temp", 0)
            g_lat = snap.get("g_lateral", 0)
            g_long = snap.get("g_longitudinal", 0)

            print(
                f"RPM: {rpm:6.0f} | SPD: {speed:5.1f} km/h | "
                f"THR: {throttle:4.1f}% | G{gear} | "
                f"CLT: {coolant:5.1f}\u00b0C | "
                f"Glat: {g_lat:+.2f} | Glon: {g_long:+.2f}",
                end="\r",
            )
            await asyncio.sleep(0.1)
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        await sim.stop()


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="APEX CORTEX OBD-II Simulator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode",
        choices=["idle", "street", "track", "launch"],
        default="street",
        help="Driving simulation mode (default: street)",
    )
    parser.add_argument(
        "--profile",
        type=str,
        default=None,
        help="Vehicle profile ID (e.g. bmw_m3_g80)",
    )
    parser.add_argument(
        "--hz",
        type=float,
        default=20.0,
        help="Internal simulation tick rate (default: 20 Hz)",
    )
    args = parser.parse_args()
    asyncio.run(_cli_main(args))


if __name__ == "__main__":
    main()
