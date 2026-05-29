'use client';

/**
 * Generic darken-and-spotlight overlay used by the onboarding flow to
 * point the explorer at a specific button or pin. Rendered through a
 * portal so the fixed positioning escapes any transformed ancestors.
 *
 * Pass a CSS selector for the target element; the overlay queries it
 * via `document.querySelector`, polls bounding rect on resize, and
 * paints the rest of the viewport near-opaque via a 9999px box-shadow.
 * The target keeps a soft white glow ring.
 *
 * `message` renders centred over the dim. `onTargetTap` fires when the
 * spotlit element is clicked (we attach the listener directly because
 * the overlay's `pointer-events: none` lets clicks reach through).
 *
 * `circleTarget` swaps the glow ring for a thicker animated circle —
 * used for the "close the modal" cue.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  targetSelector: string;
  message?: React.ReactNode;
  /** Rendered below the message (e.g. a pulsing arrow). */
  arrow?: React.ReactNode;
  /** Hard opacity for the dim layer. 0.65 = noticeable but not pitch black. */
  dimOpacity?: number;
  /** Extra space around the target rect (px). */
  padding?: number;
  /** When true, render a thicker animated ring instead of the soft glow. */
  circleTarget?: boolean;
  /** Fires when the user taps the spotlit element. */
  onTargetTap?: () => void;
  /** Fires when the user taps anywhere OUTSIDE the spotlit element. */
  onOutsideTap?: () => void;
}

export default function SpotlightOverlay({
  targetSelector,
  message,
  arrow,
  dimOpacity = 0.7,
  padding = 12,
  circleTarget = false,
  onTargetTap,
  onOutsideTap,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
    let raf: number | null = null;
    const measure = () => {
      const el = document.querySelector(targetSelector) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    measure();
    // re-measure once on next frame in case layout settles
    raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [targetSelector]);

  // Bind a click listener directly on the target so the overlay can
  // capture the tap even though the dim layer is pointer-events-none.
  useEffect(() => {
    if (!onTargetTap) return;
    const el = document.querySelector(targetSelector) as HTMLElement | null;
    if (!el) return;
    const handler = (e: Event) => {
      e.stopPropagation();
      onTargetTap();
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [targetSelector, onTargetTap]);

  if (!mounted) return null;

  const ring = circleTarget
    ? `0 0 0 4px rgba(255,255,255,0.95), 0 0 0 8px var(--th-secondary)`
    : `0 0 0 3px rgba(255,255,255,0.7), 0 0 32px 14px rgba(255,255,255,0.4)`;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] pointer-events-auto animate-fade-in"
      onClick={(e) => {
        // Outside-tap only when user clicks the dim itself.
        if (e.target === e.currentTarget && onOutsideTap) onOutsideTap();
      }}
    >
      {rect ? (
        <div
          className="absolute rounded-2xl pointer-events-none"
          style={{
            left: rect.left - padding,
            top: rect.top - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            boxShadow: `${ring}, 0 0 0 9999px rgba(0,0,0,${dimOpacity})`,
          }}
        />
      ) : (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: `rgba(0,0,0,${dimOpacity})` }} />
      )}
      {message && (
        <div className="absolute inset-x-0 top-[18%] px-8 text-center pointer-events-none">
          <div
            className="text-[22px] font-display font-semibold leading-snug"
            style={{ color: 'var(--th-surface)', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {message}
          </div>
        </div>
      )}
      {arrow && rect && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ top: rect.top - 120 }}
        >
          {arrow}
        </div>
      )}
    </div>,
    document.body,
  );
}
