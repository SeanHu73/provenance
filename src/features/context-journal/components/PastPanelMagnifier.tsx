'use client';

/**
 * Magnifying-glass variant of the P.A.S.T. panel (A/B against PastPanel).
 *
 * The four lenses are cartoon magnifying glasses cascading diagonally across the
 * page. Tapping one expands it (several can be open) into a card with its
 * definition, the authored *questions* as tappable speech bubbles, a red "Ask
 * your own …" button (which skips the lens picker), and any contexts already
 * added here. Reports whether any lens is open so the journal can hide its
 * floating "Ask your own question" button while a lens is expanded.
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LENSES, overlapsRange, thumbnailPhotoUrl, type LensDef } from '../constants';
import type { ContextEntry, PastCategory, TimeRange } from '../types';
import BookmarkButton from './BookmarkButton';
import PastLensCard from './PastLensCard';

const INK = '#241f1b';
const SHADOW = 'rgba(36,31,27,0.9)';

function haptic(ms = 8) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

interface Props {
  entries: ContextEntry[];
  selectedRange: TimeRange;
  savedIds: Set<string>;
  focusedId: string | null;
  guidingQuestion?: string;
  lockInfoById?: Map<string, { lensLabel: string; lensColour: string }>;
  onFocus: (entry: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (entry: ContextEntry) => void;
  /** Open the ask flow already scoped to this lens (skips the lens picker). */
  onAskLens: (lens: PastCategory) => void;
  /** True whenever ≥1 lens is expanded — the journal hides its floating ask CTA. */
  onAnyOpenChange?: (anyOpen: boolean) => void;
}

/** A cartoon magnifying glass: handle down-left, ink-outlined, glass lens. */
function Magnifier({ colour, letter, big }: { colour: string; letter: string; big?: boolean }) {
  const size = big ? 82 : 34;
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" style={{ filter: big ? `drop-shadow(3px 4px 0 ${SHADOW})` : 'none' }}>
        <line x1="41" y1="61" x2="15" y2="87" stroke={INK} strokeWidth="17" strokeLinecap="round" />
        <line x1="41" y1="61" x2="15" y2="87" stroke={colour} strokeWidth="9" strokeLinecap="round" />
        <circle cx="57" cy="43" r="31" fill="#fbf7efee" stroke={INK} strokeWidth="4.5" />
        <circle cx="57" cy="43" r="26.5" fill="none" stroke={colour} strokeWidth="5" />
        <path d="M42 30 a20 20 0 0 1 11 -7" stroke="#ffffffcc" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span className="absolute font-display font-bold leading-none" style={{ left: '56%', top: '43%', transform: 'translate(-50%,-50%)', color: colour, fontSize: big ? 30 : 15 }}>{letter}</span>
    </span>
  );
}

