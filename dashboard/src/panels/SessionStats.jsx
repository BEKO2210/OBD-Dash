import React, { useMemo } from 'react';
import { formatTime, formatGForce } from '../utils/formatters';
import { kwToHp } from '../utils/units';

function StatCard({ label, value, unit, color = '#f59e0b' }) {
  return (
    <div className="bg-neutral-800/40 rounded-lg p-3 text-center border border-neutral-700/30">
      <div className="text-[10px] font-mono-tech text-neutral-500 tracking-wider uppercase mb-1">
        {label}
      </div>
      <div className="font-orbitron text-lg font-bold" style={{ color }}>
        {value}
      </div>
      {unit && (
        <div className="text-[9px] font-mono-tech text-neutral-600 tracking-wider mt-0.5">
          {unit}
        </div>
      )}
    </div>
  );
}

export default function SessionStats({ data, history }) {
  const stats = useMemo(() => {
    if (!history || history.length === 0) {
      return {
        bestLap: null,
        avgSpeed: null,
        maxG: null,
        maxRPM: null,
        peakPower: null,
      };
    }

    let bestLap = Infinity;
    let totalSpeed = 0;
    let speedCount = 0;
    let maxG = 0;
    let maxRPM = 0;
    let peakPower = 0;

    for (const h of history) {
      if (h.best_lap != null && h.best_lap > 0 && h.best_lap < bestLap) {
        bestLap = h.best_lap;
      }
      if (h.speed != null) {
        totalSpeed += h.speed;
        speedCount++;
      }
      const gMag = Math.sqrt((h.g_lat ?? 0) ** 2 + (h.g_long ?? 0) ** 2);
      if (gMag > maxG) maxG = gMag;
      if (h.rpm != null && h.rpm > maxRPM) maxRPM = h.rpm;
      if (h.power != null && h.power > peakPower) peakPower = h.power;
    }

    return {
      bestLap: bestLap === Infinity ? null : bestLap,
      avgSpeed: speedCount > 0 ? Math.round(totalSpeed / speedCount) : null,
      maxG: maxG > 0 ? maxG : null,
      maxRPM: maxRPM > 0 ? maxRPM : null,
      peakPower: peakPower > 0 ? peakPower : null,
    };
  }, [history]);

  return (
    <div className="grid grid-cols-5 gap-2 w-full h-full items-center">
      <StatCard
        label="Best Lap"
        value={formatTime(stats.bestLap)}
        color="#22c55e"
      />
      <StatCard
        label="Avg Speed"
        value={stats.avgSpeed != null ? `${stats.avgSpeed}` : '--'}
        unit="KM/H"
        color="#f59e0b"
      />
      <StatCard
        label="Max G"
        value={stats.maxG != null ? formatGForce(stats.maxG) : '--'}
        unit="G"
        color="#f97316"
      />
      <StatCard
        label="Max RPM"
        value={stats.maxRPM != null ? Math.round(stats.maxRPM).toLocaleString() : '--'}
        unit="RPM"
        color="#ef4444"
      />
      <StatCard
        label="Peak Power"
        value={stats.peakPower != null ? `${Math.round(kwToHp(stats.peakPower))}` : '--'}
        unit="HP"
        color="#a855f7"
      />
    </div>
  );
}
