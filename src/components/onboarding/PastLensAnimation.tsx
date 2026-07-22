'use client';

/**
 * PastLensAnimation — animated line-art illustrations for the P.A.S.T. lenses.
 *
 * Implemented: **place**, **affairs**, **society**, **technology**.
 *
 * Style (all lenses): rust (#A33829) stroke-only line art on a transparent
 * background — the parent supplies the cream (#F8F8EC) canvas — with a uniform
 * ~8px stroke in a 1024×560 frame, round caps and joins, no fills and no text.
 * A cool accent marks each lens's "natural / structural" element: Place's river
 * keeps its water-blue (#5E93AE); affairs, society and technology draw the earth
 * they stand on — ground line, crack, track — in teal (#2C3E3A). The draw-on
 * is Framer Motion's `pathLength` sweep (or a clip reveal for dashed lines). Each
 * animation is two beats: Beat 1 draws the cause; Beat 2 staggers in the effect.
 * It plays once on mount, holds the final frame, and calls `onComplete`.
 * prefers-reduced-motion renders the final frame with no motion. The SVG scales
 * to its container's width.
 */

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useMotionValue, useTransform, animate } from 'framer-motion';

export type PastLens = 'place' | 'affairs' | 'society' | 'technology';

const STROKE = '#A33829';       // rust — the line-art colour
const SW = 8;                   // uniform stroke width
const ACCENT = '#5E93AE';       // cool accent — Place's river
const TEAL = '#2C3E3A';         // the earth: affairs ground/crack, society ground, tech track
const VB_W = 1024;
const VB_H = 560;

/** Every lens now has an animation. */
export function hasPastLensAnimation(_lens: PastLens): boolean {
  return true;
}

/** Shared SVG frame: the viewBox, the rust stroke defaults, round caps/joins. */
function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ width: '100%', height: 'auto', display: 'block' }}
      fill="none"
      stroke={STROKE}
      strokeWidth={SW}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      {children}
    </svg>
  );
}

interface Props {
  lens: PastLens;
  onComplete?: () => void;
}

export default function PastLensAnimation({ lens, onComplete }: Props) {
  const reduce = useReducedMotion();
  if (lens === 'place') return <PlaceScene reduce={reduce} onComplete={onComplete} />;
  if (lens === 'affairs') return <AffairsScene reduce={reduce} onComplete={onComplete} />;
  if (lens === 'society') return <SocietyScene reduce={reduce} onComplete={onComplete} />;
  if (lens === 'technology') return <TechScene reduce={reduce} onComplete={onComplete} />;
  return <NoScene onComplete={onComplete} />;
}

/** A lens without art yet: signal completion so callers aren't left waiting. */
function NoScene({ onComplete }: { onComplete?: () => void }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onComplete?.(); }, []);
  return null;
}

// ───────────────────────────── place ─────────────────────────────
// A map from above: a river draws on top→bottom, houses pop in along both banks,
// then a wheat field fades in last.

const RIVER_SW = 28;   // ~3.5× the house stroke: a body of water, not a road
const HOUSE_W = 52;
const HOUSE_TOTAL_H = HOUSE_W * 1.62;
const WHEAT_H = HOUSE_TOTAL_H * 0.4;
const WHEAT_SW = SW * 0.4;

const P_BEAT1 = 1.2;
const P_BEAT2 = P_BEAT1 + 0.05;
const P_HOUSE_STAGGER = 0.1;
const P_WHEAT_STAGGER = 0.05;
const P_WHEAT_FADE = 0.5;

const RIVER_D =
  'M 720 -20 C 700 110 470 130 450 250 C 432 360 690 370 640 470 C 606 535 360 520 300 580';

/** House centres, hand-placed and pre-verified: no pair closer than 1.5× width,
 *  none crossing the river, all inside the frame. Ordered top→bottom. */
const HOUSES: [number, number][] = [
  [559, 46], [766, 68], [462, 107], [670, 157], [577, 212], [380, 215],
  [634, 319], [410, 355], [719, 416], [504, 422], [385, 466],
];
const WHEAT: [number, number][] = [
  [900, 435], [880, 475], [860, 435], [920, 475], [940, 435],
  [840, 475], [880, 395], [900, 515], [920, 395], [860, 515],
];

