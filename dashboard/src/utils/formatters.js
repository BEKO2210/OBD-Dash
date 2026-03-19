/**
 * Number formatting utilities for APEX CORTEX dashboard.
 */

export const formatSpeed = (speed, decimals = 0) => {
  if (speed == null || isNaN(speed)) return '--';
  return Math.round(speed).toFixed(decimals);
};

export const formatRPM = (rpm) => {
  if (rpm == null || isNaN(rpm)) return '--';
  return Math.round(rpm).toLocaleString();
};

export const formatTemp = (temp, unit = 'C') => {
  if (temp == null || isNaN(temp)) return '--';
  return `${Math.round(temp)}°${unit}`;
};

export const formatPressure = (pressure, unit = 'bar', decimals = 2) => {
  if (pressure == null || isNaN(pressure)) return '--';
  return `${Number(pressure).toFixed(decimals)} ${unit}`;
};

export const formatPercentage = (value, decimals = 1) => {
  if (value == null || isNaN(value)) return '--%';
  return `${Number(value).toFixed(decimals)}%`;
};

export const formatTime = (ms) => {
  if (ms == null || isNaN(ms) || ms <= 0) return '--:--.---';
  const totalMs = Math.floor(ms);
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const millis = totalMs % 1000;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

export const formatDelta = (deltaMs) => {
  if (deltaMs == null || isNaN(deltaMs)) return '';
  const sign = deltaMs >= 0 ? '+' : '-';
  const abs = Math.abs(deltaMs);
  const seconds = Math.floor(abs / 1000);
  const millis = abs % 1000;
  return `${sign}${seconds}.${String(millis).padStart(3, '0')}`;
};

export const formatGForce = (g) => {
  if (g == null || isNaN(g)) return '0.00';
  return Number(g).toFixed(2);
};

export const formatAFR = (afr) => {
  if (afr == null || isNaN(afr)) return '--.-';
  return Number(afr).toFixed(1);
};

export const formatFuel = (liters) => {
  if (liters == null || isNaN(liters)) return '--';
  return Number(liters).toFixed(1);
};
