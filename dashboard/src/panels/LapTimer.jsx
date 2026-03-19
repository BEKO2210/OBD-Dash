import React from 'react';
import { formatTime, formatDelta } from '../utils/formatters';

export default function LapTimer({ data }) {
  const lapTime = data?.lap_time ?? null;
  const bestLap = data?.best_lap ?? null;
  const delta = data?.delta ?? null;
  const lapCount = data?.lap_count ?? null;

  const deltaColor = delta != null
    ? delta <= 0 ? '#22c55e' : '#ef4444'
    : '#6b7280';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-2">
      {/* Lap count */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono-tech text-neutral-500 tracking-widest">LAP</span>
        <span className="font-orbitron text-sm font-bold text-neutral-300">
          {lapCount != null ? lapCount : '--'}
        </span>
      </div>

      {/* Current lap time - large */}
      <div className="text-center">
        <div
          className="font-orbitron text-3xl font-bold text-amber-400 tracking-wider"
          style={{ textShadow: '0 0 10px rgba(245,158,11,0.4)' }}
        >
          {formatTime(lapTime)}
        </div>
        <span className="text-[10px] font-mono-tech text-neutral-600 tracking-widest">CURRENT</span>
      </div>

      {/* Delta */}
      <div className="text-center">
        <span
          className="font-orbitron text-lg font-bold"
          style={{ color: deltaColor, textShadow: `0 0 8px ${deltaColor}40` }}
        >
          {delta != null ? formatDelta(delta) : '--'}
        </span>
      </div>

      {/* Best lap */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono-tech text-neutral-500 tracking-widest">BEST</span>
        <span className="font-mono-tech text-sm text-neutral-300">
          {formatTime(bestLap)}
        </span>
      </div>
    </div>
  );
}
