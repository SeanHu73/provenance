'use client';

/**
 * Context-Prototype — the "Act N: Title" title card shown at the start of
 * each act. Fades the whole screen to black, holds for ~4s, then advances.
 * Tapping advances early.
 *
 * Rendered via a portal to document.body so the fixed full-screen overlay
 * escapes the Journal's transformed (framer-motion) ancestor — `position:
 * fixed` is scoped to a transformed parent otherwise (see Build_State §7).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  actNumber: number;
  actTitle: string;
  onComplete: () => void;
}

export default function ActIntroCard({ actNumber, actTitle, onComplete }: Props) {
  const [mounted, setMounted] = useState(false);
  // The screen no longer auto-advances — a "Ready to explore?" button fades in
  // so the learner confirms they've read it.
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    // 0.9s — the onboarding's delay ceiling. Longer and the only control on the
    // screen is missing for long enough that it reads as a screen that's stuck.
    const t = setTimeout(() => setShowButton(true), 900);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black select-none px-8 text-center"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 600ms ease-in' }}
    >
      <div
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 700ms ease-out 300ms, transform 700ms ease-out 300ms',
        }}
      >
        {/* Phase marker — begins EXPLORE; matches the Contextualise/Reflect fade
            scenes' display font, and larger than "Act N". */}
        <div
          className="font-display font-normal leading-[0.95] tracking-tight mb-20 text-warm-white"
          style={{ fontSize: 'clamp(64px, 21vw, 148px)' }}
        >
          Explore
        </div>
        {/* "Act N" — amber, italic, secondary to the phase word */}
        <div
          className="font-display italic font-bold leading-none"
          style={{ fontSize: 'clamp(38px, 10vw, 76px)', color: '#F59E0B' }}
        >
          Act {actNumber}
        </div>
        {/* Act name / guiding question — white, regular, slightly smaller but still large */}
        {actTitle.trim() && (
          <div
            className="font-serif text-warm-white leading-tight mt-5"
            style={{ fontSize: 'clamp(28px, 8vw, 60px)' }}
          >
            {actTitle}
          </div>
        )}
      </div>

      {/* Ready button — fades in to confirm they've read the screen */}
      <button
        onClick={onComplete}
        className="mt-12 px-8 py-3.5 rounded-full text-lg font-semibold"
        style={{
          backgroundColor: '#F59E0B',
          color: '#1a1a1a',
          opacity: showButton ? 1 : 0,
          transform: showButton ? 'translateY(0)' : 'translateY(10px)',
          pointerEvents: showButton ? 'auto' : 'none',
          transition: 'opacity 600ms ease-out, transform 600ms ease-out',
        }}
      >
        Ready to explore?
      </button>
    </div>,
    document.body,
  );
}
