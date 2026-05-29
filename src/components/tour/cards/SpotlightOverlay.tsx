'use client';

/**
 * Generic darken-and-spotlight overlay used by the onboarding flow to
 * point the explorer at a specific button or pin. Rendered through a
 * portal so the fixed positioning escapes any transformed ancestors.
 *
 * Layout — the dim is split into four pointer-events-auto panels
 * arranged AROUND the target rect (top / bottom / left / right). The
 * target area itself has NO overlay, so clicks pass straight through
 * to the underlying element. A separate pointer-events-none ring is
 * drawn over the target for the visual glow.
 *
 * `targetSelector` is a CSS selector; the overlay queries it via
 * `document.querySelector`, polls bounding rect on resize / scroll,
 * and waits for the element to mount.
 *
 * `circleTarget` swaps the soft glow for a thicker animated ring —
 * used for the "close the modal" cue.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  targetSelector: string;
  message?: React.ReactNode;
  /** Rendered below the message (e.g. a pulsing arrow). */
  arrow?: React.ReactNode;
  /** Opacity of the dim panels. 0.65 = noticeable but not pitch black. */
  dimOpacity?: number;
  /** Extra space around the target rect (px). */
  padding?: number;
  /** When true, render a thicker animated ring instead of the soft glow. */
  circleTarget?: boolean;
  /** Fires when the user taps the spotlit element. Listener attached
   *  directly to the target so it works even though the overlay panels
   *  don't cover the target. */
  onTargetTap?: () => void;
  /** Fires when the user taps anywhere on the DIM (one of the four
   *  surrounding panels). */
  onOutsideTap?: () => void;
  /** When false, skip the dim panels entirely — just draw the ring
   *  over the target. Useful when the underlying UI must remain
   *  visible (e.g. the Inquiries modal stays readable while we cue
   *  the close X). */
  dim?: boolean;
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
  dim = true,
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
    raf = requestAnimationFrame(measure);
    // Also poll briefly in case the target mounts after us (e.g. modal
    // not yet open).
    const interval = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      clearInterval(interval);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [targetSelector]);

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

  if (!mounted || !rect) {
    // Fall back to a single full-screen dim while we wait for the
    // target to mount; clicks on it still hit onOutsideTap.
    if (!mounted) return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[80] animate-fade-in"
        style={{ backgroundColor: `rgba(0,0,0,${dimOpacity})` }}
        onClick={() => onOutsideTap?.()}
      />,
      document.body,
    );
  }

  const bg = `rgba(0,0,0,${dimOpacity})`;
  const holeTop = rect.top - padding;
  const holeLeft = rect.left - padding;
  const holeRight = rect.right + padding;
  const holeBottom = rect.bottom + padding;
  const holeWidth = rect.width + padding * 2;
  const holeHeight = rect.height + padding * 2;

  // 4-panel dim — each captures pointer events for outside-tap. The
  // target rect itself is uncovered so clicks go through to the
  // underlying element. Using static inset positioning so the panels
  // exactly tile the viewport with no gaps and no overlap.
  return createPortal(
    <div className="fixed inset-0 z-[80] pointer-events-none animate-fade-in">
      {dim && (
        <>
          <div
            className="absolute pointer-events-auto"
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, holeTop), backgroundColor: bg }}
            onClick={() => onOutsideTap?.()}
          />
          <div
            className="absolute pointer-events-auto"
            style={{ top: holeBottom, left: 0, right: 0, bottom: 0, backgroundColor: bg }}
            onClick={() => onOutsideTap?.()}
          />
          <div
            className="absolute pointer-events-auto"
            style={{ top: holeTop, left: 0, width: Math.max(0, holeLeft), height: holeHeight, backgroundColor: bg }}
            onClick={() => onOutsideTap?.()}
          />
          <div
            className="absolute pointer-events-auto"
            style={{ top: holeTop, left: holeRight, right: 0, height: holeHeight, backgroundColor: bg }}
            onClick={() => onOutsideTap?.()}
          />
        </>
      )}

      {/* Visual ring around the hole. Pointer-events-none so clicks
          on the target pass through to the element underneath. */}
      <div
        className="absolute rounded-2xl pointer-events-none"
        style={{
          left: holeLeft,
          top: holeTop,
          width: holeWidth,
          height: holeHeight,
          boxShadow: circleTarget
            ? '0 0 0 4px rgba(255,255,255,0.95), 0 0 0 8px var(--th-secondary)'
            : '0 0 0 3px rgba(255,255,255,0.7), 0 0 32px 14px rgba(255,255,255,0.4)',
        }}
      />

      {(message || arrow) && (
        // Stack message + arrow vertically ABOVE the target so the
        // callout reads as a single tooltip pointing down at the
        // spotlit element. `bottom` is computed so the stack's bottom
        // edge sits ~12 px above the spotlight ring.
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none flex flex-col items-center gap-3 px-2"
          style={{
            bottom: `calc(100vh - ${holeTop}px + 12px)`,
            maxWidth: '96vw',
            width: '96vw',
          }}
        >
          {message && (
            <div
              className="text-center text-[22px] font-display font-semibold leading-snug"
              style={
                dim
                  ? { color: 'var(--th-surface)', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }
                  : { color: 'var(--text-primary)' }
              }
            >
              {message}
            </div>
          )}
          {arrow && <div>{arrow}</div>}
        </div>
      )}

    </div>,
    document.body,
  );
}
