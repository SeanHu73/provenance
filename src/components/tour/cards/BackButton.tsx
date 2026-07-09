'use client';

/**
 * Deprecated: the per-card back arrow beside Continue / Explore-more buttons.
 * Back navigation now lives solely in the phase header's back arrow at the top,
 * so this renders nothing. Kept as a no-op component so its ~19 call sites don't
 * all need editing (a null child collapses cleanly in their flex rows).
 */
export default function BackButton() {
  return null;
}
