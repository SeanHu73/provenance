'use client';

/**
 * Context intro — an immersive snap-scroll shown at the start of the context step
 * (`act_context_intro`), on the rich dark journal surface.
 *
 * **First time** (six beats, and the only place the P.A.S.T. is ever taught now —
 * the intro onboarding hands it over):
 *   1. Sit down — settle before the teaching, so it comes before the teaching.
 *   2. "…the CONTEXT" — what you explored, then the world behind it.
 *   3. So how? — ask context questions.
 *   4. The P.A.S.T. reveal — plays itself; see PastReveal.
 *   5. The lenses as swipeable cards.
 *   6. Ready to think like a historian? → Yes! (ends on a button, no sentinel)
 *
 * **Returning** (`returning`): the short version — sit down, the CONTEXT title,
 * then scroll past the sentinel into the journal. No teaching, no button.
 *
 * Portaled to document.body so the fixed overlay escapes the Journal's
 * transformed (framer-motion) ancestor (Build_State §7).
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LENSES } from '@/features/context-journal/constants';
import PastReveal from '@/components/onboarding/PastReveal';

/** A distinct "context" accent for these immersive splashes — deliberately NOT
 *  --th-secondary (which equals the Attitudes lens colour), so CONTEXT and the
 *  CTA don't clash with the coloured P·A·S·T lenses. A warm coral, no lens uses it. */
export const CONTEXT_ACCENT = '#E08A5F';

/**
 * The four lenses as swipeable cards. The track is padded in from both edges so
 * the neighbouring cards always peek — that peek is the affordance; without it a
 * single centred card reads as the whole content and nobody swipes. The P.A.S.T.
 * indicator above tracks whichever card is centred, so the acronym just taught on
 * the previous slide stays connected to the card being read.
 */
