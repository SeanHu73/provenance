'use client';

/**
 * A single P.A.S.T. lens — an immersive "door" the learner enters.
 *
 * Collapsed, each lens is a colour-washed panel with its emblem, a bold initial
 * watermark, the lens name, and a count of what's inside. Two things slim the
 * banner down to just the title + icon: opening the lens, or opening the map at
 * the top of the page (`compact`) — so the framework stays scannable. Tapping the
 * panel toggles it open; the definition is always shown, and tapping the **name**
 * (dotted underline + info sign) pops the lens card with its sample questions.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { thumbnailPhotoUrl, type LensDef } from '../constants';
import type { ContextEntry, PastCategory } from '../types';
import BookmarkButton from './BookmarkButton';
import PastLensCard from './PastLensCard';

interface Props {
  lens: LensDef;
  entries: ContextEntry[];
  savedIds: Set<string>;
  focusedId: string | null;
  /** When the map panel is open, all lens banners slim to title + icon. */
  compact?: boolean;
  onFocus: (entry: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
}

/** Per-lens emblem — a simple line glyph that hints at what the lens looks at. */
function LensEmblem({ kind, size = 30 }: { kind: PastCategory; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'place': // mountains / terrain
      return <svg {...common}><path d="M3 19l5.5-8 3.5 4.5L15 11l6 8z" /><circle cx="7" cy="6.5" r="1.6" /></svg>;
    case 'attitudes': // Affairs — events of the time / disasters (a calendar)
      return <svg {...common}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>;
    case 'society': // people
      return <svg {...common}><circle cx="9" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M4 19c0-2.8 2.2-4.6 5-4.6s5 1.8 5 4.6M15 19c0-1.9.9-3.3 2.5-3.9" /></svg>;
    case 'technology': // gear (Feather "settings")
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
  }
}

