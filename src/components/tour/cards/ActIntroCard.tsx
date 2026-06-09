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

const HOLD_MS = 2500;

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

  return createPortal(
    <div
      onClick={onComplete}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black cursor-pointer select-none px-8 text-center"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 600ms ease-in' }}
    >
      <div
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(14px)',
          transition: 'opacity 700ms ease-out 300ms, transform 700ms ease-out 300ms',
        }}
      >
        {/* "Act N" — amber, very large */}
        <div
          className="font-display font-bold leading-none"
          style={{ fontSize: 'clamp(48px, 15vw, 104px)', color: '#F59E0B' }}
        >
          Act {actNumber}
        </div>
        {/* Act name — white, regular, slightly smaller but still large */}
        {actTitle.trim() && (
          <div
            className="font-serif text-warm-white leading-tight mt-3"
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