/** A stroke-only house — a square body with a triangle roof, centred at (x, y). */
export function House({ x, y, size }: { x: number; y: number; size: number }) {
  const roofH = size * 0.62;
  const totalH = size + roofH;
  const left = x - size / 2;
  const right = x + size / 2;
  const apexY = y - totalH / 2;
  const bodyTop = apexY + roofH;
  const bottom = y + totalH / 2;
  return (
    <>
      <path d={`M ${left} ${bodyTop} H ${right} V ${bottom} H ${left} Z`} />
      <path d={`M ${left} ${bodyTop} L ${x} ${apexY} L ${right} ${bodyTop}`} />
    </>
  );
}

function Wheat({ x, yBottom, height, strokeWidth }: { x: number; yBottom: number; height: number; strokeWidth: number }) {
  const top = yBottom - height;
  const grains = [0.5, 0.68, 0.86].map((t) => yBottom - height * t);
  const len = height * 0.42;
  const rise = height * 0.34;
  return (
    <g strokeWidth={strokeWidth}>
      <line x1={x} y1={yBottom} x2={x} y2={top} />
      {grains.map((gy, i) => (
        <g key={i}>
          <line x1={x} y1={gy} x2={x + len} y2={gy - rise} />
          <line x1={x} y1={gy} x2={x - len} y2={gy - rise} />
        </g>
      ))}
    </g>
  );
}

function PlaceScene({ reduce, onComplete }: { reduce: boolean | null; onComplete?: () => void }) {
  // Dev-only guard: the hardcoded houses must keep the 1.5×-width minimum.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const min = 1.5 * HOUSE_W;
    for (let i = 0; i < HOUSES.length; i++) {
      for (let j = i + 1; j < HOUSES.length; j++) {
        const d = Math.hypot(HOUSES[i][0] - HOUSES[j][0], HOUSES[i][1] - HOUSES[j][1]);
        if (d < min) console.warn(`[PastLensAnimation] houses ${i} & ${j} are ${d.toFixed(0)}px apart (< ${min})`);
      }
    }
  }, []);

  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reduce) { onComplete?.(); return; }
    const wheatStart = P_BEAT2 + HOUSES.length * P_HOUSE_STAGGER + 0.15;
    const total = wheatStart + (WHEAT.length - 1) * P_WHEAT_STAGGER + P_WHEAT_FADE + 0.15;
    const t = window.setTimeout(() => onComplete?.(), total * 1000);
    return () => clearTimeout(t);
  }, [reduce, onComplete]);

  const wheatStart = P_BEAT2 + HOUSES.length * P_HOUSE_STAGGER + 0.15;

  return (
    <Frame label="A map seen from above: a river with houses along its banks and a field of wheat">
      {/* Beat 1 — the river draws on, top to bottom. */}
      <motion.path
        d={RIVER_D}
        stroke={ACCENT}
        strokeWidth={RIVER_SW}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: P_BEAT1, ease: 'easeInOut' }}
      />
      {/* Beat 2a — houses pop in one by one along both banks. */}
      {HOUSES.map(([hx, hy], i) => (
        <motion.g
          key={i}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce
            ? { duration: 0 }
            : { delay: P_BEAT2 + i * P_HOUSE_STAGGER, type: 'spring', stiffness: 520, damping: 15 }}
        >
          <House x={hx} y={hy} size={HOUSE_W} />
        </motion.g>
      ))}
      {/* Beat 2b — the wheat field fades in as the final stagger group. */}
      {WHEAT.map(([wx, wy], i) => (
        <motion.g
          key={i}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? { duration: 0 } : { delay: wheatStart + i * P_WHEAT_STAGGER, duration: P_WHEAT_FADE }}
        >
          <Wheat x={wx} yBottom={wy} height={WHEAT_H} strokeWidth={WHEAT_SW} />
        </motion.g>
      ))}
    </Frame>
  );
}

