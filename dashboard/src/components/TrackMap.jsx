/**
 * TrackMap — Nürburgring Nordschleife (original Wikimedia SVG)
 *
 * Fetches the ORIGINAL Wikimedia Commons SVG at runtime, renders it inline,
 * then uses path.getPointAtLength() to position the car dot on the actual
 * SVG track path — no manual coordinate mapping needed.
 */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { TRACK_WAYPOINTS, SECTORS } from '../hooks/useNurburgringSimulator';

// Original Wikimedia Commons SVG — fetched at runtime by the user's browser
const TRACK_SVG_URL =
  'https://upload.wikimedia.org/wikipedia/commons/3/3c/Circuit_N%C3%BCrburgring-2002-24h.svg';

export default function TrackMap({
  trackX,
  trackY,
  trackPosition = 0, // 0-1 normalized lap progress
  sectionName,
  className = '',
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const trackPathRef = useRef(null);
  const trackLengthRef = useRef(0);
  const viewBoxRef = useRef(null);
  const [svgLoaded, setSvgLoaded] = useState(false);
  const [carPos, setCarPos] = useState(null);
  const [loadError, setLoadError] = useState(false);

  // ── Fetch and inject SVG ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    fetch(TRACK_SVG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((svgText) => {
        if (cancelled || !containerRef.current) return;

        // Inject SVG into container
        const wrapper = containerRef.current;
        wrapper.innerHTML = svgText;

        const svg = wrapper.querySelector('svg');
        if (!svg) return;

        svgRef.current = svg;

        // Style the SVG to fill its container
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.style.display = 'block';

        // Read viewBox
        const vb = svg.viewBox?.baseVal;
        if (vb && vb.width > 0) {
          viewBoxRef.current = { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
        } else {
          // Fallback: read width/height attributes
          const w = parseFloat(svg.getAttribute('width')) || 800;
          const h = parseFloat(svg.getAttribute('height')) || 600;
          viewBoxRef.current = { x: 0, y: 0, w, h };
        }

        // Apply dark theme via CSS filter on all existing elements
        // Make the background transparent and invert colors for dark mode
        svg.style.filter = 'invert(1) brightness(0.4) sepia(1) hue-rotate(10deg) saturate(3)';
        svg.style.opacity = '0.7';

        // Find the longest path element (= the track circuit)
        const paths = svg.querySelectorAll('path');
        let bestPath = null;
        let bestLen = 0;
        paths.forEach((p) => {
          try {
            const len = p.getTotalLength();
            if (len > bestLen) {
              bestLen = len;
              bestPath = p;
            }
          } catch (e) {
            /* some paths may not support getTotalLength */
          }
        });

        if (bestPath) {
          trackPathRef.current = bestPath;
          trackLengthRef.current = bestLen;
        }

        setSvgLoaded(true);
      })
      .catch((err) => {
        console.warn('TrackMap: Could not load Wikimedia SVG:', err.message);
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Position car dot along track path ──────────────────────────────────
  useEffect(() => {
    if (!svgLoaded || !trackPathRef.current || trackLengthRef.current === 0) return;

    const progress = Math.max(0, Math.min(1, trackPosition || 0));
    try {
      const point = trackPathRef.current.getPointAtLength(progress * trackLengthRef.current);
      setCarPos({ x: point.x, y: point.y });
    } catch (e) {
      /* ignore */
    }
  }, [svgLoaded, trackPosition]);

  // ── Active sector from car position ────────────────────────────────────
  const activeSectorId = useMemo(() => {
    if (trackX == null || trackY == null) return null;
    let closest = null;
    let minDist = Infinity;
    for (const wp of TRACK_WAYPOINTS) {
      const d = Math.sqrt((wp[0] - trackX) ** 2 + (wp[1] - trackY) ** 2);
      if (d < minDist) {
        minDist = d;
        closest = wp;
      }
    }
    return closest ? closest[5] : null;
  }, [trackX, trackY]);

  // ── Car dot overlay SVG ────────────────────────────────────────────────
  const carOverlay = useMemo(() => {
    if (!carPos || !viewBoxRef.current) return null;
    const vb = viewBoxRef.current;
    return (
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ zIndex: 10 }}
      >
        <defs>
          <radialGradient id="carGlow">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Glow */}
        <circle cx={carPos.x} cy={carPos.y} r={12} fill="url(#carGlow)" />
        {/* Pulse ring */}
        <circle
          cx={carPos.x}
          cy={carPos.y}
          r={8}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={0.8}
          opacity={0.4}
        >
          <animate attributeName="r" from="6" to="16" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.5" to="0" dur="1.5s" repeatCount="indefinite" />
        </circle>
        {/* Main dot */}
        <circle cx={carPos.x} cy={carPos.y} r={4} fill="#f59e0b" />
        {/* Center highlight */}
        <circle cx={carPos.x} cy={carPos.y} r={1.5} fill="#ffffff" opacity={0.9} />
      </svg>
    );
  }, [carPos]);

  // ── Fallback: waypoint-based rendering if SVG fetch fails ──────────────
  if (loadError) {
    return (
      <div className={`relative ${className}`}>
        <FallbackTrackMap trackX={trackX} trackY={trackY} activeSectorId={activeSectorId} />
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

  return (
    <div className={`relative ${className}`}>
      {/* SVG container — the Wikimedia SVG gets injected here */}
      <div
        ref={containerRef}
        className="w-full h-full [&>svg]:w-full [&>svg]:h-full"
        style={{ position: 'relative' }}
      />

      {/* Car position overlay (same viewBox as the SVG) */}
      {carOverlay}

      {/* Track info overlay */}
      <div className="absolute top-2 left-2 flex flex-col gap-0.5 z-20">
        <span className="font-mono-tech text-[8px] sm:text-[9px] text-neutral-500 tracking-wider">
          20.832 km NORDSCHLEIFE
        </span>
        <span className="font-mono-tech text-[7px] sm:text-[8px] text-neutral-600">
          RECORD: 5:19.546 — PORSCHE 919 EVO
        </span>
      </div>

      {/* Sector legend */}
      <div className="absolute top-2 right-2 flex flex-wrap gap-1.5 z-20">
        {SECTORS.map((sec) => (
          <div
            key={sec.id}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono-tech transition-all ${
              activeSectorId === sec.id
                ? 'bg-neutral-800/90 border border-neutral-600/50'
                : 'opacity-40'
            }`}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: sec.color }}
            />
            <span style={{ color: activeSectorId === sec.id ? sec.color : '#888' }}>
              S{sec.id}
            </span>
          </div>
        ))}
      </div>

      {/* Current section name */}
      {sectionName && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20">
          <div className="px-3 py-1 bg-neutral-900/90 border border-amber-500/30 rounded-lg backdrop-blur-sm">
            <span className="font-orbitron text-[10px] sm:text-xs font-bold text-amber-400 tracking-wider">
              {sectionName.toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!svgLoaded && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <span className="font-mono-tech text-[10px] text-neutral-600 animate-pulse">
            Loading Nürburgring...
          </span>
        </div>
      )}
    </div>
  );
}

// ── Fallback: simple waypoint-based track if Wikimedia SVG fails to load ────
function FallbackTrackMap({ trackX, trackY, activeSectorId }) {
  const vbMinX = 220, vbMinY = 40, vbW = 570, vbH = 700;

  const trackPath = useMemo(() => {
    return TRACK_WAYPOINTS.map((wp, i) =>
      `${i === 0 ? 'M' : 'L'} ${wp[0]} ${wp[1]}`
    ).join(' ') + ' Z';
  }, []);

  return (
    <svg
      viewBox={`${vbMinX} ${vbMinY} ${vbW} ${vbH}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Track outline */}
      <path
        d={trackPath}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={3}
        strokeLinejoin="round"
        opacity={0.3}
      />
      {/* Car dot */}
      {trackX != null && trackY != null && (
        <>
          <circle cx={trackX} cy={trackY} r={10} fill="#f59e0b" opacity={0.2} />
          <circle cx={trackX} cy={trackY} r={5} fill="#f59e0b" />
          <circle cx={trackX} cy={trackY} r={2} fill="#ffffff" opacity={0.9} />
        </>
      )}
    </svg>
  );
}
