'use client';

import { useEffect, useState } from 'react';

const KEY = 'provenance.audioSpeed';

/** The speeds the player cycles through. Tap the speed chip to advance. */
export const AUDIO_SPEEDS = [1, 1.25, 1.5, 2] as const;

const subscribers = new Set<(v: number) => void>();
let cached: number | null = null;

function clamp(n: number): number {
  return (AUDIO_SPEEDS as readonly number[]).includes(n) ? n : 1;
}

function readInitial(): number {
  if (typeof window === 'undefined') return 1;
  if (cached !== null) return cached;
  try {
    cached = clamp(parseFloat(window.localStorage.getItem(KEY) || '1'));
  } catch {
    cached = 1;
  }
  return cached;
}

/**
 * Tour-wide playback speed for narration audio (1x–2x). Persisted in localStorage
 * and broadcast to every player so the choice sticks across clips and screens. The
 * next speed in the cycle is `nextAudioSpeed(current)`.
 */
export function useAudioSpeed(): [number, (v: number) => void] {
  const [speed, setSpeed] = useState<number>(readInitial);

  useEffect(() => {
    const handler = (v: number) => setSpeed(v);
    subscribers.add(handler);
    handler(readInitial());
    return () => { subscribers.delete(handler); };
  }, []);

  const update = (v: number) => {
    const next = clamp(v);
    cached = next;
    try { window.localStorage.setItem(KEY, String(next)); } catch {}
    subscribers.forEach((s) => s(next));
  };

  return [speed, update];
}

/** The next speed in the cycle (wraps back to the first after the last). */
export function nextAudioSpeed(current: number): number {
  const i = AUDIO_SPEEDS.indexOf(clamp(current) as (typeof AUDIO_SPEEDS)[number]);
  return AUDIO_SPEEDS[(i + 1) % AUDIO_SPEEDS.length];
}

/** A short label for a speed, e.g. 1.5 -> "1.5×", 1 -> "1×". */
export function speedLabel(v: number): string {
  return `${v}×`;
}
