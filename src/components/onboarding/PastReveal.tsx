'use client';

/**
 * The P.A.S.T. reveal — the first Context step's teaching beat.
 *
 * The sequence, and why it's shaped this way: the acronym is *typed* letter by
 * letter so the reader reads it as a word before it becomes a diagram. Then it
 * WAITS — there's no timed pause. Once the beat is on screen the whole intro
 * scroller is *locked* (overflow hidden), so the reader can't page past it; their
 * next down-gesture is read as "reveal", not "next slide", and plays the drift:
 * the four letters travel out of the sentence and grow into the diagonal, then
 * each meaning fades in, then the closing line. Only once the reveal has finished
 * is the scroller unlocked, so the swipe after that advances as usual.
 *
 * Locking the scroller (rather than preventing wheel/touch events) is what makes
 * this reliable: an overflow-hidden element simply can't be scrolled by the user,
 * on trackpad or touch, so there's no gesture to lose.
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
const TYPE_MS = 85;       // per character
const FRAMEWORK_MS = 280; // beat before "framework." lands
const READY_MS = 180;     // after the sentence lands, before the swipe is armed
const DRIFT_MS = 950;

export default function PastReveal({ onDone }: { onDone?: () => void }) {
  const [typed, setTyped] = useState(0);
  const [framework, setFramework] = useState(false);
  const [ready, setReady] = useState(false);   // sentence has landed; a swipe now reveals
  const [diagonal, setDiagonal] = useState(false);
  const [meanings, setMeanings] = useState(false);
  const [tail, setTail] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inlineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const bigRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const firstRects = useRef<(DOMRect | null)[]>([]);
  const triggered = useRef(false);
  const readyRef = useRef(false);
  useEffect(() => { readyRef.current = ready; }, [ready]);

  // Both latch (never unset): `armed` once the beat is first seen (drives the
  // type-out); `settled` once this slide is essentially snapped into place, which
  // is when it's safe to lock the scroller. Latching `settled` matters — the
  // diagonal can grow taller than the viewport, and a live flag would drop and
  // wrongly unlock the scroller mid-reveal.
  const [armed, setArmed] = useState(false);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.5) setArmed(true);
      if (e.isIntersecting && e.intersectionRatio >= 0.85) setSettled(true);
    }, { threshold: [0, 0.5, 0.85, 1] });
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

  // Lock the intro scroller while this beat is up and the reveal hasn't finished,
  // and read any down-gesture as "reveal". The lock (overflow hidden) is what
  // guarantees the page can't turn past the beat — event handlers only *detect*
  // the intent; they don't have to fight the browser's scrolling.
  useEffect(() => {
    if (!settled || tail) return;
    const scroller = rootRef.current?.closest('[data-cj-intro-scroll]') as HTMLElement | null;
    const section = rootRef.current?.closest('section') as HTMLElement | null;
    let prevOverflow = '';
    let prevTouch = '';
    let locked = false;
    if (scroller) {
      if (section) scroller.scrollTop = section.offsetTop; // finish the snap, exactly
      prevOverflow = scroller.style.overflowY;
      prevTouch = scroller.style.touchAction;
      scroller.style.overflowY = 'hidden';
      scroller.style.touchAction = 'none';
      locked = true;
    }
    const onIntent = () => { if (readyRef.current) triggerReveal(); };
    const onWheel = (e: WheelEvent) => { if (e.deltaY > 0) onIntent(); };
    let ty = 0;
    const onTouchStart = (e: TouchEvent) => { ty = e.touches[0]?.clientY ?? 0; };
    const onTouchMove = (e: TouchEvent) => { if (ty - (e.touches[0]?.clientY ?? 0) > 8) onIntent(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Spacebar') onIntent();
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      if (locked && scroller) {
        scroller.style.overflowY = prevOverflow;
        scroller.style.touchAction = prevTouch;
      }
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [settled, tail, triggerReveal]);

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

      {/* Before the reveal: a swipe-down cue (also tappable), since the down-swipe
          now plays the animation rather than turning the page. Fades once it fires. */}
      {ready && !diagonal && (
        <button
          onClick={triggerReveal}
          className="flex flex-col items-center gap-1.5 mt-16 mx-auto bg-transparent border-0"
          style={{ opacity: 0.7 }}
          aria-label="Reveal the P.A.S.T. lenses"
        >
          <span className="text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--th-journal)' }}>Swipe down</span>
          <svg className="animate-bounce" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--th-journal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
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
