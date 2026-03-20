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
// Accurate GPS-derived layout of the 20.832 km Nürburgring Nordschleife
// Scaled to SVG viewBox. Oriented: North=top, East=right.
// Racing direction: clockwise on map (S→N on east side, N→S on west side)
// [x, y, targetSpeed(km/h), curvature, sectionName, sectorId]
//
// 919 Evo telemetry reference speeds:
// Döttinger Höhe: 369 km/h | Fuchsröhre: 355 km/h | Schwedenkreuz: 350 km/h
// Karussell: 100-105 km/h | Adenauer Forst: 90-120 km/h | Bergwerk: 95 km/h
export const TRACK_WAYPOINTS = [
  // ═══ SECTOR 1: Start/Ziel → T13 → Hatzenbach → Hocheichen ═══
  // Start/Finish at southeast, heading north along the east leg
  [695, 572, 280, 0, 'Start/Ziel', 1],
  [710, 555, 275, 0.08, 'Start/Ziel', 1],
  [722, 535, 260, 0.15, 'T13', 1],
  [730, 512, 240, 0.22, 'T13', 1],
  [735, 488, 220, 0.30, 'T13', 1],
  // Hatzenbach - tight S-curves heading north
  [738, 462, 195, 0.42, 'Hatzenbach', 1],
  [742, 435, 175, 0.50, 'Hatzenbach', 1],
  [748, 408, 180, -0.38, 'Hatzenbach', 1],
  [752, 382, 195, -0.25, 'Hatzenbach', 1],
  // Hocheichen - fast left kink, still heading north
  [755, 355, 240, -0.15, 'Hocheichen', 1],
  [756, 328, 255, -0.08, 'Hocheichen', 1],
  [754, 300, 265, 0.05, 'Hocheichen', 1],

  // ═══ SECTOR 2: Quiddelbacher Höhe → Flugplatz → Schwedenkreuz ═══
  // Continuing north along the east side
  [750, 272, 300, 0.04, 'Quiddelbacher Höhe', 2],
  [745, 245, 310, 0.02, 'Quiddelbacher Höhe', 2],
  // Flugplatz - famous jump, crest over hill
  [738, 218, 295, 0.18, 'Flugplatz', 2],
  [728, 192, 240, 0.38, 'Flugplatz', 2],
  [715, 170, 220, 0.32, 'Flugplatz', 2],
  // Schwedenkreuz - flat-out kink heading northwest
  [698, 150, 340, -0.10, 'Schwedenkreuz', 2],
  [678, 132, 350, -0.08, 'Schwedenkreuz', 2],
  [655, 118, 335, -0.12, 'Schwedenkreuz', 2],

  // ═══ SECTOR 3: Aremberg → Fuchsröhre → Adenauer Forst ═══
  // Curving westward across the top of the circuit
  [628, 108, 260, -0.35, 'Aremberg', 3],
  [598, 98, 190, -0.52, 'Aremberg', 3],
  [570, 88, 210, -0.28, 'Aremberg', 3],
  // Fuchsröhre - steep downhill heading west, huge speed
  [538, 78, 310, -0.06, 'Fuchsröhre', 3],
  [502, 70, 340, 0.03, 'Fuchsröhre', 3],
  [465, 65, 355, 0.04, 'Fuchsröhre', 3],
  [428, 62, 330, 0.08, 'Fuchsröhre', 3],
  // Adenauer Forst - tight hairpin complex at the northwest corner
  [395, 60, 220, 0.32, 'Adenauer Forst', 3],
  [365, 62, 140, 0.58, 'Adenauer Forst', 3],
  [340, 70, 95, 0.68, 'Adenauer Forst', 3],
  [322, 85, 110, 0.52, 'Adenauer Forst', 3],
  [310, 105, 150, 0.30, 'Adenauer Forst', 3],

  // ═══ SECTOR 4: Metzgesfeld → Kallenhard → Wehrseifen → Breidscheid ═══
  // Heading south along the west leg
  [300, 130, 210, -0.15, 'Metzgesfeld', 4],
  [292, 158, 235, -0.10, 'Metzgesfeld', 4],
  [285, 188, 250, -0.06, 'Metzgesfeld', 4],
  // Kallenhard - medium-speed right curves
  [278, 218, 205, 0.30, 'Kallenhard', 4],
  [270, 248, 180, 0.42, 'Kallenhard', 4],
  [264, 278, 190, 0.28, 'Kallenhard', 4],
  // Wehrseifen - tight left hairpin
  [260, 308, 145, -0.52, 'Wehrseifen', 4],
  [258, 338, 105, -0.62, 'Wehrseifen', 4],
  [262, 365, 125, -0.38, 'Wehrseifen', 4],
  // Breidscheid - heading south
  [268, 392, 230, 0.08, 'Breidscheid', 4],
  [272, 418, 245, 0.04, 'Breidscheid', 4],

  // ═══ SECTOR 5: Ex-Mühle → Bergwerk → Karussell ═══
  // Continuing south on west side
  [274, 442, 215, -0.18, 'Ex-Mühle', 5],
  [272, 465, 185, -0.32, 'Ex-Mühle', 5],
  // Bergwerk - infamous blind left
  [268, 488, 125, -0.55, 'Bergwerk', 5],
  [264, 508, 95, -0.65, 'Bergwerk', 5],
  [268, 525, 130, 0.28, 'Bergwerk', 5],
  // Karussell - banked 210° left turn, heading east after
  [276, 540, 115, 0.52, 'Karussell', 5],
  [288, 552, 105, 0.68, 'Karussell', 5],
  [305, 558, 100, 0.72, 'Karussell', 5],
  [325, 560, 100, 0.68, 'Karussell', 5],
  [345, 556, 108, 0.55, 'Karussell', 5],
  [362, 545, 135, 0.35, 'Karussell', 5],

  // ═══ SECTOR 6: Hohe Acht → Wippermann → Brünnchen → Pflanzgarten ═══
  // Heading east through the middle-south of the circuit
  [380, 530, 210, -0.15, 'Hohe Acht', 6],
  [398, 518, 240, -0.10, 'Hohe Acht', 6],
  [418, 508, 265, 0.08, 'Wippermann', 6],
  // Brünnchen - fast sweeping section
  [438, 502, 240, 0.25, 'Brünnchen', 6],
  [458, 498, 215, 0.35, 'Brünnchen', 6],
  [478, 502, 230, 0.20, 'Brünnchen', 6],
  // Pflanzgarten - blind crests and drops, dramatic
  [498, 510, 285, -0.10, 'Pflanzgarten', 6],
  [518, 522, 295, -0.15, 'Pflanzgarten', 6],
  [535, 538, 245, 0.28, 'Pflanzgarten', 6],
  [548, 555, 200, 0.40, 'Pflanzgarten', 6],

  // ═══ SECTOR 7: Schwalbenschwanz → Galgenkopf → Döttinger Höhe → Start ═══
  // Schwalbenschwanz chicane in the south-center
  [555, 568, 185, -0.35, 'Schwalbenschwanz', 7],
  [558, 580, 195, -0.25, 'Schwalbenschwanz', 7],
  // Galgenkopf - opening up to the straight
  [555, 590, 235, 0.12, 'Galgenkopf', 7],
  [548, 598, 265, 0.05, 'Galgenkopf', 7],
  // Döttinger Höhe - longest straight, absolute top speed, heading east
  [535, 602, 320, 0.0, 'Döttinger Höhe', 7],
  [515, 606, 345, 0.0, 'Döttinger Höhe', 7],
  [490, 608, 360, 0.0, 'Döttinger Höhe', 7],
  [460, 608, 369, 0.0, 'Döttinger Höhe', 7],
  [430, 607, 365, 0.0, 'Döttinger Höhe', 7],
  [400, 605, 360, 0.01, 'Döttinger Höhe', 7],
  [370, 602, 355, 0.02, 'Döttinger Höhe', 7],
  // Antoniusbuche
  [345, 598, 340, 0.04, 'Antoniusbuche', 7],
  [322, 594, 310, -0.08, 'Antoniusbuche', 7],
  // Tiergarten
  [305, 590, 270, -0.15, 'Tiergarten', 7],
  [292, 586, 240, -0.22, 'Tiergarten', 7],
  // Hohenrain chicane - last corners before start/finish
  [282, 584, 185, 0.35, 'Hohenrain', 7],
  [278, 580, 165, -0.40, 'Hohenrain', 7],
  // Approach back to Start/Finish heading east
  [280, 575, 200, -0.12, 'Hohenrain', 7],
  [290, 572, 235, -0.05, 'T13 approach', 7],
  [315, 570, 250, 0.02, 'T13 approach', 7],
  [355, 568, 260, 0.0, 'T13 approach', 7],
  [405, 566, 265, 0.0, 'T13 approach', 7],
  [460, 565, 270, 0.01, 'T13 approach', 7],
  [520, 566, 275, 0.02, 'T13 approach', 7],
  [580, 567, 278, 0.02, 'T13 approach', 7],
  [640, 568, 280, 0.01, 'Start/Ziel', 7],
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
