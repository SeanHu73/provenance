'use client';

/**
 * Which P.A.S.T. lens UI to show: the original chunky "door" buttons (`classic`,
 * the default) or the newer magnifying-glass lenses (`magnifier`). The journal
 * menu has a toggle to switch (for brainstorming), and the choice sticks per device.
 */

import { useEffect, useState } from 'react';

export type LensVariant = 'classic' | 'magnifier';
const DEFAULT: LensVariant = 'classic';
const KEY = 'provenance.lensVariant';
const subscribers = new Set<() => void>();

function read(): LensVariant {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'classic' || v === 'magnifier' ? v : DEFAULT;
  } catch {
    return DEFAULT;
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

/** `[variant, setVariant]`. Defaults to the magnifier; toggling persists. */
export function useLensVariant(): [LensVariant, (v: LensVariant) => void] {
  const [variant, setVariant] = useState<LensVariant>(DEFAULT);
  useEffect(() => {
    const update = () => setVariant(read());
    update();
    subscribers.add(update);
    return () => { subscribers.delete(update); };
  }, []);
  return [variant, setLensVariant];
}
