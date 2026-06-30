'use client';

/**
 * Context intro — an immersive two-beat snap-scroll shown at the start of the
 * context step (`act_context_intro`), on the rich dark journal surface.
 *
 *   Beat 1: a huge "Context" section title (we're entering a new mode), with the
 *           "Now that we've learned…" line anchored low and a scroll cue.
 *   Beat 2 (revealed on scroll): left-aligned "let's ask about some context using
 *           the…", then P·A·S·T stepping diagonally down — each lens's initial
 *           BIG (in its colour) with the rest of the word smaller — then a
 *           directional "Ask about context" button.
 *
 * Portaled to document.body so the fixed overlay escapes the Journal's
 * transformed (framer-motion) ancestor (Build_State §7).
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LENSES } from '@/features/context-journal/constants';

interface Props {
  onComplete: () => void;
}

export default function ContextIntroCard({ onComplete }: Props) {
  const [mounted, setMounted] = useState(false);
  const [beat2, setBeat2] = useState(false);
  const beat2Ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const el = beat2Ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setBeat2(true); },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-y-auto select-none"
      style={{ backgroundColor: 'var(--th-journal)', scrollSnapType: 'y mandatory' }}
    >
      {/* Beat 1 — huge section title, opening line low, scroll cue */}
      <section
        className="relative min-h-[100dvh] flex flex-col justify-end px-7 pb-24"
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
          Now that we&rsquo;ve learned a bit about this place&hellip;
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

      {/* Beat 2 — left-aligned lead, diagonal P·A·S·T, directional button */}
      <section
        ref={beat2Ref}
        className="min-h-[100dvh] flex flex-col px-7 py-14"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <h2
          className="font-serif leading-snug"
          style={{
            fontSize: 'clamp(22px, 6vw, 34px)',
            color: 'var(--th-surface)',
            maxWidth: '16ch',
            opacity: beat2 ? 1 : 0,
            transform: beat2 ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out',
          }}
        >
          let&rsquo;s ask about some context using the&hellip;
        </h2>

        {/* the P.A.S.T. stepping diagonally down, each initial accentuated */}
        <div className="flex-1 flex flex-col justify-center gap-2 mt-6">
          {LENSES.map((l, i) => (
            <div
              key={l.key}
              className="flex items-baseline"
              style={{
                marginLeft: `${i * 9}%`,
                opacity: beat2 ? 1 : 0,
                transform: beat2 ? 'translateX(0)' : 'translateX(-16px)',
                transition: `opacity 500ms ease-out ${250 + i * 140}ms, transform 500ms ease-out ${250 + i * 140}ms`,
              }}
            >
              <span className="font-display leading-none" style={{ color: l.colour, fontSize: 'clamp(46px, 15vw, 96px)' }}>{l.label[0]}</span>
              <span className="font-display leading-none" style={{ color: l.colour, fontSize: 'clamp(20px, 6vw, 38px)' }}>{l.label.slice(1)}</span>
            </div>
          ))}
        </div>

        {/* directional CTA — feels like stepping through */}
        <button
          onClick={onComplete}
          className="self-start inline-flex items-center gap-3 pl-6 pr-2.5 py-2.5 rounded-full font-semibold shadow-xl active:scale-[0.98] transition-transform"
          style={{
            backgroundColor: 'var(--th-secondary)',
            color: 'var(--th-journal)',
            opacity: beat2 ? 1 : 0,
            transition: `opacity 600ms ease-out ${250 + LENSES.length * 140 + 200}ms`,
          }}
        >
          <span className="text-[15px]">Ask about context</span>
          <span className="flex items-center justify-center w-9 h-9 rounded-full" style={{ backgroundColor: 'var(--th-journal)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--th-secondary)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
        </button>
      </section>
    </div>,
    document.body,
  );
}