// Technology's houses share a size; the tower's blocks are stroke-only rectangles.
const BUILT_HOUSE = 64;

/** A stroke-only rectangle centred on cx, from `top` to `bottom`. */
function rectPath(cx: number, halfW: number, top: number, bottom: number): string {
  return `M ${(cx - halfW).toFixed(1)} ${top} H ${(cx + halfW).toFixed(1)} V ${bottom} H ${(cx - halfW).toFixed(1)} Z`;
}

// ──────────────────────────── affairs ────────────────────────────
// A tower falls. Ten blocks stack into a tower; the ground cracks and the scene
// shakes violently; the tower collapses block by block — cap first, top-down —
// into rubble on the cracked ground. No rebuild: it holds on the wreckage.

const EQ_GROUND_Y = 440;

// Ground: flat ends, a zigzag crack (±16px) between x=250 and x=780. A 0→1 value
// scales the offsets, so flat morphs into the crack — and stays cracked.
const EQ_CRACK: [number, number][] = [
  [60, 0], [250, 0], [338, -16], [426, 16], [514, -16],
  [602, 16], [690, -16], [780, 0], [964, 0],
];
function eqGroundPath(t: number): string {
  return EQ_CRACK.map(([x, off], i) => `${i ? 'L' : 'M'} ${x} ${(EQ_GROUND_Y + off * t).toFixed(1)}`).join(' ');
}

// Ten blocks: nine 90×70 in a 3×3 grid (columns 416/512/608, rows 405/329/253 —
// 6px gaps, bottom row on y=440) plus a 190×50 cap at (512,193). Each carries its
// tower position and a hardcoded rubble target (rx, ry, rotation — all distinct,
// 3 elevated to sit atop others). Build order = index (bottom row first, cap last);
// fall order = cap, then top row, middle, bottom. All verified by math.
interface Block { cx: number; cy: number; hw: number; hh: number; rx: number; ry: number; rot: number; fall: number; }
const EQ_COLS = [416, 512, 608];
const EQ_ROWS = [405, 329, 253];
const EQ_RUBBLE: [number, number, number][] = [
  [320, 410, -62], [400, 414, 29], [475, 406, -41],
  [352, 352, 16], [548, 412, 70], [625, 408, -19],
  [300, 404, -74], [592, 350, -33], [690, 360, 45],
  [505, 398, -9], // cap
];
const EQ_FALL_ORDER = [9, 6, 7, 8, 3, 4, 5, 0, 1, 2];
const EQ_BLOCKS: Block[] = EQ_RUBBLE.map(([rx, ry, rot], i) => {
  const cap = i === 9;
  return {
    cx: cap ? 512 : EQ_COLS[i % 3],
    cy: cap ? 193 : EQ_ROWS[Math.floor(i / 3)],
    hw: cap ? 95 : 45,
    hh: cap ? 25 : 35,
    rx, ry, rot, fall: EQ_FALL_ORDER.indexOf(i),
  };
});

// affairs timeline (seconds)
const EQ_BUILD_STAGGER = 0.06;
const EQ_QUAKE = 0.9;        // crack forms + the scene shakes
const EQ_CRACK_DUR = 0.5;
const EQ_JITTER_DUR = 1.0;
const EQ_FALL_START = 1.5;   // blocks start falling as the jitter peaks (~60%)
const EQ_FALL_STAGGER = 0.08;
const EQ_FALL_DUR = 0.5;
const EQ_TOTAL = EQ_FALL_START + 9 * EQ_FALL_STAGGER + EQ_FALL_DUR + 0.3;

