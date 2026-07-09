'use client';

/**
 * A/B flag for the P.A.S.T. lens UI: the original chunky "door" buttons
 * (`classic`) vs the new magnifying-glass lenses (`magnifier`).
 *
 * Each device is assigned a variant 50/50 the first time and it sticks
 * (persisted), so people organically split across the two for testing. A manual
 * override (the journal menu toggle) lets you force either for a demo.
 */

import { useEffect, useState } from 'react';

export type LensVariant = 'classic' | 'magnifier';
const KEY = 'provenance.lensVariant';
const subscribers = new Set<() => void>();

function read(): LensVariant {
  if (typeof window === 'undefined') return 'classic';
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'classic' || v === 'magnifier') return v;
    // First visit — assign a stable 50/50 bucket.
    const assigned: LensVariant = Math.random() < 0.5 ? 'classic' : 'magnifier';
    window.localStorage.setItem(KEY, assigned);
    return assigned;
  } catch {
    return 'classic';
  }
}

/** Non-hook read — for logging which variant a session used. */
export function getLensVariant(): LensVariant {
  return read();
}

export function setLensVariant(v: LensVariant): void {
  try { window.localStorage.setItem(KEY, v); } catch { /* ignore */ }
  subscribers.forEach((s) => s());
}

/** `[variant, setVariant]`. Assigns (and persists) a bucket on first use. */
export function useLensVariant(): [LensVariant, (v: LensVariant) => void] {
  const [variant, setVariant] = useState<LensVariant>('classic');
  useEffect(() => {
    const update = () => setVariant(read());
    update();
    subscribers.add(update);
    return () => { subscribers.delete(update); };
  }, []);
  return [variant, setLensVariant];
}
