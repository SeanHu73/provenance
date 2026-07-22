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

// The built lenses (affairs, technology) share a house size; its base sits on the
// scene's ground line.
const BUILT_HOUSE = 64;
const BUILT_HOUSE_HALF_H = (BUILT_HOUSE + BUILT_HOUSE * 0.62) / 2;
const GROUND_Y = 420;
const HOUSE_BASE_Y = GROUND_Y - BUILT_HOUSE_HALF_H; // house centre so its base rests on the ground

/** A stroke-only rectangle centred on cx, from `top` to `bottom`. Same command
 *  structure at any size, so two of these interpolate cleanly (used for the
 *  rebuilt building's morph). */
function rectPath(cx: number, halfW: number, top: number, bottom: number): string {
  return `M ${(cx - halfW).toFixed(1)} ${top} H ${(cx + halfW).toFixed(1)} V ${bottom} H ${(cx - halfW).toFixed(1)} Z`;
}

// ──────────────────────────── affairs ────────────────────────────
// An earthquake: a town stands on flat ground, the ground cracks and the whole
// scene shakes, the tall building's top shears off and a house tilts — then the
// town rebuilds, differently: a shorter, wider building and a house moved along.

const BLDG_CX = 580;

// The ground: flat at both ends, a zigzag crack (±14px) between x=200 and x=820.
// [x, yOffset]; a 0→1 value scales the offset, so flat (0) morphs into the crack (1).
const EQ_CRACK: [number, number][] = [
  [60, 0], [200, 0], [289, -14], [378, 14], [467, -14],
  [556, 14], [645, -14], [734, 14], [820, 0], [964, 0],
];
function eqGroundPath(t: number): string {
  return EQ_CRACK.map(([x, off], i) => `${i ? 'L' : 'M'} ${x} ${(GROUND_Y + off * t).toFixed(1)}`).join(' ');
}

// affairs timeline (seconds)
const EQ_HOUSE_STAGGER = 0.1;
const EQ_BUILDING = 0.45;   // the tall building pops in last
const EQ_SHAKE = 0.75;      // crack forms + scene jitters
const EQ_SHAKE_DUR = 0.8;
const EQ_CRACK_DUR = 0.6;
const EQ_FALL = 1.55;       // the top shears off as the jitter ends
const EQ_FALL_DUR = 0.5;
const EQ_B2 = 2.55;         // rebuild starts after a ~0.5s pause on the damage
const EQ_FADE_DUR = 0.4;
const EQ_UNCRACK = EQ_B2 + 0.1;
const EQ_REBUILD = EQ_B2 + 0.4;
const EQ_REBUILD_DUR = 0.6;
const EQ_NEW_PED = EQ_REBUILD + EQ_REBUILD_DUR;
const EQ_NEW_B = EQ_NEW_PED + 0.1;
const EQ_TOTAL = EQ_NEW_B + 0.6;

