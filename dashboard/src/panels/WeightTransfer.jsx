import React, { useMemo } from 'react';

const BASE_WEIGHT = 25; // percentage per corner at rest

function cornerColor(pct) {
  if (pct == null) return '#555';
  if (pct > 35) return '#ef4444';
  if (pct > 30) return '#f97316';
  if (pct > 27) return '#f59e0b';
  return '#22c55e';
}

export default function WeightTransfer({ data }) {
  const gLat = data?.g_lat ?? 0;
  const gLong = data?.g_long ?? 0;

  // Compute weight distribution from G-forces.
  // Positive g_long = acceleration (weight shifts rear).
  // Positive g_lat = right turn (weight shifts left).
  const weights = useMemo(() => {
    const latShift = (gLat ?? 0) * 8;   // percentage shift per G
    const longShift = (gLong ?? 0) * 8;

    const fl = BASE_WEIGHT - longShift + latShift;
    const fr = BASE_WEIGHT - longShift - latShift;
    const rl = BASE_WEIGHT + longShift + latShift;
    const rr = BASE_WEIGHT + longShift - latShift;

    // Clamp to 5-50 range.
    const clamp = (v) => Math.max(5, Math.min(50, v));
    return {
      fl: clamp(fl),
      fr: clamp(fr),
      rl: clamp(rl),
      rr: clamp(rr),
    };
  }, [gLat, gLong]);

  // Custom weight from data (if available).
  const wfl = data?.weight_fl ?? weights.fl;
  const wfr = data?.weight_fr ?? weights.fr;
  const wrl = data?.weight_rl ?? weights.rl;
  const wrr = data?.weight_rr ?? weights.rr;

  const corners = [
    { key: 'FL', value: wfl, x: 55, y: 50 },
    { key: 'FR', value: wfr, x: 145, y: 50 },
    { key: 'RL', value: wrl, x: 55, y: 170 },
    { key: 'RR', value: wrr, x: 145, y: 170 },
  ];

  return (
    <div className="panel-carbon p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-mono-tech text-neutral-500 tracking-widest">
          WEIGHT TRANSFER
        </span>
      </div>

      <svg viewBox="0 0 200 220" className="w-full max-w-[220px] mx-auto">
        {/* Car body outline */}
        <path
          d="M 60 35 L 140 35 C 155 35 160 45 160 55 L 160 165 C 160 180 155 190 140 190 L 60 190 C 45 190 40 180 40 165 L 40 55 C 40 45 45 35 60 35 Z"
          fill="none"
          stroke="#444"
          strokeWidth="1.5"
        />
        {/* Windshield */}
        <path
          d="M 65 65 L 135 65 L 130 45 L 70 45 Z"
          fill="none"
          stroke="#333"
          strokeWidth="1"
        />
        {/* Rear window */}
        <path
          d="M 70 175 L 130 175 L 135 160 L 65 160 Z"
          fill="none"
          stroke="#333"
          strokeWidth="1"
        />
        {/* Center line */}
        <line x1="100" y1="40" x2="100" y2="185" stroke="#222" strokeWidth="0.5" strokeDasharray="4 3" />
        <line x1="45" y1="112" x2="155" y2="112" stroke="#222" strokeWidth="0.5" strokeDasharray="4 3" />

        {/* Wheels */}
        {[
          { x: 38, y: 55, w: 10, h: 28 },   // FL
          { x: 152, y: 55, w: 10, h: 28 },   // FR
          { x: 38, y: 142, w: 10, h: 28 },   // RL
          { x: 152, y: 142, w: 10, h: 28 },  // RR
        ].map((wheel, i) => (
          <rect
            key={i}
            x={wheel.x}
            y={wheel.y}
            width={wheel.w}
            height={wheel.h}
            rx="2"
            fill="#333"
            stroke="#555"
            strokeWidth="0.5"
          />
        ))}

        {/* Weight circles at each corner */}
        {corners.map(({ key, value, x, y }) => {
          const radius = 10 + (value / 50) * 14;
          const color = cornerColor(value);
          const opacity = 0.15 + (value / 50) * 0.35;
          return (
            <g key={key}>
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={color}
                opacity={opacity}
                style={{ transition: 'all 0.15s ease-out' }}
              />
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth="1"
                opacity={0.6}
              />
              <text
                x={x}
                y={y - 2}
                fill={color}
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="'Orbitron', sans-serif"
              >
                {Math.round(value)}%
              </text>
              <text
                x={x}
                y={y + 11}
                fill="#888"
                fontSize="8"
                textAnchor="middle"
                fontFamily="'Share Tech Mono', monospace"
              >
                {key}
              </text>
            </g>
          );
        })}

        {/* G-force arrow indicator */}
        {(Math.abs(gLat) > 0.05 || Math.abs(gLong) > 0.05) && (
          <line
            x1="100"
            y1="112"
            x2={100 + (gLat ?? 0) * 30}
            y2={112 - (gLong ?? 0) * 30}
            stroke="#f59e0b"
            strokeWidth="2"
            strokeLinecap="round"
            markerEnd="url(#arrowhead)"
            style={{ filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.5))' }}
          />
        )}
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>

      {/* G-force readout */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="bg-neutral-800/40 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono-tech text-neutral-500">LAT G</div>
          <div className="font-mono-tech text-sm font-bold text-amber-400">
            {gLat != null ? (gLat >= 0 ? '+' : '') + gLat.toFixed(2) : '--'}
          </div>
        </div>
        <div className="bg-neutral-800/40 rounded p-1.5 text-center">
          <div className="text-[9px] font-mono-tech text-neutral-500">LON G</div>
          <div className="font-mono-tech text-sm font-bold text-amber-400">
            {gLong != null ? (gLong >= 0 ? '+' : '') + gLong.toFixed(2) : '--'}
          </div>
        </div>
      </div>
    </div>
  );
}
