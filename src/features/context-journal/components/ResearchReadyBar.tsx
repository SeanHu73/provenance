'use client';

/**
 * Background-research status overlay. Two states, on whatever screen the learner
 * is on (within the journal):
 *   - researching: a translucent, gently pulsing bar so they know a question is
 *     still being looked up even after they left the ask sheet to explore. Tap to
 *     reopen it (write a theory / cancel).
 *   - ready: a green pulsing button (+ firm haptic) pulling them back to the
 *     finished answer. Tap to reveal it.
 */

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useResearchJobs, isReadyUnseen, isPending } from '../research-store';

function readyHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([60, 50, 60, 50, 140]);
  }
}

interface Props {
  tourId: string;
  /** Suppress while the ask sheet (or another answer) is already on screen. */
  hidden?: boolean;
  onReveal: (jobId: string) => void;
}

export default function ResearchReadyBar({ tourId, hidden, onReveal }: Props) {
  const jobs = useResearchJobs();
  const mine = jobs.filter((j) => j.tourId === tourId);
  const ready = mine.filter(isReadyUnseen);
  const pending = mine.filter(isPending);
  const latestReady = ready[ready.length - 1];
  const latestPending = pending[pending.length - 1];

  const prevReady = useRef(0);
  useEffect(() => {
    if (ready.length > prevReady.current) readyHaptic();
    prevReady.current = ready.length;
  }, [ready.length]);

  if (hidden) return null;

  // Ready takes priority — draw them back to the answer.
  if (latestReady) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[85] px-4 pointer-events-none" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <motion.button
          onClick={() => onReveal(latestReady.id)}
          className="pointer-events-auto relative w-full max-w-2xl mx-auto block py-4 rounded-2xl text-white text-[16px] font-semibold shadow-2xl overflow-visible"
          style={{ backgroundColor: '#16a34a' }}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1, scale: [1, 1.03, 1] }}
          transition={{ y: { duration: 0.3 }, opacity: { duration: 0.3 }, scale: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <span className="pointer-events-none absolute inset-0 rounded-2xl animate-ping" style={{ boxShadow: '0 0 0 3px #16a34a', opacity: 0.3 }} aria-hidden />
          <span className="relative inline-flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            {ready.length > 1 ? `${ready.length} answers are ready — tap to reveal` : 'Your answer is ready — tap to reveal'}
          </span>
        </motion.button>
      </div>
    );
  }

  // Still researching — a quiet, pulsing reassurance that it's running.
  if (latestPending) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[84] px-4 pointer-events-none" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        <motion.button
          onClick={() => onReveal(latestPending.id)}
          className="pointer-events-auto w-full max-w-2xl mx-auto flex items-center justify-center gap-2.5 py-3 rounded-2xl text-[14px] font-semibold backdrop-blur-md border"
          style={{ backgroundColor: 'color-mix(in srgb, var(--th-primary) 14%, transparent)', borderColor: 'color-mix(in srgb, var(--th-primary) 35%, transparent)', color: 'var(--th-primary)' }}
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: [0.7, 1, 0.7] }}
          transition={{ y: { duration: 0.3 }, opacity: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } }}
        >
          <span className="inline-flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--th-primary)', animationDelay: `${i * 0.2}s` }} />
            ))}
          </span>
          {pending.length > 1 ? `Still researching ${pending.length} questions — keep exploring` : 'Still researching your question — keep exploring'}
        </motion.button>
      </div>
    );
  }

  return null;
}
