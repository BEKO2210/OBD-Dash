/**
 * Status color utilities for APEX CORTEX dashboard.
 */

export const getStatusColor = (value, min, max) => {
  if (value == null || isNaN(value)) return '#6b7280';
  const range = max - min;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));

  if (normalized < 0.6) return '#22c55e';      // green
  if (normalized < 0.8) return '#f59e0b';      // amber
  if (normalized < 0.9) return '#f97316';      // orange
  return '#ef4444';                             // red
};

export const getGaugeGradient = (percentage) => {
  if (percentage == null || isNaN(percentage)) percentage = 0;
  const p = Math.max(0, Math.min(100, percentage));

  if (p < 60) return { color: '#22c55e', glow: 'rgba(34,197,94,0.4)' };
  if (p < 80) return { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)' };
  if (p < 90) return { color: '#f97316', glow: 'rgba(249,115,22,0.4)' };
  return { color: '#ef4444', glow: 'rgba(239,68,68,0.5)' };
};

export const alertColors = {
  INFO: {
    bg: 'bg-blue-900/60',
    border: 'border-blue-500',
    text: 'text-blue-300',
    icon: '#3b82f6',
  },
  WARNING: {
    bg: 'bg-amber-900/60',
    border: 'border-amber-500',
    text: 'text-amber-300',
    icon: '#f59e0b',
  },
  CRITICAL: {
    bg: 'bg-red-900/70',
    border: 'border-red-500',
    text: 'text-red-300',
    icon: '#ef4444',
  },
};

export const tempColors = {
  cold: '#3b82f6',
  normal: '#22c55e',
  warm: '#f59e0b',
  hot: '#f97316',
  critical: '#ef4444',
};

export const getTempColor = (temp, coldThresh = 60, warmThresh = 95, hotThresh = 110, critThresh = 120) => {
  if (temp == null || isNaN(temp)) return tempColors.normal;
  if (temp < coldThresh) return tempColors.cold;
  if (temp < warmThresh) return tempColors.normal;
  if (temp < hotThresh) return tempColors.warm;
  if (temp < critThresh) return tempColors.hot;
  return tempColors.critical;
};

export const gaugeZoneColors = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
};

export const afrZoneColor = (afr) => {
  if (afr == null || isNaN(afr)) return '#6b7280';
  if (afr < 11.5) return '#ef4444';        // too rich - red
  if (afr < 12.5) return '#f97316';        // rich - orange
  if (afr < 13.0) return '#f59e0b';        // optimal race - amber
  if (afr < 14.0) return '#84cc16';        // near stoich - lime
  if (afr < 15.0) return '#22c55e';        // stoich range - green
  if (afr < 16.0) return '#06b6d4';        // lean - cyan
  return '#3b82f6';                         // very lean - blue
};
