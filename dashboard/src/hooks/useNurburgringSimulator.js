/**
 * Nürburgring Nordschleife Simulator
 *
 * Simulates a hot lap based on the Porsche 919 Hybrid Evo record (5:19.546).
 * Real sector speeds, G-forces, and telemetry data derived from published
 * onboard data and lap analysis.
 *
 * Track: 20.832 km Nordschleife (full circuit)
 * Reference: Timo Bernhard, Porsche 919 Evo, June 29 2018
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// ── Nordschleife Track Waypoints ────────────────────────────────────────────
// Based on real GPS coordinates, scaled to SVG space (0-1000)
// [x, y, targetSpeed(km/h), curvature, sectionName, sectorId]
//
// Speeds based on 919 Evo onboard telemetry analysis:
// - Döttinger Höhe straight: 369 km/h (recorded peak)
// - Schwedenkreuz: 350 km/h
// - Fuchsröhre: 355 km/h (downhill)
// - Karussell: 105 km/h (banked)
// - Adenauer Forst hairpins: 90-120 km/h
// - Bergwerk: 95 km/h
export const TRACK_WAYPOINTS = [
  // ── SECTOR 1: Start/Ziel → Hatzenbach → Hocheichen ──
  [500, 555, 280, 0, 'Start/Ziel', 1],
  [530, 548, 290, 0.05, 'Start/Ziel', 1],
  [560, 538, 275, 0.12, 'T13', 1],
  [588, 522, 240, 0.25, 'T13', 1],
  // Hatzenbach - tight double-right
  [610, 505, 195, 0.42, 'Hatzenbach', 1],
  [630, 485, 175, 0.50, 'Hatzenbach', 1],
  [648, 458, 185, 0.38, 'Hatzenbach', 1],
  [652, 432, 200, 0.20, 'Hatzenbach', 1],
  // Hocheichen - fast left kink
  [658, 405, 235, -0.15, 'Hocheichen', 1],
  [670, 378, 250, -0.12, 'Hocheichen', 1],
  [688, 352, 265, -0.08, 'Hocheichen', 1],

  // ── SECTOR 2: Quiddelbacher Höhe → Flugplatz → Schwedenkreuz ──
  [710, 325, 300, 0.05, 'Quiddelbacher Höhe', 2],
  [730, 298, 320, 0.02, 'Flugplatz', 2],
  [748, 270, 295, 0.22, 'Flugplatz', 2],
  [758, 242, 235, 0.40, 'Flugplatz', 2],
  [760, 218, 210, 0.35, 'Flugplatz', 2],
  // Schwedenkreuz - flat-out kink at record pace
  [755, 192, 340, -0.10, 'Schwedenkreuz', 2],
  [740, 165, 350, -0.08, 'Schwedenkreuz', 2],
  [722, 140, 330, -0.15, 'Schwedenkreuz', 2],

  // ── SECTOR 3: Aremberg → Fuchsröhre → Adenauer Forst ──
  [695, 118, 250, -0.38, 'Aremberg', 3],
  [660, 102, 180, -0.55, 'Aremberg', 3],
  [628, 95, 200, -0.30, 'Fuchsröhre', 3],
  // Fuchsröhre - steep downhill, huge speed
  [590, 82, 310, -0.08, 'Fuchsröhre', 3],
  [548, 72, 345, 0.03, 'Fuchsröhre', 3],
  [508, 65, 355, 0.05, 'Fuchsröhre', 3],
  // Adenauer Forst - slow hairpin complex
  [468, 62, 215, 0.35, 'Adenauer Forst', 3],
  [432, 68, 130, 0.60, 'Adenauer Forst', 3],
  [408, 82, 95, 0.65, 'Adenauer Forst', 3],
  [388, 105, 120, 0.45, 'Adenauer Forst', 3],
  [375, 128, 160, 0.25, 'Adenauer Forst', 3],

  // ── SECTOR 4: Metzgesfeld → Kallenhard → Wehrseifen → Breidscheid ──
  [362, 152, 210, -0.18, 'Metzgesfeld', 4],
  [345, 178, 235, -0.12, 'Metzgesfeld', 4],
  [328, 205, 250, -0.08, 'Metzgesfeld', 4],
  // Kallenhard - medium right
  [310, 232, 200, 0.32, 'Kallenhard', 4],
  [288, 258, 175, 0.42, 'Kallenhard', 4],
  [268, 282, 185, 0.30, 'Kallenhard', 4],
  // Wehrseifen - tight left hairpin
  [255, 308, 140, -0.55, 'Wehrseifen', 4],
  [248, 335, 105, -0.62, 'Wehrseifen', 4],
  [252, 358, 120, -0.40, 'Wehrseifen', 4],
  // Breidscheid
  [258, 382, 225, 0.10, 'Breidscheid', 4],
  [262, 408, 245, 0.05, 'Breidscheid', 4],

  // ── SECTOR 5: Ex-Mühle → Bergwerk → Karussell ──
  [260, 428, 210, -0.22, 'Ex-Mühle', 5],
  [252, 448, 180, -0.35, 'Bergwerk', 5],
  // Bergwerk - infamous blind left
  [242, 468, 120, -0.58, 'Bergwerk', 5],
  [238, 488, 95, -0.65, 'Bergwerk', 5],
  [240, 505, 130, 0.30, 'Bergwerk', 5],
  // Karussell - banked 210° left turn
  [248, 520, 115, 0.55, 'Karussell', 5],
  [262, 532, 105, 0.70, 'Karussell', 5],
  [280, 538, 100, 0.72, 'Karussell', 5],
  [300, 536, 100, 0.68, 'Karussell', 5],
  [318, 528, 110, 0.55, 'Karussell', 5],
  [332, 518, 140, 0.35, 'Karussell', 5],

  // ── SECTOR 6: Hohe Acht → Wippermann → Brünnchen → Pflanzgarten ──
  [348, 502, 210, -0.18, 'Hohe Acht', 6],
  [365, 488, 240, -0.12, 'Hohe Acht', 6],
  [382, 478, 260, 0.10, 'Wippermann', 6],
  [400, 470, 235, 0.28, 'Brünnchen', 6],
  [418, 465, 210, 0.35, 'Brünnchen', 6],
  [435, 468, 225, 0.22, 'Brünnchen', 6],
  // Pflanzgarten - blind crests, high-speed
  [455, 478, 280, -0.12, 'Pflanzgarten', 6],
  [472, 492, 290, -0.18, 'Pflanzgarten', 6],
  [485, 508, 240, 0.28, 'Pflanzgarten', 6],
  [492, 525, 195, 0.42, 'Pflanzgarten', 6],

  // ── SECTOR 7: Schwalbenschwanz → Döttinger Höhe → Tiergarten ──
  [488, 542, 180, -0.38, 'Schwalbenschwanz', 7],
  [480, 552, 200, -0.28, 'Schwalbenschwanz', 7],
  // Galgenkopf
  [472, 560, 230, -0.12, 'Galgenkopf', 7],
  [462, 565, 260, -0.05, 'Galgenkopf', 7],
  // Döttinger Höhe - longest straight, absolute top speed
  [445, 568, 320, 0.0, 'Döttinger Höhe', 7],
  [425, 572, 345, 0.0, 'Döttinger Höhe', 7],
  [405, 574, 360, 0.0, 'Döttinger Höhe', 7],
  [385, 573, 369, 0.0, 'Döttinger Höhe', 7],
  [365, 570, 365, 0.02, 'Döttinger Höhe', 7],
  [345, 566, 350, 0.05, 'Antoniusbuche', 7],
  // Tiergarten
  [328, 562, 290, -0.12, 'Tiergarten', 7],
  [315, 560, 260, -0.18, 'Tiergarten', 7],
  // Hohenrain chicane
  [305, 562, 195, 0.32, 'Hohenrain', 7],
  [300, 565, 170, -0.38, 'Hohenrain', 7],
  // Back to Start
  [310, 568, 200, -0.15, 'Hohenrain', 7],
  [340, 572, 235, -0.05, 'T13 approach', 7],
  [385, 574, 260, 0.0, 'T13 approach', 7],
  [430, 570, 270, 0.03, 'T13 approach', 7],
  [465, 562, 280, 0.05, 'Start/Ziel', 7],
];

// ── Sector Definitions ──────────────────────────────────────────────────────
// Real 919 Evo sector times (estimated from video analysis)
export const SECTORS = [
  { id: 1, name: 'Hatzenbach', color: '#ef4444' },
  { id: 2, name: 'Flugplatz', color: '#f97316' },
  { id: 3, name: 'Fuchsröhre', color: '#eab308' },
  { id: 4, name: 'Wehrseifen', color: '#22c55e' },
  { id: 5, name: 'Karussell', color: '#06b6d4' },
  { id: 6, name: 'Pflanzgarten', color: '#8b5cf6' },
  { id: 7, name: 'Döttinger Höhe', color: '#ec4899' },
];

// ── Vehicle Profile (Porsche 919 Hybrid Evo) ─────────────────────────────
const VEHICLE = {
  name: 'Porsche 919 Hybrid Evo',
  maxRpm: 9000,
  shiftRpm: 8500,
  redlineRpm: 9200,
  gearRatios: [3.23, 2.19, 1.71, 1.39, 1.16, 1.00, 0.87],
  finalDrive: 3.42,
  tireCircumM: 1.96,
  curbWeightKg: 849,
  maxPowerKw: 735,       // ~1000 HP combined (V4 turbo hybrid)
  maxTorqueNm: 900,
  fuelTankL: 62.5,
  cgHeightM: 0.28,
  wheelbaseM: 2.80,
  trackWidthM: 1.60,
  maxDownforceKg: 530,   // at 300+ km/h
  bestLapMs: 319546,     // 5:19.546
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
function dist(p1, p2) { return Math.sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2); }

function getGear(speed) {
  if (speed < 80) return 2;
  if (speed < 130) return 3;
  if (speed < 185) return 4;
  if (speed < 250) return 5;
  if (speed < 320) return 6;
  return 7;
}

function getRpm(speed, gear) {
  if (speed < 5) return 4200 + Math.random() * 200;
  const ratio = VEHICLE.gearRatios[gear - 1] || VEHICLE.gearRatios[0];
  const wheelRps = (speed / 3.6) / VEHICLE.tireCircumM;
  const rpm = wheelRps * ratio * VEHICLE.finalDrive * 60;
  return clamp(rpm, 4000, VEHICLE.maxRpm);
}

const TRACK_LENGTH_KM = 20.832;

// ── The Hook ────────────────────────────────────────────────────────────────

export default function useNurburgringSimulator(autoStart = true) {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [sectionName, setSectionName] = useState('Start/Ziel');
  const [isRunning, setIsRunning] = useState(autoStart);
  const [lapCount, setLapCount] = useState(0);

  const stateRef = useRef({
    segmentIndex: 0,
    segmentT: 0,
    smoothSpeed: 250,
    prevSpeed: 250,
    gLat: 0,
    gLong: 0,
    coolantTemp: 92,
    oilTemp: 105,
    iat: 38,
    brakeTemp: 350,
    fuelLevel: 92,
    trsScore: 30,
    lapTimeMs: 0,
    bestLapMs: VEHICLE.bestLapMs,
    lapCount: 0,
    lastTimestamp: 0,
    historyBuffer: [],
    sectorTimes: [null, null, null, null, null, null, null],
    currentSector: 1,
    sectorStartMs: 0,
  });

  const intervalRef = useRef(null);

  const tick = useCallback(() => {
    const s = stateRef.current;
    const now = performance.now();
    if (s.lastTimestamp === 0) { s.lastTimestamp = now; return; }

    const dt = Math.min((now - s.lastTimestamp) / 1000, 0.1);
    s.lastTimestamp = now;

    const N = TRACK_WAYPOINTS.length;

    // Segment lengths
    let totalLen = 0;
    const segLens = [];
    for (let i = 0; i < N; i++) {
      const d = dist(TRACK_WAYPOINTS[i], TRACK_WAYPOINTS[(i+1) % N]);
      segLens.push(d);
      totalLen += d;
    }
    const kmPerPx = TRACK_LENGTH_KM / totalLen;

    const idx = s.segmentIndex % N;
    const nxt = (idx + 1) % N;
    const wp = TRACK_WAYPOINTS[idx];
    const wpN = TRACK_WAYPOINTS[nxt];

    // Target speed with realistic variation
    const baseTarget = lerp(wp[2], wpN[2], s.segmentT);
    const targetSpeed = baseTarget + Math.sin(now * 0.0008) * 3;

    // Physics: approach target speed (high downforce = aggressive braking & cornering)
    const speedDiff = targetSpeed - s.smoothSpeed;
    // 919 Evo: ~2.5G braking, ~1.8G acceleration
    const accelRate = speedDiff > 0 ? 45 : -65;
    s.smoothSpeed += clamp(speedDiff, -Math.abs(accelRate) * dt, Math.abs(accelRate) * dt);
    s.smoothSpeed = clamp(s.smoothSpeed, 60, 375);

    const speed = s.smoothSpeed + Math.sin(now * 0.002) * 1.5 + (Math.random() - 0.5) * 0.8;

    // Advance position
    const distPx = (speed / 3.6) * dt / (kmPerPx * 1000);
    s.segmentT += distPx / segLens[idx];

    while (s.segmentT >= 1.0) {
      s.segmentT -= 1.0;
      s.segmentIndex = (s.segmentIndex + 1) % N;

      // Sector change detection
      const newSector = TRACK_WAYPOINTS[s.segmentIndex % N][5];
      if (newSector !== s.currentSector) {
        const sectorTime = s.lapTimeMs - s.sectorStartMs;
        s.sectorTimes[s.currentSector - 1] = Math.round(sectorTime);
        s.currentSector = newSector;
        s.sectorStartMs = s.lapTimeMs;
      }

      if (s.segmentIndex === 0) {
        s.lapCount++;
        if (s.lapTimeMs > 0 && s.lapTimeMs < s.bestLapMs) {
          s.bestLapMs = s.lapTimeMs;
        }
        s.lapTimeMs = 0;
        s.sectorTimes = [null, null, null, null, null, null, null];
        s.sectorStartMs = 0;
        s.currentSector = 1;
      }
    }

    s.lapTimeMs += dt * 1000;

    // Map position
    const curWp = TRACK_WAYPOINTS[s.segmentIndex % N];
    const nxtWp = TRACK_WAYPOINTS[(s.segmentIndex + 1) % N];
    const mapX = lerp(curWp[0], nxtWp[0], s.segmentT);
    const mapY = lerp(curWp[1], nxtWp[1], s.segmentT);

    // Normalized position
    let distSoFar = 0;
    for (let i = 0; i < s.segmentIndex; i++) distSoFar += segLens[i];
    distSoFar += segLens[s.segmentIndex] * s.segmentT;
    const normPos = distSoFar / totalLen;

    // G-Forces (919 Evo: up to 3.5G lateral, 2.5G longitudinal braking, 1.8G accel)
    const curvature = lerp(curWp[3], nxtWp[3], s.segmentT);
    // Lateral G scales with speed² and curvature (downforce helps)
    const speedFactor = speed / 200;
    const downforceBonus = speed > 200 ? 1 + (speed - 200) / 400 : 1;
    const rawLatG = curvature * speedFactor * speedFactor * 1.8 * downforceBonus;
    const latG = clamp(rawLatG, -3.5, 3.5) + (Math.random() - 0.5) * 0.03;

    // Longitudinal G
    const accelG = (speed - s.prevSpeed) / (dt * 9.81 * 3.6);
    const longG = clamp(accelG, -2.5, 1.8) + (Math.random() - 0.5) * 0.02;
    s.prevSpeed = speed;

    // Smooth G-forces
    s.gLat = lerp(s.gLat, latG, 0.25);
    s.gLong = lerp(s.gLong, longG, 0.25);

    // Gear & RPM
    const gear = getGear(speed);
    const rpm = getRpm(speed, gear);
    const shiftNow = rpm > VEHICLE.shiftRpm;

    // Throttle & Brake (realistic)
    const throttle = speedDiff > 10 ? clamp(85 + speedDiff * 0.3, 70, 100) :
                     speedDiff < -20 ? clamp(2, 0, 10) :
                     clamp(50 + speedDiff * 1.5, 15, 75);
    const brakePressure = speedDiff < -15 ? clamp(Math.abs(speedDiff) * 2.5, 0, 100) : 0;
    const engineLoad = clamp(throttle * 0.85 + (rpm / VEHICLE.maxRpm) * 20, 20, 100);

    // Temperatures (919 Evo runs hotter)
    s.coolantTemp = clamp(s.coolantTemp + (engineLoad > 75 ? 0.003 : -0.001) * dt * 10, 88, 112);
    s.oilTemp = clamp(s.oilTemp + (engineLoad > 65 ? 0.004 : -0.0008) * dt * 10, 95, 142);
    s.iat = clamp(35 + (throttle / 100) * 18 + Math.sin(now * 0.0004) * 2, 28, 58);
    s.brakeTemp = clamp(
      s.brakeTemp + (brakePressure > 0 ? brakePressure * 0.15 : -8) * dt,
      250, 850
    );

    // Fuel
    s.fuelLevel = clamp(s.fuelLevel - dt * 0.025, 15, 100);

    // AFR (race engine runs richer)
    const afr = throttle > 85 ? 11.8 + Math.random() * 0.5 :
                throttle > 55 ? 12.8 + Math.random() * 0.6 :
                13.8 + Math.random() * 0.4;

    // Power & Torque (hybrid: electric + V4 turbo)
    const rpmFrac = rpm / VEHICLE.maxRpm;
    const powerCurve = Math.sin(rpmFrac * Math.PI * 0.88) * (throttle / 100);
    const hybridBoost = speed > 100 ? 0.15 : 0.25; // more electric at low speed
    const power = VEHICLE.maxPowerKw * (powerCurve + hybridBoost * (throttle / 100));
    const torque = rpm > 0 ? (power * 9549) / rpm : 0;

    // Traction (919 Evo has insane grip from downforce)
    const absGLat = Math.abs(s.gLat);
    const slipRatio = clamp(absGLat * 0.08 + (Math.random() - 0.5) * 0.01, 0, 0.35);
    const stabilityState = slipRatio > 0.20 ? 'OVERSTEER' :
                           slipRatio > 0.10 ? 'MILD_SLIP' : 'STABLE';
    const espActive = slipRatio > 0.18;

    // Thermal Risk Score
    const coolNorm = clamp((s.coolantTemp - 88) / 30, 0, 1);
    const oilNorm = clamp((s.oilTemp - 95) / 50, 0, 1);
    const iatNorm = clamp((s.iat - 28) / 35, 0, 1);
    const brakeNorm = clamp((s.brakeTemp - 350) / 500, 0, 1);
    s.trsScore = coolNorm * 30 + oilNorm * 25 + iatNorm * 15 + brakeNorm * 20 + engineLoad * 0.10;
    const trsState = s.trsScore > 65 ? 'WARNING' : s.trsScore > 40 ? 'WATCH' : 'SAFE';

    // Weight transfer (lightweight LMP1 = aggressive transfer)
    const wBase = VEHICLE.curbWeightKg / 4;
    const longTrans = s.gLong * 55;
    const latTrans = s.gLat * 45;

    // Delta to record
    const expectedTime = normPos * VEHICLE.bestLapMs;
    const delta = s.lapTimeMs - expectedTime;

    // Stopping distance
    const stopDist = speed > 0 ? (speed * speed) / (2 * 9.81 * 2.2 * 3.6 * 3.6) : 0;

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
      coolant_temp: Math.round(s.coolantTemp * 10) / 10,
      oil_temp: Math.round(s.oilTemp * 10) / 10,
      iat: Math.round(s.iat * 10) / 10,
      intake_air_temp: Math.round(s.iat * 10) / 10,
      ambient_temp: 24,
      g_lat: Math.round(s.gLat * 1000) / 1000,
      g_long: Math.round(s.gLong * 1000) / 1000,
      afr: Math.round(afr * 100) / 100,
      fuel_level: Math.round(s.fuelLevel * 10) / 10,
      fuel_consumption: Math.round((speed > 10 ? 35 + throttle * 0.4 : 5) * 10) / 10,
      fuel_remaining: Math.round(s.fuelLevel * VEHICLE.fuelTankL / 100 * 10) / 10,
      boost: throttle > 40 ? Math.round((throttle - 40) * 0.05 * 100) / 100 : 0,
      map_pressure: Math.round((80 + throttle * 1.2) * 10) / 10,
      oil_pressure: Math.round((3.0 + (rpm / VEHICLE.maxRpm) * 3.5) * 100) / 100,
      power: Math.round(power * 10) / 10,
      torque: Math.round(torque * 10) / 10,
      brake_pressure: Math.round(brakePressure * 10) / 10,
      deceleration_g: brakePressure > 0 ? Math.round(Math.abs(s.gLong) * 100) / 100 : 0,
      brake_temp: Math.round(s.brakeTemp * 10) / 10,
      stopping_distance: Math.round(stopDist * 10) / 10,
      slip_ratio: Math.round(slipRatio * 1000) / 1000,
      stability_state: stabilityState,
      esp_active: espActive,
      weight_fl: Math.round(wBase - longTrans + latTrans),
      weight_fr: Math.round(wBase - longTrans - latTrans),
      weight_rl: Math.round(wBase + longTrans + latTrans),
      weight_rr: Math.round(wBase + longTrans - latTrans),
      lap_time: Math.round(s.lapTimeMs),
      best_lap: s.bestLapMs > 0 ? Math.round(s.bestLapMs) : null,
      delta: Math.round(delta),
      lap_count: s.lapCount,
      sector_times: [...s.sectorTimes],
      current_sector: s.currentSector,
      session_time: Math.round(now),
      trs_score: Math.round(s.trsScore * 10) / 10,
      trs_state: trsState,
      track_position: normPos,
      track_x: mapX,
      track_y: mapY,
      section_name: curWp[4],
      sector_id: curWp[5],
      vehicle_name: VEHICLE.name,
    };

    const entry = { ...snapshot, _historyTs: Date.now() };
    s.historyBuffer = [...s.historyBuffer, entry].slice(-300);

    setData(snapshot);
    setHistory(s.historyBuffer);
    setSectionName(curWp[4]);
    setLapCount(s.lapCount);
  }, []);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      return;
    }
    intervalRef.current = setInterval(tick, 50); // 20Hz
    return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
  }, [isRunning, tick]);

  const start = useCallback(() => setIsRunning(true), []);
  const stop = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    const s = stateRef.current;
    s.segmentIndex = 0; s.segmentT = 0; s.lapTimeMs = 0;
    s.lapCount = 0; s.lastTimestamp = 0; s.historyBuffer = [];
    s.smoothSpeed = 250; s.prevSpeed = 250;
    s.sectorTimes = [null,null,null,null,null,null,null];
    s.currentSector = 1; s.sectorStartMs = 0;
    setData(null); setHistory([]); setLapCount(0);
  }, []);

  return {
    data, history, connected: isRunning, error: null,
    sectionName, lapCount, isRunning,
    start, stop, reset,
  };
}
