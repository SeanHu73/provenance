'use client';

/**
 * One-shot reminder overlay that darkens the whole screen for ~3.5s
 * with a message and a bouncing arrow pointing down at the footer's
 * "? Inquiries" button. Mounted on the Context (reveal) screen of
 * every third stop (see RevealCard). Rendered via a portal to
 * document.body so the fixed overlay actually covers the viewport
 * (RevealCard sits inside a framer-motion transformed ancestor, which
 * would otherwise scope `position: fixed` to the card area only).
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const TOTAL_MS = 3500;

export default function InquiryReminder() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setVisible(false), TOTAL_MS);
    return () => clearTimeout(t);
  }, []);

  if (!visible || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] pointer-events-none animate-one-shot-flash"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
    >
      {/* Message — upper-middle of the screen so it doesn't crowd the arrow */}
      <div className="absolute inset-x-0 top-[32%] flex flex-col items-center px-8 text-center">
        <p
          className="text-[24px] font-display font-semibold leading-snug"
          style={{ color: 'var(--th-surface)' }}
        >
          Curious about something?
        </p>
        <p
          className="mt-3 text-[17px] font-serif leading-snug max-w-xs"
          style={{ color: 'var(--th-surface)' }}
        >
          Tap the <span className="font-semibold">? Inquiries</span> button below
          any time to pose a question.
        </p>
      </div>

      {/* Arrow — anchored just above the footer's centred Inquiries button.
          Positioning transform sits on the outer span; animate-bounce lives
          on the inner span so the keyframe's transform doesn't clobber the
          centring translate (see Build_State §7). */}
      <span
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}
      >
        <span className="block animate-bounce">
          <svg
            width="72"
            height="72"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--th-surface)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.6))' }}
            aria-hidden="true"
          >
            <line x1="12" y1="3" x2="12" y2="17" />
            <polyline points="5 11 12 18 19 11" />
          </svg>
        </span>
      </span>
    </div>,
    document.body,
  );
}
