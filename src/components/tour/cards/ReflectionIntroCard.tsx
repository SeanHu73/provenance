'use client';

/**
 * Reflection intro — an immersive fade shown at `act_reflection_intro`, on the
 * rich dark journal surface, mirroring the Context intro so the two read as a
 * pair. A big "REFLECTION" title with the "we'd like to hear what you think…"
 * line, a scroll cue, then scrolling into the sentinel opens the "Share Your
 * Thoughts" prompt picker (no button).
 *
 * Portaled to document.body so the fixed overlay escapes the Journal's
 * transformed (framer-motion) ancestor (Build_State §7).
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onComplete: () => void;
}

export default function ReflectionIntroCard({ onComplete }: Props) {
  const [mounted, setMounted] = useState(false);
  const enterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Scrolling past the sentinel opens the prompt picker.
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
      <section
        className="relative min-h-[100dvh] flex flex-col justify-end px-7 pb-36"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div
          className="font-display leading-[0.95] tracking-tight"
          style={{
            fontSize: 'clamp(56px, 20vw, 132px)',
            color: 'var(--th-surface)',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 800ms ease-out 200ms, transform 800ms ease-out 200ms',
          }}
        >
          Reflection
        </div>
        <p
          className="font-serif leading-snug mt-5"
          style={{
            fontSize: 'clamp(19px, 5.2vw, 28px)',
            color: 'var(--th-surface)',
            opacity: mounted ? 0.92 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(14px)',
            transition: 'opacity 900ms ease-out 900ms, transform 900ms ease-out 900ms',
            maxWidth: '26ch',
          }}
        >
          Now that you have explored{' '}
          <span style={{ color: 'var(--th-secondary)' }}>context</span>&hellip;
          <br />
          Let&rsquo;s hear <span className="italic font-display">what you think</span>&hellip;
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

      {/* Sentinel — scrolling into it opens the prompt picker */}
      <div ref={enterRef} className="h-[55vh] flex items-end justify-center pb-10" style={{ scrollSnapAlign: 'end' }}>
        <span className="font-serif italic text-[15px]" style={{ color: 'var(--th-surface)', opacity: 0.6 }}>
          Share your thoughts&hellip;
        </span>
      </div>
    </div>,
    document.body,
  );
}
