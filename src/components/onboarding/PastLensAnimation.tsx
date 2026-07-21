'use client';

/**
 * PastLensAnimation — animated line-art illustrations for the P.A.S.T. lenses.
 *
 * Implemented: **place** and **affairs**. Society and technology render nothing
 * for now.
 *
 * Style (all lenses): rust (#A33829) stroke-only line art on a transparent
 * background — the parent supplies the cream (#F8F8EC) canvas — with a uniform
 * ~8px stroke in a 1024×560 frame, round caps and joins, no fills and no text.
 * A second, cool accent (#5E93AE — the same water-blue Place uses for its river)
 * marks the one "natural / structural" element per lens (Place's river, Affairs'
 * border), so the two-colour system stays consistent across lenses. The draw-on
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
const ACCENT = '#5E93AE';       // cool accent (shared: Place river + Affairs border)
const VB_W = 1024;
const VB_H = 560;

/** Which lenses have an animation implemented (the rest render nothing for now). */
export function hasPastLensAnimation(lens: PastLens): boolean {
  return lens === 'place' || lens === 'affairs';
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

// ──────────────────────────── affairs ────────────────────────────
// Two sides in conflict: a dashed border draws down the middle, flags plant, the
// crossed swords draw and clash — then the border kinks rightward past the swords
// and the losing (left) flag tilts.

// verified geometry (see scratchpad/affairs.js): centre (512,280), blades 110,
// guards 36, all inside the frame, blades crossing at their midpoints.
const SWORD1_D = 'M 480.5 325.1 L 543.5 234.9 M 481.5 292.2 L 511 312.9';
const SWORD2_D = 'M 543.5 325.1 L 480.5 234.9 M 513 312.9 L 542.5 292.2';

// timeline (seconds)
const A_CLIP = 0.9;      // border reveal (Beat 1)
const A_FLAG_L = 0.15;
const A_FLAG_R = 0.30;
const A_SWORD1 = 0.55;
const A_SWORD_DUR = 0.25;
const A_SWORD2 = 0.85;
const A_PULSE = 1.15;
const A_PULSE_DUR = 0.35;
const A_MORPH = 1.75;    // Beat 2 border morph, ~0.3s after the pulse settles
const A_MORPH_DUR = 1.0;
const A_TILT = 1.95;     // left flag tilts as the border passes

/** The border: a vertical divider at x=512 that bows right by `bow` between
 *  y≈180 and y≈380 (peak at y=280). bow 0 = straight, 120 = kinked. Same command
 *  structure at every bow, so it interpolates cleanly. */
function borderPath(bow: number): string {
  const x = 512;
  const px = (x + bow).toFixed(2);
  const xs = x.toFixed(1);
  return `M ${xs} 0 C ${xs} 60 ${xs} 120 ${xs} 180 `
    + `C ${xs} 213 ${px} 247 ${px} 280 `
    + `C ${px} 313 ${xs} 347 ${xs} 380 `
    + `C ${xs} 440 ${xs} 500 ${xs} 560`;
}

function AffairsScene({ reduce, onComplete }: { reduce: boolean | null; onComplete?: () => void }) {
  // Beat 2 — morph the border straight → kinked by animating a 0→1 value and
  // rebuilding the path from it (identical command structure both ends).
  const morph = useMotionValue(reduce ? 1 : 0);
  const borderD = useTransform(morph, (t) => borderPath(t * 120));
  useEffect(() => {
    if (reduce) return;
    const controls = animate(morph, 1, { delay: A_MORPH, duration: A_MORPH_DUR, ease: 'easeInOut' });
    return () => controls.stop();
  }, [reduce, morph]);

  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reduce) { onComplete?.(); return; }
    const total = (A_MORPH + A_MORPH_DUR + 0.2) * 1000;
    const t = window.setTimeout(() => onComplete?.(), total);
    return () => clearTimeout(t);
  }, [reduce, onComplete]);

  return (
    <Frame label="Two territories divided by a border, their crossed swords and flags; the border shifts as one side gives way">
      <defs>
        <clipPath id="affairs-border-clip">
          {/* grows downward (scaleY from the top) to draw the dashed border top→bottom
              while keeping its dash pattern intact */}
          <motion.rect
            x={0} y={0} width={VB_W} height={VB_H}
            style={{ transformBox: 'view-box', transformOrigin: '0px 0px' }}
            initial={reduce ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={reduce ? { duration: 0 } : { duration: A_CLIP, ease: 'easeOut' }}
          />
        </clipPath>
      </defs>

      {/* Beat 1 — the dashed border, revealed top→bottom; Beat 2 — it kinks right. */}
      <motion.path
        d={borderD}
        clipPath="url(#affairs-border-clip)"
        stroke={ACCENT}
        strokeWidth={SW}
        strokeDasharray="24 16"
      />

      {/* Flags. Both plant (scale up from the pole base); the left one later tilts. */}
      <motion.g
        style={{ transformBox: 'view-box', transformOrigin: '300px 350px' }}
        initial={reduce ? false : { scale: 0, rotate: 0 }}
        animate={{ scale: 1, rotate: 28 }}
        transition={reduce ? { duration: 0 } : {
          scale: { delay: A_FLAG_L, type: 'spring', stiffness: 480, damping: 14 },
          rotate: { delay: A_TILT, type: 'spring', stiffness: 110, damping: 11 },
        }}
      >
        <line x1={300} y1={350} x2={300} y2={230} />
        <path d="M 300 230 L 370 250 L 300 270 Z" />
      </motion.g>

      <motion.g
        style={{ transformBox: 'view-box', transformOrigin: '724px 350px' }}
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={reduce ? { duration: 0 } : { delay: A_FLAG_R, type: 'spring', stiffness: 480, damping: 14 }}
      >
        <line x1={724} y1={350} x2={724} y2={230} />
        <path d="M 724 230 L 654 250 L 724 270 Z" />
      </motion.g>

      {/* Crossed swords — each draws on, then the pair scale-pulses to mark the clash. */}
      <motion.g
        style={{ transformBox: 'view-box', transformOrigin: '512px 280px' }}
        initial={reduce ? false : { scale: 1 }}
        animate={reduce ? { scale: 1 } : { scale: [1, 1.15, 1] }}
        transition={reduce ? { duration: 0 } : { delay: A_PULSE, duration: A_PULSE_DUR, times: [0, 0.5, 1], ease: 'easeInOut' }}
      >
        <motion.path
          d={SWORD1_D}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { delay: A_SWORD1, duration: A_SWORD_DUR, ease: 'easeInOut' }}
        />
        <motion.path
          d={SWORD2_D}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { delay: A_SWORD2, duration: A_SWORD_DUR, ease: 'easeInOut' }}
        />
      </motion.g>
    </Frame>
  );
}
