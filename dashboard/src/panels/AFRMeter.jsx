import React from 'react';
import { formatAFR } from '../utils/formatters';
import { afrZoneColor } from '../utils/colors';

const ZONES = [
  { min: 10.0, max: 11.5, label: 'RICH', color: '#ef4444' },
  { min: 11.5, max: 12.5, label: 'RICH', color: '#f97316' },
  { min: 12.5, max: 13.2, label: 'RACE', color: '#f59e0b' },
  { min: 13.2, max: 14.0, label: 'STOICH', color: '#84cc16' },
  { min: 14.0, max: 15.0, label: 'STOICH', color: '#22c55e' },
  { min: 15.0, max: 16.0, label: 'LEAN', color: '#06b6d4' },
  { min: 16.0, max: 18.0, label: 'LEAN', color: '#3b82f6' },
];

const AFR_MIN = 10.0;
const AFR_MAX = 18.0;
const BAR_HEIGHT = 200;

export default function AFRMeter({ data }) {
  const afr = data?.afr ?? null;
  const currentColor = afr != null ? afrZoneColor(afr) : '#6b7280';
  const pct = afr != null ? Math.max(0, Math.min(1, (afr - AFR_MIN) / (AFR_MAX - AFR_MIN))) : 0;
  const markerY = BAR_HEIGHT - pct * BAR_HEIGHT;

  const getZoneLabel = (afrVal) => {
    if (afrVal == null) return '--';
    const zone = ZONES.find((z) => afrVal >= z.min && afrVal < z.max);
    return zone ? zone.label : afrVal < AFR_MIN ? 'RICH' : 'LEAN';
  };

  return (
    <div className="panel-carbon p-3 flex flex-col items-center">
      <div className="text-xs font-mono-tech text-neutral-500 tracking-widest mb-2">AFR</div>

      <div className="flex items-center gap-4">
        {/* Vertical bar */}
        <div className="relative" style={{ width: 32, height: BAR_HEIGHT }}>
          {/* Zone gradient background */}
          <div
            className="absolute inset-0 rounded overflow-hidden border border-neutral-700/50"
            style={{ background: '#111' }}
          >
            {ZONES.map((zone, i) => {
              const bottom = ((zone.min - AFR_MIN) / (AFR_MAX - AFR_MIN)) * 100;
              const height = ((zone.max - zone.min) / (AFR_MAX - AFR_MIN)) * 100;
              return (
                <div
                  key={i}
                  className="absolute left-0 right-0"
                  style={{
                    bottom: `${bottom}%`,
                    height: `${height}%`,
                    backgroundColor: zone.color,
                    opacity: 0.2,
                  }}
                />
              );
            })}
          </div>

          {/* Current value marker */}
          {afr != null && (
            <div
              className="absolute -left-1 -right-1 flex items-center"
              style={{ top: markerY - 2 }}
            >
              <div
                className="w-full h-[4px] rounded"
                style={{
                  backgroundColor: currentColor,
                  boxShadow: `0 0 8px ${currentColor}`,
                }}
              />
            </div>
          )}

          {/* Scale labels */}
          {[10, 12, 14, 16, 18].map((v) => {
            const y = BAR_HEIGHT - ((v - AFR_MIN) / (AFR_MAX - AFR_MIN)) * BAR_HEIGHT;
            return (
              <div
                key={v}
                className="absolute text-[9px] font-mono-tech text-neutral-600"
                style={{ right: -20, top: y - 5 }}
              >
                {v}
              </div>
            );
          })}
        </div>

        {/* Numeric display */}
        <div className="flex flex-col items-center">
          <div
            className="font-orbitron text-3xl font-bold"
            style={{ color: currentColor, textShadow: `0 0 10px ${currentColor}` }}
          >
            {formatAFR(afr)}
          </div>
          <div className="text-xs font-mono-tech text-neutral-500 mt-1">Lambda</div>
          <div
            className="text-sm font-rajdhani font-semibold mt-2 px-2 py-0.5 rounded border"
            style={{
              color: currentColor,
              borderColor: currentColor + '60',
              backgroundColor: currentColor + '15',
            }}
          >
            {getZoneLabel(afr)}
          </div>
          {afr != null && (
            <div className="text-xs font-mono-tech text-neutral-500 mt-1">
              {'\u03BB'} {(afr / 14.7).toFixed(3)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
