'use client';

/**
 * "Your answer is ready" overlay. Watches the background research store and, when
 * a job the learner kicked off finishes while they're off exploring something
 * else, pops a green pulsing button at the bottom of the screen (with a firm
 * haptic) to pull them back. Tapping reopens that answer.
 */

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useResearchJobs, isReadyUnseen, type ResearchJob } from '../research-store';

function readyHaptic() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([60, 50, 60, 50, 140]);
  }
}

interface Props {
  /** Only surface jobs for this tour/scope. */
  tourId: string;
  /** Suppress while the ask sheet (or another answer) is already on screen. */
  hidden?: boolean;
  onReveal: (jobId: string) => void;
}

export default function ResearchReadyBar({ tourId, hidden, onReveal }: Props) {
  const jobs = useResearchJobs();
  const ready = jobs.filter((j) => j.tourId === tourId && isReadyUnseen(j));
  const latest: ResearchJob | undefined = ready[ready.length - 1];

  // Buzz once when a new answer becomes ready.
  const prevReady = useRef(0);
  useEffect(() => {
    if (ready.length > prevReady.current) readyHaptic();
    prevReady.current = ready.length;
  }, [ready.length]);

  if (hidden || !latest) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[85] px-4 pb-5 pointer-events-none" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
      <motion.button
        onClick={() => onReveal(latest.id)}
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