function AffairsScene({ reduce, onComplete }: { reduce: boolean | null; onComplete?: () => void }) {
  // The ground morphs flat → cracked and stays cracked.
  const crack = useMotionValue(reduce ? 1 : 0);
  const groundD = useTransform(crack, (t) => eqGroundPath(t));
  useEffect(() => {
    if (reduce) return;
    const a = animate(crack, 1, { delay: EQ_QUAKE, duration: EQ_CRACK_DUR, ease: 'easeIn' });
    return () => a.stop();
  }, [reduce, crack]);

  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reduce) { onComplete?.(); return; }
    const t = window.setTimeout(() => onComplete?.(), EQ_TOTAL * 1000);
    return () => clearTimeout(t);
  }, [reduce, onComplete]);

  return (
    <Frame label="A tall tower of blocks on flat ground; the ground cracks, the scene shakes, and the tower collapses into rubble">
      {/* The whole scene shakes violently during the quake. */}
      <motion.g
        animate={reduce ? {} : { x: [0, -14, 15, -12, 12, -8, 5, 0], y: [0, 3, -3, 3, -2, 2, 0] }}
        transition={reduce ? { duration: 0 } : { delay: EQ_QUAKE, duration: EQ_JITTER_DUR, ease: 'linear' }}
      >
        {/* Ground (teal): draws on flat, then cracks and holds. */}
        <motion.path
          d={groundD}
          stroke={TEAL}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeInOut' }}
        />

        {/* Blocks: pop up bottom-first to build the tower, then fall to their rubble
            targets (top-down) with a small landing bounce. */}
        {EQ_BLOCKS.map((b, i) => {
          const dx = b.rx - b.cx;
          const dy = b.ry - b.cy;
          const fallAt = EQ_FALL_START + b.fall * EQ_FALL_STAGGER;
          return (
            <motion.g
              key={i}
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
              initial={reduce ? false : { scale: 0, x: 0, y: 0, rotate: 0 }}
              animate={{ scale: 1, x: dx, y: reduce ? dy : [0, dy + 6, dy], rotate: b.rot }}
              transition={reduce ? { duration: 0 } : {
                scale: { delay: i * EQ_BUILD_STAGGER, type: 'spring', stiffness: 480, damping: i === 9 ? 12 : 15 },
                x: { delay: fallAt, duration: EQ_FALL_DUR, ease: 'easeIn' },
                rotate: { delay: fallAt, duration: EQ_FALL_DUR, ease: 'easeIn' },
                y: { delay: fallAt, duration: EQ_FALL_DUR, ease: 'easeIn', times: [0, 0.85, 1] },
              }}
            >
              <path d={rectPath(b.cx, b.hw, b.cy - b.hh, b.cy + b.hh)} />
            </motion.g>
          );
        })}
      </motion.g>
    </Frame>
  );
}

// ──────────────────────────── society ────────────────────────────
// A three-tier stepped pyramid of power assembles bottom-up; its symbols (crown,
// institution, populace) drop into place top-down — then the middle institution's
// spire gives way to a temple: the structure persists, what it houses changes.

const SOC_GROUND = 'M 100 420 L 924 420';
// [left, right, top]; each tier is 90 tall. Ordered bottom → top (draw order).
const SOC_TIERS: [number, number, number][] = [
  [212, 812, 330],
  [312, 712, 240],
  [412, 612, 150],
];
function socTier([l, r, top]: [number, number, number]): string {
  return `M ${l} ${top} H ${r} V ${top + 90} H ${l} Z`;
}
const SOC_CROWN = 'M 467 218 L 467 173 L 489.5 190 L 512 173 L 534.5 190 L 557 173 L 557 218 Z';
const SOC_SWAP = 2.05; // spire → temple crossfade
const SOC_TOTAL = 2.7;

