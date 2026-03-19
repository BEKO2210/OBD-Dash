import React, { useMemo } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';

const STABILITY_CONFIG = {
  STABLE: { color: '#22c55e', label: 'STABLE', bg: 'bg-green-900/30', border: 'border-green-600/40' },
  MILD_SLIP: { color: '#f59e0b', label: 'MILD SLIP', bg: 'bg-amber-900/30', border: 'border-amber-600/40' },
  OVERSTEER: { color: '#f97316', label: 'OVERSTEER', bg: 'bg-orange-900/30', border: 'border-orange-600/40' },
  UNDERSTEER: { color: '#3b82f6', label: 'UNDERSTEER', bg: 'bg-blue-900/30', border: 'border-blue-600/40' },
  SPINNING: { color: '#ef4444', label: 'SPINNING', bg: 'bg-red-900/30', border: 'border-red-600/40' },
};

function SlipBar({ value, max = 1.0 }) {
  const pct = value != null ? Math.min(100, Math.abs(value / max) * 100) : 0;
  const color = pct < 20 ? '#22c55e' : pct < 50 ? '#f59e0b' : pct < 75 ? '#f97316' : '#ef4444';

  return (
    <div className="w-full h-3 bg-neutral-800 rounded overflow-hidden border border-neutral-700/50">
      <div
        className="h-full rounded transition-all duration-100"
        style={{
          width: `${pct}%`,
          backgroundColor: color,
          boxShadow: pct > 50 ? `0 0 8px ${color}` : 'none',
        }}
      />
    </div>
  );
}

export default function TractionMonitor({ data }) {
  const slipRatio = data?.slip_ratio ?? null;
  const stabilityState = data?.stability_state ?? 'STABLE';
  const espActive = data?.esp_active ?? false;

  const config = STABILITY_CONFIG[stabilityState] || STABILITY_CONFIG.STABLE;
  const isUnstable = stabilityState !== 'STABLE';

  const slipPct = useMemo(() => {
    if (slipRatio == null) return null;
    return Math.round(Math.abs(slipRatio) * 100);
  }, [slipRatio]);

  return (
    <div className="panel-carbon p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">
            TRACTION
          </span>
        </div>
        {espActive && (
          <div className="flex items-center gap-1 text-amber-400 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-mono-tech">ESP</span>
          </div>
        )}
      </div>

      {/* Stability state badge */}
      <div className="flex justify-center mb-3">
        <div
          className={`px-4 py-1.5 rounded border text-sm font-orbitron font-bold tracking-wider ${config.bg} ${config.border} ${isUnstable ? 'animate-pulse' : ''}`}
          style={{ color: config.color, textShadow: `0 0 10px ${config.color}40` }}
        >
          {config.label}
        </div>
      </div>

      {/* Slip ratio bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] font-mono-tech text-neutral-500 mb-1">
          <span>SLIP RATIO</span>
          <span style={{ color: config.color }}>
            {slipPct != null ? `${slipPct}%` : '--%'}
          </span>
        </div>
        <SlipBar value={slipRatio} />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-neutral-800/40 rounded p-2 text-center">
          <div className="text-[10px] font-mono-tech text-neutral-500 mb-0.5">
            SLIP
          </div>
          <div className="font-orbitron text-lg font-bold" style={{ color: config.color }}>
            {slipRatio != null ? Math.abs(slipRatio).toFixed(3) : '--'}
          </div>
        </div>
        <div className="bg-neutral-800/40 rounded p-2 text-center">
          <div className="text-[10px] font-mono-tech text-neutral-500 mb-0.5">
            ESP EVENTS
          </div>
          <div className="font-orbitron text-lg font-bold text-amber-400">
            {espActive ? 'ACTIVE' : 'OFF'}
          </div>
        </div>
      </div>

      {/* Tire grip visualization */}
      <div className="mt-3">
        <div className="text-[10px] font-mono-tech text-neutral-500 mb-1.5">GRIP LEVEL</div>
        <div className="flex items-center gap-2">
          {['FL', 'FR', 'RL', 'RR'].map((corner) => {
            const gripPct = slipRatio != null
              ? Math.max(0, Math.min(100, 100 - Math.abs(slipRatio) * 200))
              : 100;
            const gripColor = gripPct > 70 ? '#22c55e' : gripPct > 40 ? '#f59e0b' : '#ef4444';
            return (
              <div key={corner} className="flex-1 text-center">
                <div className="text-[9px] font-mono-tech text-neutral-600 mb-0.5">{corner}</div>
                <div className="w-full h-2 bg-neutral-800 rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-150"
                    style={{ width: `${gripPct}%`, backgroundColor: gripColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
