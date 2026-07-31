'use client';

/**
 * The admin controls' hiding place.
 *
 * Dev Jump and the research-mode switch are both admin-only and both do things a
 * visitor should never trip over — one disables the tour's learning gates, the
 * other changes the Detective for every user at once. They used to sit in the
 * menu in plain sight, one tap from anyone who opened it looking for the audio
 * toggle. Now they aren't rendered at all until the menu button itself is tapped
 * five times in a row.
 *
 * The menu button rather than a hidden target in the panel: it is already there
 * on every screen, it needs no affordance of its own, and a stray double-tap just
 * opens and closes the menu — which is what it looks like it should do.
 *
 * Not security — anyone reading this file knows the gesture. It is there so the
 * controls can't be found by accident, which is the actual risk during a tour.
 *
 * sessionStorage, like `dev-jump`: it survives the reloads the tour does, and
 * clears when the tab closes, so a device handed to the next visitor starts
 * locked again.
 */

import { useEffect, useState } from 'react';

const KEY = 'mc_admin_unlock_v1';
/** Enough that nobody arrives here by fidgeting; few enough to do one-handed.
 *  Odd, so the last tap leaves the menu open rather than shut. */
const TAPS_REQUIRED = 5;
/** Taps have to be deliberate — a gap this long and the count starts over. */
const TAP_WINDOW_MS = 3000;

function read(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

let unlocked = read();
const subscribers = new Set<(v: boolean) => void>();

function set(v: boolean): void {
  unlocked = v;
  try { window.sessionStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode */ }
  subscribers.forEach((s) => s(v));
}

export function lockAdmin(): void {
  set(false);
}

/**
 * `[unlocked, tap]`.
 *
 * `tap` registers one press on the menu button. Nothing is shown while the count
 * builds — no badge, no counter. A visible countdown would announce that a hidden
 * thing exists to anyone who happened to tap twice, which defeats the point of
 * hiding it; the haptic on success is confirmation enough for whoever meant it.
 *
 * Starts `false` on every render and syncs in an effect — the server has no
 * sessionStorage, so seeding from it during render would break hydration.
 */
export function useAdminUnlock(): [boolean, () => void] {
  const [on, setOn] = useState(false);
  const [taps, setTaps] = useState(0);
  const [lastTap, setLastTap] = useState(0);

  useEffect(() => {
    const h = (next: boolean) => setOn(next);
    subscribers.add(h);
    h(read());
    return () => { subscribers.delete(h); };
  }, []);

  const tap = () => {
    if (unlocked) return;
    const now = Date.now();
    const next = now - lastTap > TAP_WINDOW_MS ? 1 : taps + 1;
    setLastTap(now);
    if (next >= TAPS_REQUIRED) {
      setTaps(0);
      set(true);
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate([15, 40, 15]);
      return;
    }
    setTaps(next);
  };

  return [on, tap];
}
