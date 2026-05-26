'use client';

import { useEffect, useState } from 'react';

const KEY = 'provenance.audioAutoplay';

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
 * Tour-wide user preference: when true, audio on a card autoplays on mount
 * (unless the admin disabled autoplay for that specific audio). Persisted in
 * localStorage so the choice survives a page reload. The setter broadcasts to
 * every subscriber so the footer toggle and any other consumer stay in sync.
 */
export function useAudioAutoplay(): [boolean, (v: boolean) => void] {
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
