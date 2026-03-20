import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900/95 border border-neutral-700 rounded px-2 py-1 text-xs font-mono-tech">
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toFixed(1)}
        </div>
      ))}
    </div>
  );
};

export default function PowerCurve({ data, history }) {
  // Build RPM vs Power/Torque from last 30s of history (~600 points at 20Hz, but we have 300 max)
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    const now = Date.now();
    const thirtySecsAgo = now - 30000;

    return history
      .filter((h) => h._historyTs >= thirtySecsAgo && h.rpm != null)
      .map((h) => ({
        rpm: Math.round(h.rpm),
        power: h.power != null ? Number(h.power) : null,
        torque: h.torque != null ? Number(h.torque) : null,
      }))
      .filter((d) => d.power != null || d.torque != null);
  }, [history]);

  const currentPower = data?.power ?? null;
  const currentTorque = data?.torque ?? null;

  return (
    <div className="panel-carbon p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">POWER CURVE</span>
        <div className="flex gap-3 text-xs font-mono-tech">
          <span className="text-amber-400">
            {currentPower != null ? `${Math.round(currentPower)} HP` : '-- HP'}
          </span>
          <span className="text-red-400">
            {currentTorque != null ? `${Math.round(currentTorque)} Nm` : '-- Nm'}
          </span>
        </div>
      </div>

      <div className="h-40 sm:h-48 lg:h-56">
        {chartData.length > 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis
                dataKey="rpm"
                tick={{ fill: '#555', fontSize: 9, fontFamily: "'Share Tech Mono'" }}
                stroke="#333"
                tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              />
              <YAxis
                yAxisId="power"
                tick={{ fill: '#555', fontSize: 9, fontFamily: "'Share Tech Mono'" }}
                stroke="#333"
              />
              <YAxis
                yAxisId="torque"
                orientation="right"
                tick={{ fill: '#555', fontSize: 9, fontFamily: "'Share Tech Mono'" }}
                stroke="#333"
                hide
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                yAxisId="power"
                type="monotone"
                dataKey="power"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                name="Power (HP)"
                connectNulls
              />
              <Line
                yAxisId="torque"
                type="monotone"
                dataKey="torque"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Torque (Nm)"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-neutral-600 text-sm font-mono-tech">
            Collecting data...
          </div>
        )}
      </div>
    </div>
  );
}
