import React, { useRef, useEffect, useMemo } from 'react';
import { formatGForce } from '../utils/formatters';

const SIZE = 220;
const CX = SIZE / 2;
const CY = SIZE / 2;
const MAX_G = 1.5;
const RADIUS = 85;
const TRAIL_LENGTH = 40;

function gToPos(gLat, gLong) {
  const x = CX + (gLat / MAX_G) * RADIUS;
  const y = CY - (gLong / MAX_G) * RADIUS;
  return { x: Math.max(CX - RADIUS, Math.min(CX + RADIUS, x)), y: Math.max(CY - RADIUS, Math.min(CY + RADIUS, y)) };
}

function getMagnitudeColor(mag) {
  if (mag < 0.3) return '#22c55e';
  if (mag < 0.6) return '#f59e0b';
  if (mag < 1.0) return '#f97316';
  return '#ef4444';
}

export default function GForceBall({ data, history }) {
  const gLat = data?.g_lat ?? 0;
  const gLong = data?.g_long ?? 0;
  const magnitude = Math.sqrt(gLat * gLat + gLong * gLong);
  const dotPos = gToPos(gLat, gLong);
  const dotColor = getMagnitudeColor(magnitude);

  // Build trail from recent history (last ~2s => ~40 points at 20Hz)
  const trail = useMemo(() => {
    if (!history || history.length === 0) return [];
    const recent = history.slice(-TRAIL_LENGTH);
    return recent.map((h) => {
      const lat = h.g_lat ?? 0;
      const lon = h.g_long ?? 0;
      return gToPos(lat, lon);
    });
  }, [history]);

  // G circles at 0.5, 1.0, 1.5
  const rings = [0.5, 1.0, 1.5];

  return (
    <div className="panel-carbon p-3 flex flex-col items-center">
      <div className="text-xs font-mono-tech text-neutral-500 tracking-widest mb-1">G-FORCE</div>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full max-w-[240px]">
        {/* Rings */}
        {rings.map((g) => (
          <circle
            key={g}
            cx={CX}
            cy={CY}
            r={(g / MAX_G) * RADIUS}
            fill="none"
            stroke="#333"
            strokeWidth={0.5}
            strokeDasharray="3,3"
          />
        ))}

        {/* Axis lines */}
        <line x1={CX - RADIUS} y1={CY} x2={CX + RADIUS} y2={CY} stroke="#333" strokeWidth={0.5} />
        <line x1={CX} y1={CY - RADIUS} x2={CX} y2={CY + RADIUS} stroke="#333" strokeWidth={0.5} />

        {/* Labels */}
        <text x={CX + RADIUS + 6} y={CY + 3} fill="#555" fontSize="8" fontFamily="'Share Tech Mono'">+LAT</text>
        <text x={CX - RADIUS - 22} y={CY + 3} fill="#555" fontSize="8" fontFamily="'Share Tech Mono'">-LAT</text>
        <text x={CX - 8} y={CY - RADIUS - 6} fill="#555" fontSize="8" fontFamily="'Share Tech Mono'">+ACCEL</text>
        <text x={CX - 8} y={CY + RADIUS + 12} fill="#555" fontSize="8" fontFamily="'Share Tech Mono'">+BRAKE</text>

        {/* Ring labels */}
        {rings.map((g) => (
          <text
            key={`label-${g}`}
            x={CX + 3}
            y={CY - (g / MAX_G) * RADIUS + 10}
            fill="#444"
            fontSize="7"
            fontFamily="'Share Tech Mono'"
          >
            {g}G
          </text>
        ))}

        {/* Trail */}
        {trail.length > 1 && (
          <polyline
            points={trail.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={dotColor}
            strokeWidth={1.5}
            opacity={0.3}
            strokeLinejoin="round"
          />
        )}
        {/* Trail dots */}
        {trail.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1}
            fill={dotColor}
            opacity={0.1 + (i / trail.length) * 0.3}
          />
        ))}

        {/* Main dot */}
        <circle
          cx={dotPos.x}
          cy={dotPos.y}
          r={8}
          fill={dotColor}
          style={{ filter: `drop-shadow(0 0 8px ${dotColor})` }}
        />
        <circle
          cx={dotPos.x}
          cy={dotPos.y}
          r={3}
          fill="white"
          opacity={0.8}
        />
      </svg>

      {/* Numeric readout */}
      <div className="flex gap-6 mt-1 text-xs font-mono-tech">
        <div className="text-center">
          <span className="text-neutral-500">LAT </span>
          <span className="text-amber-400">{formatGForce(gLat)}G</span>
        </div>
        <div className="text-center">
          <span className="text-neutral-500">LONG </span>
          <span className="text-amber-400">{formatGForce(gLong)}G</span>
        </div>
        <div className="text-center">
          <span className="text-neutral-500">MAG </span>
          <span style={{ color: dotColor }}>{formatGForce(magnitude)}G</span>
        </div>
      </div>
    </div>
  );
}
