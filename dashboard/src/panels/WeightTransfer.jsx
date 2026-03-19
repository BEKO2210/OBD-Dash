import React from 'react';

const WHEEL_W = 28;
const WHEEL_H = 40;
const CAR_W = 100;
const CAR_H = 180;
const SVG_W = 160;
const SVG_H = 220;
const CX = SVG_W / 2;
const CY = SVG_H / 2;

function getWheelColor(weight, total) {
  if (weight == null || total === 0) return '#333';
  const pct = weight / total;
  if (pct < 0.22) return '#3b82f6';
  if (pct < 0.27) return '#22c55e';
  if (pct < 0.32) return '#f59e0b';
  return '#ef4444';
}

function getWheelOpacity(weight, maxCorner) {
  if (weight == null || maxCorner === 0) return 0.3;
  return 0.3 + (weight / maxCorner) * 0.7;
}

export default function WeightTransfer({ data }) {
  const fl = data?.weight_fl ?? null;
  const fr = data?.weight_fr ?? null;
  const rl = data?.weight_rl ?? null;
  const rr = data?.weight_rr ?? null;

  const total = (fl ?? 0) + (fr ?? 0) + (rl ?? 0) + (rr ?? 0);
  const maxCorner = Math.max(fl ?? 0, fr ?? 0, rl ?? 0, rr ?? 0, 1);

  const wheels = [
    { label: 'FL', weight: fl, x: CX - CAR_W / 2 - 2, y: CY - CAR_H / 2 + 10 },
    { label: 'FR', weight: fr, x: CX + CAR_W / 2 - WHEEL_W + 2, y: CY - CAR_H / 2 + 10 },
    { label: 'RL', weight: rl, x: CX - CAR_W / 2 - 2, y: CY + CAR_H / 2 - WHEEL_H - 10 },
    { label: 'RR', weight: rr, x: CX + CAR_W / 2 - WHEEL_W + 2, y: CY + CAR_H / 2 - WHEEL_H - 10 },
  ];

  return (
    <div className="flex flex-col items-center w-full h-full">
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full max-w-[180px]">
        {/* Car body outline */}
        <rect
          x={CX - CAR_W / 2 + 8}
          y={CY - CAR_H / 2}
          width={CAR_W - 16}
          height={CAR_H}
          rx={12}
          fill="none"
          stroke="#333"
          strokeWidth={1.5}
        />

        {/* Front windshield line */}
        <line
          x1={CX - CAR_W / 2 + 16}
          y1={CY - CAR_H / 2 + 40}
          x2={CX + CAR_W / 2 - 16}
          y2={CY - CAR_H / 2 + 40}
          stroke="#2a2a2a"
          strokeWidth={1}
        />

        {/* Rear line */}
        <line
          x1={CX - CAR_W / 2 + 16}
          y1={CY + CAR_H / 2 - 40}
          x2={CX + CAR_W / 2 - 16}
          y2={CY + CAR_H / 2 - 40}
          stroke="#2a2a2a"
          strokeWidth={1}
        />

        {/* Center line */}
        <line
          x1={CX}
          y1={CY - CAR_H / 2 + 5}
          x2={CX}
          y2={CY + CAR_H / 2 - 5}
          stroke="#1f1f1f"
          strokeWidth={0.5}
          strokeDasharray="4 4"
        />

        {/* Wheels */}
        {wheels.map((w) => {
          const color = getWheelColor(w.weight, total);
          const opacity = getWheelOpacity(w.weight, maxCorner);
          const pctText = total > 0 && w.weight != null
            ? `${((w.weight / total) * 100).toFixed(0)}%`
            : '--%';

          return (
            <g key={w.label}>
              <rect
                x={w.x}
                y={w.y}
                width={WHEEL_W}
                height={WHEEL_H}
                rx={4}
                fill={color}
                opacity={opacity}
                stroke={color}
                strokeWidth={1}
              />
              <text
                x={w.x + WHEEL_W / 2}
                y={w.y + WHEEL_H / 2 - 4}
                textAnchor="middle"
                fill="#e5e5e5"
                fontSize="8"
                fontWeight="bold"
                fontFamily="'Orbitron', sans-serif"
              >
                {w.label}
              </text>
              <text
                x={w.x + WHEEL_W / 2}
                y={w.y + WHEEL_H / 2 + 8}
                textAnchor="middle"
                fill="#aaa"
                fontSize="7"
                fontFamily="'Share Tech Mono', monospace"
              >
                {pctText}
              </text>
            </g>
          );
        })}

        {/* Direction arrow */}
        <polygon
          points={`${CX},${CY - CAR_H / 2 - 8} ${CX - 5},${CY - CAR_H / 2 - 2} ${CX + 5},${CY - CAR_H / 2 - 2}`}
          fill="#444"
        />
      </svg>
    </div>
  );
}
