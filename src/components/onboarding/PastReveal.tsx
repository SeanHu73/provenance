'use client';

/**
 * The P.A.S.T. reveal — the first Context step's teaching beat.
 *
 * The sequence, and why it's shaped this way: the acronym is *typed* letter by
 * letter so the reader reads it as a word before it becomes a diagram. Then it
 * WAITS — there's no timed pause anymore. The reader's next swipe-down doesn't
 * advance the onboarding; it's captured here and plays the reveal instead: the
 * four letters physically travel out of the sentence and grow into the diagonal,
 * then each meaning fades in, then the closing line. Only once the reveal has
 * finished does a swipe-down move on to the next slide.
 *
 *   type P.A.S.T. → "framework." → [wait for swipe] → letters drift + grow into
 *   the diagonal → each meaning fades in → closing line
 *
 * The drift is a FLIP: the inline letters' positions are measured *before* the
 * layout changes, then each big letter is placed back at its old spot (translated
 * and scaled down) and released. Measuring after the swap would read the new
 * layout and animate from nowhere.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LENSES } from '@/features/context-journal/constants';

/** "P.A.S.T." as typed characters; the letters (not the dots) map to LENSES. */
const CHARS = ['P', '.', 'A', '.', 'S', '.', 'T', '.'];
const LETTER_AT = [0, 2, 4, 6]; // indices in CHARS that are lens initials

const START_MS = 0;       // typing starts as soon as the beat is on screen
const TYPE_MS = 170;      // per character
const FRAMEWORK_MS = 420; // beat before "framework." lands
const READY_MS = 250;     // after the sentence lands, before the swipe is armed
const DRIFT_MS = 950;

export default function PastReveal({ onDone }: { onDone?: () => void }) {
  const [typed, setTyped] = useState(0);
  const [framework, setFramework] = useState(false);
  const [ready, setReady] = useState(false);   // sentence has landed; swipe now reveals
  const [diagonal, setDiagonal] = useState(false);
  const [meanings, setMeanings] = useState(false);
  const [tail, setTail] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inlineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bigRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const firstRects = useRef<(DOMRect | null)[]>([]);
  const triggered = useRef(false);

  // `armed` latches once the beat is first seen (drives the type-out). `inView`
  // tracks live visibility so the swipe-capture only runs while this slide is up.
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      const vis = e.isIntersecting && e.intersectionRatio >= 0.5;
      setInView(vis);
      if (vis) setArmed(true);
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Type the acronym, land "framework.", then arm the swipe. No drift on a timer.
  useEffect(() => {
    if (!armed) return;
    const timers: number[] = [];
    CHARS.forEach((_, i) => timers.push(window.setTimeout(() => setTyped(i + 1), START_MS + i * TYPE_MS)));
    const typedDone = START_MS + CHARS.length * TYPE_MS;
    timers.push(window.setTimeout(() => setFramework(true), typedDone + FRAMEWORK_MS));
    timers.push(window.setTimeout(() => setReady(true), typedDone + FRAMEWORK_MS + READY_MS));
    return () => timers.forEach(clearTimeout);
  }, [armed]);

  // Kick off the drift: complete the sentence (in case they swiped mid-type),
  // measure the inline letters *before* the layout changes, then swap.
  const triggerReveal = useCallback(() => {
    if (triggered.current) return;
    triggered.current = true;
    setTyped(CHARS.length);
    setFramework(true);
    requestAnimationFrame(() => {
      firstRects.current = LETTER_AT.map((_, i) => inlineRefs.current[i]?.getBoundingClientRect() ?? null);
      setDiagonal(true);
    });
  }, []);

  // Once the reveal starts, stagger the meanings and the closing line off it.
  useEffect(() => {
    if (!diagonal) return;
    const timers: number[] = [];
    timers.push(window.setTimeout(() => setMeanings(true), DRIFT_MS * 0.7));
    timers.push(window.setTimeout(() => { setTail(true); onDone?.(); }, DRIFT_MS + 350));
    return () => timers.forEach(clearTimeout);
  }, [diagonal, onDone]);

  // Capture the down-swipe. While the slide is up and the sentence has landed but
  // the reveal hasn't finished, a downward gesture is swallowed (it does not
  // advance the onboarding): the first one plays the reveal; the rest are held
  // until it's done. Upward gestures pass through so they can scroll back.
  useEffect(() => {
    if (!inView || !ready || tail) return;
    const advance = (e: Event) => {
      e.preventDefault();
      if (!diagonal) triggerReveal();
    };
    const onWheel = (e: WheelEvent) => { if (e.deltaY > 0) advance(e); };
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? 0; };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? 0;
      if (touchY - y > 10) advance(e);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Spacebar') advance(e);
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [inView, ready, tail, diagonal, triggerReveal]);

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
        <p className="font-serif leading-snug" style={{ fontSize: 'clamp(26px, 7vw, 38px)', color: 'var(--th-journal)', maxWidth: '17ch' }}>
          We break down context by using
          {!diagonal ? (
            <>
              {' the '}
              <span className="font-display whitespace-nowrap" style={{ fontWeight: 700 }}>
                {CHARS.map((c, i) => {
                  const lensIdx = LETTER_AT.indexOf(i);
                  const colour = lensIdx >= 0 ? LENSES[lensIdx].colour : 'var(--th-journal)';
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

      {/* Before the reveal: a swipe-down cue, since the swipe now plays the
          animation rather than turning the page. Fades out once it fires. */}
      {ready && !diagonal && (
        <div
          className="flex flex-col items-center gap-1.5 mt-16"
          style={{ opacity: 0.7, transition: 'opacity 300ms ease-out' }}
        >
          <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--th-journal)' }}>Swipe down</span>
          <svg className="animate-bounce" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--th-journal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      )}

      {/* The diagonal. Rendered only once the drift starts, so the letters have a
          real destination to be measured against. vw-based indent (not %) so
          w-fit measures the true box and mx-auto centres it. */}
      {diagonal && (
        <div className="w-fit mx-auto">
          {LENSES.map((lens, i) => (
            <div key={lens.key} className="flex items-baseline" style={{ marginLeft: `${i * 6}vw` }}>
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
        className="font-serif mt-8 leading-snug text-center"
        style={{
          fontSize: 'clamp(20px, 5.4vw, 27px)', color: 'var(--th-journal)', maxWidth: '26ch', marginInline: 'auto',
          opacity: tail ? 0.92 : 0,
          transform: tail ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity 700ms ease-out, transform 700ms ease-out',
        }}
      >
        These lenses help you <strong style={{ fontSize: '1.25em' }}>ASK</strong> about the world in big pictures.
      </p>
    </div>
  );
}
