/**
 * TrackMap — Nürburgring Nordschleife
 *
 * Hand-traced SVG path of the original 20.832 km Nordschleife circuit.
 * Based on the official Wikimedia circuit diagram geometry.
 *
 * The track is drawn as 7 sector paths (colored segments) plus labels.
 * Car position is projected onto the nearest point on the path.
 *
 * Layout (top-down, north up):
 * - East leg runs north (Hatzenbach → Flugplatz → Schwedenkreuz)
 * - Top curves west (Aremberg → Fuchsröhre → Adenauer Forst)
 * - West leg runs south (Metzgesfeld → Bergwerk → Karussell)
 * - Bottom curves east (Brünnchen → Pflanzgarten → Döttinger Höhe)
 * - Start/Finish at southeast
 */
import React, { useMemo } from 'react';
import { TRACK_WAYPOINTS, SECTORS } from '../hooks/useNurburgringSimulator';

// ── Precise SVG sector paths ────────────────────────────────────────────────
// Each sector is a continuous cubic Bezier path traced from the real circuit.
// The coordinate space is 0-1000 x 0-800 with north up.
// These paths form a closed loop when connected end-to-end.

const SECTOR_PATHS = [
  {
    // SECTOR 1: Start/Ziel → T13 → Hatzenbach → Hocheichen
    // From S/F heading north along the east side, through tight S-curves
    id: 1,
    d: 'M 735,680 C 740,665 748,648 752,630 C 756,612 760,595 762,578 C 764,560 765,542 764,525 C 763,508 760,492 755,478 C 750,464 742,452 738,438 C 734,424 732,410 735,395 C 738,380 744,368 750,355 C 756,342 760,328 762,312 C 764,296 764,280 762,264',
    label: { x: 772, y: 450, name: 'Hatzenbach' },
    startLabel: { x: 745, y: 690, name: 'Start/Ziel' },
  },
  {
    // SECTOR 2: Quiddelbacher Höhe → Flugplatz → Schwedenkreuz
    // Continuing north, then curving northwest. Flugplatz jump crest.
    id: 2,
    d: 'M 762,264 C 760,248 756,232 750,218 C 744,204 736,192 726,180 C 716,168 704,158 690,150 C 676,142 660,136 644,130 C 628,124 612,118 596,114',
    label: { x: 710, y: 185, name: 'Flugplatz' },
    labels: [
      { x: 665, y: 140, name: 'Schwedenkreuz' },
    ],
  },
  {
    // SECTOR 3: Aremberg → Fuchsröhre → Adenauer Forst
    // Sharp left at Aremberg, fast downhill through Fuchsröhre,
    // then tight hairpins at Adenauer Forst (northernmost point)
    id: 3,
    d: 'M 596,114 C 580,108 562,100 542,94 C 522,88 500,82 478,78 C 456,74 434,72 412,70 C 390,68 368,68 348,72 C 328,76 310,84 296,96 C 282,108 272,124 266,142',
    label: { x: 468, y: 68, name: 'Fuchsröhre' },
    labels: [
      { x: 582, y: 100, name: 'Aremberg' },
      { x: 310, y: 80, name: 'Adenauer Forst' },
    ],
  },
  {
    // SECTOR 4: Metzgesfeld → Kallenhard → Wehrseifen → Breidscheid
    // Heading south along the west leg, through medium-speed curves
    // and the tight Wehrseifen hairpin
    id: 4,
    d: 'M 266,142 C 260,160 255,180 252,200 C 249,220 247,240 246,260 C 245,280 244,300 244,320 C 244,340 245,358 248,375 C 251,392 255,408 258,425 C 261,442 263,458 264,475',
    label: { x: 232, y: 330, name: 'Wehrseifen' },
    labels: [
      { x: 240, y: 200, name: 'Metzgesfeld' },
      { x: 232, y: 268, name: 'Kallenhard' },
    ],
  },
  {
    // SECTOR 5: Ex-Mühle → Bergwerk → Karussell
    // Bergwerk blind left, then the famous banked Karussell
    // 210° left turn heading east after exit
    id: 5,
    d: 'M 264,475 C 262,492 258,508 254,522 C 250,536 246,548 244,560 C 242,572 244,584 250,594 C 256,604 266,612 278,618 C 290,624 304,628 320,630 C 336,632 352,630 368,624 C 384,618 396,608 406,596',
    label: { x: 240, y: 510, name: 'Bergwerk' },
    labels: [
      { x: 300, y: 638, name: 'Karussell' },
    ],
  },
  {
    // SECTOR 6: Hohe Acht → Wippermann → Brünnchen → Pflanzgarten
    // Heading east through the middle-south, dramatic crests at Pflanzgarten
    id: 6,
    d: 'M 406,596 C 416,584 428,574 442,566 C 456,558 472,554 488,552 C 504,550 520,552 536,556 C 552,560 566,568 578,578 C 590,588 600,600 612,610 C 624,620 636,628 648,634',
    label: { x: 490, y: 542, name: 'Brünnchen' },
    labels: [
      { x: 415, y: 575, name: 'Hohe Acht' },
      { x: 595, y: 595, name: 'Pflanzgarten' },
    ],
  },
  {
    // SECTOR 7: Schwalbenschwanz → Galgenkopf → Döttinger Höhe → Start
    // Schwalbenschwanz chicane, then the long Döttinger Höhe straight (369 km/h),
    // Antoniusbuche, Tiergarten, Hohenrain chicane back to Start/Finish
    id: 7,
    d: 'M 648,634 C 660,640 672,646 680,654 C 688,662 692,672 690,682 C 688,692 680,700 668,706 C 656,712 640,714 620,714 C 600,714 578,712 556,710 C 534,708 510,706 486,704 C 462,702 438,700 414,700 C 390,700 366,700 344,702 C 322,704 302,706 286,706 C 270,706 260,704 254,698 C 248,692 246,684 250,676 C 254,668 262,662 274,658 C 286,654 302,652 322,650 C 342,648 366,648 394,648 C 422,648 454,650 490,652 C 526,654 566,658 606,662 C 646,666 680,670 700,674 C 720,678 732,680 735,680',
    label: { x: 490, y: 692, name: 'Döttinger Höhe' },
    labels: [
      { x: 665, y: 648, name: 'Schwalbenschwanz' },
      { x: 296, y: 694, name: 'Tiergarten' },
    ],
  },
];

