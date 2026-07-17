'use client';

/**
 * The P.A.S.T. framework slide, shown as a raised card so the lenses read as a
 * distinct panel (not floating on the warm onboarding canvas).
 *
 * Each lens starts as just its big coloured initial (P / A / S / T); the rest of
 * the word, its sub-topics, and the magnifier sit **blurred** until the learner
 * taps that lens to unveil the meaning behind the acronym. Once unveiled, the
 * magnifier opens the shared PastLensCard with the sample context questions.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LENSES, type LensDef } from '@/features/context-journal/constants';
import PastLensCard from '@/features/context-journal/components/PastLensCard';

/** A light haptic tick (no-op where unsupported). */
function haptic(ms = 12) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

/** "P.A.S.T." inline, each letter in its lens colour. Lives here rather than in
 *  the intro onboarding because the P.A.S.T. teaching moved to the first Context
 *  step — this is the module both surfaces share. */
export function PastWord() {
  return (
    <strong className="onb-past">
      <span style={{ color: 'var(--onb-place)' }}>P</span>.
      <span style={{ color: 'var(--th-secondary)' }}>A</span>.
      <span style={{ color: 'var(--onb-society)' }}>S</span>.
      <span style={{ color: 'var(--onb-time)' }}>T</span>.
    </strong>
  );
}

export default function PastFramework({ onAllRevealed }: { onAllRevealed?: () => void } = {}) {
  const [openLens, setOpenLens] = useState<LensDef | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const allRevealed = revealed.size === LENSES.length;

  // Tell the onboarding once every lens has been unveiled (unlocks the scroll).
  useEffect(() => { if (allRevealed) onAllRevealed?.(); }, [allRevealed, onAllRevealed]);

  const reveal = (key: string) =>
    setRevealed((prev) => {
      if (prev.has(key)) return prev;
      haptic();
      const next = new Set(prev);
      next.add(key);
      return next;
    });

  return (
    <div>
      <div className="flex flex-col gap-4">
        {LENSES.map((lens) => {
          const isRevealed = revealed.has(lens.key);
          return (
            <div
              key={lens.key}
              role="button"
              tabIndex={0}
              onClick={() => reveal(lens.key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(lens.key); } }}
              aria-label={isRevealed ? lens.label : `Reveal the ${lens.label[0]} lens`}
              className="w-full text-left flex items-center gap-3 rounded-2xl pl-4 pr-4 py-4 shadow-lg"
              style={{ backgroundColor: 'var(--th-surface)', border: '1px solid var(--th-border)', borderLeft: `4px solid ${lens.colour}`, cursor: isRevealed ? 'default' : 'pointer' }}
            >
              <div className="flex-1 min-w-0">
                {/* The big initial always shows; the rest of the word unblurs on tap. */}
                <div className="font-display leading-none flex items-baseline" style={{ color: lens.colour }}>
                  <span style={{ fontSize: 'clamp(40px, 12vw, 56px)' }}>{lens.label[0]}</span>
                  <span
                    className="transition-all duration-300"
                    style={{ fontSize: 'clamp(22px, 6.5vw, 30px)', filter: isRevealed ? 'none' : 'blur(6px)', opacity: isRevealed ? 1 : 0.4 }}
                  >
                    {lens.label.slice(1)}
                  </span>
                </div>
                <div
                  className="font-serif mt-1.5 leading-snug transition-all duration-300"
                  style={{ color: 'var(--th-text)', fontSize: 15, filter: isRevealed ? 'none' : 'blur(6px)', opacity: isRevealed ? 0.92 : 0.35 }}
                >
                  {lens.definition}
                </div>
              </div>
              {/* Magnifier — blurred/inert until the lens is unveiled, then opens its card. */}
              <span
                role="button"
                tabIndex={isRevealed ? 0 : -1}
                aria-hidden={!isRevealed}
                onClick={(e) => { if (!isRevealed) return; e.stopPropagation(); setOpenLens(lens); }}
                onKeyDown={(e) => { if (isRevealed && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); setOpenLens(lens); } }}
                aria-label={`See ${lens.label} example questions`}
                className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all duration-300"
                style={{ color: lens.colour, borderColor: lens.colour, filter: isRevealed ? 'none' : 'blur(4px)', opacity: isRevealed ? 1 : 0.3, pointerEvents: isRevealed ? 'auto' : 'none' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] italic text-center mt-4" style={{ color: 'var(--th-text)', opacity: 0.6 }}>
        {allRevealed ? 'Tap the magnifier to see example questions.' : 'Tap each lens to reveal what it means.'}
      </p>

      <AnimatePresence>
        {openLens && <PastLensCard lens={openLens} onClose={() => setOpenLens(null)} />}
      </AnimatePresence>
    </div>
  );
}
