'use client';

/**
 * One-shot reminder overlay that darkens almost the entire screen for
 * ~3.5s and "spotlights" the footer's "? Inquiries" button. Mounted on
 * the Context (reveal) screen of every third stop (see RevealCard).
 *
 * Rendered via a portal to document.body so the fixed overlay actually
 * covers the viewport (RevealCard sits inside a framer-motion
 * transformed ancestor, which would otherwise scope `position: fixed`
 * to the card area only).
 *
 * The "hole" around the button is built from a transparent box-sized
 * element positioned over the button with a massive `box-shadow`
 * spread — the shadow fills the rest of the viewport with near-opaque
 * black while the element itself stays clear, leaving the button lit.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const TOTAL_MS = 3500;
const PADDING = 10;

export default function InquiryReminder() {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => setVisible(false), TOTAL_MS);

    const findButton = () => {
      const btn = document.querySelector('[data-inquiries-button]');
      if (btn) setRect(btn.getBoundingClientRect());
    };
    findButton();
    window.addEventListener('resize', findButton);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', findButton);
    };
  }, []);

  if (!visible || !mounted) return null;

  // Arrow base position — sits just above the button when known, or a
  // sensible fallback near the bottom of the viewport if not. Animation
  // moves it up/down, so the resting (low) position is what we set.
  const arrowTop = rect
    ? rect.top - 140
    : undefined;

  return createPortal(
    <div className="fixed inset-0 z-[80] pointer-events-none animate-one-shot-flash">
      {/* Spotlight — transparent rect over the Inquiries button with a
          9999px box-shadow that paints the rest of the viewport near-
          black, plus a soft white halo to make the button glow. Falls
          back to a flat dim layer if we can't find the button. */}
      {rect ? (
        <div
          className="absolute rounded-2xl"
          style={{
            left: rect.left - PADDING,
            top: rect.top - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: `
              0 0 0 3px rgba(255,255,255,0.7),
              0 0 36px 14px rgba(255,255,255,0.45),
              0 0 0 9999px rgba(0,0,0,0.93)
            `,
          }}
        />
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.93)' }} />
      )}

      {/* Headline — top of the screen */}
      <div className="absolute inset-x-0 top-[22%] flex items-center justify-center px-6 text-center">
        <p
          className="text-[32px] font-display font-semibold leading-tight"
          style={{ color: 'var(--th-surface)', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
        >
          SHARE: Do you have any inquiries?
        </p>
      </div>

      {/* Big bouncing arrow above the spotlit button. Positioning
          translate on outer span; bounce on inner span (Build_State §7
          — animate-bounce clobbers transforms). */}
      <span
        className="absolute left-1/2 -translate-x-1/2"
        style={
          arrowTop !== undefined
            ? { top: arrowTop }
            : { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)' }
        }
      >
        <span className="block animate-bounce">
          <svg
            width="112"
            height="112"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--th-secondary)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              filter:
                'drop-shadow(0 0 8px rgba(0,0,0,0.75)) drop-shadow(0 0 22px rgba(255,255,255,0.3))',
            }}
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
