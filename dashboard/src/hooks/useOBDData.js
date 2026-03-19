import { useState, useEffect, useRef, useCallback } from 'react';
import useWebSocket from './useWebSocket';

const HISTORY_MAX = 300;

export default function useOBDData(wsUrl) {
  const { data: rawData, connected, error } = useWebSocket(wsUrl);
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const historyRef = useRef([]);

  useEffect(() => {
    if (!rawData) return;

    // Normalize data - handle both flat and nested structures
    const parsed = {
      timestamp: rawData.timestamp ?? Date.now(),
      // Engine
      rpm: rawData.rpm ?? rawData.engine_rpm ?? null,
      speed: rawData.speed ?? rawData.vehicle_speed ?? null,
      throttle: rawData.throttle ?? rawData.throttle_position ?? null,
      load: rawData.engine_load ?? rawData.load ?? null,
      // Temperatures
      coolant_temp: rawData.coolant_temp ?? rawData.engine_coolant_temp ?? null,
      oil_temp: rawData.oil_temp ?? null,
      iat: rawData.iat ?? rawData.intake_air_temp ?? null,
      ambient_temp: rawData.ambient_temp ?? null,
      // Fuel & Air
      afr: rawData.afr ?? rawData.air_fuel_ratio ?? null,
      fuel_level: rawData.fuel_level ?? null,
      fuel_consumption: rawData.fuel_consumption ?? null,
      fuel_remaining: rawData.fuel_remaining ?? null,
      // Pressure
      boost: rawData.boost ?? rawData.boost_pressure ?? null,
      map_pressure: rawData.map ?? rawData.manifold_pressure ?? null,
      oil_pressure: rawData.oil_pressure ?? null,
      // Performance
      power: rawData.power ?? rawData.hp ?? null,
      torque: rawData.torque ?? null,
      gear: rawData.gear ?? rawData.current_gear ?? null,
      // Dynamics
      g_lat: rawData.g_lat ?? rawData.lateral_g ?? null,
      g_long: rawData.g_long ?? rawData.longitudinal_g ?? null,
      // Braking
      brake_pressure: rawData.brake_pressure ?? rawData.bpi ?? null,
      deceleration_g: rawData.deceleration_g ?? null,
      brake_temp: rawData.brake_temp ?? null,
      stopping_distance: rawData.stopping_distance ?? null,
      // Traction
      slip_ratio: rawData.slip_ratio ?? null,
      stability_state: rawData.stability_state ?? null,
      esp_active: rawData.esp_active ?? rawData.tcs_active ?? false,
      // Weight transfer
      weight_fl: rawData.weight_fl ?? null,
      weight_fr: rawData.weight_fr ?? null,
      weight_rl: rawData.weight_rl ?? null,
      weight_rr: rawData.weight_rr ?? null,
      // Timing
      lap_time: rawData.lap_time ?? rawData.current_lap_time ?? null,
      best_lap: rawData.best_lap ?? rawData.best_lap_time ?? null,
      delta: rawData.delta ?? rawData.lap_delta ?? null,
      sector_times: rawData.sector_times ?? null,
      lap_count: rawData.lap_count ?? rawData.laps ?? null,
      // Session
      session_time: rawData.session_time ?? null,
      max_rpm: rawData.max_rpm ?? rawData.redline ?? 7000,
      shift_rpm: rawData.shift_rpm ?? rawData.optimal_shift ?? null,
      shift_now: rawData.shift_now ?? false,
      // Thermal Rating
      trs_score: rawData.trs_score ?? rawData.thermal_score ?? null,
      trs_state: rawData.trs_state ?? rawData.thermal_state ?? null,
      // Alerts
      alerts: rawData.alerts ?? null,
      // Raw passthrough
      ...rawData,
    };

    setData(parsed);

    // Append to history
    const entry = { ...parsed, _historyTs: Date.now() };
    historyRef.current = [...historyRef.current, entry].slice(-HISTORY_MAX);
    setHistory(historyRef.current);
  }, [rawData]);

  return { data, history, connected, error };
}
