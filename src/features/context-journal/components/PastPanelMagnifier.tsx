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

import { useEffect, useId, useMemo, useState } from 'react';
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

/** A cartoon-but-glassy magnifying glass: handle down-left, ink-outlined,
 *  gradient lens with a metallic rim and reflections. Letter is optional. */
function Magnifier({ colour, letter, big }: { colour: string; letter?: string; big?: boolean }) {
  const size = big ? 128 : 44;
  const gid = 'mag' + useId().replace(/:/g, '');
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" style={{ filter: big ? `drop-shadow(4px 5px 0 ${SHADOW})` : 'none' }}>
        <defs>
          <radialGradient id={gid} cx="40%" cy="30%" r="72%">
            <stop offset="0%" stopColor="#ffffff" /><stop offset="46%" stopColor="#f7f2e8" /><stop offset="100%" stopColor={`${colour}2b`} />
          </radialGradient>
        </defs>
        <line x1="42" y1="60" x2="13" y2="89" stroke={INK} strokeWidth="19" strokeLinecap="round" />
        <line x1="42" y1="60" x2="13" y2="89" stroke={colour} strokeWidth="11" strokeLinecap="round" />
        <line x1="40" y1="62" x2="18" y2="84" stroke="#ffffff55" strokeWidth="3" strokeLinecap="round" />
        <circle cx="58" cy="42" r="33" fill={`url(#${gid})`} stroke={INK} strokeWidth="5" />
        <circle cx="58" cy="42" r="28" fill="none" stroke={colour} strokeWidth="6" />
        <circle cx="58" cy="42" r="28.6" fill="none" stroke="#ffffff36" strokeWidth="2" />
        <path d="M43 30 a22 22 0 0 1 14 -8" stroke="#ffffffee" strokeWidth="5" strokeLinecap="round" />
        <circle cx="47" cy="53" r="2.6" fill="#ffffffcc" />
      </svg>
      {letter && <span className="absolute font-display font-bold leading-none" style={{ left: '58%', top: '42%', transform: 'translate(-50%,-50%)', color: colour, fontSize: big ? 48 : 16 }}>{letter}</span>}
    </span>
  );
}

