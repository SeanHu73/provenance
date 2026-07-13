'use client';

/**
 * Which P.A.S.T. lens UI to show: the swipeable single-lens deck (`slider`, the
 * default), the original chunky "door" buttons (`classic`), or the
 * magnifying-glass lenses (`magnifier`). The journal menu has a toggle to switch
 * (for brainstorming), and the choice sticks per device.
 */

import { useEffect, useState } from 'react';

export type LensVariant = 'slider' | 'classic' | 'magnifier';
const VARIANTS: LensVariant[] = ['slider', 'classic', 'magnifier'];
const DEFAULT: LensVariant = 'slider';
const KEY = 'provenance.lensVariant';
const subscribers = new Set<() => void>();

function read(): LensVariant {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const v = window.localStorage.getItem(KEY);
    return (VARIANTS as string[]).includes(v ?? '') ? (v as LensVariant) : DEFAULT;
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

/** `[variant, setVariant]`. Defaults to the slider; toggling persists. */
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
