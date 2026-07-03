'use client';

/**
 * The P.A.S.T. framework slide. Each lens shows its name + sub-topics
 * (definition); a magnifying-glass button opens a full lens card with the
 * sample context questions (shared PastLensCard) — replacing the old slide-to-
 * reveal interaction.
 */

import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LENSES, type LensDef } from '@/features/context-journal/constants';
import PastLensCard from '@/features/context-journal/components/PastLensCard';

export default function PastFramework() {
  const [openLens, setOpenLens] = useState<LensDef | null>(null);

  return (
    <div className="flex flex-col gap-3.5">
      {LENSES.map((lens) => (
        <div key={lens.key} className="flex items-center gap-3 pl-3.5" style={{ borderLeft: `3px solid ${lens.colour}` }}>
          <div className="flex-1 min-w-0">
            <div className="font-display leading-none" style={{ color: lens.colour, fontSize: 'clamp(24px, 7vw, 34px)' }}>
              {lens.label}
            </div>
            <div className="font-serif mt-1.5 leading-snug" style={{ color: 'var(--th-surface)', opacity: 0.88, fontSize: 14 }}>
              {lens.definition}
            </div>
          </div>
          <button
            onClick={() => setOpenLens(lens)}
            aria-label={`See ${lens.label} example questions`}
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2"
            style={{ color: lens.colour, borderColor: lens.colour }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
            </svg>
          </button>
        </div>
      ))}
      <p className="text-[13px] italic text-center mt-1" style={{ color: 'var(--th-surface)', opacity: 0.7 }}>
        Tap the magnifier to see example questions.
      </p>

      <AnimatePresence>
        {openLens && <PastLensCard lens={openLens} onClose={() => setOpenLens(null)} />}
      </AnimatePresence>
    </div>
  );
}
