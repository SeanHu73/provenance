'use client';

/**
 * PastPanelSlider — the P.A.S.T. framework as a *swipeable* single-lens deck.
 *
 * Instead of stacking all four lenses (a wall of text), the learner sees ONE
 * lens at a time and swipes left/right through them. A P·A·S·T indicator sits
 * under the instruction: the active lens's initial swells and wears a glassy
 * magnifying lens (a shaded circle, no handle); swiping — or tapping a letter —
 * moves the lens along and enlarges the new initial.
 *
 * The shown lens leads with a coloured bar (its name, large, + a truncated
 * description with an (i) that opens the full lens page), then the authored
 * *questions* to explore and any contexts already added here, plus an in-lens
 * "Ask your own question".
 *
 * Reports `allSeen` once every lens has been swiped to, so the journal can gate
 * Continue on "swiped through all the lenses".
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { LENSES, overlapsRange, thumbnailPhotoUrl, type LensDef } from '../constants';
import type { ContextEntry, PastCategory, TimeRange } from '../types';
import BookmarkButton from './BookmarkButton';
import PastLensCard from './PastLensCard';

/** The comic ink used for question-bubble borders + offset shadows. */
const INK = '#241f1b';
const SHADOW = 'rgba(26,20,14,0.9)';

function haptic(ms = 8) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

interface Props {
  entries: ContextEntry[];
  selectedRange: TimeRange;
  savedIds: Set<string>;
  /** The currently focused context (drives the map); null = none. */
  focusedId: string | null;
  guidingQuestion?: string;
  /** Locked authored questions → the lens each must be unlocked by exploring. */
  lockInfoById?: Map<string, { lensLabel: string; lensColour: string }>;
  onFocus: (entry: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
  /** Open the ask flow already scoped to this lens (skips the lens picker). */
  onAskLens?: (lens: PastCategory) => void;
  /** Fires whenever the "every lens has been swiped to" state flips. */
  onAllSeenChange?: (allSeen: boolean) => void;
  /** Seed all lenses as already-seen (a returning learner, via back-nav). */
  initiallyAllSeen?: boolean;
}

/** A glassy magnifying lens — a shaded circle, no handle — worn over the active
 *  P·A·S·T initial. Translucent so the enlarged letter reads *through* it. */
function LensGlass({ colour, size }: { colour: string; size: number }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        borderRadius: '999px',
        // glassy dome: bright top-left, sinking to a faint tint at the rim
        background:
          `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.16) 42%, ${colour}22 78%, ${colour}33 100%)`,
        border: `3px solid ${colour}`,
        boxShadow: `inset 0 3px 8px rgba(255,255,255,0.55), inset 0 -5px 10px ${colour}40, 0 4px 10px rgba(26,20,14,0.28)`,
      }}
    >
      {/* crescent glare */}
      <span
        className="absolute"
        style={{
          left: '18%', top: '14%', width: '46%', height: '30%',
          borderRadius: '999px',
          background: 'linear-gradient(140deg, rgba(255,255,255,0.85), rgba(255,255,255,0))',
          transform: 'rotate(-18deg)',
        }}
      />
    </span>
  );
}

/** The P·A·S·T row. The active initial swells and wears the lens glass; the rest
 *  sit small and dimmed in their own lens colour. Tapping a letter jumps to it. */
