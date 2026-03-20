import React, { useMemo } from 'react';
import { TRACK_WAYPOINTS, SECTORS } from '../hooks/useNurburgringSimulator';

export default function TrackMap({ trackX, trackY, sectionName, className = '' }) {
  // Build smooth SVG path per sector for coloring
  const { sectorPaths, fullPath } = useMemo(() => {
    const pts = TRACK_WAYPOINTS;
    if (pts.length < 2) return { sectorPaths: [], fullPath: '' };

    // Group points by sector
    const sectorGroups = {};
    pts.forEach((p) => {
      const sid = p[5];
      if (!sectorGroups[sid]) sectorGroups[sid] = [];
      sectorGroups[sid].push(p);
    });

    // Build per-sector paths
    const paths = [];
    SECTORS.forEach((sec) => {
      const group = sectorGroups[sec.id];
      if (!group || group.length < 2) return;
      let d = `M ${group[0][0]} ${group[0][1]}`;
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1];
        const curr = group[i];
        const cpx = (prev[0] + curr[0]) / 2;
        const cpy = (prev[1] + curr[1]) / 2;
        d += ` Q ${prev[0]} ${prev[1]} ${cpx} ${cpy}`;
      }
      // Connect to next sector's first point
      const lastPt = group[group.length - 1];
      const nextSec = sectorGroups[sec.id < 7 ? sec.id + 1 : 1];
      if (nextSec && nextSec.length > 0) {
        d += ` L ${nextSec[0][0]} ${nextSec[0][1]}`;
      }
      paths.push({ ...sec, d });
    });

    // Full path for outline
    let full = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev[0] + curr[0]) / 2;
      const cpy = (prev[1] + curr[1]) / 2;
      full += ` Q ${prev[0]} ${prev[1]} ${cpx} ${cpy}`;
    }
    const last = pts[pts.length - 1];
    const first = pts[0];
    full += ` Q ${last[0]} ${last[1]} ${first[0]} ${first[1]}`;

    return { sectorPaths: paths, fullPath: full };
  }, []);

  // Section labels (deduplicated, important ones only)
  const sectionLabels = useMemo(() => {
    const seen = new Set();
    const labels = [];
    const important = [
      'Start/Ziel', 'Hatzenbach', 'Flugplatz', 'Schwedenkreuz',
      'Aremberg', 'Fuchsröhre', 'Adenauer Forst', 'Karussell',
      'Bergwerk', 'Wehrseifen', 'Brünnchen', 'Pflanzgarten',
      'Schwalbenschwanz', 'Döttinger Höhe', 'Hohe Acht',
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

  // Active sector from car position
  const activeSectorId = useMemo(() => {
    if (trackX == null || trackY == null) return null;
    let closest = null;
    let minDist = Infinity;
    for (const wp of TRACK_WAYPOINTS) {
      const d = Math.sqrt((wp[0] - trackX) ** 2 + (wp[1] - trackY) ** 2);
      if (d < minDist) { minDist = d; closest = wp; }
    }
    return closest ? closest[5] : null;
  }, [trackX, trackY]);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="170 25 640 590"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Track outline glow */}
        <path
          d={fullPath}
          fill="none"
          stroke="rgba(255,255,255,0.04)"
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Per-sector colored track */}
        {sectorPaths.map((sec) => (
          <path
            key={sec.id}
            d={sec.d}
            fill="none"
            stroke={activeSectorId === sec.id ? sec.color : '#444'}
            strokeWidth={activeSectorId === sec.id ? 7 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={activeSectorId === sec.id ? 1 : 0.6}
            style={activeSectorId === sec.id ? {
              filter: `drop-shadow(0 0 6px ${sec.color}80)`,
              transition: 'all 0.3s ease',
            } : { transition: 'all 0.3s ease' }}
          />
        ))}

        {/* Center line */}
        <path
          d={fullPath}
          fill="none"
          stroke="#666"
          strokeWidth={0.8}
          strokeDasharray="6,10"
          strokeLinecap="round"
        />

        {/* Section labels */}
        {sectionLabels.map((label, i) => (
          <g key={i}>
            <circle cx={label.x} cy={label.y} r={2.5} fill="#f59e0b" opacity={0.5} />
            <text
              x={label.x + 8}
              y={label.y - 6}
              fill="#999"
              fontSize="9"
              fontFamily="'Share Tech Mono', monospace"
              opacity={0.8}
            >
              {label.name}
            </text>
          </g>
        ))}

        {/* Start/Finish line */}
        <line
          x1={495} y1={548} x2={508} y2={562}
          stroke="#f59e0b"
          strokeWidth={3}
          opacity={0.7}
        />
        <text
          x={512} y={558}
          fill="#f59e0b"
          fontSize="10"
          fontFamily="'Orbitron', sans-serif"
          fontWeight="bold"
          opacity={0.9}
        >
          S/F
        </text>

        {/* Distance markers */}
        <text x={192} y={48} fill="#555" fontSize="8" fontFamily="'Share Tech Mono'">
          20.832 km NORDSCHLEIFE
        </text>
        <text x={192} y={60} fill="#444" fontSize="7" fontFamily="'Share Tech Mono'">
          RECORD: 5:19.546 — PORSCHE 919 EVO
        </text>

        {/* Car position */}
        {trackX != null && trackY != null && (
          <>
            {/* Pulse ring */}
            <circle cx={trackX} cy={trackY} r={16} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.15}>
              <animate attributeName="r" values="12;20;12" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.05;0.3" dur="1.5s" repeatCount="indefinite" />
            </circle>
            {/* Car dot */}
            <circle
              cx={trackX} cy={trackY} r={6}
              fill="#f59e0b"
              style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.9))' }}
            />
            <circle cx={trackX} cy={trackY} r={2.5} fill="#fff" opacity={0.9} />
          </>
        )}
      </svg>

      {/* Sector legend */}
      <div className="absolute top-2 right-2 flex flex-wrap gap-1.5">
        {SECTORS.map((sec) => (
          <div
            key={sec.id}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono-tech transition-all ${
              activeSectorId === sec.id
                ? 'bg-neutral-800/90 border border-neutral-600/50'
                : 'opacity-40'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sec.color }} />
            <span style={{ color: activeSectorId === sec.id ? sec.color : '#888' }}>
              S{sec.id}
            </span>
          </div>
        ))}
      </div>

      {/* Current section overlay */}
      {sectionName && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <div className="px-3 py-1 bg-neutral-900/90 border border-amber-500/30 rounded-lg backdrop-blur-sm">
            <span className="font-orbitron text-[10px] sm:text-xs font-bold text-amber-400 tracking-wider">
              {sectionName.toUpperCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
