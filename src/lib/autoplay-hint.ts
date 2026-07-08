'use client';

import { useEffect, useState } from 'react';

// A one-shot signal: onboarding asks the tour menu to open and point out the
// Auto-Play toggle right after the learner picks Listen/Read. A lightweight
// singleton (no context) so the two live in different trees.
let pending = false;
const subscribers = new Set<(v: boolean) => void>();

/** Fire the hint — the menu will open and highlight the Auto-Play toggle. */
export function requestAutoplayHint(): void {
  pending = true;
  subscribers.forEach((s) => s(true));
}

/** `[pending, clear]` — the menu reads this to know when to open + highlight. */
export function useAutoplayHint(): [boolean, () => void] {
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
