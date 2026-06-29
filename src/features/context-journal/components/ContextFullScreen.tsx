'use client';

/**
 * Full-screen reader for a single context: framing question + photo gallery +
 * short summary + the long explanation (read aloud with word highlighting) +
 * audio clips. Save/bookmark + dismiss controls. Animated with Framer Motion.
 */

import { motion } from 'framer-motion';
import { LENS_BY_KEY, formatYear, contextPhotos, contextAudio } from '../constants';
import type { ContextEntry } from '../types';
import BookmarkButton from './BookmarkButton';
import ReadAloud from './ReadAloud';

interface Props {
  entry: ContextEntry;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

export default function ContextFullScreen({ entry, saved, onToggleSave, onClose }: Props) {
  const lens = LENS_BY_KEY[entry.pastCategory];
  const photos = contextPhotos(entry);
  const audio = contextAudio(entry);

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
              {lens.label} · {formatYear(entry.timeRange.start)}–{formatYear(entry.timeRange.end)}
            </p>
            <h2 className="font-display text-2xl text-text-primary leading-tight">{entry.title}</h2>
            {entry.question && (
              <p className="text-sm font-serif italic text-text-secondary mt-0.5 leading-snug">{entry.question}</p>
            )}
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
          {/* photo gallery — swipeable when there's more than one */}
          {photos.length > 0 && (
            <div className={`mb-4 ${photos.length > 1 ? 'flex gap-3 overflow-x-auto cj-hscroll -mx-1 px-1' : ''}`}>
              {photos.map((p) => (
                <figure key={p.id} className={photos.length > 1 ? 'shrink-0 w-[80%]' : ''} style={{ scrollSnapAlign: 'start' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.title} className="w-full max-h-[42vh] object-cover rounded-xl" />
                  {p.title && <figcaption className="mt-1 text-xs text-text-muted">{p.title}</figcaption>}
                </figure>
              ))}
            </div>
          )}

          {entry.shortSummary && (
            <p className="font-display text-lg text-text-primary mb-3 leading-snug">{entry.shortSummary}</p>
          )}

          {/* full explanation, read aloud with highlighting */}
          <ReadAloud text={entry.longExplanation} colour={lens.colour} />

          {/* audio clips (oral accounts, songs, …) */}
          {audio.length > 0 && (
            <div className="mt-5 space-y-3">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-text-secondary">Audio</p>
              {audio.map((a) => (
                <div key={a.id}>
                  {a.title && <p className="text-sm font-semibold text-text-primary mb-1">{a.title}</p>}
                  <audio src={a.url} controls preload="none" className="w-full" />
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
