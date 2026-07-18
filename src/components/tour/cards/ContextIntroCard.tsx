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
 * The four lenses as swipeable cards, built to match the Context Journal's own
 * lens card (PastLensCard): coloured header band with the big lens name, category
 * icons, then every sample question in a tinted row. Not a reduced preview — the
 * point is that what you learn here is the thing you'll meet in the journal.
 *
 * The track is padded in from both edges so the neighbouring cards always peek —
 * that peek is the affordance; without it a single centred card reads as the whole
 * content and nobody swipes. Each card scrolls internally when its questions don't
 * fit, so the card is never clipped and the page never grows past the viewport.
 *
 * The indicator carries the magnifier over whichever letter is centred, matching
 * the lens metaphor the cards use.
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
    <div className="mt-5">
      {/* P.A.S.T. indicator — the active letter grows and wears the magnifier. */}
      <div className="flex items-end justify-center gap-0.5">
        {LENSES.map((l, i) => {
          const on = i === active;
          return (
            <span key={l.key} className="relative flex flex-col items-center">
              <svg
                width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={l.colour}
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                style={{ opacity: on ? 1 : 0, transform: on ? 'translateY(0)' : 'translateY(4px)', transition: 'opacity 250ms ease, transform 250ms ease' }}
              >
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <span
                className="font-display leading-none"
                style={{
                  color: on ? l.colour : 'var(--th-surface)',
                  opacity: on ? 1 : 0.3,
                  fontSize: on ? 'clamp(34px, 9vw, 44px)' : 'clamp(22px, 6vw, 30px)',
                  transition: 'color 300ms ease, opacity 300ms ease, font-size 300ms ease',
                }}
              >
                {l.label[0]}.
              </span>
            </span>
          );
        })}
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="mt-4 flex gap-4 overflow-x-auto tour-scroll"
        style={{ scrollSnapType: 'x mandatory', paddingLeft: '10%', paddingRight: '10%' }}
      >
        {LENSES.map((l) => (
          <div
            key={l.key}
            className="shrink-0 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            style={{ width: '80%', maxWidth: 420, maxHeight: '58vh', scrollSnapAlign: 'center', backgroundColor: 'var(--th-surface)' }}
          >
            <div className="px-5 py-4 shrink-0" style={{ backgroundColor: l.colour }}>
              <h3 className="font-display font-bold leading-none" style={{ color: 'var(--th-surface)', fontSize: 'clamp(34px, 9vw, 46px)' }}>{l.label}</h3>
            </div>
            <div className="overflow-y-auto tour-scroll px-5 py-4">
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {l.categories.map((c) => (
                  <span key={c} className="text-[15px] font-semibold" style={{ color: l.colour }}>{c}</span>
                ))}
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: 'var(--th-text)', opacity: 0.6 }}>Sample context questions</p>
              <ul className="mt-2.5 space-y-2.5">
                {[...l.questions, ...(l.specificQuestions ?? [])].map((q, i) => (
                  <li key={i} className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5" style={{ backgroundColor: `${l.colour}14` }}>
                    <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.colour }} />
                    <span className="font-serif leading-snug" style={{ color: 'var(--th-text)', fontSize: 16 }}>{q}</span>
                  </li>
                ))}
              </ul>
            </div>
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
  /** The act's guiding theme — framed on the splash before the journal. */
  guidingQuestion?: string;
}

/** The framing splash before the journal: reconstruct → look through the P.A.S.T.
 *  → the act's guiding theme, large. `visible` drives the staggered fade-in. */
