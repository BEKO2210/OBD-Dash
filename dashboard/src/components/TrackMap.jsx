/**
 * TrackMap — Nürburgring Nordschleife
 *
 * Uses the ORIGINAL Wikimedia Commons SVG of the Nürburgring 24h circuit.
 * The SVG is loaded at runtime by the user's browser (not bundled).
 * Car position is overlaid on top using percentage-based coordinates.
 */
import React, { useMemo } from 'react';
import { TRACK_WAYPOINTS, SECTORS } from '../hooks/useNurburgringSimulator';

// Original Wikimedia Commons SVG — loaded by the user's browser at runtime
const TRACK_SVG_URL =
  'https://upload.wikimedia.org/wikipedia/commons/3/3c/Circuit_N%C3%BCrburgring-2002-24h.svg';

// ── Coordinate mapping ──────────────────────────────────────────────────────
// The Wikimedia SVG has a viewBox of roughly 0 0 1052 744.
// Our simulator waypoints use a different coord space.
// We map simulator coords → percentage positions on the image.
//
// Simulator bounding box (from waypoints):
// X: ~248 to ~762   → width ~514
// Y: ~68  to ~714   → height ~646
//
// We map these to percentage positions on the displayed image.
const SIM_BOUNDS = {
  minX: 240, maxX: 770,
  minY: 60,  maxY: 720,
};

function simToPercent(x, y) {
  const px = ((x - SIM_BOUNDS.minX) / (SIM_BOUNDS.maxX - SIM_BOUNDS.minX)) * 100;
  const py = ((y - SIM_BOUNDS.minY) / (SIM_BOUNDS.maxY - SIM_BOUNDS.minY)) * 100;
  return { px, py };
}

export default function TrackMap({ trackX, trackY, sectionName, className = '' }) {
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

  // Map car position to percentage on the image
  const carPercent = useMemo(() => {
    if (trackX == null || trackY == null) return null;
    return simToPercent(trackX, trackY);
  }, [trackX, trackY]);

  return (
    <div className={`relative ${className}`}>
      {/* Original Wikimedia SVG — the real Nürburgring 24h circuit map */}
      <div className="w-full h-full flex items-center justify-center relative">
        <img
          src={TRACK_SVG_URL}
          alt="Nürburgring Nordschleife"
          className="w-full h-full object-contain"
          style={{
            filter: 'invert(1) brightness(0.35) sepia(1) hue-rotate(10deg) saturate(3)',
            opacity: 0.7,
          }}
          draggable={false}
        />

        {/* Car position overlay */}
        {carPercent && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${carPercent.px}%`,
              top: `${carPercent.py}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Pulse ring */}
            <div
              className="absolute rounded-full border border-amber-500/30 animate-ping"
              style={{
                width: 36, height: 36,
                left: -18, top: -18,
                animationDuration: '1.5s',
              }}
            />
            {/* Glow */}
            <div
              className="absolute rounded-full bg-amber-500/20"
              style={{
                width: 28, height: 28,
                left: -14, top: -14,
                filter: 'blur(6px)',
              }}
            />
            {/* Dot */}
            <div
              className="absolute rounded-full bg-amber-400"
              style={{
                width: 12, height: 12,
                left: -6, top: -6,
                boxShadow: '0 0 12px 4px rgba(245,158,11,0.7)',
              }}
            />
            {/* Center */}
            <div
              className="absolute rounded-full bg-white"
              style={{
                width: 5, height: 5,
                left: -2.5, top: -2.5,
                opacity: 0.9,
              }}
            />
          </div>
        )}
      </div>

      {/* Track info overlay */}
      <div className="absolute top-2 left-2 flex flex-col gap-0.5">
        <span className="font-mono-tech text-[8px] sm:text-[9px] text-neutral-500 tracking-wider">
          20.832 km NORDSCHLEIFE
        </span>
        <span className="font-mono-tech text-[7px] sm:text-[8px] text-neutral-600">
          RECORD: 5:19.546 — PORSCHE 919 EVO
        </span>
      </div>

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

      {/* Current section name */}
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