export default function PastPanelMagnifier({
  entries, selectedRange, savedIds, focusedId, guidingQuestion, lockInfoById,
  onFocus, onToggleSave, onOpenFull, onAskLens, onAnyOpenChange,
}: Props) {
  const [openKeys, setOpenKeys] = useState<Set<PastCategory>>(new Set());
  useEffect(() => { onAnyOpenChange?.(openKeys.size > 0); }, [openKeys, onAnyOpenChange]);

  const byLens = useMemo(() => {
    const inRange = entries.filter((e) => overlapsRange({ start: e.timeRange.start, end: e.timeRange.end }, selectedRange));
    return LENSES.map((lens) => ({ lens, items: inRange.filter((e) => e.pastCategory === lens.key) }));
  }, [entries, selectedRange]);

  const toggle = (k: PastCategory) => {
    haptic(10);
    setOpenKeys((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  };

  const indents = [0, 84, 168, 252];

  return (
    <div className="px-5 pb-4">
      {/* left-aligned intro */}
      <div className="pt-6 pb-2">
        <h2 className="font-display text-[19px] leading-snug text-text-primary">
          Look through the <PastWord /> to contextualise&hellip;
        </h2>
        {guidingQuestion && <p className="mt-1.5 font-display font-bold text-[26px] leading-tight" style={{ color: 'var(--th-primary)' }}>{guidingQuestion}</p>}
        <p className="mt-3 font-serif italic text-[15px] text-text-secondary leading-snug">Tap a lens to explore a context question &mdash; or ask your own!</p>
      </div>

      <div className="flex flex-col gap-3.5 mt-3">
        {byLens.map(({ lens, items }, i) => {
          const open = openKeys.has(lens.key);
          const questions = items.filter((e) => e.origin === 'authored');
          const added = items.filter((e) => e.origin !== 'authored');
          return (
            <div key={lens.key} className="relative">
              {!open ? (
                <button
                  onClick={() => toggle(lens.key)}
                  className="flex items-center bg-transparent border-0 p-0 cursor-pointer"
                  style={{ marginLeft: indents[i] }}
                  aria-label={`Open the ${lens.label} lens`}
                >
                  <motion.span
                    animate={questions.length > 0 ? { scale: [1, 1, 1.07, 1] } : { scale: 1 }}
                    transition={questions.length > 0 ? { duration: 1.9, times: [0, 0.72, 0.84, 1], repeat: Infinity, ease: 'easeInOut' } : undefined}
                    className="relative inline-block"
                    style={{ transformOrigin: '60% 40%' }}
                  >
                    <Magnifier colour={lens.colour} letter={lens.label[0]} big />
                    {questions.length > 0 && (
                      <span className="absolute z-10 flex items-center justify-center font-sans font-extrabold text-white tabular-nums"
                        style={{ left: '74%', top: '62%', transform: 'translate(-50%,-50%)', minWidth: 23, height: 23, padding: '0 5px', borderRadius: 999, backgroundColor: '#c31d1d', border: '2.5px solid var(--warm-white)', fontSize: 12 }}>
                        {questions.length}
                      </span>
                    )}
                  </motion.span>
                </button>
              ) : (
                <LensCard
                  lens={lens} questions={questions} added={added}
                  savedIds={savedIds} focusedId={focusedId} lockInfoById={lockInfoById}
                  onClose={() => toggle(lens.key)}
                  onAsk={() => onAskLens(lens.key)}
                  onFocus={onFocus} onToggleSave={onToggleSave} onOpenFull={onOpenFull}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* "P.A.S.T." with each initial in its lens colour. */
function PastWord() {
  return (
    <strong>
      {LENSES.map((l, i) => (
        <span key={l.key}>
          <span style={{ color: l.colour }}>{l.label[0]}</span>{i < LENSES.length - 1 ? '.' : '.'}
        </span>
      ))}
    </strong>
  );
}

function LensCard({ lens, questions, added, savedIds, focusedId, lockInfoById, onClose, onAsk, onFocus, onToggleSave, onOpenFull }: {
  lens: LensDef;
  questions: ContextEntry[];
  added: ContextEntry[];
  savedIds: Set<string>;
  focusedId: string | null;
  lockInfoById?: Map<string, { lensLabel: string; lensColour: string }>;
  onClose: () => void;
  onAsk: () => void;
  onFocus: (e: ContextEntry | null) => void;
  onToggleSave: (id: string) => void;
  onOpenFull: (e: ContextEntry) => void;
}) {
  const [cardOpen, setCardOpen] = useState(false);
  const colour = lens.colour;
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
      className="rounded-[18px] bg-warm-white overflow-hidden"
      style={{ border: `3px solid ${colour}`, boxShadow: `4px 4px 0 ${SHADOW}` }}
    >
      {/* header — tap to close */}
      <button onClick={onClose} className="w-full flex items-center gap-2.5 px-3.5 pt-3 pb-1.5 bg-transparent border-0 text-left cursor-pointer">
        <Magnifier colour={colour} letter={lens.label[0]} />
        <span className="flex-1 inline-flex items-end gap-1.5 font-display leading-none" style={{ color: colour, fontSize: 24 }}>
          <span className="border-b-2 border-dotted pb-0.5" style={{ borderColor: colour }}>{lens.label}</span>
          <span role="button" tabIndex={0}
            onClick={(e) => { e.stopPropagation(); haptic(6); setCardOpen(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setCardOpen(true); } }}
            aria-label={`See ${lens.label} details`} className="mb-0.5">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2" className="opacity-85"><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="7.6" r="0.6" fill={colour} /></svg>
          </span>
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 font-sans font-bold uppercase tracking-wide text-[11px] rounded-full px-2.5 py-1"
          style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--th-bg)', border: '1.5px solid var(--th-border)' }}>
          Close <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </span>
      </button>

      <p className="px-4 font-serif italic text-[13.5px] leading-snug text-text-secondary">{lens.definition}</p>

      {/* authored questions as speech bubbles */}
      {questions.length > 0 && (
        <div className="px-3.5 pt-3 pb-1 flex flex-col gap-3">
          {questions.map((q) => (
            <QuestionBubble key={q.id} entry={q} colour={colour} lock={lockInfoById?.get(q.id) ?? null} onTap={() => onOpenFull(q)} />
          ))}
        </div>
      )}

      {/* Ask your own — red, in-lens (skips the lens picker) */}
      <button onClick={onAsk} className="mx-3.5 mt-3 mb-1 flex items-center justify-center gap-2 rounded-[14px] py-2.5 font-display text-[16.5px] text-warm-white"
        style={{ backgroundColor: 'var(--th-primary)', border: `2.5px solid ${INK}`, boxShadow: `3px 3px 0 ${SHADOW}`, width: 'calc(100% - 28px)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" /></svg>
        Ask your own {lens.label} question
      </button>

      {/* contexts already added here */}
      {added.length > 0 && (
        <div className="px-3.5 pt-2 pb-3.5">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.13em] text-text-secondary mb-2">Contexts you added here</p>
          <div data-cj-keep className="flex flex-col gap-2">
            {added.map((entry) => (
              <AddedRow key={entry.id} entry={entry} colour={colour} active={focusedId === entry.id} saved={savedIds.has(entry.id)}
                onTap={() => { if (focusedId === entry.id) onOpenFull(entry); else onFocus(entry); }}
                onToggleSave={() => onToggleSave(entry.id)} />
            ))}
          </div>
        </div>
      )}

      <AnimatePresence>{cardOpen && <PastLensCard lens={lens} onClose={() => setCardOpen(false)} />}</AnimatePresence>
    </motion.div>
  );
}

function QuestionBubble({ entry, colour, lock, onTap }: {
  entry: ContextEntry; colour: string; lock: { lensLabel: string; lensColour: string } | null; onTap: () => void;
}) {
  const [hint, setHint] = useState(false);
  const label = entry.question?.trim() || entry.title?.trim() || 'Explore this context';
  if (lock) {
    return (
      <div>
        <button onClick={() => { haptic(6); setHint((v) => !v); }} className="w-full flex items-center gap-3 text-left rounded-2xl bg-black/[0.03] px-3.5 py-2.5" style={{ border: `2px dashed ${colour}66` }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <span className="flex-1 min-w-0 font-serif text-[15px] text-text-muted leading-snug">{label}</span>
        </button>
        <AnimatePresence>{hint && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden px-2 pt-1 text-[12.5px] text-text-secondary">
            Explore the <span className="font-semibold" style={{ color: lock.lensColour }}>{lock.lensLabel}</span> lens first to unlock this.
          </motion.p>
        )}</AnimatePresence>
      </div>
    );
  }
  return (
    <button onClick={onTap} className="relative w-full text-left rounded-2xl font-serif text-[15px] text-text-primary"
      style={{ backgroundColor: 'var(--th-bg)', border: `2.5px solid ${colour}`, padding: '10px 34px 10px 14px', boxShadow: `3px 3px 0 color-mix(in srgb, ${colour} 45%, ${SHADOW})` }}>
      {label}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2"><path d="M9 6l6 6-6 6" /></svg>
      <span className="absolute" style={{ left: 20, bottom: -11, width: 18, height: 13, background: 'var(--th-bg)', border: `2.5px solid ${colour}`, borderTop: 'none', borderLeft: 'none', clipPath: 'polygon(0 0,100% 0,100% 100%)', transform: 'skewX(-18deg)' }} />
    </button>
  );
}

function AddedRow({ entry, colour, active, saved, onTap, onToggleSave }: {
  entry: ContextEntry; colour: string; active: boolean; saved: boolean; onTap: () => void; onToggleSave: () => void;
}) {
  const photo = thumbnailPhotoUrl(entry);
  return (
    <div className="rounded-xl overflow-hidden bg-warm-white" style={{ border: `2px solid ${active ? colour : 'var(--th-border)'}` }}>
      <button onClick={onTap} className="w-full flex items-center gap-3 text-left px-2.5 py-2">
        <span className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: `${colour}1f` }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="1.7"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-display text-[15px] text-text-primary leading-tight line-clamp-2">{entry.title}</span>
          {active && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: colour }}>
              Tap again to open
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          )}
        </span>
        {active && <span onClick={(e) => { e.stopPropagation(); onToggleSave(); }}><BookmarkButton saved={saved} onToggle={onToggleSave} colour={colour} /></span>}
      </button>
    </div>
  );
}