function AffairsScene({ reduce, onComplete }: { reduce: boolean | null; onComplete?: () => void }) {
  // The ground morphs flat ↔ cracked; the lower building morphs 120×120 → 170×110.
  const crack = useMotionValue(0);
  const groundD = useTransform(crack, (t) => eqGroundPath(t));
  const rebuild = useMotionValue(reduce ? 1 : 0);
  const lowerD = useTransform(rebuild, (t) => rectPath(BLDG_CX, 60 + 25 * t, 300 - 10 * t, GROUND_Y));

  useEffect(() => {
    if (reduce) return;
    const a1 = animate(crack, 1, { delay: EQ_SHAKE, duration: EQ_CRACK_DUR, ease: 'easeIn' });
    const a2 = animate(crack, 0, { delay: EQ_UNCRACK, duration: 0.5, ease: 'easeInOut' });
    const a3 = animate(rebuild, 1, { delay: EQ_REBUILD, duration: EQ_REBUILD_DUR, ease: 'easeInOut' });
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [reduce, crack, rebuild]);

  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reduce) { onComplete?.(); return; }
    const t = window.setTimeout(() => onComplete?.(), EQ_TOTAL * 1000);
    return () => clearTimeout(t);
  }, [reduce, onComplete]);

  return (
    <Frame label="A town on flat ground; an earthquake cracks the ground and shears the top off a building, then the town rebuilds shorter and wider">
      {/* The whole scene jitters on the x-axis during the quake. */}
      <motion.g
        animate={reduce ? {} : { x: [0, -8, 9, -7, 6, -4, 2, 0] }}
        transition={reduce ? { duration: 0 } : { delay: EQ_SHAKE, duration: EQ_SHAKE_DUR, ease: 'linear' }}
      >
        {/* Ground (teal): draws on flat, cracks in Beat 1, heals in Beat 2. */}
        <motion.path
          d={groundD}
          stroke={TEAL}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeInOut' }}
        />

        {/* Houses A and C — upright throughout. */}
        {[240, 790].map((hx, i) => (
          <motion.g
            key={hx}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            initial={reduce ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { delay: i * EQ_HOUSE_STAGGER, type: 'spring', stiffness: 520, damping: 15 }}
          >
            <House x={hx} y={HOUSE_BASE_Y} size={BUILT_HOUSE} />
          </motion.g>
        ))}

        {/* House B (original) — pops in, tilts 10° in the quake, fades before the rebuild. */}
        {!reduce && (
          <motion.g
            style={{ transformBox: 'view-box', transformOrigin: `380px ${GROUND_Y}px` }}
            initial={{ scale: 0, opacity: 1, rotate: 0 }}
            animate={{ scale: 1, opacity: 0, rotate: 10 }}
            transition={{
              scale: { delay: EQ_HOUSE_STAGGER, type: 'spring', stiffness: 520, damping: 15 },
              rotate: { delay: EQ_FALL, type: 'spring', stiffness: 120, damping: 12 },
              opacity: { delay: EQ_B2, duration: EQ_FADE_DUR },
            }}
          >
            <House x={380} y={HOUSE_BASE_Y} size={BUILT_HOUSE} />
          </motion.g>
        )}

        {/* Tall building — lower section persists and rebuilds wider. */}
        <motion.path
          d={lowerD}
          style={{ transformBox: 'view-box', transformOrigin: `${BLDG_CX}px ${GROUND_Y}px` }}
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={reduce ? { duration: 0 } : { delay: EQ_BUILDING, type: 'spring', stiffness: 420, damping: 16 }}
        />

        {/* Upper section + pediment — pops in, shears off (rotate + fall) in Beat 1,
            fades out in Beat 2. Outer group scales/fades; inner group falls. */}
        {!reduce && (
          <motion.g
            style={{ transformBox: 'view-box', transformOrigin: `${BLDG_CX}px 300px` }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1, opacity: 0 }}
            transition={{
              scale: { delay: EQ_BUILDING, type: 'spring', stiffness: 420, damping: 16 },
              opacity: { delay: EQ_B2, duration: EQ_FADE_DUR },
            }}
          >
            <motion.g
              style={{ transformBox: 'view-box', transformOrigin: '520px 300px' }}
              initial={{ rotate: 0, x: 0, y: 0 }}
              animate={{ rotate: 18, x: 150, y: [0, 124, 120] }}
              transition={{ delay: EQ_FALL, duration: EQ_FALL_DUR, ease: 'easeIn', y: { times: [0, 0.82, 1] } }}
            >
              <path d={rectPath(BLDG_CX, 60, 220, 300)} />
              <path d="M 520 220 L 580 170 L 640 220" />
            </motion.g>
          </motion.g>
        )}

        {/* Rebuilt: a wider, shorter pediment pops onto the widened lower section. */}
        <motion.g
          style={{ transformBox: 'view-box', transformOrigin: `${BLDG_CX}px 310px` }}
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={reduce ? { duration: 0 } : { delay: EQ_NEW_PED, type: 'spring', stiffness: 380, damping: 12 }}
        >
          <path d="M 495 310 L 580 270 L 665 310" />
        </motion.g>

        {/* House B rebuilt — upright, shifted to x=410 (a wider gap from House A). */}
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { delay: EQ_NEW_B, type: 'spring', stiffness: 420, damping: 12 }}
        >
          <House x={410} y={HOUSE_BASE_Y} size={BUILT_HOUSE} />
        </motion.g>
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
// Two clusters of houses sit far apart; a railroad draws between them, a
// locomotive runs the line, and each cluster grows a new house — connection
// produces growth.

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
const TECH_LOCO = 1.1;
const TECH_TOTAL = 3.5;

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
    <Frame label="Two clusters of houses joined by a railroad a locomotive runs along; each cluster then grows a new house">
      {/* Track (teal): two rails draw on together, then ties appear along them. */}
      {[TECH_RAIL_L, TECH_RAIL_R].map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke={TEAL}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 0.9, duration: 1.0, ease: 'easeInOut' }}
        />
      ))}
      {TECH_TIES.map((s, i) => (
        <motion.line
          key={i}
          x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]}
          stroke={TEAL}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={reduce ? { duration: 0 } : { delay: 1.0 + i * 0.04, duration: 0.2 }}
        />
      ))}

      {/* Cluster A, then Cluster B — pop in. */}
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
      {TECH_CL_B.map(([x, y], i) => (
        <motion.g
          key={`b${i}`}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={popHouse(0.4 + i * 0.1)}
        >
          <House x={x} y={y} size={BUILT_HOUSE} />
        </motion.g>
      ))}

      {/* Expansion houses — one per cluster, once the line is running. */}
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={popHouse(2.6)}
      >
        <House x={320} y={90} size={BUILT_HOUSE} />
      </motion.g>
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        initial={reduce ? false : { scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={popHouse(2.8)}
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
