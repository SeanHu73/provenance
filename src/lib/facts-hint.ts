'use client';

import { useEffect, useState } from 'react';

/**
 * A one-shot signal: the end-of-act-1 screen asks the tour menu to open and point
 * at Facts.
 *
 * Being told "the answer will be under Facts" on a screen you are leaving is not
 * the same as being shown where Facts is. The learner reads that line once, taps
 * on, and by the time an answer lands they have no reason to go looking. So the
 * menu opens itself, once, with the row named — the same move onboarding makes
 * for Auto-Play, and for the same reason.
 *
 * A singleton rather than context: the screen firing this and the menu reading it
 * live in different trees.
 */
let pending = false;
const subscribers = new Set<(v: boolean) => void>();

/** Fire the hint — the menu opens and calls out the Facts row. */
export function requestFactsHint(): void {
  pending = true;
  subscribers.forEach((s) => s(true));
}

/** `[pending, clear]` — the menu reads this to know when to open + point. */
export function useFactsHint(): [boolean, () => void] {
  const [p, setP] = useState<boolean>(() => pending);
  useEffect(() => {
    const h = (v: boolean) => setP(v);
    subscribers.add(h);
    h(pending);
    return () => { subscribers.delete(h); };
  }, []);
  const clear = () => { pending = false; subscribers.forEach((s) => s(false)); };
  return [p, clear];
}
