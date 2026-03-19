/**
 * Unit conversion utilities for APEX CORTEX dashboard.
 */

export const kmhToMph = (kmh) => {
  if (kmh == null || isNaN(kmh)) return 0;
  return kmh * 0.621371;
};

export const mphToKmh = (mph) => {
  if (mph == null || isNaN(mph)) return 0;
  return mph * 1.60934;
};

export const celsiusToFahrenheit = (c) => {
  if (c == null || isNaN(c)) return 32;
  return (c * 9) / 5 + 32;
};

export const fahrenheitToCelsius = (f) => {
  if (f == null || isNaN(f)) return 0;
  return ((f - 32) * 5) / 9;
};

export const kwToHp = (kw) => {
  if (kw == null || isNaN(kw)) return 0;
  return kw * 1.34102;
};

export const hpToKw = (hp) => {
  if (hp == null || isNaN(hp)) return 0;
  return hp * 0.7457;
};

export const barToPsi = (bar) => {
  if (bar == null || isNaN(bar)) return 0;
  return bar * 14.5038;
};

export const psiToBar = (psi) => {
  if (psi == null || isNaN(psi)) return 0;
  return psi / 14.5038;
};

export const kpaToBar = (kpa) => {
  if (kpa == null || isNaN(kpa)) return 0;
  return kpa / 100;
};

export const barToKpa = (bar) => {
  if (bar == null || isNaN(bar)) return 0;
  return bar * 100;
};
