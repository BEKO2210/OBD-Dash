/**
 * Nürburgring Nordschleife Simulator
 *
 * Client-side telemetry generator that simulates a hot lap around the
 * Nordschleife. Produces data compatible with all existing dashboard panels.
 * No backend required.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ── Track Definition ─────────────────────────────────────────────────────────
// Each waypoint: [x, y, targetSpeed(km/h), curvature(-1..1), sectionName]
// x,y are normalized coordinates for the track map SVG (0-1000 range)
// curvature: negative=left, positive=right, 0=straight
const TRACK_WAYPOINTS = [
  // Start/Finish straight
  [500, 555, 250, 0, 'Start/Ziel'],
  [530, 548, 260, 0.05, 'Start/Ziel'],
  [565, 535, 240, 0.1, 'T13'],
  // Hatzenbach
  [600, 515, 180, 0.35, 'Hatzenbach'],
  [628, 490, 160, 0.45, 'Hatzenbach'],
  [645, 460, 170, 0.3, 'Hatzenbach'],
  [650, 430, 190, 0.15, 'Hatzenbach'],
  // Hocheichen
  [660, 400, 210, -0.1, 'Hocheichen'],
  [675, 370, 220, -0.15, 'Hocheichen'],
  [695, 340, 230, -0.05, 'Hocheichen'],
  // Quiddelbacher Höhe
  [720, 310, 250, 0.05, 'Quiddelbacher Höhe'],
  [740, 280, 260, 0.0, 'Flugplatz'],
  [755, 250, 240, 0.2, 'Flugplatz'],
  [760, 220, 200, 0.35, 'Flugplatz'],
  // Schwedenkreuz
  [755, 190, 260, -0.1, 'Schwedenkreuz'],
  [740, 160, 270, -0.05, 'Schwedenkreuz'],
  [720, 135, 250, -0.15, 'Schwedenkreuz'],
  // Aremberg
  [690, 115, 200, -0.4, 'Aremberg'],
  [655, 100, 160, -0.5, 'Aremberg'],
  [620, 95, 170, -0.3, 'Fuchsröhre'],
  // Fuchsröhre (downhill!)
  [580, 85, 240, -0.1, 'Fuchsröhre'],
  [540, 75, 260, 0.05, 'Fuchsröhre'],
  [500, 68, 250, 0.1, 'Fuchsröhre'],
  // Adenauer Forst
  [460, 65, 180, 0.4, 'Adenauer Forst'],
  [425, 72, 140, 0.55, 'Adenauer Forst'],
  [400, 88, 130, 0.5, 'Adenauer Forst'],
  [380, 110, 150, 0.3, 'Adenauer Forst'],
  // Metzgesfeld
  [365, 135, 180, -0.2, 'Metzgesfeld'],
  [345, 160, 200, -0.15, 'Metzgesfeld'],
  [325, 190, 220, -0.1, 'Metzgesfeld'],
  // Kallenhard
  [305, 220, 180, 0.35, 'Kallenhard'],
  [280, 248, 160, 0.45, 'Kallenhard'],
  [260, 275, 170, 0.3, 'Kallenhard'],
  // Wehrseifen
  [250, 305, 140, -0.5, 'Wehrseifen'],
  [245, 330, 120, -0.55, 'Wehrseifen'],
  [248, 355, 130, -0.3, 'Wehrseifen'],
  // Breidscheid
  [255, 380, 200, 0.1, 'Breidscheid'],
  [260, 405, 220, 0.05, 'Breidscheid'],
  // Ex-Mühle
  [258, 425, 190, -0.25, 'Ex-Mühle'],
  [250, 445, 170, -0.35, 'Bergwerk'],
  // Bergwerk
  [240, 465, 140, -0.5, 'Bergwerk'],
  [235, 485, 130, 0.4, 'Bergwerk'],
  // Karussell approach
  [240, 505, 150, 0.2, 'Karussell'],
  [250, 520, 110, 0.65, 'Karussell'],
  [268, 530, 90, 0.7, 'Karussell'],
  [288, 535, 85, 0.7, 'Karussell'],
  [308, 530, 90, 0.6, 'Karussell'],
  [322, 520, 120, 0.4, 'Karussell'],
  // Hohe Acht
  [335, 505, 180, -0.2, 'Hohe Acht'],
  [350, 488, 200, -0.15, 'Hohe Acht'],
  // Wippermann / Brünnchen
  [368, 475, 220, 0.15, 'Wippermann'],
  [388, 468, 210, 0.25, 'Brünnchen'],
  [410, 465, 190, 0.35, 'Brünnchen'],
  [430, 470, 200, 0.2, 'Brünnchen'],
  // Pflanzgarten
  [450, 480, 230, -0.15, 'Pflanzgarten'],
  [468, 495, 240, -0.2, 'Pflanzgarten'],
  [480, 510, 200, 0.3, 'Pflanzgarten'],
  [488, 525, 170, 0.45, 'Pflanzgarten'],
  // Schwalbenschwanz
  [485, 540, 160, -0.4, 'Schwalbenschwanz'],
  [478, 550, 180, -0.25, 'Schwalbenschwanz'],
  // Galgenkopf / back to start
  [470, 558, 200, -0.15, 'Galgenkopf'],
  [460, 562, 220, -0.1, 'Döttinger Höhe'],
  // Döttinger Höhe (long straight!)
  [440, 565, 260, 0.0, 'Döttinger Höhe'],
  [420, 568, 275, 0.0, 'Döttinger Höhe'],
  [400, 570, 280, 0.0, 'Döttinger Höhe'],
  [380, 568, 275, 0.02, 'Döttinger Höhe'],
  // Antoniusbuche
  [360, 564, 260, 0.05, 'Antoniusbuche'],
  [345, 560, 240, 0.1, 'Tiergarten'],
  // Tiergarten
  [330, 558, 220, -0.15, 'Tiergarten'],
  [320, 558, 210, -0.2, 'Tiergarten'],
  // Hohenrain chicane
  [310, 560, 180, 0.3, 'Hohenrain'],
  [305, 562, 160, -0.35, 'Hohenrain'],
  // Back to Start/Finish
  [320, 565, 180, -0.15, 'Hohenrain'],
  [350, 568, 200, -0.05, 'T13 approach'],
  [400, 570, 230, 0.0, 'T13 approach'],
  [450, 565, 240, 0.05, 'T13 approach'],
  [480, 558, 250, 0.05, 'Start/Ziel'],
];

// ── Vehicle Profile (AMG GT-R inspired) ─────────────────────────────────────
const VEHICLE = {
  maxRpm: 7200,
  shiftRpm: 6800,
  redlineRpm: 7200,
  gearRatios: [4.69, 3.14, 2.10, 1.67, 1.29, 1.00, 0.84],
  finalDrive: 2.82,
  tireCircumM: 2.06,
  curbWeightKg: 1810,
  maxPowerKw: 375,
  maxTorqueNm: 700,
  fuelTankL: 66,
};

// ── Helper Functions ─────────────────────────────────────────────────────────

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

function distance(p1, p2) {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate gear from speed (km/h)
function getGear(speed) {
  if (speed < 5) return 1;
  if (speed < 45) return 1;
  if (speed < 80) return 2;
  if (speed < 120) return 3;
  if (speed < 165) return 4;
  if (speed < 210) return 5;
  if (speed < 255) return 6;
  return 7;
}

// Calculate RPM from speed and gear
function getRpm(speed, gear) {
  if (speed < 2) return 850 + Math.random() * 50;
  const ratio = VEHICLE.gearRatios[gear - 1] || VEHICLE.gearRatios[0];
  const wheelRps = (speed / 3.6) / VEHICLE.tireCircumM;
  const engineRps = wheelRps * ratio * VEHICLE.finalDrive;
  const rpm = engineRps * 60;
  return clamp(rpm, 850, VEHICLE.maxRpm);
}

// ── Nürburgring Lap Time Reference ──────────────────────────────────────────
// Total track ~20.8km, target lap time ~7:00-7:30 for a sports car
const NORDSCHLEIFE_LENGTH_KM = 20.832;

// ── The Hook ─────────────────────────────────────────────────────────────────

export default function useNurburgringSimulator(autoStart = true) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [trackPosition, setTrackPosition] = useState(0);
  const [sectionName, setSectionName] = useState('Start/Ziel');
  const [isRunning, setIsRunning] = useState(autoStart);
  const [lapCount, setLapCount] = useState(0);

  const stateRef = useRef({
    position: 0, // 0..1 around the track
    speed: 0,
    targetSpeed: 250,
    rpm: 850,
    gear: 1,
    throttle: 0,
    brake: 0,
    gLat: 0,
    gLong: 0,
    coolantTemp: 88,
    oilTemp: 92,
    iat: 32,
    fuelLevel: 85,
    lapTimeMs: 0,
    bestLapMs: 432000, // 7:12.000
    lapCount: 0,
    lastTimestamp: 0,
    historyBuffer: [],
    segmentIndex: 0,
    segmentT: 0,
    smoothSpeed: 120,
    prevSpeed: 120,
    trsScore: 25,
  });

  const intervalRef = useRef(null);

  const tick = useCallback(() => {
    const s = stateRef.current;
    const now = performance.now();
    if (s.lastTimestamp === 0) {
      s.lastTimestamp = now;
      return;
    }

    const dt = Math.min((now - s.lastTimestamp) / 1000, 0.1); // seconds, capped
    s.lastTimestamp = now;

    const numWaypoints = TRACK_WAYPOINTS.length;

    // Calculate total track length in pixel units
    let totalLength = 0;
    const segmentLengths = [];
    for (let i = 0; i < numWaypoints; i++) {
      const next = (i + 1) % numWaypoints;
      const d = distance(TRACK_WAYPOINTS[i], TRACK_WAYPOINTS[next]);
      segmentLengths.push(d);
      totalLength += d;
    }

    // Scale factor: pixels to km
    const kmPerPixel = NORDSCHLEIFE_LENGTH_KM / totalLength;

    // Current segment data
    const idx = s.segmentIndex % numWaypoints;
    const nextIdx = (idx + 1) % numWaypoints;
    const wp = TRACK_WAYPOINTS[idx];
    const wpNext = TRACK_WAYPOINTS[nextIdx];

    // Target speed from current waypoint (with some randomness)
    const baseTargetSpeed = lerp(wp[2], wpNext[2], s.segmentT);
    s.targetSpeed = baseTargetSpeed + (Math.sin(now * 0.001) * 5);

    // Smoothly approach target speed
    const speedDiff = s.targetSpeed - s.smoothSpeed;
    const acceleration = speedDiff > 0 ? 25 : -40; // m/s² equivalent feel
    s.smoothSpeed += clamp(speedDiff, acceleration * dt * -1, Math.abs(acceleration) * dt);
    s.smoothSpeed = clamp(s.smoothSpeed, 30, 285);

    // Add slight realistic variation
    const speed = s.smoothSpeed + Math.sin(now * 0.003) * 2 + (Math.random() - 0.5) * 1.5;

    // Advance position along track
    const speedMs = speed / 3.6; // m/s
    const distanceTraveled = speedMs * dt; // meters
    const distancePixels = distanceTraveled / (kmPerPixel * 1000);

    const segLen = segmentLengths[idx];
    s.segmentT += distancePixels / segLen;

    while (s.segmentT >= 1.0) {
      s.segmentT -= 1.0;
      s.segmentIndex = (s.segmentIndex + 1) % numWaypoints;
      if (s.segmentIndex === 0) {
        // Completed a lap
        s.lapCount++;
        if (s.lapTimeMs > 0 && (s.lapTimeMs < s.bestLapMs || s.bestLapMs <= 0)) {
          s.bestLapMs = s.lapTimeMs;
        }
        s.lapTimeMs = 0;
      }
    }

    // Update lap time
    s.lapTimeMs += dt * 1000;

    // Calculate normalized position (0..1)
    let distSoFar = 0;
    for (let i = 0; i < s.segmentIndex; i++) {
      distSoFar += segmentLengths[i];
    }
    distSoFar += segmentLengths[s.segmentIndex] * s.segmentT;
    const normalizedPos = distSoFar / totalLength;

    // Interpolated position for map
    const curWp = TRACK_WAYPOINTS[s.segmentIndex % numWaypoints];
    const nxtWp = TRACK_WAYPOINTS[(s.segmentIndex + 1) % numWaypoints];
    const mapX = lerp(curWp[0], nxtWp[0], s.segmentT);
    const mapY = lerp(curWp[1], nxtWp[1], s.segmentT);

    // Curvature and G-forces
    const curvature = lerp(curWp[3], nxtWp[3], s.segmentT);
    const lateralG = curvature * (speed / 150) * 1.2 + (Math.random() - 0.5) * 0.05;
    const accelDecel = (speed - s.prevSpeed) / (dt * 9.81 * 50);
    const longG = clamp(accelDecel, -2.0, 1.5) + (Math.random() - 0.5) * 0.03;
    s.prevSpeed = speed;

    // Smooth G-forces
    s.gLat = lerp(s.gLat, lateralG, 0.3);
    s.gLong = lerp(s.gLong, longG, 0.3);

    // Gear and RPM
    const gear = getGear(speed);
    const rpm = getRpm(speed, gear);
    const shiftNow = rpm > VEHICLE.shiftRpm;

    // Throttle and brake
    const throttle = speedDiff > 5 ? clamp(80 + speedDiff * 0.5, 60, 100) :
                     speedDiff < -10 ? clamp(5 + speedDiff * 0.2, 0, 15) :
                     clamp(40 + speedDiff * 2, 20, 70);
    const brakePressure = speedDiff < -15 ? clamp(Math.abs(speedDiff) * 2, 0, 100) : 0;

    // Load
    const engineLoad = clamp(throttle * 0.9 + (rpm / VEHICLE.maxRpm) * 15, 15, 100);

    // Temperatures (slowly evolve)
    s.coolantTemp = clamp(s.coolantTemp + (engineLoad > 70 ? 0.002 : -0.001) * dt * 10, 85, 108);
    s.oilTemp = clamp(s.oilTemp + (engineLoad > 60 ? 0.003 : -0.0005) * dt * 10, 88, 135);
    s.iat = clamp(30 + (throttle / 100) * 15 + Math.sin(now * 0.0005) * 3, 25, 55);

    // Fuel (slowly decreasing)
    s.fuelLevel = clamp(s.fuelLevel - dt * 0.015, 20, 100);

    // AFR
    const afr = throttle > 80 ? 12.5 + Math.random() * 0.8 :
                throttle > 50 ? 13.5 + Math.random() * 0.7 :
                14.2 + Math.random() * 0.5;

    // Power and Torque
    const rpmFrac = rpm / VEHICLE.maxRpm;
    const powerCurve = Math.sin(rpmFrac * Math.PI * 0.85) * (throttle / 100);
    const power = VEHICLE.maxPowerKw * powerCurve;
    const torque = rpm > 0 ? (power * 9549) / rpm : 0;

    // Traction
    const absGLat = Math.abs(s.gLat);
    const slipRatio = clamp(absGLat * 0.15 + (Math.random() - 0.5) * 0.02, 0, 0.5);
    const stabilityState = slipRatio > 0.25 ? 'OVERSTEER' :
                           slipRatio > 0.12 ? 'MILD_SLIP' : 'STABLE';
    const espActive = slipRatio > 0.2;

    // Thermal Risk Score
    const coolantNorm = clamp((s.coolantTemp - 85) / 35, 0, 1);
    const oilNorm = clamp((s.oilTemp - 88) / 57, 0, 1);
    const iatNorm = clamp((s.iat - 25) / 40, 0, 1);
    s.trsScore = (coolantNorm * 35 + oilNorm * 25 + iatNorm * 20 + engineLoad * 0.2);
    const trsState = s.trsScore > 70 ? 'WARNING' : s.trsScore > 45 ? 'WATCH' : 'SAFE';

    // Weight transfer
    const weightBase = VEHICLE.curbWeightKg / 4;
    const longTransfer = s.gLong * 80;
    const latTransfer = s.gLat * 60;

    // Delta calculation
    const expectedLapTime = 432000; // 7:12
    const expectedFraction = normalizedPos;
    const expectedTimeAtPos = expectedFraction * expectedLapTime;
    const delta = s.lapTimeMs - expectedTimeAtPos;

    // Stopping distance
    const stoppingDist = speed > 0 ? (speed * speed) / (2 * 9.81 * 1.2 * 3.6 * 3.6) : 0;

    // Build data snapshot
    const snapshot = {
      timestamp: Date.now(),
      rpm: Math.round(rpm),
      speed: Math.round(speed * 10) / 10,
      throttle: Math.round(throttle * 10) / 10,
      engine_load: Math.round(engineLoad * 10) / 10,
      load: Math.round(engineLoad * 10) / 10,
      gear,
      max_rpm: VEHICLE.maxRpm,
      shift_rpm: VEHICLE.shiftRpm,
      shift_now: shiftNow,
      // Temperatures
      coolant_temp: Math.round(s.coolantTemp * 10) / 10,
      oil_temp: Math.round(s.oilTemp * 10) / 10,
      iat: Math.round(s.iat * 10) / 10,
      intake_air_temp: Math.round(s.iat * 10) / 10,
      ambient_temp: 22,
      // Dynamics
      g_lat: Math.round(s.gLat * 1000) / 1000,
      g_long: Math.round(s.gLong * 1000) / 1000,
      // Fuel
      afr: Math.round(afr * 100) / 100,
      fuel_level: Math.round(s.fuelLevel * 10) / 10,
      fuel_consumption: Math.round((speed > 10 ? 18 + throttle * 0.2 : 2) * 10) / 10,
      fuel_remaining: Math.round(s.fuelLevel * VEHICLE.fuelTankL / 100 * 10) / 10,
      // Pressure
      boost: throttle > 60 ? Math.round((throttle - 60) * 0.03 * 100) / 100 : 0,
      map_pressure: Math.round((70 + throttle * 0.8) * 10) / 10,
      oil_pressure: Math.round((2.5 + (rpm / VEHICLE.maxRpm) * 2.5) * 100) / 100,
      // Performance
      power: Math.round(power * 10) / 10,
      torque: Math.round(torque * 10) / 10,
      // Braking
      brake_pressure: Math.round(brakePressure * 10) / 10,
      deceleration_g: brakePressure > 0 ? Math.round(Math.abs(s.gLong) * 100) / 100 : 0,
      brake_temp: Math.round(clamp(200 + brakePressure * 4 + speed * 0.5, 180, 650) * 10) / 10,
      stopping_distance: Math.round(stoppingDist * 10) / 10,
      // Traction
      slip_ratio: Math.round(slipRatio * 1000) / 1000,
      stability_state: stabilityState,
      esp_active: espActive,
      // Weight Transfer
      weight_fl: Math.round(weightBase - longTransfer + latTransfer),
      weight_fr: Math.round(weightBase - longTransfer - latTransfer),
      weight_rl: Math.round(weightBase + longTransfer + latTransfer),
      weight_rr: Math.round(weightBase + longTransfer - latTransfer),
      // Timing
      lap_time: Math.round(s.lapTimeMs),
      best_lap: s.bestLapMs > 0 ? Math.round(s.bestLapMs) : null,
      delta: Math.round(delta),
      lap_count: s.lapCount,
      sector_times: null,
      session_time: Math.round(now),
      // Thermal
      trs_score: Math.round(s.trsScore * 10) / 10,
      trs_state: trsState,
      // Track info (extra)
      track_position: normalizedPos,
      track_x: mapX,
      track_y: mapY,
      section_name: curWp[4],
    };

    // Update history buffer
    const entry = { ...snapshot, _historyTs: Date.now() };
    s.historyBuffer = [...s.historyBuffer, entry].slice(-300);

    setData(snapshot);
    setHistory(s.historyBuffer);
    setTrackPosition(normalizedPos);
    setSectionName(curWp[4]);
    setLapCount(s.lapCount);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Run at ~20Hz (50ms)
    intervalRef.current = setInterval(tick, 50);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, tick]);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    stateRef.current.position = 0;
    stateRef.current.segmentIndex = 0;
    stateRef.current.segmentT = 0;
    stateRef.current.lapTimeMs = 0;
    stateRef.current.lapCount = 0;
    stateRef.current.lastTimestamp = 0;
    stateRef.current.historyBuffer = [];
    stateRef.current.smoothSpeed = 120;
    stateRef.current.prevSpeed = 120;
    setData(null);
    setHistory([]);
    setTrackPosition(0);
    setLapCount(0);
  }, []);

  return {
    data,
    history,
    connected: isRunning,
    error: null,
    trackPosition,
    sectionName,
    lapCount,
    isRunning,
    start,
    stop,
    reset,
  };
}

// Export track waypoints for the TrackMap component
export { TRACK_WAYPOINTS };
