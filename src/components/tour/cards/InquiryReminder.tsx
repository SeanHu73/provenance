'use client';

/**
 * One-shot reminder overlay that darkens the screen for ~2s with text
 * and a downward arrow pointing at the footer "? Inquiries" button.
 * Mounted on the Context (reveal) screen of every third stop in a
 * tour (see RevealCard for the trigger). Self-unmounts after the
 * animation completes so it never blocks interaction for long.
 */

import { useEffect, useState } from 'react';

const TOTAL_MS = 2000;

export default function InquiryReminder() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), TOTAL_MS);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-8 text-center pointer-events-none animate-one-shot-flash"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <p
        className="text-[22px] font-display font-semibold leading-snug"
        style={{ color: 'var(--th-surface)' }}
      >
        Curious about something?
      </p>
      <p
        className="mt-2 text-[16px] font-serif leading-snug"
        style={{ color: 'var(--th-surface)' }}
      >
        Tap the <span className="font-semibold">? Inquiries</span> button below
        any time to pose a question.
      </p>
      <svg
        className="mt-6"
        width="56"
        height="56"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--th-surface)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
        aria-hidden="true"
      >
        <line x1="12" y1="3" x2="12" y2="20" />
        <polyline points="5 13 12 20 19 13" />
      </svg>
    </div>
  );
}