function PastIndicator({ active, onJump }: { active: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-end justify-center gap-1.5 select-none">
      {LENSES.map((lens, i) => {
        const isActive = i === active;
        return (
          <div key={lens.key} className="flex items-end gap-1.5">
            <button
              onClick={() => onJump(i)}
              aria-label={`Show the ${lens.label} lens`}
              aria-current={isActive}
              className="relative flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
              style={{ width: isActive ? 58 : 30, height: 58 }}
            >
              <span
                className="font-display font-bold leading-none transition-all duration-200"
                style={{
                  fontSize: isActive ? 46 : 24,
                  color: lens.colour,
                  opacity: isActive ? 1 : 0.4,
                }}
              >
                {lens.label[0]}
              </span>
              {isActive && <LensGlass colour={lens.colour} size={62} />}
            </button>
            {i < LENSES.length - 1 && (
              <span className="font-display font-bold text-text-muted mb-1.5" style={{ fontSize: 20, opacity: 0.5 }}>·</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Slide variants — the card enters from the swipe direction and leaves the
 *  opposite way. `custom` is +1 (advancing) or -1 (going back). */
const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0 }),
};

export default function PastPanelSlider({
  entries, selectedRange, savedIds, focusedId, guidingQuestion, lockInfoById,
  onFocus, onToggleSave, onOpenFull, onAskLens, onAllSeenChange, initiallyAllSeen = false,
}: Props) {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  // Which lenses the learner has swiped/jumped to. Seed with the first (shown)
  // one, or all when a returning learner has already engaged this act.
  const [seen, setSeen] = useState<Set<number>>(
    () => (initiallyAllSeen ? new Set(LENSES.map((_, i) => i)) : new Set([0])),
  );

  const allSeen = seen.size >= LENSES.length;
  useEffect(() => { onAllSeenChange?.(allSeen); }, [allSeen, onAllSeenChange]);

  const byLens = useMemo(() => {
    const inRange = entries.filter((e) => overlapsRange({ start: e.timeRange.start, end: e.timeRange.end }, selectedRange));
    return LENSES.map((lens) => ({ lens, items: inRange.filter((e) => e.pastCategory === lens.key) }));
  }, [entries, selectedRange]);

  const go = (next: number) => {
    const clamped = Math.max(0, Math.min(LENSES.length - 1, next));
    if (clamped === active) return;
    haptic(8);
    setDir(clamped > active ? 1 : -1);
    setActive(clamped);
    setSeen((prev) => (prev.has(clamped) ? prev : new Set(prev).add(clamped)));
  };

  const jump = (i: number) => {
    if (i === active) return;
    setDir(i > active ? 1 : -1);
    setActive(i);
    setSeen((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
    haptic(8);
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2;
    if (swipe < -70) go(active + 1);
    else if (swipe > 70) go(active - 1);
  };

  const { lens, items } = byLens[active];
  const questions = items.filter((e) => e.origin === 'authored');
  const added = items.filter((e) => e.origin !== 'authored');

  return (
    <div className="px-4 pb-5">
      {/* intro */}
      <div className="px-1 pt-6 pb-1">
        {guidingQuestion ? (
          <>
            <h2 className="font-serif text-[17px] leading-snug text-text-secondary">Look through the P.A.S.T. to contextualise&hellip;</h2>
            <p className="mt-2.5 mb-1 font-display font-bold text-[28px] leading-tight text-center" style={{ color: 'var(--th-primary)' }}>{guidingQuestion}</p>
          </>
        ) : (
          <h2 className="font-display text-[24px] leading-tight text-text-primary">Look through the P.A.S.T.</h2>
        )}
        <p className="mt-2 font-serif italic text-[16px] text-text-secondary leading-snug">
          Swipe through the lenses to find a question you want to ask &mdash; or ask your own!
        </p>
      </div>

      {/* P·A·S·T indicator */}
      <div className="pt-2 pb-3.5">
        <PastIndicator active={active} onJump={jump} />
      </div>

      {/* the swipeable single-lens deck */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={lens.key}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: 'spring', stiffness: 320, damping: 34 }, opacity: { duration: 0.18 } }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            className="touch-pan-y"
          >
            <LensSlide
              lens={lens}
              questions={questions}
              added={added}
              savedIds={savedIds}
              focusedId={focusedId}
              lockInfoById={lockInfoById}
              onOpenCard={() => { haptic(6); setCardOpen(true); }}
              onAsk={onAskLens ? () => onAskLens(lens.key) : undefined}
              onFocus={onFocus}
              onToggleSave={onToggleSave}
              onOpenFull={onOpenFull}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* swipe affordance: dots + a hint until they've been through them all */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {LENSES.map((l, i) => (
            <button
              key={l.key}
              onClick={() => jump(i)}
              aria-label={`Go to ${l.label}`}
              className="rounded-full transition-all"
              style={{
                width: i === active ? 22 : 8, height: 8,
                backgroundColor: i === active ? l.colour : seen.has(i) ? `${l.colour}66` : 'var(--th-border)',
              }}
            />
          ))}
        </div>
        {!allSeen && (
          <p className="text-[12px] italic text-text-muted">Swipe to see all four lenses</p>
        )}
      </div>

      <AnimatePresence>{cardOpen && <PastLensCard lens={lens} onClose={() => setCardOpen(false)} />}</AnimatePresence>
    </div>
  );
}

/** One lens' contents: the coloured name bar, its questions, an in-lens ask, and
 *  any contexts added here. */
function LensSlide({ lens, questions, added, savedIds, focusedId, lockInfoById, onOpenCard, onAsk, onFocus, onToggleSave, onOpenFull }: {
  lens: LensDef;
  questions: ContextEntry[];
  added: ContextEntry[];
  savedIds: Set<string>;
  focusedId: string | null;
  lockInfoById?: Map<string, { lensLabel: string; lensColour: string }>;
  onOpenCard: () => void;
  onAsk?: () => void;
  onFocus: (e: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (e: ContextEntry) => void;
}) {
  const colour = lens.colour;
  const handleThumb = (entry: ContextEntry) => {
    if (focusedId === entry.id) onOpenFull(entry);
    else onFocus(entry);
  };
  return (
    <div className="rounded-[20px] overflow-hidden" style={{ border: `3px solid ${INK}`, boxShadow: `5px 5px 0 ${SHADOW}` }}>
      {/* coloured name bar — big name + truncated description with an (i) that
          opens the full lens page. */}
      <div className="relative px-4 pt-3 pb-3.5" style={{ backgroundColor: colour }}>
        <span className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/20 pointer-events-none" />
        <div className="relative flex items-center gap-2">
          <h3 className="font-display font-bold text-warm-white leading-none" style={{ fontSize: 34 }}>{lens.label}</h3>
          <button
            onClick={onOpenCard}
            aria-label={`See ${lens.label} details`}
            className="ml-auto shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-warm-white bg-white/20 hover:bg-white/30 border border-white/40"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" /></svg>
          </button>
        </div>
        <button onClick={onOpenCard} className="relative mt-1.5 block w-full text-left">
          <p className="font-serif italic text-warm-white/90 text-[14px] leading-snug truncate">
            {lens.definition} <span className="not-italic font-bold">&hellip;</span>
          </p>
        </button>
      </div>

      {/* body — questions + added contexts + ask your own */}
      <div className="bg-warm-white px-4 py-4 space-y-3">
        {questions.length === 0 && added.length === 0 && (
          <p className="text-sm text-text-muted py-1">No context here yet — try asking your own question.</p>
        )}

        {questions.map((entry) => (
          <QuestionRow key={entry.id} entry={entry} colour={colour} lock={lockInfoById?.get(entry.id) ?? null} onTap={() => onOpenFull(entry)} />
        ))}

        {onAsk && (
          <button
            onClick={onAsk}
            className="w-full flex items-center justify-center gap-2 rounded-[14px] py-2.5 font-display text-[16px] text-warm-white"
            style={{ backgroundColor: 'var(--th-primary)', border: `2.5px solid ${INK}`, boxShadow: `3px 3px 0 ${SHADOW}` }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" /></svg>
            Ask your own question
          </button>
        )}

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
}

/**
 * An unexplored authored context, shown as its *question* (a chat bubble).
 * Locked questions show dimmed with a lock; tapping toggles a hint naming the
 * lens to explore first.
 */
function QuestionRow({ entry, colour, lock, onTap }: {
  entry: ContextEntry; colour: string;
  lock: { lensLabel: string; lensColour: string } | null;
  onTap: () => void;
}) {
  const [showHint, setShowHint] = useState(false);
  const label = entry.question?.trim() || entry.title?.trim() || 'Explore this context';
  const photo = thumbnailPhotoUrl(entry);

  if (lock) {
    return (
      <div>
        <button
          onClick={() => { haptic(6); setShowHint((v) => !v); }}
          aria-expanded={showHint}
          className="w-full flex items-center gap-3 text-left rounded-xl border bg-black/[0.02] px-4 py-3"
          style={{ borderColor: 'var(--th-border)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="flex-1 min-w-0 font-serif text-[16px] text-text-muted leading-snug">{label}</span>
        </button>
        <AnimatePresence initial={false}>
          {showHint && (
            <motion.p
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden px-4 pt-1.5 text-[13px] text-text-secondary leading-snug"
            >
              <span className="inline-flex items-center gap-1.5">
                Explore the
                <span className="inline-flex items-center gap-1 font-semibold" style={{ color: lock.lensColour }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lock.lensColour }} />
                  {lock.lensLabel}
                </span>
                lens first to unlock this question.
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <button
      onClick={onTap}
      className="relative w-full text-left rounded-2xl"
      style={{ backgroundColor: 'var(--th-bg)', border: `2.5px solid ${colour}`, padding: '13px 15px', boxShadow: `3px 3px 0 color-mix(in srgb, ${colour} 45%, ${SHADOW})` }}
    >
      <span className="flex items-start gap-2">
        <span className="flex-1 min-w-0 font-serif text-[19.5px] text-text-primary leading-snug">{label}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-1.5">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="block mx-auto mt-2.5 rounded-lg max-w-full" style={{ maxHeight: 150, border: `1.5px solid ${colour}55` }} />
      )}
      {/* speech-bubble tail on the left */}
      <span aria-hidden className="absolute" style={{ left: -13, top: 16, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: `13px solid ${colour}` }} />
      <span aria-hidden className="absolute" style={{ left: -9, top: 19.5, width: 0, height: 0, borderTop: '6.5px solid transparent', borderBottom: '6.5px solid transparent', borderRight: '9px solid var(--th-bg)' }} />
    </button>
  );
}

/** An added context in the lens rail — tap 1 selects (map/summary), tap 2 opens. */
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
