import React, { useRef, useEffect, useMemo } from 'react';
import { formatRPM } from '../utils/formatters';
import { gaugeZoneColors } from '../utils/colors';

const SWEEP_DEG = 270;
const START_ANGLE = 135; // degrees from 12 o'clock, clockwise
const GAUGE_RADIUS = 90;
const ARC_WIDTH = 12;
const CENTER = 120;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function RPMGauge({ data }) {
  const rpm = data?.rpm ?? 0;
  const maxRpm = data?.max_rpm ?? 7000;
  const shiftNow = data?.shift_now ?? false;
  const percentage = Math.min(1, Math.max(0, rpm / maxRpm));
  const animatedAngleRef = useRef(0);
  const rafRef = useRef(null);
  const svgRef = useRef(null);

  // Needle animation
  useEffect(() => {
    const targetAngle = START_ANGLE + percentage * SWEEP_DEG;
    const animate = () => {
      const diff = targetAngle - animatedAngleRef.current;
      animatedAngleRef.current += diff * 0.15;
      if (svgRef.current) {
        const needle = svgRef.current.querySelector('#rpm-needle');
        if (needle) {
          needle.setAttribute(
            'transform',
            `rotate(${animatedAngleRef.current} ${CENTER} ${CENTER})`
          );
        }
      }
      if (Math.abs(diff) > 0.1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [percentage]);

  // Zone arcs
  const zones = useMemo(() => {
    const greenEnd = START_ANGLE + 0.7 * SWEEP_DEG;
    const yellowEnd = START_ANGLE + 0.9 * SWEEP_DEG;
    const redEnd = START_ANGLE + SWEEP_DEG;
    return [
      { d: describeArc(CENTER, CENTER, GAUGE_RADIUS, START_ANGLE, greenEnd), color: gaugeZoneColors.green },
      { d: describeArc(CENTER, CENTER, GAUGE_RADIUS, greenEnd, yellowEnd), color: gaugeZoneColors.yellow },
      { d: describeArc(CENTER, CENTER, GAUGE_RADIUS, yellowEnd, redEnd), color: gaugeZoneColors.red },
    ];
  }, []);

  // Active arc
  const activeEnd = START_ANGLE + percentage * SWEEP_DEG;
  const activeColor =
    percentage < 0.7
      ? gaugeZoneColors.green
      : percentage < 0.9
      ? gaugeZoneColors.yellow
      : gaugeZoneColors.red;

  // Tick marks
  const ticks = useMemo(() => {
    const result = [];
    const count = Math.ceil(maxRpm / 1000);
    for (let i = 0; i <= count; i++) {
      const frac = (i * 1000) / maxRpm;
      if (frac > 1) break;
      const angle = START_ANGLE + frac * SWEEP_DEG;
      const outerP = polarToCartesian(CENTER, CENTER, GAUGE_RADIUS + 8, angle);
      const innerP = polarToCartesian(CENTER, CENTER, GAUGE_RADIUS - 2, angle);
      const labelP = polarToCartesian(CENTER, CENTER, GAUGE_RADIUS + 18, angle);
      result.push({ outerP, innerP, labelP, label: i, angle });
    }
    return result;
  }, [maxRpm]);

  // Shift lights (8 LEDs)
  const shiftLights = useMemo(() => {
    const lights = [];
    for (let i = 0; i < 8; i++) {
      const threshold = 0.7 + (i / 8) * 0.3;
      const isLit = percentage >= threshold;
      const color =
        i < 3 ? gaugeZoneColors.green : i < 6 ? gaugeZoneColors.yellow : gaugeZoneColors.red;
      lights.push({ isLit, color, threshold });
    }
    return lights;
  }, [percentage]);

  return (
    <div className="panel-carbon p-3 flex flex-col items-center">
      {/* Shift Light Strip */}
      <div className="flex gap-1.5 mb-2">
        {shiftLights.map((light, i) => (
          <div
            key={i}
            className={`w-5 h-3 rounded-sm transition-all duration-75 ${
              light.isLit
                ? shiftNow
                  ? 'shift-light-blink'
                  : ''
                : ''
            }`}
            style={{
              backgroundColor: light.isLit ? light.color : '#1a1a1a',
              boxShadow: light.isLit ? `0 0 8px ${light.color}` : 'none',
              border: `1px solid ${light.isLit ? light.color : '#333'}`,
            }}
          />
        ))}
      </div>

      {/* SVG Gauge */}
      <svg ref={svgRef} viewBox="0 0 240 200" className="w-full max-w-[280px]">
        {/* Background arcs (dim) */}
        {zones.map((zone, i) => (
          <path
            key={i}
            d={zone.d}
            fill="none"
            stroke={zone.color}
            strokeWidth={ARC_WIDTH}
            strokeLinecap="round"
            opacity={0.15}
          />
        ))}

        {/* Active arc */}
        {percentage > 0.005 && (
          <path
            d={describeArc(CENTER, CENTER, GAUGE_RADIUS, START_ANGLE, activeEnd)}
            fill="none"
            stroke={activeColor}
            strokeWidth={ARC_WIDTH}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${activeColor})`,
              transition: 'd 0.1s ease-out',
            }}
          />
        )}

        {/* Tick marks */}
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={tick.innerP.x}
              y1={tick.innerP.y}
              x2={tick.outerP.x}
              y2={tick.outerP.y}
              stroke="#666"
              strokeWidth={1.5}
            />
            <text
              x={tick.labelP.x}
              y={tick.labelP.y}
              fill="#888"
              fontSize="9"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="'Share Tech Mono', monospace"
            >
              {tick.label}
            </text>
          </g>
        ))}

        {/* Needle */}
        <g id="rpm-needle" transform={`rotate(${START_ANGLE} ${CENTER} ${CENTER})`}>
          <line
            x1={CENTER}
            y1={CENTER}
            x2={CENTER}
            y2={CENTER - GAUGE_RADIUS + 10}
            stroke={activeColor}
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${activeColor})` }}
          />
        </g>

        {/* Center hub */}
        <circle cx={CENTER} cy={CENTER} r={6} fill="#222" stroke="#444" strokeWidth={1.5} />

        {/* RPM value */}
        <text
          x={CENTER}
          y={CENTER + 30}
          fill={activeColor}
          fontSize="28"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="'Orbitron', sans-serif"
          style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
        >
          {formatRPM(rpm)}
        </text>
        <text
          x={CENTER}
          y={CENTER + 46}
          fill="#666"
          fontSize="10"
          textAnchor="middle"
          fontFamily="'Share Tech Mono', monospace"
        >
          RPM
        </text>
      </svg>
    </div>
  );
}
