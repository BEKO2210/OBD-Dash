import React, { useMemo } from 'react';
import { Thermometer, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatTemp } from '../utils/formatters';
import { getTempColor } from '../utils/colors';

const TRS_COLORS = {
  SAFE: { color: '#22c55e', bg: 'bg-green-900/30', border: 'border-green-600/40' },
  WATCH: { color: '#f59e0b', bg: 'bg-amber-900/30', border: 'border-amber-600/40' },
  WARNING: { color: '#f97316', bg: 'bg-orange-900/30', border: 'border-orange-600/40' },
  CRITICAL: { color: '#ef4444', bg: 'bg-red-900/30', border: 'border-red-600/40' },
};

function TempRow({ label, value, history, thresholds }) {
  const color = getTempColor(value, ...(thresholds || []));

  // Calculate trend from history
  const trend = useMemo(() => {
    if (!history || history.length < 10) return 'stable';
    const recent = history.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const diff = last - first;
    if (diff > 2) return 'up';
    if (diff < -2) return 'down';
    return 'stable';
  }, [history]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-800/50 last:border-b-0">
      <span className="text-xs font-rajdhani text-neutral-400 w-16">{label}</span>
      <div className="flex items-center gap-2">
        <span
          className="font-mono-tech text-sm font-semibold"
          style={{ color, textShadow: `0 0 6px ${color}40` }}
        >
          {formatTemp(value)}
        </span>
        <TrendIcon
          className="w-3 h-3"
          style={{ color: trend === 'up' ? '#f59e0b' : trend === 'down' ? '#3b82f6' : '#555' }}
        />
      </div>
    </div>
  );
}

export default function ThermalPanel({ data, history }) {
  const trsScore = data?.trs_score ?? null;
  const trsState = data?.trs_state ?? 'SAFE';
  const trsStyle = TRS_COLORS[trsState] || TRS_COLORS.SAFE;

  // Extract temp histories
  const coolantHistory = useMemo(
    () => (history || []).map((h) => h.coolant_temp).filter((v) => v != null),
    [history]
  );
  const oilHistory = useMemo(
    () => (history || []).map((h) => h.oil_temp).filter((v) => v != null),
    [history]
  );
  const iatHistory = useMemo(
    () => (history || []).map((h) => h.iat).filter((v) => v != null),
    [history]
  );

  return (
    <div className="panel-carbon p-3">
      {/* Header with TRS */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Thermometer className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">THERMAL</span>
        </div>
        <div
          className={`px-2 py-0.5 rounded border text-xs font-orbitron font-bold ${trsStyle.bg} ${trsStyle.border}`}
          style={{ color: trsStyle.color }}
        >
          TRS: {trsScore != null ? Math.round(trsScore) : '--'} {trsState}
        </div>
      </div>

      {/* Temperature rows */}
      <div className="space-y-0">
        <TempRow
          label="COOLANT"
          value={data?.coolant_temp}
          history={coolantHistory}
          thresholds={[60, 95, 110, 120]}
        />
        <TempRow
          label="OIL"
          value={data?.oil_temp}
          history={oilHistory}
          thresholds={[70, 110, 130, 145]}
        />
        <TempRow
          label="IAT"
          value={data?.iat}
          history={iatHistory}
          thresholds={[20, 40, 55, 65]}
        />
        <TempRow
          label="AMBIENT"
          value={data?.ambient_temp}
          history={[]}
          thresholds={[0, 35, 40, 50]}
        />
      </div>
    </div>
  );
}
