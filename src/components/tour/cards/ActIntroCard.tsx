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

const HOLD_MS = 4000;

interface Props {
  actNumber: number;
  actTitle: string;
  onComplete: () => void;
}

export default function ActIntroCard({ actNumber, actTitle, onComplete }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(onComplete, HOLD_MS);
    return () => clearTimeout(t);
    // onComplete is stable enough; we only want this to run once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === 'undefined') return null;

  const label = actTitle.trim() ? `Act ${actNumber}: ${actTitle}` : `Act ${actNumber}`;

  return createPortal(
    <div
      onClick={onComplete}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black cursor-pointer select-none px-8"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 600ms ease-in' }}
    >
      <h1
        className="font-display text-center text-warm-white leading-tight"
        style={{
          fontSize: 'clamp(28px, 7vw, 52px)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(12px)',
          transition: 'opacity 700ms ease-out 300ms, transform 700ms ease-out 300ms',
        }}
      >
        {label}
      </h1>
    </div>,
    document.body,
  );
}
