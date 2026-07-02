'use client';

/**
 * Context intro — an immersive snap-scroll shown at the start of the context step
 * (`act_context_intro`), on the rich dark journal surface.
 *
 *   Beat 1: a huge "Context" section title with the "Now that we've learned…"
 *           line, sitting a little above centre, plus a scroll cue.
 *   Beat 2 (revealed on scroll): a vertically-centred block — "Let's ASK about
 *           some context using the…" just above the P·A·S·T stepping diagonally
 *           down (each lens initial BIG + coloured, the rest smaller).
 *   Then scrolling on past a sentinel slides into the Context Journal (no button).
 *
 * Portaled to document.body so the fixed overlay escapes the Journal's
 * transformed (framer-motion) ancestor (Build_State §7).
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LENSES } from '@/features/context-journal/constants';

interface Props {
  onComplete: () => void;
  /** After the first context step, the intro is shorter: the same fade into the
   *  big CONTEXT title with a "let's explore the P.A.S.T. again" line, then scroll
   *  straight into the journal (no ASK / P·A·S·T reveal beat). */
  returning?: boolean;
}

export default function ContextIntroCard({ onComplete, returning = false }: Props) {
  const [mounted, setMounted] = useState(false);
  const [beat2, setBeat2] = useState(false);
  const beat2Ref = useRef<HTMLElement | null>(null);
  const enterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const el = beat2Ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setBeat2(true); }, { threshold: 0.4 });
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
      {/* Beat 1 */}
      <section
        className="relative min-h-[100dvh] flex flex-col justify-end px-7 pb-36"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div
          className="font-display leading-[0.95] tracking-tight"
          style={{
            fontSize: 'clamp(64px, 24vw, 150px)',
            color: 'var(--th-surface)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 800ms ease-out 200ms, transform 800ms ease-out 200ms',
          }}
        >
          Context
        </div>
        <p
          className="font-serif leading-snug mt-5"
          style={{
            fontSize: 'clamp(19px, 5.2vw, 28px)',
            color: 'var(--th-surface)',
            opacity: mounted ? 0.92 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 900ms ease-out 900ms, transform 900ms ease-out 900ms',
            maxWidth: '24ch',
          }}
        >
          {returning
            ? <>Now that you&rsquo;ve learned more, let&rsquo;s explore the <span className="font-bold">P.A.S.T.</span> again&hellip;</>
            : <>Now that we&rsquo;ve learned a bit about this place&hellip;</>}
        </p>

        <div
          className="absolute bottom-7 left-0 right-0 flex flex-col items-center gap-1.5"
          style={{ opacity: mounted ? 0.7 : 0, transition: 'opacity 700ms ease-out 1900ms' }}
        >
          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--th-surface)' }}>Scroll</span>
          <svg className="animate-bounce" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--th-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* Beat 2 — vertically centred: lead just above the diagonal P·A·S·T.
          Skipped on the return intro (straight from CONTEXT into the journal). */}
      {!returning && (
      <section
        ref={beat2Ref}
        className="relative min-h-[100dvh] flex flex-col justify-center px-7"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div className="w-fit">
          <h2
            className="font-serif leading-snug mb-4"
            style={{
              fontSize: 'clamp(24px, 6.6vw, 38px)',
              color: 'var(--th-surface)',
              maxWidth: '15ch',
              opacity: beat2 ? 1 : 0,
              transform: beat2 ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 700ms ease-out, transform 700ms ease-out',
            }}
          >
            Let&rsquo;s <span className="italic">reconstruct</span> some{' '}
            <span className="font-bold">CONTEXT</span>
            <br />
            using the&hellip;
          </h2>

          {LENSES.map((l, i) => (
            <div
              key={l.key}
              className="flex items-baseline"
              style={{
                marginLeft: `${(i + 1) * 14}%`,
                opacity: beat2 ? 1 : 0,
                transform: beat2 ? 'translateX(0)' : 'translateX(-16px)',
                transition: `opacity 500ms ease-out ${250 + i * 140}ms, transform 500ms ease-out ${250 + i * 140}ms`,
              }}
            >
              <span className="font-display leading-none" style={{ color: l.colour, fontSize: 'clamp(46px, 15vw, 92px)' }}>{l.label[0]}</span>
              <span className="font-display leading-none" style={{ color: l.colour, fontSize: 'clamp(20px, 6vw, 36px)' }}>{l.label.slice(1)}</span>
            </div>
          ))}

          {/* Ready to ask questions? — same left margin, lighter font, scroll cue */}
          <div
            className="mt-7 flex items-center gap-2.5"
            style={{
              opacity: beat2 ? 1 : 0,
              transform: beat2 ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 600ms ease-out 950ms, transform 600ms ease-out 950ms',
            }}
          >
            <span className="font-display leading-none" style={{ fontSize: 'clamp(20px, 5.5vw, 30px)', color: 'var(--th-secondary)' }}>Ready to ask questions?</span>
            <svg className="animate-bounce shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--th-secondary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </div>
        </div>
      </section>
      )}

      {/* Sentinel — scrolling into it enters the Context Journal */}
      <div ref={enterRef} className="h-[55vh] flex items-end justify-center pb-10" style={{ scrollSnapAlign: 'end' }}>
        <span className="font-serif italic text-[15px]" style={{ color: 'var(--th-surface)', opacity: 0.6 }}>
          Opening the Context Journal&hellip;
        </span>
      </div>
    </div>,
    document.body,
  );
}
