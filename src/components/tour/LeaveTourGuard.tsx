'use client';

/**
 * Guards against accidentally leaving the tour. The whole tour is one client-side
 * page with no per-stop routing, so the browser/OS back button (or a refresh /
 * tab close) would drop the learner out of the experience.
 *
 * While `active`, this traps the back button with a history entry and shows a
 * "Leave the tour?" modal, and arms a native beforeunload prompt for refresh /
 * close. Choosing "Leave" steps back for real; "Stay" keeps them in the tour.
 */

import { useEffect, useRef, useState } from 'react';

export default function LeaveTourGuard({ active }: { active: boolean }) {
  const [confirm, setConfirm] = useState(false);
  const leaving = useRef(false);

  useEffect(() => {
    if (!active) return;
    leaving.current = false;

    // Native prompt for refresh / tab close / hard navigation (skipped once the
    // learner has confirmed Leave, so our modal isn't doubled by the browser's).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaving.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    // Trap the back button: seed an entry, and on each back re-seed + confirm.
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => {
      if (leaving.current) return;
      window.history.pushState(null, '', window.location.href);
      setConfirm(true);
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('popstate', onPopState);
    };
  }, [active]);

  if (!confirm) return null;

  const stay = () => setConfirm(false);
  const leave = () => {
    leaving.current = true;
    setConfirm(false);
    window.history.back();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(20,15,10,0.55)' }} onClick={stay}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ backgroundColor: 'var(--th-surface)', border: '3px solid #241f1b', boxShadow: '5px 5px 0 rgba(36,31,27,0.85)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display font-bold text-[22px]" style={{ color: 'var(--th-primary)' }}>Leave the tour?</h2>
        <p className="mt-2 text-[14px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
          You&rsquo;re partway through — going back now will take you out of the tour.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={stay}
            className="w-full py-3 rounded-xl text-base font-semibold text-warm-white"
            style={{ backgroundColor: 'var(--th-primary)' }}
          >
            Stay in the tour
          </button>
          <button
            onClick={leave}
            className="w-full py-2.5 rounded-xl text-[15px] font-semibold"
            style={{ color: 'var(--text-secondary)', border: '2px solid var(--th-border)' }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
