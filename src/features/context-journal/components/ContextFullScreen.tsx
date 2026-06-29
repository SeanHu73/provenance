'use client';

/**
 * Full-screen reader for a single context: long explanation + optional photo,
 * a save/bookmark control, and a clear dismiss control. Animated with Framer
 * Motion (backdrop fade + sheet rise).
 */

import { motion } from 'framer-motion';
import { LENS_BY_KEY } from '../constants';
import type { ContextEntry } from '../types';
import BookmarkButton from './BookmarkButton';

interface Props {
  entry: ContextEntry;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

export default function ContextFullScreen({ entry, saved, onToggleSave, onClose }: Props) {
  const lens = LENS_BY_KEY[entry.pastCategory];
  return (
    <motion.div
      className="fixed inset-0 z-[1200] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative mt-auto w-full max-w-lg mx-auto bg-warm-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        {/* header */}
        <div className="shrink-0 flex items-start gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: lens.colour }} />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: lens.colour }}>
              {lens.label} · {entry.timeRange.start}–{entry.timeRange.end}
            </p>
            <h2 className="font-display text-2xl text-text-primary leading-tight">{entry.title}</h2>
          </div>
          <BookmarkButton saved={saved} onToggle={onToggleSave} colour={lens.colour} />
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-black/5 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {entry.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.photoUrl} alt="" className="w-full max-h-[42vh] object-cover rounded-xl mb-4" />
          )}
          {entry.shortSummary && (
            <p className="font-display text-lg text-text-primary mb-3 leading-snug">{entry.shortSummary}</p>
          )}
          <p className="text-[17px] font-serif text-text-primary leading-relaxed whitespace-pre-wrap">
            {entry.longExplanation}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