export default function PastLens({ lens, entries, savedIds, focusedId, compact = false, onFocus, onToggleSave, onOpenFull }: Props) {
  const [open, setOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const colour = lens.colour;
  // Slim banner when the lens is open, or when the map panel is up.
  const slim = open || compact;

  // When a thumbnail in this lens is selected (tap 1), the map/timeline expand
  // above the fold — bring this lens up to the top of the scrollable lower half
  // so the selected card + its revealed summary stay in view. Runs after the
  // layout settles (rAF) so the just-expanded map is accounted for.
  const rootRef = useRef<HTMLDivElement>(null);
  const ownsFocus = focusedId != null && entries.some((e) => e.id === focusedId);
  useEffect(() => {
    if (!ownsFocus) return;
    const id = requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [ownsFocus, focusedId]);

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
    <div ref={rootRef} className="scroll-mt-2 rounded-3xl overflow-hidden shadow-md">
      {/* the immersive lens "door" */}
      <button
        onClick={toggleOpen}
        aria-expanded={open}
        className={`relative w-full text-left flex transition-all ${slim ? 'flex-row items-center gap-3 px-5 py-3' : 'flex-col gap-3 px-5 pt-4 pb-3.5'}`}
        style={{ backgroundColor: colour, minHeight: slim ? 56 : 120 }}
      >
        {/* depth wash */}
        <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30 pointer-events-none" />
        {/* big initial watermark (bolder) */}
        {!slim && (
          <span className="absolute right-2 -bottom-8 font-display leading-none text-white/20 select-none pointer-events-none"
            style={{ fontSize: 160 }}>{lens.label[0]}</span>
        )}

        {slim ? (
          <>
            <span className="relative text-warm-white/90 shrink-0"><LensEmblem kind={lens.key} size={22} /></span>
            <span
              role="button" tabIndex={0}
              onClick={(e) => { e.stopPropagation(); setCardOpen(true); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setCardOpen(true); } }}
              aria-label={`See ${lens.label} questions`}
              className="relative inline-flex items-center gap-1.5 font-display text-xl text-warm-white leading-none"
            >
              <span className="border-b border-dotted border-white/45 pb-0.5">{lens.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
              </svg>
            </span>
            {entries.length > 0 && (
              <span className="relative ml-1 px-1.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums bg-white/20 text-warm-white">{entries.length}</span>
            )}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              className={`relative ml-auto text-warm-white transition-transform ${open ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </>
        ) : (
          <>
            {/* emblem */}
            <span className="absolute top-4 right-4 text-white/85 pointer-events-none"><LensEmblem kind={lens.key} /></span>
            <div className="relative">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setCardOpen(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setCardOpen(true); } }}
                aria-label={`See ${lens.label} questions`}
                className="inline-flex items-center gap-1.5 font-display text-3xl text-warm-white leading-none"
              >
                <span className="border-b border-dotted border-white/45 pb-0.5">{lens.label}</span>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-70">
                  <circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" />
                </svg>
              </span>
              {/* definition always visible in the journal */}
              <p className="font-serif italic text-warm-white/90 text-[15px] leading-snug mt-1.5 max-w-[92%]">
                {lens.definition}
              </p>
            </div>
            <div className="relative mt-auto flex items-center justify-between">
              <span className="text-warm-white/90 text-sm font-semibold">
                {entries.length > 0 ? `${entries.length} context question${entries.length === 1 ? '' : 's'}` : 'No context questions yet'}
              </span>
              <span className="inline-flex items-center gap-1 text-warm-white text-sm font-semibold">
                Look through
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
          </>
        )}
      </button>

      {/* contents */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26 }}
            className="overflow-hidden bg-warm-white"
          >
            {(() => {
              const questions = entries.filter((e) => e.origin === 'authored');
              const added = entries.filter((e) => e.origin !== 'authored');
              if (questions.length === 0 && added.length === 0) {
                return <p className="px-5 py-4 text-sm text-text-muted">No context here yet.</p>;
              }
              return (
                <div className="px-5 py-4 space-y-3">
                  {/* unanswered questions to explore */}
                  {questions.map((entry) => (
                    <QuestionRow key={entry.id} entry={entry} colour={colour} onTap={() => onOpenFull(entry)} />
                  ))}
                  {/* contexts already added (thumbnails) */}
                  {added.length > 0 && (
                    <div data-cj-keep className="flex gap-3 overflow-x-auto cj-hscroll -mx-1 px-1 py-0.5">
                      {added.map((entry) => (
                        <ContextCard
                          key={entry.id}
                          entry={entry}
                          colour={colour}
                          active={focusedId === entry.id}
                          saved={savedIds.has(entry.id)}
                          onTap={() => handleThumb(entry)}
                          onToggleSave={() => onToggleSave(entry.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cardOpen && <PastLensCard lens={lens} onClose={() => setCardOpen(false)} />}
      </AnimatePresence>
    </div>
  );
}

/** An unexplored authored context, shown as its *question* — tap to open it. */
function QuestionRow({ entry, colour, onTap }: { entry: ContextEntry; colour: string; onTap: () => void }) {
  const label = entry.question?.trim() || entry.title?.trim() || 'Explore this context';
  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 text-left rounded-xl border bg-warm-white px-4 py-3 hover:bg-black/[0.02]"
      style={{ borderColor: 'var(--th-border)' }}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />
      <span className="flex-1 min-w-0 font-serif text-[16px] text-text-primary leading-snug">{label}</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/**
 * An added context in the lens rail — Slice 2 select-levels.
 *
 * Collapsed the thumbnail is **photo + title only**. **Tap 1** selects it
 * (`onTap` → focus): the map/timeline update to this context, a short summary
 * reveals, and a pulse ring cues that a second tap opens it. **Tap 2** (`onTap`
 * again, while active) opens the full overlay. Deselecting is handled by the
 * journal's outside-tap listener (this card is inside a `data-cj-keep` rail).
 */
function ContextCard({ entry, colour, active, saved, onTap, onToggleSave }: {
  entry: ContextEntry; colour: string; active: boolean; saved: boolean;
  onTap: () => void; onToggleSave: () => void;
}) {
  const photo = thumbnailPhotoUrl(entry);
  return (
    <div
      className={`relative shrink-0 rounded-xl overflow-hidden bg-warm-white border transition-all ${active ? 'w-60' : 'w-40'}`}
      style={{ borderColor: active ? colour : 'var(--th-border)', scrollSnapAlign: 'start' }}
    >
      {/* pulse ring cueing the second tap */}
      {active && (
        <span className="pointer-events-none absolute inset-0 rounded-xl animate-pulse z-10" style={{ boxShadow: `0 0 0 2px ${colour}` }} aria-hidden />
      )}
      <button onClick={onTap} className="block w-full text-left">
        <div className="w-full h-24 flex items-center justify-center" style={{ backgroundColor: `${colour}1f` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="1.6">
              <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
        <div className="px-3 py-2.5">
          <h3 className="font-display text-[15px] text-text-primary leading-tight line-clamp-2">{entry.title}</h3>
          {/* tap-1 reveal: short summary + open cue */}
          {active && entry.shortSummary && (
            <p className="mt-1.5 text-xs font-serif text-text-secondary leading-snug line-clamp-4">{entry.shortSummary}</p>
          )}
          {active && (
            <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: colour }}>
              Tap again to open
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          )}
        </div>
      </button>
      {active && (
        <div className="flex items-center justify-end px-2 pb-2">
          <BookmarkButton saved={saved} onToggle={onToggleSave} colour={colour} />
        </div>
      )}
    </div>
  );
}
