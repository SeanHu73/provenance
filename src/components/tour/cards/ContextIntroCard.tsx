'use client';

/**
 * Context intro — an immersive two-beat snap-scroll shown at the start of the
 * context step (`act_context_intro`), on the rich dark journal surface.
 *
 *   Beat 1: "Now that we've learned a bit about this place…" + a scroll cue.
 *   Beat 2 (revealed as it scrolls in): "let's ask about some context using the
 *           P.A.S.T." — the four lenses stagger in as colour chips — then the
 *           "Ask about context" button.
 *
 * Rendered via a portal to document.body so the fixed overlay escapes the
 * Journal's transformed (framer-motion) ancestor (Build_State §7).
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

  // Reveal beat 2 as it scrolls into view (scroll-as-narrative).
  useEffect(() => {
    const el = beat2Ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setBeat2(true); },
      { threshold: 0.45 },
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
      {/* Beat 1 */}
      <section
        className="relative min-h-[100dvh] flex flex-col items-center justify-center text-center px-8"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div
          className="font-display font-bold uppercase tracking-[0.2em]"
          style={{
            fontSize: 'clamp(13px, 3.6vw, 18px)',
            color: 'var(--th-secondary)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 700ms ease-out 200ms, transform 700ms ease-out 200ms',
          }}
        >
          Context
        </div>
        <h1
          className="font-serif leading-snug mt-6"
          style={{
            fontSize: 'clamp(28px, 8vw, 48px)',
            color: 'var(--th-surface)',
            maxWidth: '18ch',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 900ms ease-out 800ms, transform 900ms ease-out 800ms',
          }}
        >
          Now that we&rsquo;ve learned a bit about this place&hellip;
        </h1>

        {/* scroll cue */}
        <div
          className="absolute bottom-10 flex flex-col items-center gap-1.5"
          style={{ opacity: mounted ? 0.7 : 0, transition: 'opacity 700ms ease-out 1900ms' }}
        >
          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--th-surface)' }}>Scroll</span>
          <svg className="animate-bounce" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--th-surface)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* Beat 2 */}
      <section
        ref={beat2Ref}
        className="min-h-[100dvh] flex flex-col items-center justify-center text-center px-8 py-16"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <h2
          className="font-serif leading-snug"
          style={{
            fontSize: 'clamp(24px, 6.5vw, 40px)',
            color: 'var(--th-surface)',
            maxWidth: '20ch',
            opacity: beat2 ? 1 : 0,
            transform: beat2 ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 700ms ease-out, transform 700ms ease-out',
          }}
        >
          let&rsquo;s ask about some context using the{' '}
          <strong style={{ color: 'var(--th-secondary)' }}>P.A.S.T.</strong>
        </h2>

        {/* the four lenses stagger in */}
        <div className="mt-10 grid grid-cols-2 gap-3 w-full max-w-xs">
          {LENSES.map((l, i) => (
            <div
              key={l.key}
              className="rounded-2xl px-3.5 py-3 flex items-center gap-2.5 shadow-lg"
              style={{
                backgroundColor: l.colour,
                opacity: beat2 ? 1 : 0,
                transform: beat2 ? 'translateY(0) scale(1)' : 'translateY(18px) scale(0.96)',
                transition: `opacity 500ms ease-out ${250 + i * 130}ms, transform 500ms ease-out ${250 + i * 130}ms`,
              }}
            >
              <span className="font-display text-2xl leading-none text-warm-white">{l.label[0]}</span>
              <span className="font-display text-[15px] leading-none text-warm-white/95">{l.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={onComplete}
          className="mt-12 px-8 py-3 rounded-full text-[15px] font-semibold"
          style={{
            color: 'var(--th-journal)',
            backgroundColor: 'var(--th-surface)',
            opacity: beat2 ? 1 : 0,
            transition: `opacity 600ms ease-out ${250 + LENSES.length * 130 + 200}ms`,
          }}
        >
          Ask about context
        </button>
      </section>
    </div>,
    document.body,
  );
}
