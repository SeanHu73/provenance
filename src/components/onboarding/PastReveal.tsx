'use client';

/**
 * The P.A.S.T. reveal — the first Context step's teaching beat. It plays itself;
 * there is nothing to tap.
 *
 * The sequence, and why it's shaped this way: the acronym is *typed* letter by
 * letter so the reader reads it as a word before it becomes a diagram, then holds
 * for a beat so the sentence lands, then the four letters physically travel out of
 * the sentence and grow into the diagonal. That travel is the point — it's what
 * makes "P.A.S.T." and the four lenses register as the same object rather than two
 * unrelated slides. Their meanings arrive after, so the reader isn't decoding a
 * diagram while it's still moving.
 *
 *   type P.A.S.T. → "framework." → hold 2.5s → letters drift + grow into the
 *   diagonal → each meaning fades in → closing line
 *
 * The drift is a FLIP: the inline letters' positions are measured *before* the
 * layout changes, then each big letter is placed back at its old spot (translated
 * and scaled down) and released. Measuring after the swap would read the new
 * layout and animate from nowhere.
 */

import { useEffect, useRef, useState } from 'react';
import { LENSES } from '@/features/context-journal/constants';

/** "P.A.S.T." as typed characters; the letters (not the dots) map to LENSES. */
const CHARS = ['P', '.', 'A', '.', 'S', '.', 'T', '.'];
const LETTER_AT = [0, 2, 4, 6]; // indices in CHARS that are lens initials

const START_MS = 1000;    // sit still for a beat before the typing starts
const TYPE_MS = 170;      // per character
const FRAMEWORK_MS = 420; // beat before "framework." lands
const HOLD_MS = 3500;     // the pause, before anything moves
const DRIFT_MS = 950;

export default function PastReveal({ onDone }: { onDone?: () => void }) {
  const [typed, setTyped] = useState(0);
  const [framework, setFramework] = useState(false);
  const [diagonal, setDiagonal] = useState(false);
  const [meanings, setMeanings] = useState(false);
  const [tail, setTail] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inlineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bigRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const firstRects = useRef<(DOMRect | null)[]>([]);

  // Only start once the beat is actually on screen — otherwise it plays out while
  // the reader is still a slide above and they arrive at a finished diagram.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio >= 0.5) setArmed(true); }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The timeline. Every stage is a timer off the same start, cleared together.
  useEffect(() => {
    if (!armed) return;
    const timers: number[] = [];
    CHARS.forEach((_, i) => timers.push(window.setTimeout(() => setTyped(i + 1), START_MS + i * TYPE_MS)));
    const typedDone = START_MS + CHARS.length * TYPE_MS;
    timers.push(window.setTimeout(() => setFramework(true), typedDone + FRAMEWORK_MS));

    // Measure the inline letters *before* the layout changes, then swap.
    timers.push(window.setTimeout(() => {
      firstRects.current = LETTER_AT.map((_, i) => inlineRefs.current[i]?.getBoundingClientRect() ?? null);
      setDiagonal(true);
    }, typedDone + FRAMEWORK_MS + HOLD_MS));

    timers.push(window.setTimeout(() => setMeanings(true), typedDone + FRAMEWORK_MS + HOLD_MS + DRIFT_MS * 0.7));
    timers.push(window.setTimeout(() => { setTail(true); onDone?.(); }, typedDone + FRAMEWORK_MS + HOLD_MS + DRIFT_MS + 350));
    return () => timers.forEach(clearTimeout);
  }, [armed, onDone]);

  // FLIP: put each big letter back where its inline twin was, then release it.
  useEffect(() => {
    if (!diagonal) return;
    const id = requestAnimationFrame(() => {
      bigRefs.current.forEach((el, i) => {
        const first = firstRects.current[i];
        if (!el || !first) return;
        const last = el.getBoundingClientRect();
        if (!last.height) return;
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        const scale = first.height / last.height;
        el.style.transformOrigin = 'top left';
        el.style.transition = 'none';
        el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
        el.style.opacity = '1';
        requestAnimationFrame(() => {
          el.style.transition = `transform ${DRIFT_MS}ms cubic-bezier(0.22, 0.9, 0.24, 1)`;
          el.style.transform = 'none';
        });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [diagonal]);

  return (
    <div ref={rootRef} className="relative w-full">
      {/* The sentence stays — it's the heading for the diagram below, not a step to
          be cleared. Only its tail changes: once the letters fly out, "the P.A.S.T.
          framework." is replaced by an ellipsis, leaving "We break down context by
          using…". The swap is invisible because the big letters appear at the exact
          pixels the inline ones occupied. */}
      <div className="mb-8">
        <p className="font-serif leading-snug" style={{ fontSize: 'clamp(26px, 7vw, 38px)', color: 'var(--th-surface)', maxWidth: '17ch' }}>
          We break down context by using
          {!diagonal ? (
            <>
              {' the '}
              <span className="font-display whitespace-nowrap" style={{ fontWeight: 700 }}>
                {CHARS.map((c, i) => {
                  const lensIdx = LETTER_AT.indexOf(i);
                  const colour = lensIdx >= 0 ? LENSES[lensIdx].colour : 'var(--th-surface)';
                  return (
                    <span
                      key={i}
                      ref={(el) => { if (lensIdx >= 0) inlineRefs.current[lensIdx] = el; }}
                      style={{ color: colour, opacity: i < typed ? 1 : 0, transition: 'opacity 90ms linear' }}
                    >
                      {c}
                    </span>
                  );
                })}
              </span>
              <span style={{ opacity: framework ? 1 : 0, transition: 'opacity 500ms ease-out' }}> framework.</span>
            </>
          ) : (
            <span>&hellip;</span>
          )}
        </p>
      </div>

      {/* The diagonal. Rendered only once the drift starts, so the letters have a
          real destination to be measured against. */}
      {diagonal && (
        <div className="w-fit">
          {LENSES.map((lens, i) => (
            // Starts further in and steps further per line than the acronym's own
            // width would suggest — the diagonal reads as a diagram, not a list.
            <div key={lens.key} className="flex items-baseline" style={{ marginLeft: `${10 + i * 15}%` }}>
              <span
                ref={(el) => { bigRefs.current[i] = el; }}
                className="font-display leading-none"
                style={{ color: lens.colour, fontSize: 'clamp(52px, 17vw, 104px)', opacity: 0, willChange: 'transform', display: 'inline-block' }}
              >
                {lens.label[0]}
              </span>
              <span
                className="font-display leading-none"
                style={{
                  color: lens.colour, fontSize: 'clamp(23px, 6.8vw, 40px)',
                  opacity: meanings ? 1 : 0,
                  transform: meanings ? 'translateX(0)' : 'translateX(-8px)',
                  transition: `opacity 450ms ease-out ${i * 110}ms, transform 450ms ease-out ${i * 110}ms`,
                }}
              >
                {lens.label.slice(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p
        className="font-serif mt-8 leading-snug"
        style={{
          fontSize: 'clamp(20px, 5.4vw, 27px)', color: 'var(--th-surface)', maxWidth: '24ch',
          opacity: tail ? 0.92 : 0,
          transform: tail ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 700ms ease-out, transform 700ms ease-out',
        }}
      >
        These help you <strong style={{ fontSize: '1.25em' }}>ASK</strong> about the world through big picture lenses.
      </p>
    </div>
  );
}
