'use client';

/**
 * PastLensAnimation — an animated line-art illustration for a P.A.S.T. lens.
 *
 * This file is the shared foundation + the **place** animation only; the other
 * three lenses render nothing for now.
 *
 * Style (all lenses): rust (#A33829) stroke-only line art on a transparent
 * background — the parent supplies the cream (#F8F8EC) canvas — with a uniform
 * ~8px stroke in a 1024×560 frame, round caps and joins, no fills and no text.
 * The river is the one exception: a thicker deep-teal stroke so it reads as a body
 * of water. The draw-on is Framer Motion's `pathLength` sweep (the
 * stroke-dasharray / stroke-dashoffset technique). Each animation is two beats:
 * Beat 1 draws the cause; Beat 2 staggers in the effect. It plays once on mount,
 * holds the final frame, and calls `onComplete`. prefers-reduced-motion renders
 * the final frame with no motion. The SVG scales to its container's width.
 */

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type PastLens = 'place' | 'affairs' | 'society' | 'technology';

const STROKE = '#A33829';       // rust — the line-art colour
const SW = 8;                   // uniform stroke width
const RIVER_COLOR = '#5E93AE';  // a lighter water-blue that reads clearly against the cream
const RIVER_SW = 28;            // ~3.5× the house stroke: unmistakably a body of water
const VB_W = 1024;
const VB_H = 560;

// place geometry
const HOUSE_W = 52;                        // uniform house width
const HOUSE_TOTAL_H = HOUSE_W * 1.62;      // body + roof
const WHEAT_H = HOUSE_TOTAL_H * 0.4;       // stalks ~40% of house height
const WHEAT_SW = SW * 0.4;                 // line weight scaled to match at the smaller size

// place timeline (seconds)
const BEAT1 = 1.2;             // the river draws on
const BEAT2 = BEAT1 + 0.05;    // houses begin as the river lands
const HOUSE_STAGGER = 0.1;
const WHEAT_STAGGER = 0.05;
const WHEAT_FADE = 0.5;

/** One thick winding river — an S-curve running the full frame, top to bottom. */
const RIVER_D =
  'M 720 -20 C 700 110 470 130 450 250 C 432 360 690 370 640 470 C 606 535 360 520 300 580';

/**
 * House centres, hand-placed and pre-verified (see below): no two are closer than
 * 1.5× house width, none crosses the river stroke, and all sit inside the frame
 * with at least half a house width of margin. They hug both banks, ordered
 * top→bottom so they pop in following the river's flow.
 */
const HOUSES: [number, number][] = [
  [559, 46], [766, 68], [462, 107], [670, 157], [577, 212], [380, 215],
  [634, 319], [410, 355], [719, 416], [504, 422], [385, 466],
];

/** Ten wheat stalks clustered in the open land bottom-right, clear of the river
 *  and the houses. (x, y) is each stalk's base. */
const WHEAT: [number, number][] = [
  [900, 435], [880, 475], [860, 435], [920, 475], [940, 435],
  [840, 475], [880, 395], [900, 515], [920, 395], [860, 515],
];

/** Which lenses have an animation implemented (the rest render nothing for now). */
export function hasPastLensAnimation(lens: PastLens): boolean {
  return lens === 'place';
}

/**
 * A stroke-only house — a square body with a triangle roof, centred at (x, y);
 * `size` is the body's width. No windows or doors. Meant to sit inside a group the
 * caller can pop in.
 */
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
      {/* square body */}
      <path d={`M ${left} ${bodyTop} H ${right} V ${bottom} H ${left} Z`} />
      {/* triangle roof sitting on the body's top edge */}
      <path d={`M ${left} ${bodyTop} L ${x} ${apexY} L ${right} ${bodyTop}`} />
    </>
  );
}

/** A single wheat stalk: a vertical stem with three short angled strokes per side,
 *  drawn at its own (reduced) stroke width so it reads consistently at this size. */
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

interface Props {
  lens: PastLens;
  onComplete?: () => void;
}

export default function PastLensAnimation({ lens, onComplete }: Props) {
  const reduce = useReducedMotion();
  const isPlace = lens === 'place';

  // Dev-only guard: verify the hardcoded houses keep the 1.5×-width minimum, so a
  // future edit to the array can't silently reintroduce overlaps.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' || !isPlace) return;
    const min = 1.5 * HOUSE_W;
    for (let i = 0; i < HOUSES.length; i++) {
      for (let j = i + 1; j < HOUSES.length; j++) {
        const d = Math.hypot(HOUSES[i][0] - HOUSES[j][0], HOUSES[i][1] - HOUSES[j][1]);
        if (d < min) console.warn(`[PastLensAnimation] houses ${i} & ${j} are ${d.toFixed(0)}px apart (< ${min})`);
      }
    }
  }, [isPlace]);

  // Fire onComplete once, after the whole sequence. Non-place lenses (and reduced
  // motion) complete straight away so callers are never left waiting.
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    if (!isPlace || reduce) { doneRef.current = true; onComplete?.(); return; }
    doneRef.current = true;
    const wheatStart = BEAT2 + HOUSES.length * HOUSE_STAGGER + 0.15;
    const total = wheatStart + (WHEAT.length - 1) * WHEAT_STAGGER + WHEAT_FADE + 0.15;
    const t = window.setTimeout(() => onComplete?.(), total * 1000);
    return () => clearTimeout(t);
  }, [isPlace, reduce, onComplete]);

  if (!isPlace) return null;

  const wheatStart = BEAT2 + HOUSES.length * HOUSE_STAGGER + 0.15;

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
      aria-label="A map seen from above: a river with houses along its banks and a field of wheat"
    >
      {/* Beat 1 — the river draws on, top to bottom. */}
      <motion.path
        d={RIVER_D}
        stroke={RIVER_COLOR}
        strokeWidth={RIVER_SW}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: BEAT1, ease: 'easeInOut' }}
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
            : { delay: BEAT2 + i * HOUSE_STAGGER, type: 'spring', stiffness: 520, damping: 15 }}
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
          transition={reduce ? { duration: 0 } : { delay: wheatStart + i * WHEAT_STAGGER, duration: WHEAT_FADE }}
        >
          <Wheat x={wx} yBottom={wy} height={WHEAT_H} strokeWidth={WHEAT_SW} />
        </motion.g>
      ))}
    </svg>
  );
}
