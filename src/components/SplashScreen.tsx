'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const STORAGE_KEY = 'splash_seen';

const PIN_DELAY = 0.3;
const PIN_DURATION = 0.8;
const WORDMARK_DELAY = 1.0;
const WORDMARK_DURATION = 0.6;
const ANIM_END_MS = (WORDMARK_DELAY + WORDMARK_DURATION) * 1000; // 1600
const FADE_OUT_S = 0.5;

const PIN_EASE: [number, number, number, number] = [0.22, 1.8, 0.36, 1];

type Phase = 'hidden' | 'animating' | 'fading';

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('hidden');

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, '1');
    setPhase('animating');
    const fadeAt = window.setTimeout(() => setPhase('fading'), ANIM_END_MS);
    const doneAt = window.setTimeout(
      () => setPhase('hidden'),
      ANIM_END_MS + FADE_OUT_S * 1000,
    );
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(doneAt);
    };
  }, []);

  return (
    <>
      {children}
      <AnimatePresence>
        {phase !== 'hidden' && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-cream"
            initial={{ opacity: 1 }}
            animate={{ opacity: phase === 'fading' ? 0 : 1 }}
            transition={{ duration: FADE_OUT_S, ease: 'easeOut' }}
            aria-hidden="true"
          >
            <div className="relative flex flex-col items-center">
              {/* Logo + shadow */}
              <div className="relative flex items-center justify-center">
                <motion.img
                  src="/Logo.png"
                  alt=""
                  width={80}
                  height={80}
                  className="block w-20 h-auto select-none"
                  draggable={false}
                  initial={{ y: '-120vh' }}
                  animate={{ y: 0 }}
                  transition={{ delay: PIN_DELAY, duration: PIN_DURATION, ease: PIN_EASE }}
                />
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 -bottom-3 h-2 w-14 rounded-[50%]"
                  style={{ backgroundColor: 'rgba(0,0,0,0.1)', filter: 'blur(3px)' }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: PIN_DELAY, duration: PIN_DURATION, ease: PIN_EASE }}
                />
              </div>

              {/* Wordmark */}
              <motion.p
                className="mt-4 font-montserrat font-medium text-[32px] leading-none tracking-[0.01em]"
                style={{ color: '#8B2D2D' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: WORDMARK_DELAY, duration: WORDMARK_DURATION, ease: 'easeOut' }}
              >
                Provenance
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
