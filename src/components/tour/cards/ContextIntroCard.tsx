'use client';

/**
 * Context intro — an immersive snap-scroll shown at the start of the context step
 * (`act_context_intro`), on a soft light-red surface.
 *
 * **First time** (six beats, and the only place the P.A.S.T. is ever taught now —
 * the intro onboarding hands it over):
 *   1. Sit down — settle before the teaching, so it comes before the teaching.
 *   2. "…the CONTEXT" — what you explored, then the world behind it.
 *   3. So how? — ask context questions.
 *   4. The P.A.S.T. reveal — plays itself; see PastReveal.
 *   5. The lenses as swipeable cards.
 *   6. Try it out → the button scrolls on to the guiding-theme splash.
 *   7. The guiding-theme splash — a scroll section; swipe down past the sentinel
 *      to enter the journal (and back up to return to it).
 *
 * **Returning** (`returning`): the short version — sit down, the guiding-theme
 * splash, then scroll past the sentinel into the journal. No teaching, no button.
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

/** The intro rides on a soft light-red surface (was the dark journal cover) so the
 *  copy stays legible; INK is the dark journal red that reads as text on it. */
const LIGHT_RED = '#F6DEDB';
const INK = 'var(--th-journal)';

/** The soft lens halo worn over the active initial — same treatment as the Context
 *  Journal's indicator, so the lens metaphor is consistent across both: a pale
 *  tinted disc ringed in the lens colour, with a faint outer glow. Sits behind the
 *  letter (which carries z-10). */
function LensGlass({ colour, size }: { colour: string; size: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: size, height: size, transform: 'translate(-50%, -50%)', borderRadius: '999px',
        backgroundColor: `color-mix(in srgb, ${colour} 15%, #fff)`,
        border: `2px solid ${colour}`,
        boxShadow: `0 0 0 5px color-mix(in srgb, ${colour} 12%, transparent), 0 1px 6px color-mix(in srgb, ${colour} 22%, transparent)`,
      }}
    />
  );
}

/**
 * The four lenses as swipeable cards. The indicator matches the Context Journal's
 * exactly — the active P·A·S·T initial swells and wears the lens glass (same
 * big/small sizing) — so the two surfaces read as one thing. Each card leads with
 * a sentence definition ("Recreate the past using Place by asking about…" + the
 * lens's sub-topics stacked), then this tour's *authored* questions for that lens
 * (the sample questions live on the journal's lens card instead).
 *
 * The track snaps left↔right, one card at a time, padded in from both edges so
 * the neighbours peek — that peek is the swipe affordance. Cards scroll internally
 * when the questions don't fit, so the card is never clipped.
 */
