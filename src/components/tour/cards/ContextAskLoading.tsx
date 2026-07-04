'use client';

/**
 * Loading state shown while the Context Detective researches a learner's own
 * question (the /api/ask pipeline runs for ~10–30s). A magnifying glass scans a
 * small stack of documents, with the provenance Notice below explaining where
 * the forthcoming answer's information comes from.
 */

import { motion } from 'framer-motion';

const NOTICE =
  'The answer below prioritises information curated and stored by the tour designer. '
  + 'Missing details are supplemented by looking online — prioritising academic resources '
  + 'and the university’s own or other official sites.';

export default function ContextAskLoading() {
  return (
    <div className="animate-fade-in flex flex-col items-center py-4">
      {/* Scanning-documents animation */}
      <div className="relative" style={{ width: 220, height: 168 }}>
        {/* A small fanned stack of documents */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-lg border shadow-sm overflow-hidden"
            style={{
              width: 96,
              height: 124,
              left: 46 + i * 12,
              top: 18 + i * 3,
              backgroundColor: 'var(--th-surface)',
              borderColor: 'var(--th-border)',
              transform: `rotate(${(i - 1) * 5}deg)`,
              zIndex: i,
            }}
          >
            <div className="p-3 space-y-2">
              {[0, 1, 2, 3, 4, 5].map((j) => (
                <div
                  key={j}
                  className="h-1.5 rounded"
                  style={{ backgroundColor: 'var(--th-border)', width: `${60 + ((j * 13) % 35)}%`, opacity: 0.7 }}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Magnifying glass roaming over the documents */}
        <motion.div
          className="absolute"
          style={{ left: 28, top: 14, zIndex: 10 }}
          animate={{
            x: [0, 92, 58, 8, 74, 0],
            y: [0, 24, 82, 52, 96, 0],
            rotate: [-8, 5, -6, 7, -4, -8],
          }}
          transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <svg width="76" height="76" viewBox="0 0 76 76" fill="none">
            <defs>
              <radialGradient id="cad-glass" cx="0.35" cy="0.3" r="0.85">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.4" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* lens */}
            <circle cx="30" cy="30" r="23" fill="var(--th-primary)" fillOpacity="0.08" stroke="var(--th-primary)" strokeWidth="4.5" />
            <circle cx="30" cy="30" r="23" fill="url(#cad-glass)" />
            {/* glint */}
            <path d="M17 21 a17 17 0 0 1 13 -9" stroke="#ffffff" strokeOpacity="0.65" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* handle */}
            <line x1="47" y1="47" x2="66" y2="66" stroke="var(--th-primary)" strokeWidth="6.5" strokeLinecap="round" />
          </svg>
        </motion.div>
      </div>

      {/* Caption */}
      <div className="mt-1 flex items-center text-[15px] font-semibold" style={{ color: 'var(--th-primary)' }}>
        <span>Researching your question</span>
        <motion.span
          className="ml-0.5"
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          …
        </motion.span>
      </div>

      {/* Provenance notice */}
      <div
        className="mt-5 max-w-sm rounded-xl border px-4 py-3 flex gap-2.5"
        style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface-alt)' }}
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" style={{ color: 'var(--th-primary)' }} aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="11" x2="12" y2="16" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{NOTICE}</p>
      </div>
    </div>
  );
}
