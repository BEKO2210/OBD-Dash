import React, { useState, useMemo } from 'react';
import { formatSpeed } from '../utils/formatters';
import { kmhToMph } from '../utils/units';

const SWEEP = 240;
const START = 150;
const R = 70;
const CX = 100;
const CY = 100;

function polarToXY(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx, cy, r, start, end) {
  const s = polarToXY(cx, cy, r, end);
  const e = polarToXY(cx, cy, r, start);
  const large = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}

export default function SpeedMeter({ data }) {
  const [useMph, setUseMph] = useState(false);
  const rawSpeed = data?.speed ?? 0;
  const speed = useMph ? kmhToMph(rawSpeed) : rawSpeed;
  const maxSpeed = useMph ? 180 : 300;
  const pct = Math.min(1, Math.max(0, speed / maxSpeed));

  const activeEnd = START + pct * SWEEP;

  const ticks = useMemo(() => {
    const step = useMph ? 20 : 40;
    const arr = [];
    for (let v = 0; v <= maxSpeed; v += step) {
      const frac = v / maxSpeed;
      const angle = START + frac * SWEEP;
      const outer = polarToXY(CX, CY, R + 6, angle);
      const inner = polarToXY(CX, CY, R - 2, angle);
      const label = polarToXY(CX, CY, R + 15, angle);
      arr.push({ outer, inner, label, value: v });
    }
    return arr;
  }, [useMph, maxSpeed]);

  return (
    <div className="panel-carbon p-4 flex flex-col items-center">
      {/* Big digital display */}
      <div className="text-center mb-1">
        <div
          className="font-orbitron text-6xl font-black text-amber-400 text-glow-amber leading-none tracking-tight"
          style={{ minWidth: '200px' }}
        >
          {formatSpeed(speed)}
        </div>
        <button
          onClick={() => setUseMph((p) => !p)}
          className="text-xs font-mono-tech text-neutral-500 hover:text-amber-400 transition-colors mt-1 tracking-widest"
        >
          {useMph ? 'MPH' : 'KM/H'}
        </button>
      </div>

      {/* Small analog arc */}
      <svg viewBox="0 0 200 130" className="w-full max-w-[220px] -mt-1">
        {/* Background arc */}
        <path
          d={arcPath(CX, CY, R, START, START + SWEEP)}
          fill="none"
          stroke="#222"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Active arc */}
        {pct > 0.005 && (
          <path
            d={arcPath(CX, CY, R, START, activeEnd)}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={6}
            strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.5))' }}
          />
        )}
        {/* Ticks */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={t.inner.x} y1={t.inner.y}
              x2={t.outer.x} y2={t.outer.y}
              stroke="#555" strokeWidth={1}
            />
            <text
              x={t.label.x} y={t.label.y}
              fill="#666" fontSize="7" textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="'Share Tech Mono', monospace"
            >
              {t.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
