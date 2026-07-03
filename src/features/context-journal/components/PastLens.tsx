'use client';

/**
 * A single P.A.S.T. lens — a chunky, comic-panel "door" the learner taps.
 *
 * Each lens is a rounded, thick-bordered button sitting on a hard offset shadow
 * (a solid, zero-blur block down-and-right) with a small accent burst bleeding
 * out behind one corner — so it reads as a sticker-like button begging to be
 * pressed. Tapping toggles it open (revealing the authored *questions* inside)
 * and gives a push-down + haptic response. The map panel slims every banner to
 * just its emblem + name (`compact`). In the act sequence, a lens still holding
 * unopened questions runs a slow press-and-release loop (`prompt`) as a tap cue.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { thumbnailPhotoUrl, type LensDef } from '../constants';
import type { ContextEntry, PastCategory } from '../types';
import BookmarkButton from './BookmarkButton';

/** The comic ink used for every button border + its hard offset shadow. */
const INK = '#241f1b';
const SHADOW = 'rgba(26,20,14,0.9)';
/** How far down-and-right the cut-out shadow (and the push-down) travels. */
const OFFSET = 5;

/** Match the established repo pattern for an optional light haptic tick. */
function haptic(ms = 8) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

interface Props {
  lens: LensDef;
  entries: ContextEntry[];
  savedIds: Set<string>;
  focusedId: string | null;
  /** When the map panel is open, all lens banners slim to emblem + name. */
  compact?: boolean;
  /** Act sequence + this lens still has unopened questions → run the tap-cue loop. */
  prompt?: boolean;
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

export default function PastLens({ lens, entries, savedIds, focusedId, compact = false, prompt = false, onFocus, onToggleSave, onOpenFull }: Props) {
  const [open, setOpen] = useState(false);
  const colour = lens.colour;
  // Slim banner when the lens is open, or when the map panel is up.
  const slim = open || compact;
  // Run the tap-cue loop only on a closed, full-size lens (not under the map).
  const showPrompt = prompt && !open && !compact;

  // Neubrutalist rest / pressed states, animated by framer-motion. Open = pressed
  // *in* (sits on its shadow) so the active lens reads as depressed.
  const rest = open
    ? { x: OFFSET, y: OFFSET, boxShadow: `0px 0px 0 ${SHADOW}` }
    : { x: 0, y: 0, boxShadow: `${OFFSET}px ${OFFSET}px 0 ${SHADOW}` };
  const pressed = { x: OFFSET, y: OFFSET, boxShadow: `0px 0px 0 ${SHADOW}` };
  // A slow "someone is pressing this" loop: ride down onto the shadow and back.
  const promptAnim = {
    x: [0, OFFSET, 0],
    y: [0, OFFSET, 0],
    boxShadow: [`${OFFSET}px ${OFFSET}px 0 ${SHADOW}`, `0px 0px 0 ${SHADOW}`, `${OFFSET}px ${OFFSET}px 0 ${SHADOW}`],
  };

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
    haptic(open ? 6 : 12);
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
    // extra right/bottom room so the offset shadow + accent burst aren't clipped
    <div ref={rootRef} className="relative scroll-mt-2 pr-1.5 pb-1.5">
      {/* comic accent burst — a slice bleeding out behind the top-left corner */}
      {!slim && (
        <span
          aria-hidden
          className="absolute -top-1.5 -left-1.5 pointer-events-none rounded-md"
          style={{ width: 42, height: 42, backgroundColor: `color-mix(in srgb, ${colour} 42%, #fff)`, border: `3px solid ${INK}`, transform: 'rotate(14deg)' }}
        />
      )}

      {/* the lens "door" — a chunky, pressable comic button */}
      <motion.button
        onClick={toggleOpen}
        aria-expanded={open}
        className={`relative w-full text-left flex overflow-hidden ${slim ? 'flex-row items-center gap-3 px-4 py-2.5' : 'flex-col gap-2 px-4 pt-3.5 pb-3'}`}
        style={{ backgroundColor: colour, border: `3px solid ${INK}`, borderRadius: 18, minHeight: slim ? 50 : 92 }}
        animate={showPrompt ? promptAnim : rest}
        whileTap={pressed}
        transition={showPrompt
          ? { duration: 1.5, times: [0, 0.5, 1], repeat: Infinity, repeatDelay: 1.1, ease: 'easeInOut' }
          : { type: 'spring', stiffness: 600, damping: 32 }}
      >
        {/* depth wash */}
        <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/25 pointer-events-none" />

        {slim ? (
          <>
            <span className="relative text-warm-white/90 shrink-0"><LensEmblem kind={lens.key} size={22} /></span>
            <span className="relative font-display text-xl text-warm-white leading-none">{lens.label}</span>
          </>
        ) : (
          <>
            {/* descriptor emblem (kept) */}
            <span className="absolute top-3 right-3 text-white/85 pointer-events-none"><LensEmblem kind={lens.key} /></span>
            <span className="relative font-display text-[28px] text-warm-white leading-none">{lens.label}</span>
            {/* definition always visible in the journal */}
            <p className="relative font-serif italic text-warm-white/90 text-[15px] leading-snug max-w-[88%]">
              {lens.definition}
            </p>
          </>
        )}
      </motion.button>

      {/* contents — a separate bordered card that drops below the pressed door */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24 }}
            className="overflow-hidden"
          >
            {(() => {
              const questions = entries.filter((e) => e.origin === 'authored');
              const added = entries.filter((e) => e.origin !== 'authored');
              const card = 'mt-2 rounded-2xl bg-warm-white';
              const cardStyle = { border: `3px solid ${INK}` };
              if (questions.length === 0 && added.length === 0) {
                return <div className={card} style={cardStyle}><p className="px-5 py-4 text-sm text-text-muted">No context here yet.</p></div>;
              }
              return (
                <div className={card} style={cardStyle}>
                  <div className="px-4 py-3.5 space-y-3">
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
                </div>
              );
            })()}
          </motion.div>
        )}
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