function LensSlider() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // Nearest card to the track's centre wins — more forgiving than scroll maths,
  // and correct at both ends where a card can't actually reach the middle.
  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, bestD = Infinity;
    Array.from(track.children).forEach((c, i) => {
      const el = c as HTMLElement;
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    setActive((a) => (a === best ? a : best));
  };

  return (
    <div className="mt-7">
      {/* P.A.S.T. indicator — the active letter lights up, its lens named above. */}
      <div className="flex flex-col items-center gap-1">
        <span className="font-display leading-none" style={{ fontSize: 'clamp(17px, 4.4vw, 22px)', color: LENSES[active].colour }}>
          {LENSES[active].label}
        </span>
        <div className="font-display leading-none flex" style={{ fontSize: 'clamp(22px, 6vw, 30px)' }}>
          {LENSES.map((l, i) => (
            <span
              key={l.key}
              style={{
                color: i === active ? l.colour : 'var(--th-surface)',
                opacity: i === active ? 1 : 0.28,
                transition: 'color 300ms ease, opacity 300ms ease',
              }}
            >
              {l.label[0]}.
            </span>
          ))}
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="mt-4 flex gap-4 overflow-x-auto tour-scroll"
        style={{ scrollSnapType: 'x mandatory', paddingLeft: '12%', paddingRight: '12%' }}
      >
        {LENSES.map((l) => (
          <div
            key={l.key}
            className="shrink-0 rounded-2xl p-5"
            style={{
              width: '76%', scrollSnapAlign: 'center',
              backgroundColor: 'var(--th-surface)', borderLeft: `4px solid ${l.colour}`,
            }}
          >
            <p className="font-display leading-none" style={{ color: l.colour, fontSize: 'clamp(28px, 8vw, 38px)' }}>{l.label}</p>
            <p className="font-serif mt-2 leading-snug" style={{ color: 'var(--th-text)', fontSize: 14, opacity: 0.85 }}>{l.definition}</p>
            <p className="font-semibold mt-4 text-[11px] uppercase tracking-[0.14em]" style={{ color: l.colour }}>Ask things like</p>
            <ul className="mt-1.5 space-y-1.5">
              {l.questions.slice(0, 2).map((q) => (
                <li key={q} className="font-serif italic leading-snug" style={{ color: 'var(--th-text)', fontSize: 15 }}>&ldquo;{q}&rdquo;</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2" style={{ color: 'var(--th-surface)', opacity: 0.6 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        <span className="text-[10px] uppercase tracking-[0.22em]">Swipe the lenses</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
      </div>
    </div>
  );
}

interface Props {
  onComplete: () => void;
  /** After the first context step, the intro is shorter: the same fade into the
   *  big CONTEXT title with a "let's explore the P.A.S.T. again" line, then scroll
   *  straight into the journal (no ASK / P·A·S·T reveal beat). */
  returning?: boolean;
}

export default function ContextIntroCard({ onComplete, returning = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [sitIn, setSitIn] = useState(false);
  const [howIn, setHowIn] = useState(false);
  const sitRef = useRef<HTMLElement | null>(null);
  const howRef = useRef<HTMLElement | null>(null);
  const enterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const el = sitRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSitIn(true); }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = howRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setHowIn(true); }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Scrolling past the sentinel enters the Context Journal.
  useEffect(() => {
    const el = enterRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) onComplete(); }, { threshold: 0.75 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onComplete]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-y-auto select-none"
      style={{ backgroundColor: 'var(--th-journal)', scrollSnapType: 'y mandatory' }}
    >
      {/* 1 — Sit down. First now, not last: it's the invitation to settle before
             the teaching, so it has to come before the teaching. */}
      <section
        ref={sitRef}
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-8"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <svg
          width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="var(--th-surface)"
          strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
          style={{
            opacity: sitIn ? 0.9 : 0,
            transform: sitIn ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.92)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out',
          }}
        >
          {/* Park bench */}
          <path d="M4 7h16" />
          <path d="M3 12h18" />
          <path d="M6 7v5M10 7v5M14 7v5M18 7v5" />
          <path d="M5 12v6M19 12v6" />
        </svg>

        <p
          className="font-serif mt-7"
          style={{
            fontSize: 'clamp(18px, 4.8vw, 24px)', color: 'var(--th-surface)',
            opacity: sitIn ? 0.85 : 0, transform: sitIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 700ms ease-out 150ms, transform 700ms ease-out 150ms',
          }}
        >
          Feel free to find a place to
        </p>
        <p
          className="font-display leading-none mt-1"
          style={{
            fontSize: 'clamp(46px, 15vw, 88px)', color: 'var(--th-surface)',
            opacity: sitIn ? 1 : 0, transform: sitIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 800ms ease-out 350ms, transform 800ms ease-out 350ms',
          }}
        >
          sit down
        </p>
        <p
          className="font-serif mt-7"
          style={{
            fontSize: 'clamp(18px, 4.8vw, 24px)', color: 'var(--th-surface)', maxWidth: '22ch',
            opacity: sitIn ? 0.9 : 0, transform: sitIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 800ms ease-out 750ms, transform 800ms ease-out 750ms',
          }}
        >
          during this next section.
        </p>

        <div
          className="absolute bottom-7 left-0 right-0 flex flex-col items-center gap-1.5"
          style={{ opacity: sitIn ? 0.65 : 0, transition: 'opacity 700ms ease-out 1200ms' }}
        >
          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--th-surface)' }}>Scroll</span>
          <svg className="animate-bounce" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--th-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* 2 — "…the CONTEXT". The lead sits above the title now, and the title is
             right-aligned so the slide reads as a turn: what you explored on the
             left, what's behind it on the right. */}
      <section
        className="relative min-h-[100dvh] flex flex-col justify-center px-7"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p
          className="font-serif leading-snug"
          style={{
            fontSize: 'clamp(19px, 5.2vw, 28px)',
            color: 'var(--th-surface)',
            opacity: mounted ? 0.92 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 800ms ease-out 200ms, transform 800ms ease-out 200ms',
            maxWidth: '24ch',
          }}
        >
          {returning
            ? <>Now that you&rsquo;ve learned more, let&rsquo;s explore the <span className="font-bold">P.A.S.T.</span> again&hellip;</>
            : <>Now that you have explored <em>what&rsquo;s in front of you</em>&hellip;</>}
        </p>
        {!returning && (
          <p
            className="font-serif leading-snug mt-5"
            style={{
              fontSize: 'clamp(21px, 5.6vw, 30px)',
              color: 'var(--th-surface)',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 900ms ease-out 1000ms, transform 900ms ease-out 1000ms',
              maxWidth: '22ch',
            }}
          >
            Let&rsquo;s <span className="italic font-display" style={{ color: CONTEXT_ACCENT }}>reconstruct</span> the world behind it.
          </p>
        )}

        <div
          className="mt-8 text-right"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 900ms ease-out 1800ms, transform 900ms ease-out 1800ms',
          }}
        >
          <span className="font-serif block" style={{ fontSize: 'clamp(18px, 4.6vw, 24px)', color: 'var(--th-surface)', opacity: 0.75 }}>the</span>
          <span className="font-display leading-[0.95] tracking-tight block" style={{ fontSize: 'clamp(56px, 21vw, 132px)', color: 'var(--th-surface)' }}>
            CONTEXT
          </span>
        </div>

        <div
          className="absolute bottom-7 left-0 right-0 flex flex-col items-center gap-1.5"
          style={{ opacity: mounted ? 0.7 : 0, transition: 'opacity 700ms ease-out 2600ms' }}
        >
          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--th-surface)' }}>Scroll</span>
          <svg className="animate-bounce" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--th-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* 3 — So how? (first Context step only) */}
      {!returning && (
      <section
        ref={howRef}
        className="relative min-h-[100dvh] flex flex-col justify-center px-7"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p
          className="font-display italic leading-tight"
          style={{
            fontSize: 'clamp(30px, 8vw, 46px)', color: 'var(--th-surface)',
            opacity: howIn ? 1 : 0, transform: howIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out',
          }}
        >
          So how do we do it?
        </p>
        <p
          className="font-serif leading-snug mt-10"
          style={{
            fontSize: 'clamp(26px, 7vw, 40px)', color: 'var(--th-surface)', maxWidth: '18ch',
            opacity: howIn ? 1 : 0, transform: howIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 800ms ease-out 1100ms, transform 800ms ease-out 1100ms',
          }}
        >
          Let&rsquo;s start by <strong style={{ color: CONTEXT_ACCENT }}>asking context questions!</strong>
        </p>
      </section>
      )}

      {/* 4 — The P.A.S.T. reveal. Plays itself; see PastReveal. */}
      {!returning && (
      <section
        className="relative min-h-[100dvh] flex flex-col justify-center px-7"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <PastReveal />
      </section>
      )}

      {/* 5 — The lenses, as swipeable cards. */}
      {!returning && (
      <section
        className="relative min-h-[100dvh] flex flex-col justify-center"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div className="px-7">
          <p className="font-serif leading-snug" style={{ fontSize: 'clamp(21px, 5.6vw, 30px)', color: 'var(--th-surface)', maxWidth: '20ch' }}>
            Use the <span className="font-bold">P.A.S.T.</span> to frame your questions.
          </p>
          <p className="font-display mt-2" style={{ fontSize: 'clamp(24px, 6.4vw, 34px)', color: CONTEXT_ACCENT }}>
            Check out the lenses!
          </p>
        </div>
        <LensSlider />
      </section>
      )}

      {/* 6 — Try it out */}
      {!returning && (
      <section
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-8"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p className="font-serif" style={{ fontSize: 'clamp(20px, 5.2vw, 27px)', color: 'var(--th-surface)', opacity: 0.9 }}>
          Now let&rsquo;s try it out for this tour!
        </p>
        <p className="font-display leading-tight mt-4" style={{ fontSize: 'clamp(30px, 8vw, 46px)', color: 'var(--th-surface)', fontWeight: 700, maxWidth: '15ch' }}>
          Ready to think like a historian?
        </p>
        <button
          onClick={onComplete}
          className="mt-10 px-12 py-4 rounded-full text-[18px] font-semibold"
          style={{ backgroundColor: CONTEXT_ACCENT, color: 'var(--th-journal)' }}
        >
          Yes!
        </button>
      </section>
      )}


      {/* Sentinel — scrolling into it enters the Context Journal. Only on the
          return intro: the first one ends on a "Yes!" button, and leaving the
          sentinel in would let a scroll past slide 6 fire onComplete a second
          time (and skip the button entirely). */}
      {returning && (
        <div ref={enterRef} className="h-[55vh] flex items-end justify-center pb-10" style={{ scrollSnapAlign: 'end' }}>
          <span className="font-serif italic text-[15px]" style={{ color: 'var(--th-surface)', opacity: 0.6 }}>
            Opening the Context Journal&hellip;
          </span>
        </div>
      )}
    </div>,
    document.body,
  );
}
