'use client';

import { useEffect, useState } from 'react';

const KEY = 'provenance.readMode';

const subscribers = new Set<(v: boolean) => void>();
let cached: boolean | null = null;

function readInitial(): boolean {
  if (typeof window === 'undefined') return false;
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(KEY) === '1';
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * Tour-wide "Read" preference: when true, the learner prefers reading over
 * listening, so read-along text on cards is **expanded by default** (rather than
 * collapsed behind a "Read Along" toggle). Chosen in the Quick Set Up audio step
 * — "Read" sets this true (and audio to tap-to-play); "Listen" sets it false.
 * Persisted in localStorage; the setter broadcasts to every subscriber.
 */
export function useReadMode(): [boolean, (v: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(readInitial);

  useEffect(() => {
    const handler = (v: boolean) => setEnabled(v);
    subscribers.add(handler);
    handler(readInitial());
    return () => { subscribers.delete(handler); };
  }, []);

  const update = (v: boolean) => {
    cached = v;
    try { window.localStorage.setItem(KEY, v ? '1' : '0'); } catch {}
    subscribers.forEach((s) => s(v));
  };

  return [enabled, update];
}
