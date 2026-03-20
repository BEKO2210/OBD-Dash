import React, { useMemo } from 'react';
import { TRACK_WAYPOINTS } from '../hooks/useNurburgringSimulator';

const VIEWBOX_W = 1000;
const VIEWBOX_H = 650;

export default function TrackMap({ trackX, trackY, sectionName, className = '' }) {
  // Build smooth SVG path from waypoints
  const trackPath = useMemo(() => {
    if (TRACK_WAYPOINTS.length < 2) return '';
    const pts = TRACK_WAYPOINTS;
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev[0] + curr[0]) / 2;
      const cpy = (prev[1] + curr[1]) / 2;
      d += ` Q ${prev[0]} ${prev[1]} ${cpx} ${cpy}`;
    }
    // Close back to start
    const last = pts[pts.length - 1];
    const first = pts[0];
    d += ` Q ${last[0]} ${last[1]} ${first[0]} ${first[1]}`;
    return d;
  }, []);

  // Section labels (deduplicated, at midpoint of each section)
  const sectionLabels = useMemo(() => {
    const seen = new Set();
    const labels = [];
    const important = [
      'Start/Ziel', 'Hatzenbach', 'Flugplatz', 'Schwedenkreuz',
      'Fuchsröhre', 'Adenauer Forst', 'Karussell', 'Brünnchen',
      'Pflanzgarten', 'Döttinger Höhe', 'Bergwerk', 'Wehrseifen',
    ];
    for (let i = 0; i < TRACK_WAYPOINTS.length; i++) {
      const name = TRACK_WAYPOINTS[i][4];
      if (!seen.has(name) && important.includes(name)) {
        seen.add(name);
        labels.push({ x: TRACK_WAYPOINTS[i][0], y: TRACK_WAYPOINTS[i][1], name });
      }
    }
    return labels;
  }, []);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`180 30 620 580`}
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 0 20px rgba(245,158,11,0.15))' }}
      >
        {/* Track outline glow */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(245,158,11,0.08)"
          strokeWidth={18}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Track surface */}
        <path
          d={trackPath}
          fill="none"
          stroke="#333"
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Track center line */}
        <path
          d={trackPath}
          fill="none"
          stroke="#555"
          strokeWidth={1}
          strokeDasharray="8,12"
          strokeLinecap="round"
        />

        {/* Section labels */}
        {sectionLabels.map((label, i) => (
          <g key={i}>
            <circle cx={label.x} cy={label.y} r={3} fill="#f59e0b" opacity={0.4} />
            <text
              x={label.x + 10}
              y={label.y - 8}
              fill="#888"
              fontSize="11"
              fontFamily="'Share Tech Mono', monospace"
              opacity={0.7}
            >
              {label.name}
            </text>
          </g>
        ))}

        {/* Start/Finish line */}
        <line
          x1={495} y1={545} x2={505} y2={565}
          stroke="#f59e0b"
          strokeWidth={3}
          opacity={0.6}
        />
        <text
          x={510} y={560}
          fill="#f59e0b"
          fontSize="10"
          fontFamily="'Orbitron', sans-serif"
          fontWeight="bold"
          opacity={0.8}
        >
          S/F
        </text>

        {/* Car position - outer glow */}
        {trackX != null && trackY != null && (
          <>
            <circle
              cx={trackX}
              cy={trackY}
              r={18}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={1}
              opacity={0.2}
            >
              <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
            </circle>
            {/* Car position dot */}
            <circle
              cx={trackX}
              cy={trackY}
              r={7}
              fill="#f59e0b"
              style={{ filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.8))' }}
            />
            <circle
              cx={trackX}
              cy={trackY}
              r={3}
              fill="#fff"
              opacity={0.9}
            />
          </>
        )}
      </svg>

      {/* Current section overlay */}
      {sectionName && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <div className="px-4 py-1.5 bg-neutral-900/90 border border-amber-500/30 rounded-lg backdrop-blur-sm">
            <span className="font-orbitron text-xs font-bold text-amber-400 tracking-wider">
              {sectionName.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
