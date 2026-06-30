'use client';

/**
 * Context-Prototype — the "Context" intro shown at the end of an act, before
 * the Context page itself. Fades the whole screen in (~2s, like the Act intro
 * but inverted — a dark, rich surface instead of cream) and presents the
 * framing question "So what context do we need?".
 *
 * This is a snap-scroll surface: the framing question is section 1, and a
 * future "framework" (authored in onboarding) will snap-scroll below it. For
 * now there is just the one section + a Continue affordance.
 *
 * Rendered via a portal to document.body so the fixed full-screen overlay
 * escapes the Journal's transformed (framer-motion) ancestor (Build_State §7).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onComplete: () => void;
}

export default function ContextIntroCard({ onComplete }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Next frame so the opacity/transform transitions actually run.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-y-auto select-none"
      style={{
        backgroundColor: 'var(--th-journal)',
        opacity: mounted ? 1 : 0,
        transition: 'opacity 800ms ease-in',
        scrollSnapType: 'y mandatory',
      }}
    >
      {/* Section 1 — the framing question. Future framework sections snap below. */}
      <section
        className="min-h-full flex flex-col items-center justify-center text-center px-8 py-12"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {/* "Context" kicker — amber, fades in first */}
        <div
          className="font-display font-bold uppercase tracking-[0.18em]"
          style={{
            fontSize: 'clamp(28px, 9vw, 56px)',
            color: 'var(--th-secondary)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'opacity 700ms ease-out 200ms, transform 700ms ease-out 200ms',
          }}
        >
          Context
        </div>

        {/* Intro line 1 — cream, fades in after the kicker */}
        <h1
          className="font-serif leading-snug mt-6"
          style={{
            fontSize: 'clamp(26px, 7vw, 42px)',
            color: 'var(--th-surface)',
            maxWidth: '20ch',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 800ms ease-out 1000ms, transform 800ms ease-out 1000ms',
          }}
        >
          Now that we&rsquo;ve learned a bit about this place&hellip;
        </h1>

        {/* Intro line 2 — fades in after */}
        <p
          className="font-serif leading-snug mt-4"
          style={{
            fontSize: 'clamp(20px, 5.5vw, 32px)',
            color: 'var(--th-surface)',
            maxWidth: '20ch',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 800ms ease-out 1500ms, transform 800ms ease-out 1500ms',
          }}
        >
          let&rsquo;s ask about some context using the <strong style={{ color: 'var(--th-secondary)' }}>P.A.S.T.</strong>
        </p>

        {/* Ask about context — fades in last */}
        <button
          onClick={onComplete}
          className="mt-12 px-8 py-3 rounded-full text-[15px] font-semibold"
          style={{
            color: 'var(--th-journal)',
            backgroundColor: 'var(--th-surface)',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 600ms ease-out 2200ms',
          }}
        >
          Ask about context
        </button>
      </section>
    </div>,
    document.body,
  );
}