export default function PastPanelMagnifier({
  entries, selectedRange, savedIds, guidingQuestion, lockInfoById,
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

  const indents = [0, 74, 148, 222];

  return (
    <div className="px-5 pb-4">
      {/* intro — instruction lines left, the guiding question centred + large */}
      <div className="pt-6 pb-2">
        <h2 className="font-display text-[19px] leading-snug text-text-primary">
          Look through the <PastWord /> to contextualise&hellip;
        </h2>
        {guidingQuestion && <p className="mt-3 mb-1 font-display font-bold text-[30px] leading-tight text-center" style={{ color: 'var(--th-primary)' }}>{guidingQuestion}</p>}
        <p className="mt-3 font-serif italic text-[15px] text-text-secondary leading-snug">Tap a lens to explore a context question &mdash; or ask your own!</p>
      </div>

      <div className="flex flex-col mt-2">
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
                  style={{ marginLeft: indents[i], marginTop: i === 0 ? 2 : -30 }}
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
                        style={{ left: '78%', top: '64%', transform: 'translate(-50%,-50%)', minWidth: 31, height: 31, padding: '0 6px', borderRadius: 999, backgroundColor: '#c31d1d', border: '3px solid var(--warm-white)', fontSize: 15 }}>
                        {questions.length}
                      </span>
                    )}
                  </motion.span>
                </button>
              ) : (
                <LensCard
                  lens={lens} questions={questions} added={added}
                  savedIds={savedIds} lockInfoById={lockInfoById}
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

function LensCard({ lens, questions, added, savedIds, lockInfoById, onClose, onAsk, onFocus, onToggleSave, onOpenFull }: {
  lens: LensDef;
  questions: ContextEntry[];
  added: ContextEntry[];
  savedIds: Set<string>;
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
      className="my-3 rounded-[18px] bg-warm-white overflow-hidden"
      style={{ border: `3px solid ${colour}`, boxShadow: `4px 4px 0 ${SHADOW}` }}
    >
      {/* header — tap to close. The colour identifies the lens; no letter needed. */}
      <button onClick={onClose} className="w-full flex items-center gap-2.5 px-3.5 pt-3 pb-1.5 bg-transparent border-0 text-left cursor-pointer">
        <Magnifier colour={colour} />
        <span className="flex-1 inline-flex items-end gap-1.5 font-display leading-none" style={{ color: colour, fontSize: 31 }}>
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
        Ask your own question
      </button>

      {/* contexts already added here */}
      {added.length > 0 && (
        <div className="px-3.5 pt-2 pb-3.5">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.13em] text-text-secondary mb-2">Contexts you added here</p>
          <div data-cj-keep className="flex flex-col gap-2.5">
            {added.map((entry) => (
              <AddedBox key={entry.id} entry={entry} colour={colour} saved={savedIds.has(entry.id)}
                onFocus={() => onFocus(entry)} onOpenFull={() => onOpenFull(entry)} onToggleSave={() => onToggleSave(entry.id)} />
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
  const photo = thumbnailPhotoUrl(entry);
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
  // With a photo: a box — big picture on top, question below (like an added
  // context) so the image is large enough to draw the learner in.
  if (photo) {
    return (
      <button onClick={onTap} className="w-full text-left rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--th-bg)', border: `2.5px solid ${colour}`, boxShadow: `3px 3px 0 color-mix(in srgb, ${colour} 45%, ${SHADOW})` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="" className="w-full object-cover" style={{ height: 128 }} />
        <span className="flex items-center gap-2 px-3.5 py-2.5">
          <span className="flex-1 min-w-0 font-serif text-[15px] text-text-primary leading-snug">{label}</span>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M9 6l6 6-6 6" /></svg>
        </span>
      </button>
    );
  }

  // No photo: a plain speech bubble with a side tail pointing toward the lens.
  return (
    <button onClick={onTap} className="relative w-full text-left rounded-2xl font-serif text-[15px] text-text-primary leading-snug"
      style={{ backgroundColor: 'var(--th-bg)', border: `2.5px solid ${colour}`, padding: '10px 34px 10px 14px', boxShadow: `3px 3px 0 color-mix(in srgb, ${colour} 45%, ${SHADOW})` }}>
      {label}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2"><path d="M9 6l6 6-6 6" /></svg>
      <span aria-hidden className="absolute" style={{ left: -13, top: 16, width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderRight: `13px solid ${colour}` }} />
      <span aria-hidden className="absolute" style={{ left: -9, top: 19.5, width: 0, height: 0, borderTop: '6.5px solid transparent', borderBottom: '6.5px solid transparent', borderRight: '9px solid var(--th-bg)' }} />
    </button>
  );
}

/** A context already added here — a box with a big picture; tap to reveal its
 *  short explanation, then open the full context or bookmark it. */
function AddedBox({ entry, colour, saved, onFocus, onOpenFull, onToggleSave }: {
  entry: ContextEntry; colour: string; saved: boolean; onFocus: () => void; onOpenFull: () => void; onToggleSave: () => void;
}) {
  const [open, setOpen] = useState(false);
  const photo = thumbnailPhotoUrl(entry);
  return (
    <div className="rounded-2xl overflow-hidden bg-warm-white" style={{ border: `2px solid ${colour}`, boxShadow: `3px 3px 0 color-mix(in srgb, ${colour} 40%, ${SHADOW})` }}>
      <div className="relative">
        <button onClick={() => { setOpen((v) => !v); onFocus(); }} className="w-full text-left">
          <span className="flex items-center justify-center overflow-hidden" style={{ display: 'flex', height: 132, backgroundColor: `color-mix(in srgb, ${colour} 15%, #fff)` }}>
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
            )}
          </span>
          <span className="block px-3.5 py-2.5">
            <span className="block font-display text-[17px] text-text-primary leading-snug">{entry.title}</span>
            <AnimatePresence initial={false}>
              {open && entry.shortSummary && (
                <motion.span initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="block overflow-hidden mt-1.5 font-serif text-[13.5px] text-text-secondary leading-snug">{entry.shortSummary}</motion.span>
              )}
            </AnimatePresence>
            <span className="mt-1.5 inline-flex items-center gap-1.5 font-sans text-[11px] font-bold" style={{ color: colour }}>
              {open ? 'Tap to read less' : 'Tap to read more'}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none' }}><path d="M6 9l6 6 6-6" /></svg>
            </span>
          </span>
        </button>
        <span className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}><BookmarkButton saved={saved} onToggle={onToggleSave} colour={colour} /></span>
      </div>
      {open && (
        <div className="px-3.5 pb-3 -mt-1">
          <button onClick={onOpenFull} className="inline-flex items-center gap-1.5 font-sans text-[12px] font-bold rounded-full px-3 py-1.5"
            style={{ color: colour, border: `1.5px solid ${colour}` }}>
            Open full context
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}