// Full circuit path (all sectors concatenated)
const FULL_PATH = SECTOR_PATHS.map(s => s.d).join(' ');

// ── Helper: closest point on polyline approximation ─────────────────────────
// We sample each sector path to create a lookup for car position
function parseSVGPath(d) {
  // Simple parser: extract all coordinate pairs from M, C, L commands
  const nums = d.match(/-?\d+\.?\d*/g);
  if (!nums) return [];
  const points = [];
  for (let i = 0; i < nums.length; i += 2) {
    points.push([parseFloat(nums[i]), parseFloat(nums[i + 1])]);
  }
  return points;
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

  // Map car position from simulator coords to SVG coords
  const carPos = useMemo(() => {
    if (trackX == null || trackY == null) return null;

    // The simulator waypoints use a different coordinate space.
    // We find the two closest waypoints, get the interpolation factor,
    // then map to the SVG path by sampling the corresponding sector.
    let closestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < TRACK_WAYPOINTS.length; i++) {
      const wp = TRACK_WAYPOINTS[i];
      const d = Math.sqrt((wp[0] - trackX) ** 2 + (wp[1] - trackY) ** 2);
      if (d < minDist) { minDist = d; closestIdx = i; d; }
    }

    const wp = TRACK_WAYPOINTS[closestIdx];
    const sectorId = wp[5];

    // Find the sector path and sample it
    const sector = SECTOR_PATHS.find(s => s.id === sectorId);
    if (!sector) return null;

    const sectorPoints = parseSVGPath(sector.d);
    if (sectorPoints.length === 0) return null;

    // Count waypoints in this sector and find index within sector
    const sectorWaypoints = TRACK_WAYPOINTS.filter(w => w[5] === sectorId);
    const idxInSector = sectorWaypoints.findIndex(w => w === wp);
    if (idxInSector < 0) return null;

    // Map to SVG path position
    const t = sectorWaypoints.length > 1
      ? idxInSector / (sectorWaypoints.length - 1)
      : 0;
    const svgIdx = Math.min(
      Math.floor(t * (sectorPoints.length - 1)),
      sectorPoints.length - 1
    );

    return { x: sectorPoints[svgIdx][0], y: sectorPoints[svgIdx][1] };
  }, [trackX, trackY]);

  // Collect all labels
  const allLabels = useMemo(() => {
    const labels = [];
    SECTOR_PATHS.forEach(s => {
      if (s.startLabel) labels.push(s.startLabel);
      if (s.label) labels.push(s.label);
      if (s.labels) labels.push(...s.labels);
    });
    return labels;
  }, []);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="210 50 570 700"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background glow */}
        <path
          d={FULL_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.03)"
          strokeWidth={24}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Track surface (dark base) */}
        <path
          d={FULL_PATH}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Per-sector colored overlay */}
        {SECTOR_PATHS.map((sec) => {
          const sectorDef = SECTORS.find(s => s.id === sec.id);
          const isActive = activeSectorId === sec.id;
          const color = sectorDef?.color || '#666';
          return (
            <path
              key={sec.id}
              d={sec.d}
              fill="none"
              stroke={isActive ? color : '#444'}
              strokeWidth={isActive ? 8 : 6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isActive ? 1 : 0.5}
              style={{
                filter: isActive ? `drop-shadow(0 0 8px ${color}90)` : 'none',
                transition: 'all 0.3s ease',
              }}
            />
          );
        })}

        {/* Center dashes */}
        <path
          d={FULL_PATH}
          fill="none"
          stroke="#555"
          strokeWidth={0.6}
          strokeDasharray="5,10"
          strokeLinecap="round"
        />

        {/* Section labels */}
        {allLabels.map((label, i) => (
          <g key={i}>
            <circle cx={label.x} cy={label.y} r={2} fill="#f59e0b" opacity={0.5} />
            <text
              x={label.x + 8}
              y={label.y - 5}
              fill="#888"
              fontSize="9"
              fontFamily="'Share Tech Mono', monospace"
              opacity={0.75}
            >
              {label.name}
            </text>
          </g>
        ))}

        {/* Start/Finish marker */}
        <line x1={730} y1={673} x2={740} y2={688} stroke="#f59e0b" strokeWidth={3} opacity={0.8} />
        <text x={744} y={684} fill="#f59e0b" fontSize="10" fontFamily="'Orbitron', sans-serif" fontWeight="bold" opacity={0.9}>
          S/F
        </text>

        {/* Track info */}
        <text x={220} y={68} fill="#555" fontSize="8" fontFamily="'Share Tech Mono'">
          20.832 km NORDSCHLEIFE
        </text>
        <text x={220} y={80} fill="#444" fontSize="7" fontFamily="'Share Tech Mono'">
          RECORD: 5:19.546 — PORSCHE 919 EVO
        </text>

        {/* Car position */}
        {carPos && (
          <>
            <circle cx={carPos.x} cy={carPos.y} r={16} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.15}>
              <animate attributeName="r" values="12;22;12" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.3;0.05;0.3" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <circle
              cx={carPos.x} cy={carPos.y} r={6}
              fill="#f59e0b"
              style={{ filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.9))' }}
            />
            <circle cx={carPos.x} cy={carPos.y} r={2.5} fill="#fff" opacity={0.9} />
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
