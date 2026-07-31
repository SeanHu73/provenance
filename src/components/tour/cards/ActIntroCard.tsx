'use client';

/**
 * Context-Prototype — the "Act N: Title" title card shown at the start of
 * each act. Fades the whole screen to black, holds, then opens the map on its
 * own. Tapping anywhere advances early.
 *
 * Rendered via a portal to document.body so the fixed full-screen overlay
 * escapes the Journal's transformed (framer-motion) ancestor — `position:
 * fixed` is scoped to a transformed parent otherwise (see Build_State §7).
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  actNumber: number;
  actTitle: string;
  onComplete: () => void;
}

/** How long the title holds before the map opens. Long enough to read "Act 2"
 *  and its guiding question, short enough not to feel like a wait. */
const HOLD_MS = 3500;

export default function ActIntroCard({ actNumber, actTitle, onComplete }: Props) {
  const [mounted, setMounted] = useState(false);

  // No button. This screen only names the act, and asking someone to confirm
  // they have read two lines put a tap between them and the tour for nothing —
  // it advances itself, and a tap anywhere skips the wait.
  //
  // `onComplete` is held in a ref and the effect runs ONCE. It came from the tour
  // context, where it is rebuilt whenever the session changes — and the session
  // changes constantly right after the opening investigation, as each answer
  // lands and is written back. With `[onComplete]` in the deps that tore down and
  // restarted the timer every time, so it never fired and the screen hung.
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    const t = setTimeout(() => doneRef.current(), HOLD_MS);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black select-none px-8 text-center"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 600ms ease-in' }}
      onClick={onComplete}
      role="button"
      tabIndex={0}
      aria-label={`Act ${actNumber}. Tap to continue.`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onComplete(); } }}
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

    </div>,
    document.body,
  );
}
