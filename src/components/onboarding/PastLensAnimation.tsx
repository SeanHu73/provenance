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
 * The draw-on is Framer Motion's `pathLength` sweep (the stroke-dasharray /
 * stroke-dashoffset technique). Each animation is two beats: Beat 1 draws the
 * cause; Beat 2 staggers in the effect. It plays once on mount, holds the final
 * frame, and calls `onComplete`. prefers-reduced-motion renders the final frame
 * with no motion. The SVG scales to its container's width.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export type PastLens = 'place' | 'affairs' | 'society' | 'technology';

const STROKE = '#A33829';
const SW = 8;          // uniform stroke width
const RIVER_SW = 16;   // the river reads as a thick channel, not a line
const VB_W = 1024;
const VB_H = 560;

// place timeline (seconds)
const BEAT1 = 1.2;             // the river draws on
const BEAT2 = BEAT1 + 0.05;    // houses begin as the river lands
const HOUSE_STAGGER = 0.12;

/** One thick winding river — an S-curve running the full frame, top to bottom. */
const RIVER_D =
  'M 720 -20 C 700 110 470 130 450 250 C 432 360 690 370 640 470 C 606 535 360 520 300 580';

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

/** A single wheat stalk: a vertical stem with three short angled strokes per side. */
function Wheat({ x, yBottom, height }: { x: number; yBottom: number; height: number }) {
  const top = yBottom - height;
  const grains = [0.28, 0.5, 0.72].map((t) => yBottom - height * t);
  const len = 30;
  const rise = 24;
  return (
    <>
      <line x1={x} y1={yBottom} x2={x} y2={top} />
      {grains.map((gy, i) => (
        <g key={i}>
          <line x1={x} y1={gy} x2={x + len} y2={gy - rise} />
          <line x1={x} y1={gy} x2={x - len} y2={gy - rise} />
        </g>
      ))}
    </>
  );
}

interface Props {
  lens: PastLens;
  onComplete?: () => void;
}

export default function PastLensAnimation({ lens, onComplete }: Props) {
  const reduce = useReducedMotion();
  const riverRef = useRef<SVGPathElement>(null);
  const [houses, setHouses] = useState<{ x: number; y: number; size: number }[]>([]);
  const isPlace = lens === 'place';

  // Place the houses by sampling the river path, so they hug its banks and follow
  // its curves rather than being hand-placed against a shape that might change.
  useEffect(() => {
    if (!isPlace) return;
    const path = riverRef.current;
    if (!path) return;
    let total = 0;
    try { total = path.getTotalLength(); } catch { return; }
    if (!total) return;
    const N = 6;        // sample points → up to 2N candidates, trimmed to the frame
    const OFFSET = 64;  // how far off the river's centre each bank sits
    const out: { x: number; y: number; size: number }[] = [];
    for (let i = 0; i < N; i++) {
      const at = ((i + 0.5) / N) * total;
      const p = path.getPointAtLength(at);
      const ahead = path.getPointAtLength(Math.min(total, at + 8));
      let tx = ahead.x - p.x;
      let ty = ahead.y - p.y;
      const m = Math.hypot(tx, ty) || 1;
      tx /= m; ty /= m;
      const nx = -ty;   // unit normal to the flow
      const ny = tx;
      const size = 44 + (i % 3) * 8;
      out.push({ x: p.x + nx * OFFSET, y: p.y + ny * OFFSET, size });
      out.push({ x: p.x - nx * OFFSET, y: p.y - ny * OFFSET, size: size - 4 });
    }
    // Keep the ones comfortably inside the frame, then order top→bottom so they pop
    // in following the river's flow.
    const inFrame = out
      .filter((h) => h.x > 46 && h.x < VB_W - 46 && h.y > 42 && h.y < VB_H - 42)
      .sort((a, b) => a.y - b.y)
      .slice(0, 12);
    setHouses(inFrame);
  }, [isPlace]);

  // Fire onComplete once, after the whole sequence. Non-place lenses (and reduced
  // motion) complete straight away so callers are never left waiting.
  const doneRef = useRef(false);
  useEffect(() => {
    if (doneRef.current) return;
    if (!isPlace || reduce) { doneRef.current = true; onComplete?.(); return; }
    if (houses.length === 0) return; // wait until the houses have been placed
    doneRef.current = true;
    const end = BEAT2 + houses.length * HOUSE_STAGGER + 0.25 /* wheat delay */ + 0.6 /* wheat fade */ + 0.2;
    const t = window.setTimeout(() => onComplete?.(), end * 1000);
    return () => clearTimeout(t);
  }, [isPlace, reduce, houses.length, onComplete]);

  if (!isPlace) return null;

  const wheatDelay = BEAT2 + houses.length * HOUSE_STAGGER + 0.25;

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
      aria-label="A map seen from above: a river with houses along its banks"
    >
      {/* Beat 1 — the river draws on, top to bottom. */}
      <motion.path
        ref={riverRef}
        d={RIVER_D}
        strokeWidth={RIVER_SW}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: BEAT1, ease: 'easeInOut' }}
      />

      {/* Beat 2 — houses pop in one by one along both banks. */}
      {houses.map((h, i) => (
        <motion.g
          key={i}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduce
            ? { duration: 0 }
            : { delay: BEAT2 + i * HOUSE_STAGGER, type: 'spring', stiffness: 520, damping: 15 }}
        >
          <House x={h.x} y={h.y} size={h.size} />
        </motion.g>
      ))}

      {/* One wheat stalk out in the empty land, fading in last. */}
      <motion.g
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0 } : { delay: wheatDelay, duration: 0.6 }}
      >
        <Wheat x={880} yBottom={498} height={150} />
      </motion.g>
    </svg>
  );
}