function GuidingSplash({ theme, visible }: { theme: string; visible: boolean }) {
  const fade = (delayMs: number, op = 1): React.CSSProperties => ({
    opacity: visible ? op : 0,
    transform: visible ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 800ms ease-out ${delayMs}ms, transform 800ms ease-out ${delayMs}ms`,
  });
  return (
    <>
      <p className="font-serif leading-snug" style={{ fontSize: 'clamp(21px, 5.6vw, 30px)', color: 'var(--th-surface)', maxWidth: '20ch', ...fade(200) }}>
        Let&rsquo;s reconstruct the world around us&hellip;
      </p>
      <p className="font-serif leading-snug mt-5" style={{ fontSize: 'clamp(17px, 4.6vw, 22px)', color: 'var(--th-surface)', maxWidth: '24ch', ...fade(1000, 0.9) }}>
        {/* {' '} — a JSX text chunk touching a newline gets trimmed both ends, so a
            bare space after the span is eaten ("P.A.S.T.to"). */}
        Look through the <span className="font-bold">P.A.S.T.</span>{' '}to contextualise&hellip;
      </p>
      <p className="font-display font-bold leading-tight mt-9" style={{ fontSize: 'clamp(34px, 10vw, 60px)', color: CONTEXT_ACCENT, ...fade(1800) }}>
        {theme}
      </p>
    </>
  );
}

export default function ContextIntroCard({ onComplete, returning = false, guidingQuestion }: Props) {
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
            fontSize: 'clamp(46px, 15vw, 88px)', color: CONTEXT_ACCENT,
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

      {/* 2 — Returning (every context page after the first): the guiding-theme
             splash, then scroll into the journal. First time: the "…the CONTEXT"
             reveal, since the P.A.S.T. teaching still follows. */}
      <section
        className="relative min-h-[100dvh] flex flex-col justify-center px-7"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {returning && guidingQuestion ? (
          <GuidingSplash theme={guidingQuestion} visible={mounted} />
        ) : (
          <>
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
                className="font-serif leading-snug mt-5 ml-auto text-right"
                style={{
                  fontSize: 'clamp(21px, 5.6vw, 30px)',
                  color: 'var(--th-surface)',
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(14px)',
                  transition: 'opacity 900ms ease-out 1000ms, transform 900ms ease-out 1000ms',
                  maxWidth: '22ch',
                }}
              >
                &hellip;let&rsquo;s <span className="italic font-display" style={{ color: CONTEXT_ACCENT }}>reconstruct</span> the world behind it.
              </p>
            )}

            {/* "the CONTEXT" on one line. Centred, but sized to fill the width, so
                the centring shouldn't read as centring — it should just look placed. */}
            <div
              className="mt-8 flex items-baseline justify-center gap-3"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(18px)',
                transition: 'opacity 900ms ease-out 1800ms, transform 900ms ease-out 1800ms',
              }}
            >
              <span className="font-serif" style={{ fontSize: 'clamp(16px, 4.2vw, 22px)', color: 'var(--th-surface)', opacity: 0.75 }}>the</span>
              <span className="font-display leading-[0.95] tracking-tight" style={{ fontSize: 'clamp(44px, 16vw, 104px)', color: 'var(--th-surface)' }}>
                CONTEXT
              </span>
            </div>
          </>
        )}

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
          className="font-serif leading-snug mt-24"
          style={{
            fontSize: 'clamp(30px, 8vw, 46px)', color: 'var(--th-surface)', maxWidth: '16ch',
            opacity: howIn ? 1 : 0, transform: howIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 800ms ease-out 1100ms, transform 800ms ease-out 1100ms',
          }}
        >
          Let&rsquo;s start by
          <br />
          <strong style={{ color: CONTEXT_ACCENT }}>asking context questions!</strong>
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
        {/* The first act's guiding theme, so Act 1 is framed like every later one
            (which get the standalone GuidingSplash). */}
        {guidingQuestion && (
          <p className="font-display font-bold leading-tight mt-6" style={{ fontSize: 'clamp(28px, 8vw, 46px)', color: CONTEXT_ACCENT, maxWidth: '16ch' }}>
            {guidingQuestion}
          </p>
        )}
        <p className="font-display leading-tight mt-6" style={{ fontSize: 'clamp(26px, 7vw, 40px)', color: 'var(--th-surface)', fontWeight: 700, maxWidth: '15ch' }}>
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
