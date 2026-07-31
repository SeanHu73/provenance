'use client';

/**
 * Dev Jump — an admin escape hatch for checking the tour by hand.
 *
 * Off by default, and it must stay that way: it disables the gates that make the
 * tour work as a *learning* design (ask your own question before you read others'
 * contexts, engage the lenses before you continue). Those gates are pedagogy, not
 * plumbing. This exists so Sean can inspect any stage in seconds without playing
 * the whole tour to reach it — nothing more.
 *
 * A localStorage-backed singleton with subscribers, matching `autoplay-hint.ts`,
 * because the readers live in unrelated trees: the menu (TourMenu), the journal
 * gates (ContextJournal), the footer lock (TourFooter), and the research gate
 * (ReflectGate). A React context would mean threading a provider through all four.
 *
 * **sessionStorage, not localStorage.** It has to survive the reload the tour does
 * on some transitions, so it can't be pure in-memory — but it must not survive the
 * tab. On localStorage a jump switched on once stayed on for that device forever,
 * so a visitor could arrive at a phone with the tour's gates already disabled and
 * never know the difference. Now every fresh open starts off.
 *
 * `try/catch` because Safari private mode throws on storage access.
 */

import { useEffect, useState } from 'react';

const KEY = 'mc_dev_jump_v1';

function read(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

let on = read();
const subscribers = new Set<(v: boolean) => void>();

export function setDevJump(v: boolean): void {
  on = v;
  try { window.sessionStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode */ }
  subscribers.forEach((s) => s(v));
}

/**
 * `[on, setOn]` — the toggle's own state.
 *
 * Starts `false` on every render, including when localStorage says `true`, and
 * syncs in the effect. That is deliberate: the server has no localStorage, so
 * seeding from it during render would make the first client render disagree with
 * the server's HTML and hydration would fail. One frame of "off" is the cost.
 */
export function useDevJump(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(false);
  useEffect(() => {
    const h = (next: boolean) => setV(next);
    subscribers.add(h);
    h(read());
    return () => { subscribers.delete(h); };
  }, []);
  return [v, setDevJump];
}

/** Read-only — for the gates, which only ever ask "am I bypassed?". */
export function useDevJumpOn(): boolean {
  return useDevJump()[0];
}
