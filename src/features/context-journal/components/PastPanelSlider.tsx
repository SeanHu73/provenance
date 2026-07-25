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

/** A soft "lens" halo worn over the active P·A·S·T initial (the redesign's style):
 *  a pale tinted disc ringed in the lens colour, with a faint outer glow. Flat and
 *  clean — it sits *behind* the letter (which carries `z-10`) so the letter reads
 *  crisply on top. */
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
        backgroundColor: `color-mix(in srgb, ${colour} 15%, #fff)`,
        border: `2px solid ${colour}`,
        boxShadow: `0 0 0 5px color-mix(in srgb, ${colour} 12%, transparent), 0 1px 6px color-mix(in srgb, ${colour} 22%, transparent)`,
      }}
    />
  );
}

/** The indicator row: an instructions panel (★) then the four lenses, so it reads
 *  ✱·P·A·S·T. `active` is 0 for the instructions panel, 1–4 for the lenses. The
 *  active glyph swells and wears the lens glass (centred over it — the ✱ uses a
 *  neutral colour); the rest sit small and dimmed. Tapping a glyph jumps to it. */
const STAR_COLOUR = 'var(--th-primary)';
function PastIndicator({ active, onJump }: { active: number; onJump: (i: number) => void }) {
  const items = [{ glyph: '✱', label: 'instructions', colour: STAR_COLOUR }, ...LENSES.map((l) => ({ glyph: l.label[0], label: l.label, colour: l.colour }))];
  return (
    <div className="flex items-end justify-center gap-1.5 select-none">
      {items.map((it, i) => {
        const isActive = i === active;
        return (
          <div key={it.label} className="flex items-end gap-1.5">
            <button
              onClick={() => onJump(i)}
              aria-label={i === 0 ? 'Show the instructions' : `Show the ${it.label} lens`}
              aria-current={isActive}
              className="relative flex items-center justify-center bg-transparent border-0 p-0 cursor-pointer"
              style={{ width: isActive ? 58 : 30, height: 58 }}
            >
              <span
                className="relative z-10 font-display font-bold leading-none transition-all duration-200"
                style={{
                  // the ✱ sits smaller than a letter at the same slot so the
                  // asterisk's arms don't overpower the P/A/S/T beside it.
                  fontSize: isActive ? (i === 0 ? 30 : 46) : (i === 0 ? 16 : 24),
                  color: it.colour,
                  opacity: isActive ? 1 : 0.4,
                }}
              >
                {it.glyph}
              </span>
              {isActive && <LensGlass colour={it.colour} size={62} />}
            </button>
            {i < items.length - 1 && (
              <span className="font-display font-bold text-text-muted mb-1.5" style={{ fontSize: 20, opacity: 0.5 }}>·</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The ✱ instructions slide — the first thing in the deck: pick a lens, then swipe. */
function InstructionsSlide({ onNext }: { onNext: () => void }) {
  return (
    <div className="rounded-3xl bg-warm-white flex flex-col items-center text-center px-6 py-10" style={{ border: '1px solid var(--th-border)', boxShadow: '0 6px 24px rgba(26,20,14,0.10)' }}>
      <span className="font-display font-bold leading-none" style={{ fontSize: 38, color: STAR_COLOUR }}>✱</span>
      <p className="mt-5 font-serif text-[26px] leading-snug text-text-primary max-w-[20ch]">
        Pick a lens you want to look through to ask your question.
      </p>
      <p className="mt-4 font-serif italic text-[15px] leading-snug text-text-secondary max-w-[24ch]">
        Optional: Explore questions others have asked.
      </p>
      <button
        onClick={onNext}
        aria-label="Swipe to the first lens"
        className="mt-8 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: 'var(--th-primary)' }}
      >
        Swipe
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce-x">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
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
  // Deck index. 0 is the ✱ instructions panel; 1–4 are the lenses. Starts on the
  // instructions so "pick a lens" is the first thing they read.
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(0);
  const [cardOpen, setCardOpen] = useState(false);
  const LAST = LENSES.length; // max index (4)
  // Which LENS indices (1–4) have been swiped to. The gate is "all four lenses
  // seen"; the instructions panel doesn't count. A returning learner is all-seen.
  const [seenLenses, setSeenLenses] = useState<Set<number>>(
    () => (initiallyAllSeen ? new Set(LENSES.map((_, i) => i + 1)) : new Set()),
  );

  const allSeen = seenLenses.size >= LENSES.length;
  useEffect(() => { onAllSeenChange?.(allSeen); }, [allSeen, onAllSeenChange]);

  const byLens = useMemo(() => {
    const inRange = entries.filter((e) => overlapsRange({ start: e.timeRange.start, end: e.timeRange.end }, selectedRange));
    return LENSES.map((lens) => ({ lens, items: inRange.filter((e) => e.pastCategory === lens.key) }));
  }, [entries, selectedRange]);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(LAST, i));
    if (clamped === active) return;
    haptic(8);
    setDir(clamped > active ? 1 : -1);
    setActive(clamped);
    if (clamped >= 1) setSeenLenses((prev) => (prev.has(clamped) ? prev : new Set(prev).add(clamped)));
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const swipe = info.offset.x + info.velocity.x * 0.2;
    if (swipe < -70) goTo(active + 1);
    else if (swipe > 70) goTo(active - 1);
  };

  const onInstructions = active === 0;
  const { lens, items } = byLens[Math.max(0, active - 1)];
  const questions = items.filter((e) => e.origin === 'authored');
  const added = items.filter((e) => e.origin !== 'authored');

  return (
    <div className="px-4 pb-5">
      {/* Top: a "Contextualise…" kicker over the guiding theme, centred. */}
      {guidingQuestion && (
        <div className="px-1 pt-5 pb-1 text-center">
          <p className="font-serif italic text-[14px] leading-none" style={{ color: 'var(--text-secondary)' }}>Contextualise&hellip;</p>
          <p className="mt-1 font-display font-bold text-[22px] leading-tight" style={{ color: 'var(--th-primary)' }}>{guidingQuestion}</p>
        </div>
      )}

      {/* ✱·P·A·S·T indicator */}
      <div className="pt-2 pb-3.5">
        <PastIndicator active={active} onJump={goTo} />
      </div>

      {/* the swipeable deck: instructions, then one lens at a time */}
      <div className="relative overflow-hidden">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={onInstructions ? '__instructions__' : lens.key}
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
            {onInstructions ? (
              <InstructionsSlide onNext={() => goTo(1)} />
            ) : (
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
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* swipe affordance: a dot per panel (✱ + four lenses), + a hint until seen */}
      <div className="mt-4 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          {[{ key: '__star__', colour: STAR_COLOUR }, ...LENSES].map((l, i) => (
            <button
              key={l.key}
              onClick={() => goTo(i)}
              aria-label={i === 0 ? 'Go to instructions' : `Go to lens ${i}`}
              className="rounded-full transition-all"
              style={{
                width: i === active ? 22 : 8, height: 8,
                backgroundColor: i === active ? l.colour : (i >= 1 && seenLenses.has(i)) ? `${l.colour}66` : 'var(--th-border)',
              }}
            />
          ))}
        </div>
        {!allSeen && (
          <p className="text-[12px] italic text-text-muted">Swipe to see all four lenses</p>
        )}
      </div>

      <AnimatePresence>{cardOpen && !onInstructions && <PastLensCard lens={lens} onClose={() => setCardOpen(false)} />}</AnimatePresence>
    </div>
  );
}

/** One lens' contents (redesign): a clean white card — the lens name in its own
 *  colour with an (i) and its sub-topics, a "what are you curious about?" prompt
 *  leading the ask-your-own pill, then the model questions (locked ones last) and
 *  any contexts already added here. */
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
  // Locked questions (an unlock dependency not yet met) always sink below the
  // available ones; order is otherwise preserved (the authored order).
  const orderedQuestions = [
    ...questions.filter((q) => !lockInfoById?.has(q.id)),
    ...questions.filter((q) => lockInfoById?.has(q.id)),
  ];
  return (
    <div className="rounded-3xl bg-warm-white px-5 py-5" style={{ border: '1px solid var(--th-border)', boxShadow: '0 6px 24px rgba(26,20,14,0.10)' }}>
      {/* lens identity — the name in its lens colour, an (i) to open the full lens
          page, and the sub-topics beneath. */}
      <div className="flex items-center gap-1.5">
        <h3 className="font-display font-bold leading-none" style={{ fontSize: 26, color: colour }}>{lens.label}</h3>
        <button onClick={onOpenCard} aria-label={`See ${lens.label} details`} className="shrink-0 flex items-center justify-center" style={{ color: colour }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill="currentColor" /></svg>
        </button>
      </div>
      <p className="mt-1.5 text-[13px] leading-snug text-text-secondary">{lens.categories.join('   |   ')}</p>

      {/* the prompt + ask-your-own — the primary action on the card, centred, with
          a soft halo so it reads as the focal point. */}
      <h2 className="mt-5 text-center font-display font-bold leading-tight text-text-primary" style={{ fontSize: 'clamp(24px, 6.8vw, 30px)' }}>
        What are you curious about?
      </h2>
      {onAsk && (
        <button
          onClick={onAsk}
          className="mt-4 w-full flex items-center gap-3 rounded-full bg-warm-white px-4 py-3.5 text-left"
          style={{
            border: '1.5px solid var(--th-primary)',
            boxShadow: '0 0 0 5px color-mix(in srgb, var(--th-primary) 9%, transparent), 0 4px 16px color-mix(in srgb, var(--th-primary) 16%, transparent)',
          }}
        >
          <span className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-warm-white" style={{ backgroundColor: 'var(--th-primary)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.4-3 4" /><line x1="12" y1="17.5" x2="12.01" y2="17.5" />
            </svg>
          </span>
          <span className="flex-1 font-semibold text-[18.5px]" style={{ color: 'var(--text-primary)' }}>Ask your own question</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: 'var(--th-primary)' }}><path d="M9 6l6 6-6 6" /></svg>
        </button>
      )}

      {/* model questions (locked last) */}
      {orderedQuestions.length > 0 && (
        <div className="mt-4 space-y-2.5">
          <p className="text-[12px] font-semibold text-text-secondary">Explore questions others have asked</p>
          {orderedQuestions.map((entry) => (
            <QuestionRow key={entry.id} entry={entry} colour={colour} lock={lockInfoById?.get(entry.id) ?? null} onTap={() => onOpenFull(entry)} />
          ))}
        </div>
      )}

      {orderedQuestions.length === 0 && added.length === 0 && !onAsk && (
        <p className="mt-4 text-sm text-text-muted">No context here yet.</p>
      )}

      {added.length > 0 && (
        <div data-cj-keep className="mt-4 flex gap-3 overflow-x-auto cj-hscroll -mx-1 px-1 py-0.5">
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

  // A compact row: a small thumbnail (or a lens-tinted icon) leads, the question
  // reads beside it, a chevron trails. Locked ones swap the thumbnail for a lock,
  // dim the text, and toggle a hint naming the lens to explore first.
  if (lock) {
    return (
      <div>
        <button
          onClick={() => { haptic(6); setShowHint((v) => !v); }}
          aria-expanded={showHint}
          className="w-full flex items-center gap-3.5 text-left rounded-2xl px-3.5 py-3.5"
          style={{ backgroundColor: 'var(--th-surface-alt)', opacity: 0.75 }}
        >
          <span className="shrink-0 w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--th-border)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </span>
          <span className="flex-1 min-w-0 font-serif text-[16.5px] text-text-muted leading-snug">{label}</span>
        </button>
        <AnimatePresence initial={false}>
          {showHint && (
            <motion.p
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden px-3 pt-1.5 text-[13px] text-text-secondary leading-snug"
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
      className="w-full flex items-center gap-3.5 text-left rounded-2xl px-3.5 py-3.5"
      style={{ backgroundColor: 'var(--th-surface-alt)' }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="shrink-0 w-16 h-16 rounded-xl object-cover" />
      ) : (
        <span className="shrink-0 w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${colour}1f` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
          </svg>
        </span>
      )}
      <span className="flex-1 min-w-0 font-serif text-[17px] leading-snug text-text-primary">{label}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M9 6l6 6-6 6" />
      </svg>
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
