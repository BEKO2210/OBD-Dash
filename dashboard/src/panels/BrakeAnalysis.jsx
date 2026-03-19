import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatGForce, formatPressure } from '../utils/formatters';

export default function BrakeAnalysis({ data }) {
  const bpi = data?.brake_pressure ?? 0;
  const decelG = data?.deceleration_g ?? 0;
  const brakeTemp = data?.brake_temp ?? null;
  const stoppingDist = data?.stopping_distance ?? null;

  const bpiPct = Math.min(100, Math.max(0, bpi));
  const isFading = brakeTemp != null && brakeTemp > 600;
  const isHeavy = bpiPct > 80;

  const barColor = bpiPct < 30 ? '#22c55e' : bpiPct < 60 ? '#f59e0b' : bpiPct < 85 ? '#f97316' : '#ef4444';

  return (
    <div className="panel-carbon p-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">BRAKE ANALYSIS</span>
        {isFading && (
          <div className="flex items-center gap-1 text-red-400 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono-tech">FADE</span>
          </div>
        )}
      </div>

      {/* BPI Bar Gauge */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-mono-tech text-neutral-500 mb-1">
          <span>BPI</span>
          <span style={{ color: barColor }}>{Math.round(bpiPct)}%</span>
        </div>
        <div className="w-full h-4 bg-neutral-800 rounded overflow-hidden border border-neutral-700/50">
          <div
            className="h-full rounded transition-all duration-100"
            style={{
              width: `${bpiPct}%`,
              backgroundColor: barColor,
              boxShadow: isHeavy ? `0 0 10px ${barColor}` : 'none',
            }}
          />
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-neutral-800/40 rounded p-2 text-center">
          <div className="text-[10px] font-mono-tech text-neutral-500 mb-0.5">DECEL G</div>
          <div className="font-orbitron text-lg font-bold text-amber-400">
            {formatGForce(Math.abs(decelG))}
          </div>
        </div>
        <div className="bg-neutral-800/40 rounded p-2 text-center">
          <div className="text-[10px] font-mono-tech text-neutral-500 mb-0.5">STOP DIST</div>
          <div className="font-orbitron text-lg font-bold text-amber-400">
            {stoppingDist != null ? `${Math.round(stoppingDist)}m` : '--'}
          </div>
        </div>
      </div>

      {/* Brake temp if available */}
      {brakeTemp != null && (
        <div className="mt-2 flex justify-between items-center text-xs font-mono-tech">
          <span className="text-neutral-500">BRAKE TEMP</span>
          <span
            style={{
              color: brakeTemp > 600 ? '#ef4444' : brakeTemp > 400 ? '#f59e0b' : '#22c55e',
            }}
          >
            {Math.round(brakeTemp)}°C
          </span>
        </div>
      )}
    </div>
  );
}