function SocietyScene({ reduce, onComplete }: { reduce: boolean | null; onComplete?: () => void }) {
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reduce) { onComplete?.(); return; }
    const t = window.setTimeout(() => onComplete?.(), SOC_TOTAL * 1000);
    return () => clearTimeout(t);
  }, [reduce, onComplete]);

  // A symbol dropping into its tier with a small settle bounce.
  const drop = (delay: number) => (reduce ? { duration: 0 } : { delay, type: 'spring' as const, stiffness: 420, damping: 13 });

  return (
    <Frame label="A three-tier pyramid of social order — crown, institution and people — where the institution's spire becomes a temple">
      {/* Ground (teal), then tier outlines draw on bottom-up. */}
      <motion.path
        d={SOC_GROUND}
        stroke={TEAL}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeInOut' }}
      />
      {SOC_TIERS.map((tier, i) => (
        <motion.path
          key={i}
          d={socTier(tier)}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.15 + i * 0.3, duration: 0.3, ease: 'easeInOut' }}
        />
      ))}

      {/* Crown (top tier). */}
      <motion.g
        style={{ transformBox: 'view-box' }}
        initial={reduce ? false : { y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={drop(1.05)}
      >
        <path d={SOC_CROWN} />
      </motion.g>

      {/* Middle tier — the spire institution drops in, then fades to the temple. */}
      {!reduce && (
        <motion.g
          style={{ transformBox: 'view-box' }}
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: [1, 1, 0] }}
          transition={{ y: drop(1.17), opacity: { delay: SOC_SWAP, duration: 0.4, times: [0, 0.01, 1] } }}
        >
          <path d="M 467 285 H 557 V 315 H 467 Z" />
          <path d="M 492 285 L 512 255 L 532 285" />
        </motion.g>
      )}
      <motion.g
        style={{ transformBox: 'view-box' }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0 } : { delay: SOC_SWAP + 0.05, duration: 0.4 }}
      >
        <path d="M 467 278 L 512 255 L 557 278" />
        <path d="M 467 278 H 557" />
        <path d="M 485 278 V 315 M 512 278 V 315 M 539 278 V 315" />
        <path d="M 467 315 H 557" />
      </motion.g>

      {/* Bottom tier — the populace, three circles, left to right. */}
      {[392, 512, 632].map((cx, i) => (
        <motion.g
          key={cx}
          style={{ transformBox: 'view-box' }}
          initial={reduce ? false : { y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={drop(1.29 + i * 0.12)}
        >
          <circle cx={cx} cy={375} r={26} />
        </motion.g>
      ))}
    </Frame>
  );
}

// ─────────────────────────── technology ──────────────────────────
// One cluster of houses sits alone; a railroad draws out into empty land and a
// locomotive runs it to the terminus — and only then does the second cluster
// spring up around the line, plus one more house. The town exists because the
// railroad came.

const TECH_P: [number, number][] = [[300, 210], [450, 240], [590, 320], [740, 350]];
function techCub(t: number): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * mt * TECH_P[0][0] + 3 * mt * mt * t * TECH_P[1][0] + 3 * mt * t * t * TECH_P[2][0] + t * t * t * TECH_P[3][0],
    mt * mt * mt * TECH_P[0][1] + 3 * mt * mt * t * TECH_P[1][1] + 3 * mt * t * t * TECH_P[2][1] + t * t * t * TECH_P[3][1],
  ];
}
function techDer(t: number): [number, number] {
  const mt = 1 - t;
  return [
    3 * mt * mt * (TECH_P[1][0] - TECH_P[0][0]) + 6 * mt * t * (TECH_P[2][0] - TECH_P[1][0]) + 3 * t * t * (TECH_P[3][0] - TECH_P[2][0]),
    3 * mt * mt * (TECH_P[1][1] - TECH_P[0][1]) + 6 * mt * t * (TECH_P[2][1] - TECH_P[1][1]) + 3 * t * t * (TECH_P[3][1] - TECH_P[2][1]),
  ];
}
function techNormal(t: number): [number, number] {
  const [dx, dy] = techDer(t);
  const L = Math.hypot(dx, dy) || 1;
  return [-dy / L, dx / L];
}
function techAngle(t: number): number {
  const [dx, dy] = techDer(t);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
const TECH_RAIL_OFF = 11;
function techRailPath(sign: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const [x, y] = techCub(t);
    const [nx, ny] = techNormal(t);
    pts.push(`${i ? 'L' : 'M'} ${(x + sign * nx * TECH_RAIL_OFF).toFixed(1)} ${(y + sign * ny * TECH_RAIL_OFF).toFixed(1)}`);
  }
  return pts.join(' ');
}
const TECH_RAIL_L = techRailPath(1);
const TECH_RAIL_R = techRailPath(-1);
const TECH_TIE_HALF = 17;
const TECH_TIES: [number, number, number, number][] = Array.from({ length: 14 }, (_, i) => {
  const t = (i + 0.5) / 14;
  const [x, y] = techCub(t);
  const [nx, ny] = techNormal(t);
  return [x + nx * TECH_TIE_HALF, y + ny * TECH_TIE_HALF, x - nx * TECH_TIE_HALF, y - ny * TECH_TIE_HALF];
});
const TECH_CL_A: [number, number][] = [[140, 150], [250, 130], [185, 240]];
const TECH_CL_B: [number, number][] = [[790, 380], [895, 400], [845, 300]];
const TECH_LOCO = 1.2;             // slides for 1.4s, so it arrives at ~2.6s
const TECH_ARRIVE = TECH_LOCO + 1.4;
const TECH_TOTAL = TECH_ARRIVE + 3 * 0.2 + 0.6; // cluster B (staggered) then the expansion house

