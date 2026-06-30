'use client';

/**
 * A single P.A.S.T. lens — an immersive "door" the learner enters.
 *
 * Collapsed, each lens is a large colour-washed panel with its emblem, the big
 * initial letter as a watermark, the lens name, and a count of what's inside —
 * it should feel like stepping into that way of looking at the past, not reading
 * a list row. Tapping the panel opens it; tapping the **name** reveals the lens's
 * short definition.
 *
 * Open, the lens reveals its contexts. (The lens→question presentation and the
 * new thumbnail select-levels land in the next Phase-C slices.)
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { thumbnailPhotoUrl, type LensDef } from '../constants';
import type { ContextEntry, PastCategory } from '../types';
import BookmarkButton from './BookmarkButton';

interface Props {
  lens: LensDef;
  entries: ContextEntry[];
  savedIds: Set<string>;
  focusedId: string | null;
  onFocus: (entry: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
}

/** Per-lens emblem — a simple line glyph that hints at what the lens looks at. */
function LensEmblem({ kind }: { kind: PastCategory }) {
  const common = { width: 30, height: 30, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'place': // mountains / terrain
      return <svg {...common}><path d="M3 19l5.5-8 3.5 4.5L15 11l6 8z" /><circle cx="7" cy="6.5" r="1.6" /></svg>;
    case 'attitudes': // ideas / values — a radiant sun
      return <svg {...common}><circle cx="12" cy="12" r="3.4" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" /></svg>;
    case 'society': // people
      return <svg {...common}><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4 19c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6M15 19c0-1.9.9-3.3 2.5-3.9" /></svg>;
    case 'technology': // gear
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></svg>;
  }
}

export default function PastLens({ lens, entries, savedIds, focusedId, onFocus, onToggleSave, onOpenFull }: Props) {
  const [open, setOpen] = useState(false);
  const [showDef, setShowDef] = useState(false);
  const colour = lens.colour;

  const toggleOpen = () => {
    setOpen((o) => {
      const next = !o;
      if (!next && entries.some((e) => e.id === focusedId)) onFocus(null);
      return next;
    });
  };

  const handleThumb = (entry: ContextEntry) => {
    if (focusedId === entry.id) onOpenFull(entry);
    else onFocus(entry);
  };

  return (
    <div className="rounded-3xl overflow-hidden shadow-md">
      {/* the immersive lens "door" */}
      <button
        onClick={toggleOpen}
        aria-expanded={open}
        className="relative w-full text-left px-5 pt-5 pb-4 flex flex-col gap-3"
        style={{ backgroundColor: colour, minHeight: 148 }}
      >
        {/* depth wash */}
        <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30 pointer-events-none" />
        {/* big initial watermark */}
        <span className="absolute right-1 -bottom-7 font-display leading-none text-white/10 select-none pointer-events-none"
          style={{ fontSize: 150 }}>{lens.label[0]}</span>
        {/* emblem */}
        <span className="absolute top-4 right-4 text-white/85 pointer-events-none">
          <LensEmblem kind={lens.key} />
        </span>

        <div className="relative">
          {/* name → tap for definition */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); setShowDef((d) => !d); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setShowDef((d) => !d); } }}
            aria-pressed={showDef}
            className="inline-flex items-center gap-1.5 font-display text-3xl text-warm-white leading-none"
          >
            <span className="border-b border-dotted border-white/45 pb-0.5">{lens.label}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
              <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
            </svg>
          </span>
          <AnimatePresence initial={false}>
            {showDef && (
              <motion.p
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden font-serif italic text-warm-white/90 text-[15px] leading-snug mt-1.5 max-w-[88%]"
              >
                {lens.definition}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="relative mt-auto flex items-center justify-between">
          <span className="text-warm-white/90 text-sm font-semibold">
            {entries.length > 0 ? `${entries.length} ${entries.length === 1 ? 'context' : 'contexts'} to explore` : 'No contexts yet'}
          </span>
          <span className="inline-flex items-center gap-1 text-warm-white text-sm font-semibold">
            {open ? 'Close' : 'Explore'}
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>

      {/* contents */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26 }}
            className="overflow-hidden bg-warm-white"
          >
            {entries.length === 0 ? (
              <p className="px-5 py-4 text-sm text-text-muted">No context here yet.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto px-5 py-4 cj-hscroll">
                {entries.map((entry) => (
                  <ContextCard
                    key={entry.id}
                    entry={entry}
                    colour={colour}
                    active={focusedId === entry.id}
                    saved={savedIds.has(entry.id)}
                    onTap={() => handleThumb(entry)}
                    onOpenFull={() => onOpenFull(entry)}
                    onToggleSave={() => onToggleSave(entry.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A context card in the lens rail: photo, title, framing question (italic),
 *  short summary. Tap focuses the map; "Read more" opens the full page. */
function ContextCard({ entry, colour, active, saved, onTap, onOpenFull, onToggleSave }: {
  entry: ContextEntry; colour: string; active: boolean; saved: boolean;
  onTap: () => void; onOpenFull: () => void; onToggleSave: () => void;
}) {
  const photo = thumbnailPhotoUrl(entry);
  return (
    <div
      className="shrink-0 w-60 rounded-xl overflow-hidden bg-warm-white border"
      style={{ borderColor: active ? colour : 'var(--th-border)', boxShadow: active ? `0 0 0 1px ${colour}` : 'none', scrollSnapAlign: 'start' }}
    >
      <button onClick={onTap} className="block w-full text-left">
        <div className="w-full h-28 flex items-center justify-center" style={{ backgroundColor: `${colour}1f` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="1.6">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-display text-base text-text-primary leading-tight">{entry.title}</h3>
          {entry.question && (
            <p className="text-xs font-serif italic text-text-secondary mt-0.5 leading-snug line-clamp-2">{entry.question}</p>
          )}
          {entry.shortSummary && (
            <p className="text-xs font-serif text-text-secondary mt-1.5 leading-snug line-clamp-3">{entry.shortSummary}</p>
          )}
        </div>
      </button>
      <div className="flex items-center justify-between px-3 pb-2.5">
        <button onClick={onOpenFull} className="text-xs font-semibold" style={{ color: colour }}>Read more →</button>
        <BookmarkButton saved={saved} onToggle={onToggleSave} colour={colour} />
      </div>
    </div>
  );
}
