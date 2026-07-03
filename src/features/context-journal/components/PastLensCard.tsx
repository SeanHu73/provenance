'use client';

/**
 * PastLensCard — a full card overlay for one P.A.S.T. lens, opened from the
 * magnifying-glass button (onboarding) or by tapping the lens name (journal).
 * Shows the lens title, its sub-topics (definition) with per-category icons, and
 * a "Sample context questions" section — replacing the old sliding reveal.
 */

import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { LensDef } from '../constants';

export default function PastLensCard({ lens, onClose }: { lens: LensDef; onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[1300] flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/55" />
      <motion.div
        className="relative m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl shadow-2xl overflow-hidden bg-warm-white"
        style={{ maxHeight: '86vh' }}
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* header — coloured band with the lens title + definition */}
        <div className="px-6 pt-6 pb-5" style={{ backgroundColor: lens.colour }}>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display font-bold text-warm-white leading-none" style={{ fontSize: 'clamp(30px, 8vw, 42px)' }}>{lens.label}</h2>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-warm-white bg-white/20 hover:bg-white/30 text-2xl leading-none">&times;</button>
          </div>
          <p className="mt-2 font-serif text-warm-white/95 text-[16px] leading-snug">{lens.definition}</p>
        </div>

        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(86vh - 120px)' }}>
          {/* category icons */}
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            {lens.categories.map((c) => (
              <div key={c} className="flex items-center gap-2" style={{ color: lens.colour }}>
                <CategoryIcon name={c} />
                <span className="text-[13px] font-semibold text-text-primary">{c}</span>
              </div>
            ))}
          </div>

          {/* sample questions */}
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-text-secondary">Sample context questions</p>
            <ul className="mt-3 space-y-2.5">
              {lens.questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-xl px-4 py-3" style={{ backgroundColor: `${lens.colour}14` }}>
                  <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: lens.colour }} />
                  <span className="font-serif text-[16px] text-text-primary leading-snug">{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** A small line icon for each P.A.S.T. sub-topic. */
function CategoryIcon({ name }: { name: string }) {
  const p = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'Geography':
      return <svg {...p}><path d="M3 19l5.5-8 3.5 4.5L15 12l6 7z" /><circle cx="7" cy="6.5" r="1.5" /></svg>;
    case 'Natural resources':
      return <svg {...p}><path d="M12 3s6 5.5 6 10a6 6 0 0 1-12 0c0-4.5 6-10 6-10z" /></svg>;
    case 'Relevant events of the time':
      return <svg {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>;
    case 'Natural disasters':
      return <svg {...p}><path d="M7 16a4 4 0 1 1 .8-7.94A5 5 0 0 1 17.5 9 3.5 3.5 0 0 1 17 16" /><path d="M12 12l-2 4h3l-2 4" /></svg>;
    case 'Cultural values':
      return <svg {...p}><path d="M12 20s-6.5-4.2-8.6-7.7C1.8 9.4 3.5 6 6.6 6c1.9 0 3.3 1.3 5.4 3.4C14.1 7.3 15.5 6 17.4 6c3.1 0 4.8 3.4 3.2 6.3C18.5 15.8 12 20 12 20z" /></svg>;
    case 'Social class':
      return <svg {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 12l9 5 9-5" /></svg>;
    case 'Political system':
      return <svg {...p}><path d="M3 21h18M5 10h14M12 3l8 4.5H4L12 3zM6 10v8M10 10v8M14 10v8M18 10v8" /></svg>;
    case 'Economy':
      return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.6 9.4a2.4 2 0 0 1 4.8 0c0 1.4-4.8 1-4.8 2.9a2.4 2 0 0 0 4.8 0" /></svg>;
    case 'Useful tools':
      return <svg {...p}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.3 2.3-2-2 2.3-2.3z" /></svg>;
    case 'Infrastructure':
      return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="1" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M10 21v-4h4v4" /></svg>;
    case 'Key inventions':
      return <svg {...p}><path d="M9.5 18h5M10 21h4" /><path d="M15.2 14c.2-1 .7-1.8 1.45-2.55A4.8 4.8 0 0 0 18 8 6 6 0 1 0 6.8 11.45C7.55 12.2 8.05 13 8.25 14" /></svg>;
    default:
      return <svg {...p}><circle cx="12" cy="12" r="9" /></svg>;
  }
}
