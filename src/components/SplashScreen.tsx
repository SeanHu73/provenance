'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'splash_seen';

// Timeline lives in globals.css (.splash-pin, .splash-shadow, .splash-wordmark,
// .splash-overlay). Values below mirror it so we can schedule the fade-out and
// unmount.
//   pin/shadow: 0.5s delay → 0.8s drop
//   wordmark:  1.2s delay → 0.8s fade/slide  (anim ends at 2.0s)
//   overlay fade-out: 0.7s
const ANIM_END_MS = 2000;
const FADE_OUT_MS = 700;

type Phase = 'hidden' | 'animating' | 'fading';

// useLayoutEffect runs synchronously before paint on the client so the overlay
// covers the children on the first frame. On the server it's a no-op (useEffect).
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('hidden');

  useIsoLayoutEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, '1');
    setPhase('animating');
    const fadeAt = window.setTimeout(() => setPhase('fading'), ANIM_END_MS);
    const doneAt = window.setTimeout(
      () => setPhase('hidden'),
      ANIM_END_MS + FADE_OUT_MS,
    );
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(doneAt);
    };
  }, []);

  return (
    <>
      {children}
      {phase !== 'hidden' && (
        <div
          className="splash-overlay fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-cream"
          style={{ opacity: phase === 'fading' ? 0 : 1 }}
          aria-hidden="true"
        >
          <div className="relative flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              <img
                src="/logo_transparent.png"
                alt=""
                width={160}
                height={160}
                className="splash-pin block w-40 h-auto select-none"
                draggable={false}
              />
              <div
                className="splash-shadow absolute left-1/2 -bottom-3 h-3 w-28 rounded-[50%]"
                style={{ backgroundColor: 'rgba(0,0,0,0.1)', filter: 'blur(4px)' }}
              />
            </div>
            <p
              className="splash-wordmark mt-4 font-montserrat font-medium text-[32px] leading-none tracking-[0.01em]"
              style={{ color: '#8B2D2D' }}
            >
              Provenance
            </p>
          </div>
        </div>
      )}
    </>
  );
}

