'use client';

/**
 * A single P.A.S.T. lens row.
 *
 * Collapsed by default, name only. Tapping the **name** (which carries a dotted
 * underline + ⓘ cue) toggles a short definition shown to its right — no delay.
 * Tapping anywhere else on the row (or the chevron) toggles the dropdown of
 * in-range contexts.
 *
 * Open, the lens lists its in-range contexts as horizontally-scrolling
 * thumbnails. Tapping a thumbnail reveals a compact summary card; tapping it
 * again (or "Read more") opens the full-screen reader.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { thumbnailPhotoUrl, type LensDef } from '../constants';
import type { ContextEntry } from '../types';
import BookmarkButton from './BookmarkButton';

interface Props {
  lens: LensDef;
  entries: ContextEntry[];
  savedIds: Set<string>;
  /** The currently focused context id (shared across lenses; drives the map). */
  focusedId: string | null;
  onFocus: (entry: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
}

export default function PastLens({ lens, entries, savedIds, focusedId, onFocus, onToggleSave, onOpenFull }: Props) {
  const [open, setOpen] = useState(false);
  const [showDef, setShowDef] = useState(false);

  // Collapsing the lens clears the focus (and returns the map to the default
  // view) if the focused context lives in this lens.
  const toggleOpen = () => {
    setOpen((o) => {
      const next = !o;
      if (!next && entries.some((e) => e.id === focusedId)) onFocus(null);
      return next;
    });
  };

  const onRowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); }
  };

  const handleThumb = (entry: ContextEntry) => {
    if (focusedId === entry.id) onOpenFull(entry); // tap the focused one again → full screen
    else onFocus(entry);                           // first tap → focus it (map flies, summary shows)
  };

  return (
    <div className="rounded-2xl bg-warm-white border" style={{ borderColor: 'var(--th-border)' }}>
      {/* header — tap the row (or chevron) to expand; tap the NAME for the definition */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggleOpen}
        onKeyDown={onRowKey}
        className="flex items-start gap-2.5 px-4 py-3.5 cursor-pointer"
      >
        <span className="w-3 h-3 mt-2 rounded-full shrink-0" style={{ backgroundColor: lens.colour }} />

        {/* name → definition (with dotted-underline + ⓘ cue) */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowDef((d) => !d); }}
          className="shrink-0 flex items-center gap-1 font-display text-xl leading-none"
          style={{ color: lens.colour }}
          aria-label={`Show the definition of ${lens.label}`}
          aria-pressed={showDef}
        >
          <span className="border-b border-dotted pb-0.5" style={{ borderColor: `${lens.colour}88` }}>{lens.label}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70 mt-0.5">
            <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
          </svg>
        </button>

        {/* definition to the right of the name when shown */}
        <AnimatePresence initial={false} mode="wait">
          {showDef ? (
            <motion.span
              key="def"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
              className="flex-1 min-w-0 self-center text-sm font-serif italic text-text-secondary leading-snug"
            >
              {lens.definition}
            </motion.span>
          ) : (
            <span key="spacer" className="flex-1" />
          )}
        </AnimatePresence>

        {entries.length > 0 && (
          <span className="mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums shrink-0"
            style={{ backgroundColor: `${lens.colour}1A`, color: lens.colour }}>
            {entries.length}
          </span>
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          className={`mt-1 shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* dropdown */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26 }}
            className="overflow-hidden"
          >
            {entries.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-text-muted">No context here yet.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto px-4 pb-4 cj-hscroll">
                {entries.map((entry) => (
                  <ContextCard
                    key={entry.id}
                    entry={entry}
                    colour={lens.colour}
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