function TechScene({ reduce, onComplete }: { reduce: boolean | null; onComplete?: () => void }) {
  // The locomotive follows the guide path (position + tangent) via a 0→1 value.
  const prog = useMotionValue(reduce ? 1 : 0);
  const lx = useTransform(prog, (t) => techCub(t)[0]);
  const ly = useTransform(prog, (t) => techCub(t)[1]);
  const lrot = useTransform(prog, (t) => techAngle(t));
  useEffect(() => {
    if (reduce) return;
    const a = animate(prog, 1, { delay: TECH_LOCO, duration: 1.4, ease: 'easeInOut' });
    return () => a.stop();
  }, [reduce, prog]);

  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reduce) { onComplete?.(); return; }
    const t = window.setTimeout(() => onComplete?.(), TECH_TOTAL * 1000);
    return () => clearTimeout(t);
  }, [reduce, onComplete]);

  const popHouse = (delay: number) => (reduce ? { duration: 0 } : { delay, type: 'spring' as const, stiffness: 480, damping: 14 });

  return (
    <Frame label="A cluster of houses; a railroad draws into empty land and a locomotive runs it, and only then a second cluster of houses springs up around the terminus">
      {/* Track (teal): the rails draw out from the Cluster A end, then ties appear. */}
      {[TECH_RAIL_L, TECH_RAIL_R].map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke={TEAL}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.7, duration: 1.0, ease: 'easeInOut' }}
        />
      ))}
      {TECH_TIES.map((s, i) => (
        <motion.line
          key={i}
          x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]}
          stroke={TEAL}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.8 + i * 0.04, duration: 0.2 }}
        />
      ))}

      {/* Cluster A — the origin town, alone at the start. */}
      {TECH_CL_A.map(([x, y], i) => (
        <motion.g
          key={`a${i}`}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={popHouse(i * 0.1)}
        >
          <House x={x} y={y} size={BUILT_HOUSE} />
        </motion.g>
      ))}

      {/* Cluster B — springs up around the terminus only after the loco arrives. */}
      {TECH_CL_B.map(([x, y], i) => (
        <motion.g
          key={`b${i}`}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={popHouse(TECH_ARRIVE + i * 0.2)}
        >
          <House x={x} y={y} size={BUILT_HOUSE} />
        </motion.g>
      ))}

      {/* One expansion house — last, once the new town has taken root. */}
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={popHouse(TECH_ARRIVE + 3 * 0.2 + 0.1)}
      >
        <House x={720} y={460} size={BUILT_HOUSE} />
      </motion.g>

      {/* The locomotive — stroke-only, follows the guide path and its tangent. */}
      <motion.g
        style={{ x: lx, y: ly, rotate: lrot, transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0 } : { delay: TECH_LOCO, duration: 0.2 }}
      >
        <path d="M -35 -18 H 35 V 18 H -35 Z" />
        <path d="M -24 -18 V -32 H -12 V -18" />
        <circle cx={-18} cy={18} r={11} />
        <circle cx={18} cy={18} r={11} />
      </motion.g>
    </Frame>
  );
}
