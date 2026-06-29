'use client';

/**
 * A single P.A.S.T. lens row.
 *
 * Collapsed by default, name only. Single tap toggles the dropdown of contexts
 * in range; double tap toggles a short definition. The two are disambiguated by
 * a ~280ms delay so a double tap never also fires the dropdown.
 *
 * Open, the lens lists its in-range contexts as horizontally-scrolling
 * thumbnails. Tapping a thumbnail reveals a compact summary card; tapping it
 * again (or "Read more") opens the full-screen reader.
 */

import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { TAP_DELAY_MS, type LensDef } from '../constants';
import type { ContextEntry } from '../types';
import BookmarkButton from './BookmarkButton';

interface Props {
  lens: LensDef;
  entries: ContextEntry[];
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
}

export default function PastLens({ lens, entries, savedIds, onToggleSave, onOpenFull }: Props) {
  const [open, setOpen] = useState(false);
  const [showDef, setShowDef] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const clickTimer = useRef<number | null>(null);

  const handleHeaderTap = () => {
    if (clickTimer.current !== null) {
      // second tap within the window → double tap → toggle definition
      window.clearTimeout(clickTimer.current);
      clickTimer.current = null;
      setShowDef((d) => !d);
      return;
    }
    clickTimer.current = window.setTimeout(() => {
      clickTimer.current = null;
      setOpen((o) => !o);
    }, TAP_DELAY_MS);
  };

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  const handleThumb = (entry: ContextEntry) => {
    if (selectedId === entry.id) onOpenFull(entry); // tap again → full screen
    else setSelectedId(entry.id);                   // first tap → reveal summary
  };

  return (
    <div className="rounded-2xl bg-warm-white border" style={{ borderColor: 'var(--th-border)' }}>
      {/* header */}
      <button
        onClick={handleHeaderTap}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: lens.colour }} />
        <span className="font-display text-xl flex-1" style={{ color: lens.colour }}>{lens.label}</span>
        {entries.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
            style={{ backgroundColor: `${lens.colour}1A`, color: lens.colour }}>
            {entries.length}
          </span>
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
          className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* definition (double tap) */}
      <AnimatePresence initial={false}>
        {showDef && (
          <motion.p
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden px-4 text-sm font-serif italic text-text-secondary"
          >
            <span className="block pb-3">{lens.definition}</span>
          </motion.p>
        )}
      </AnimatePresence>

      {/* dropdown (single tap) */}
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
              <>
                <div className="flex gap-3 overflow-x-auto px-4 pb-3 cj-hscroll">
                  {entries.map((entry) => (
                    <Thumbnail
                      key={entry.id}
                      entry={entry}
                      colour={lens.colour}
                      active={selectedId === entry.id}
                      onTap={() => handleThumb(entry)}
                    />
                  ))}
                </div>

                <AnimatePresence initial={false} mode="wait">
                  {selected && (
                    <motion.div
                      key={selected.id}
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                      transition={{ duration: 0.2 }}
                      className="mx-4 mb-4 rounded-xl p-3.5"
                      style={{ backgroundColor: `${lens.colour}12` }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-lg text-text-primary leading-tight">{selected.title}</h3>
                          <p className="text-sm font-serif text-text-secondary mt-1 leading-relaxed">{selected.shortSummary}</p>
                        </div>
                        <BookmarkButton saved={savedIds.has(selected.id)} onToggle={() => onToggleSave(selected.id)} colour={lens.colour} />
                      </div>
                      <button
                        onClick={() => onOpenFull(selected)}
                        className="mt-2.5 text-sm font-semibold"
                        style={{ color: lens.colour }}
                      >
                        Read more →
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Thumbnail({ entry, colour, active, onTap }: {
  entry: ContextEntry; colour: string; active: boolean; onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="shrink-0 w-28 text-left"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div
        className="w-28 h-20 rounded-lg overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: `${colour}26`, outline: active ? `2.5px solid ${colour}` : 'none', outlineOffset: active ? 0 : undefined }}
      >
        {entry.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.photoUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="1.7">
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
          </svg>
        )}
      </div>
      <p className="mt-1 text-xs font-semibold text-text-primary leading-tight line-clamp-2">{entry.title}</p>
    </button>
  );
}