function LensSlider({ questionsByLens }: { questionsByLens: Record<string, string[]> }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // Nearest card to the track's centre wins — forgiving, and correct at both ends
  // where a card can't reach the middle.
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

  const scrollToCard = (i: number) => {
    const track = trackRef.current;
    const card = track?.children[i] as HTMLElement | undefined;
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2, behavior: 'smooth' });
  };

  return (
    <div className="mt-5">
      {/* P·A·S·T indicator — journal-style: active initial swells + wears the glass. */}
      <div className="flex items-end justify-center gap-1.5 select-none">
        {LENSES.map((l, i) => {
          const on = i === active;
          return (
            <div key={l.key} className="flex items-end gap-1.5">
              <button
                onClick={() => scrollToCard(i)}
                aria-label={`Show the ${l.label} lens`}
                className="relative flex items-center justify-center bg-transparent border-0 p-0"
                style={{ width: on ? 58 : 30, height: 58 }}
              >
                <span className="relative z-10 font-display font-bold leading-none transition-all duration-200" style={{ fontSize: on ? 46 : 24, color: l.colour, opacity: on ? 1 : 0.4 }}>
                  {l.label[0]}
                </span>
                {on && <LensGlass colour={l.colour} size={62} />}
              </button>
              {i < LENSES.length - 1 && (
                <span className="font-display font-bold mb-1.5" style={{ fontSize: 20, opacity: 0.4, color: INK }}>·</span>
              )}
            </div>
          );
        })}
      </div>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="mt-4 flex gap-4 overflow-x-auto tour-scroll"
        style={{ scrollSnapType: 'x mandatory', paddingLeft: '7%', paddingRight: '7%' }}
      >
        {LENSES.map((l) => {
          const authored = questionsByLens[l.key] ?? [];
          return (
            <div
              key={l.key}
              className="shrink-0 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
              style={{ width: '86%', maxWidth: 460, maxHeight: '62vh', scrollSnapAlign: 'center', scrollSnapStop: 'always', backgroundColor: 'var(--th-surface)' }}
            >
              <div className="px-5 py-4 shrink-0" style={{ backgroundColor: l.colour }}>
                <h3 className="font-display font-bold leading-none" style={{ color: '#fff', fontSize: 'clamp(36px, 9.5vw, 50px)' }}>{l.label}</h3>
              </div>
              <div className="overflow-y-auto tour-scroll px-5 py-4">
                {/* Sentence definition + stacked sub-topics. */}
                <p className="font-serif leading-snug" style={{ color: 'var(--th-text)', fontSize: 20 }}>
                  Recreate the past using <span className="font-bold" style={{ color: l.colour }}>{l.label.toUpperCase()}</span>{' '}by asking about&hellip;
                </p>
                <ul className="mt-2.5 space-y-1">
                  {l.categories.map((c) => (
                    <li key={c} className="font-display font-semibold leading-tight" style={{ color: l.colour, fontSize: 18 }}>{c}</li>
                  ))}
                </ul>

                {authored.length > 0 && (
                  <>
                    <p className="mt-5 text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: 'var(--th-text)', opacity: 0.6 }}>Questions to explore</p>
                    <ul className="mt-2.5 space-y-2.5">
                      {authored.map((q, i) => (
                        <li key={i} className="flex items-start gap-2.5 rounded-xl px-3.5 py-2.5" style={{ backgroundColor: `${l.colour}14` }}>
                          <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.colour }} />
                          <span className="font-serif leading-snug" style={{ color: 'var(--th-text)', fontSize: 16 }}>{q}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-center gap-2" style={{ color: INK, opacity: 0.55 }}>
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
  /** This act's authored context questions, grouped by lens key, shown on the
   *  lens cards (the generic sample questions live on the journal's lens card). */
  questionsByLens?: Record<string, string[]>;
}

/** The framing splash that ushers in the journal: "look through the P.A.S.T." then
 *  the act's guiding theme, large — both centred. `visible` staggers the fade-in. */
function GuidingSplash({ theme, visible }: { theme: string; visible: boolean }) {
  const fade = (delayMs: number, op = 1): React.CSSProperties => ({
    opacity: visible ? op : 0,
    transform: visible ? 'translateY(0)' : 'translateY(14px)',
    transition: `opacity 800ms ease-out ${delayMs}ms, transform 800ms ease-out ${delayMs}ms`,
  });
  return (
    <div className="flex flex-col items-center text-center">
      <p className="font-serif leading-snug" style={{ fontSize: 'clamp(17px, 4.6vw, 22px)', color: INK, maxWidth: '24ch', ...fade(200, 0.9) }}>
        {/* {' '} — a JSX text chunk touching a newline gets trimmed both ends, so a
            bare space after the span is eaten ("P.A.S.T.to"). */}
        Look through the <span className="font-bold">P.A.S.T.</span>{' '}to contextualise&hellip;
      </p>
      <p className="font-display font-bold leading-tight mt-9" style={{ fontSize: 'clamp(34px, 10vw, 60px)', color: CONTEXT_ACCENT, maxWidth: '18ch', ...fade(1000) }}>
        {theme}
      </p>
    </div>
  );
}

export default function ContextIntroCard({ onComplete, returning = false, guidingQuestion, questionsByLens = {} }: Props) {
  const [mounted, setMounted] = useState(false);
  const [sitIn, setSitIn] = useState(false);
  const [howIn, setHowIn] = useState(false);
  const [pastRevealed, setPastRevealed] = useState(false);
  // First-time: after "Ask my own question", the guiding-theme splash rides in as
  // a full-screen screen ABOVE the journal (not another scroll slide) before onComplete.
  const [showGuiding, setShowGuiding] = useState(false);
  const [guidingIn, setGuidingIn] = useState(false);
  const sitRef = useRef<HTMLElement | null>(null);
  const howRef = useRef<HTMLElement | null>(null);
  const lensRef = useRef<HTMLElement | null>(null);
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

  useEffect(() => {
    if (!showGuiding) return;
    const id = requestAnimationFrame(() => setGuidingIn(true));
    return () => cancelAnimationFrame(id);
  }, [showGuiding]);

  // Both paths end by scrolling past the sentinel into the Context Journal — a
  // real scroll, so the guiding-theme splash above it stays put and can be
  // scrolled back up to.
  useEffect(() => {
    const el = enterRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) onComplete(); }, { threshold: 0.75 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [onComplete]);

  // Progress counter (N of total). Observe the real section elements so the count
  // matches whatever the current path renders (first-time vs returning), and the
  // sentinel isn't counted as a page.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState(0);
  const [total, setTotal] = useState(0);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll('section')) as HTMLElement[];
    setTotal(sections.length);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.5) {
          const i = sections.indexOf(e.target as HTMLElement);
          if (i >= 0) setStep(i);
        }
      }),
      { root, threshold: 0.5 },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [returning, guidingQuestion]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={rootRef}
      data-cj-intro-scroll
      className="fixed inset-0 z-[60] overflow-y-auto select-none"
      style={{ backgroundColor: LIGHT_RED, scrollSnapType: 'y mandatory' }}
    >
      {/* Segmented progress bar — the same chrome as the intro onboarding, on the
          light-red surface. */}
      {total > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-[61] px-5 pt-3 pb-2"
          style={{ background: `linear-gradient(${LIGHT_RED}, color-mix(in srgb, ${LIGHT_RED} 55%, transparent) 70%, transparent)` }}
        >
          <div className="flex items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full transition-colors" style={{ backgroundColor: i <= step ? INK : 'color-mix(in srgb, var(--th-journal) 22%, transparent)' }} />
            ))}
          </div>
          <p className="mt-1 text-[11px] font-semibold tracking-wide" style={{ color: INK, opacity: 0.7 }}>{Math.min(step + 1, total)} of {total}</p>
        </div>
      )}
      {/* 1 — Sit down. First now, not last: it's the invitation to settle before
             the teaching, so it has to come before the teaching. */}
      <section
        ref={sitRef}
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-8"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <svg
          width="76" height="76" viewBox="0 0 24 24" fill="none" stroke="var(--th-journal)"
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
            fontSize: 'clamp(18px, 4.8vw, 24px)', color: INK,
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
            fontSize: 'clamp(18px, 4.8vw, 24px)', color: INK, maxWidth: '22ch',
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
          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: INK }}>Scroll</span>
          <svg className="animate-bounce" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--th-journal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                color: INK,
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
                  fontSize: 'clamp(23px, 6vw, 33px)',
                  color: INK,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? 'translateY(0)' : 'translateY(14px)',
                  transition: 'opacity 900ms ease-out 1000ms, transform 900ms ease-out 1000ms',
                  maxWidth: '22ch',
                }}
              >
                &hellip;let&rsquo;s <span className="italic font-display" style={{ color: CONTEXT_ACCENT }}>uncover</span>{' '}the world behind it&hellip;
              </p>
            )}

            {/* Just "CONTEXT", sized to fill the line, sitting lower on the page. */}
            <div
              className="mt-20 text-center"
              style={{
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0)' : 'translateY(18px)',
                transition: 'opacity 900ms ease-out 1800ms, transform 900ms ease-out 1800ms',
              }}
            >
              <span className="font-serif italic block leading-none" style={{ fontSize: 'clamp(20px, 5.2vw, 30px)', color: INK, opacity: 0.72 }}>the</span>
              <span className="font-display leading-[0.9] tracking-tight block" style={{ fontSize: 'clamp(52px, 20vw, 128px)', color: INK }}>
                CONTEXT
              </span>
            </div>
          </>
        )}

        <div
          className="absolute bottom-7 left-0 right-0 flex flex-col items-center gap-1.5"
          style={{ opacity: mounted ? 0.7 : 0, transition: 'opacity 700ms ease-out 2600ms' }}
        >
          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: INK }}>Scroll</span>
          <svg className="animate-bounce" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--th-journal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            fontSize: 'clamp(30px, 8vw, 46px)', color: INK,
            opacity: howIn ? 1 : 0, transform: howIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out',
          }}
        >
          So how do we do it?
        </p>
        <p
          className="font-serif leading-snug mt-24"
          style={{
            fontSize: 'clamp(20px, 6.2vw, 34px)', color: INK,
            opacity: howIn ? 1 : 0, transform: howIn ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 800ms ease-out 1100ms, transform 800ms ease-out 1100ms',
          }}
        >
          Let&rsquo;s start by
          <br />
          <strong className="whitespace-nowrap" style={{ color: CONTEXT_ACCENT }}>asking context questions!</strong>
        </p>
      </section>
      )}

      {/* 4 — The P.A.S.T. reveal. Plays itself; see PastReveal. Once the reveal has
             finished, a button carries them on to the lenses (no extra scroll). */}
      {!returning && (
      <section
        className="relative min-h-[100dvh] flex flex-col justify-center px-7"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <PastReveal onDone={() => setPastRevealed(true)} />
        <div
          className="mt-10 flex justify-center"
          style={{
            opacity: pastRevealed ? 1 : 0,
            transform: pastRevealed ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 600ms ease-out 200ms, transform 600ms ease-out 200ms',
            pointerEvents: pastRevealed ? 'auto' : 'none',
          }}
        >
          <button
            onClick={() => lensRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-11 py-4 rounded-full text-[17px] font-semibold"
            style={{ backgroundColor: CONTEXT_ACCENT, color: 'var(--th-journal)' }}
          >
            Explore the P.A.S.T. &rarr;
          </button>
        </div>
      </section>
      )}

      {/* 5 — The lenses, as swipeable cards. */}
      {!returning && (
      <section
        ref={lensRef}
        className="relative min-h-[100dvh] flex flex-col justify-center"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div className="px-7">
          <p className="font-serif italic leading-snug" style={{ fontSize: 'clamp(21px, 5.6vw, 30px)', color: INK, maxWidth: '20ch' }}>
            Use the <span className="font-bold">P.A.S.T.</span> to frame your questions.
          </p>
          <p className="font-display mt-2" style={{ fontSize: 'clamp(24px, 6.4vw, 34px)', color: CONTEXT_ACCENT }}>
            Check out the lenses!
          </p>
        </div>
        <LensSlider questionsByLens={questionsByLens} />
      </section>
      )}

      {/* 6 — Try it out */}
      {!returning && (
      <section
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-8"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p className="font-serif" style={{ fontSize: 'clamp(20px, 5.2vw, 27px)', color: INK, opacity: 0.9 }}>
          Now let&rsquo;s try it out for this tour!
        </p>
        <p className="font-display leading-tight mt-6" style={{ fontSize: 'clamp(28px, 8vw, 46px)', color: INK, fontWeight: 700, maxWidth: '18ch' }}>
          Ready to <span className="italic">recreate</span> the past?
        </p>
        {/* Brings up the guiding-theme splash as a screen above the journal, then
            into the journal — no extra scroll slide. Straight to the journal if
            there's no guiding theme to frame. */}
        <button
          onClick={() => (guidingQuestion ? setShowGuiding(true) : onComplete())}
          className="mt-10 px-12 py-4 rounded-full text-[18px] font-semibold"
          style={{ backgroundColor: CONTEXT_ACCENT, color: 'var(--th-journal)' }}
        >
          Ask my own question
        </button>
      </section>
      )}

      {/* Returning only: the guiding-theme splash is shown inline (section 2) and
          they scroll into this sentinel to enter the journal. First-time enters via
          the guiding screen below instead, so the sentinel isn't rendered for it. */}
      {returning && (
        <div ref={enterRef} className="h-[55vh] flex items-end justify-center pb-10" style={{ scrollSnapAlign: 'end' }}>
          <span className="font-serif italic text-[15px]" style={{ color: INK, opacity: 0.6 }}>
            Opening the Context Journal&hellip;
          </span>
        </div>
      )}

      {/* First-time: the guiding-theme splash as a full-screen screen ABOVE the
          journal — it fades in, then "Enter" opens the journal. */}
      {showGuiding && guidingQuestion && (
        <div
          className="fixed inset-0 z-[62] flex flex-col items-center justify-center px-7"
          style={{ backgroundColor: LIGHT_RED, opacity: guidingIn ? 1 : 0, transition: 'opacity 400ms ease-out' }}
        >
          <GuidingSplash theme={guidingQuestion} visible={guidingIn} />
          <button
            onClick={onComplete}
            className="mt-14 px-12 py-4 rounded-full text-[18px] font-semibold"
            style={{
              backgroundColor: CONTEXT_ACCENT, color: 'var(--th-journal)',
              opacity: guidingIn ? 1 : 0, transform: guidingIn ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 700ms ease-out 1400ms, transform 700ms ease-out 1400ms',
            }}
          >
            Enter the Context Journal &rarr;
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
