'use client';

/**
 * The silent queue behind the opening "Your Investigation" stage.
 *
 * The learner asks several questions before they explore anything, presses
 * [Let's Explore!], and hears nothing more about it. The answers are simply
 * waiting for them at the end of Act 1. That silence is the design — so unlike
 * `research-store`, nothing here surfaces a "your answer is ready" bar, plays a
 * haptic, or asks to be looked at.
 *
 * Three things it does that the ordinary ask flow does not need:
 *
 * **Queues rather than fans out.** Several questions at once would mean several
 * concurrent pipelines, and we have watched the API return 529 Overloaded under
 * much lighter load. Two at a time, and the rest wait.
 *
 * **Factual first.** They take about fifteen seconds against a contextual
 * answer's fifty, so running them first empties most of the list early and
 * leaves only the slow, valuable ones in flight when the learner reaches the end
 * of the act.
 *
 * **Persists.** The window between asking and delivery is a whole act, and the
 * ordinary research store is memory-only by design ("a full page reload drops
 * jobs — acceptable, they'd re-ask"). That is not acceptable here: they cannot
 * re-ask, because they do not know it is happening. State goes to sessionStorage
 * after every change, so a reload picks the queue back up where it stopped.
 */

import { useEffect, useState } from 'react';
import type { InvestigationQuestion, PastLens } from './types';

const KEY = 'provenance-investigation-v1';
/** Two at a time. See the note above about 529s. */
const CONCURRENCY = 2;

interface Stored {
  /** True once the raw submission has been split into questions — however many
   *  that turned out to be, including none. Distinguishes "nothing to show" from
   *  "not back yet" for the screen that hands the answers over. */
  parsed?: boolean;
  tourId: string;
  actId?: string;
  raw: string;
  submittedAt: string;
  questions: InvestigationQuestion[];
}

let state: Stored | null = null;
let running = 0;
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  emit();
}

function load(): Stored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch { return null; }
}

function patch(id: string, p: Partial<InvestigationQuestion>) {
  if (!state) return;
  state = { ...state, questions: state.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) };
  persist();
}

// ── Answering ──

/** How many times a lookup is attempted before it is left alone. A failure here
 *  is usually a search that went wide rather than a question with no answer, but
 *  some questions really cannot be settled and must be allowed to stop. */
const MAX_FACTUAL_TRIES = 3;
const tries = new Map<string, number>();

async function answerFactual(q: InvestigationQuestion, tourId: string) {
  tries.set(q.id, (tries.get(q.id) || 0) + 1);
  const res = await fetch('/api/factual-answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: q.searchText || q.text, tourId }),
  });
  const d = await res.json();
  const answered = d.status === 'answered' && d.answer;
  if (!answered && (tries.get(q.id) || 0) < MAX_FACTUAL_TRIES) {
    // Straight back on the queue. The learner is walking; the cost of another
    // search is nothing to them, and the answer is worth more than the call.
    patch(q.id, { status: 'pending' });
    return;
  }
  patch(q.id, {
    status: answered ? 'answered' : 'failed',
    answer: d.answer || '',
    sources: d.sources || [],
    answeredAt: new Date().toISOString(),
  });
}

async function answerContextual(q: InvestigationQuestion, tourId: string, actId?: string) {
  const res = await fetch('/api/context-answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // No lens: the learner picks one later, on the categorisation screen, and
    // that choice is theirs to make rather than ours to pre-empt.
    body: JSON.stringify({ question: q.searchText || q.text, tourId, actId }),
  });
  const d = await res.json();
  const card = d?.handout?.cards?.[0];
  patch(q.id, {
    // Verbatim, as well as flattened: the journal reopens this through the
    // ordinary ask flow, which needs the photo, the source metadata and the card
    // — none of which survive being reduced to answer + title + summary.
    detective: d,
    status: d?.status === 'answered' && d?.narrative ? 'answered' : 'failed',
    answer: d?.narrative || '',
    title: card?.title || '',
    summary: card?.summary || '',
    sources: (d?.sources || [])
      .filter((s: { url?: string }) => s.url)
      .map((s: { url: string; name?: string }) => ({ label: s.name || s.url, url: s.url })),
    answeredAt: new Date().toISOString(),
  });
}

/**
 * Take the next question and run it. Factual before contextual, and `later`
 * questions are never dispatched at all — the tour answers those in person.
 */
function pump() {
  if (!state) return;
  while (running < CONCURRENCY) {
    const next = state.questions.find((q) => q.status === 'pending' && q.kind === 'factual')
      ?? state.questions.find((q) => q.status === 'pending');
    if (!next) return;
    const { tourId, actId } = state;
    running += 1;
    patch(next.id, { status: 'researching' });
    const job = next.kind === 'factual'
      ? answerFactual(next, tourId)
      : answerContextual(next, tourId, actId);
    job
      .catch((err) => {
        console.error('[investigation] answer failed:', err);
        patch(next.id, { status: 'failed' });
      })
      .finally(() => { running -= 1; pump(); });
  }
}

// ── Public surface ──

/** Begin the queue with questions already parsed. */
export function startInvestigation(input: {
  tourId: string;
  actId?: string;
  raw: string;
  questions: InvestigationQuestion[];
}): void {
  state = {
    tourId: input.tourId,
    actId: input.actId,
    raw: input.raw,
    submittedAt: new Date().toISOString(),
    questions: input.questions,
    parsed: true,
  };
  persist();
  pump();
}

/**
 * Begin from the raw text, without waiting for it to be parsed.
 *
 * The parse is a real call — a Haiku pass plus an embedding batch for the
 * spoiler check, measured at 2.4-3.5s — and making the learner watch a button
 * say "One moment" for it was buying nothing. They are about to walk to a stop;
 * the questions can be split while they do. So the raw text is recorded
 * immediately, the tour moves on, and the list fills in underneath.
 *
 * If the parse fails the raw text still stands on the session, so the admin can
 * read what they asked even when nothing was made of it.
 */
export function beginInvestigation(input: { tourId: string; actId?: string; raw: string }): void {
  state = {
    tourId: input.tourId,
    actId: input.actId,
    raw: input.raw,
    submittedAt: new Date().toISOString(),
    questions: [],
  };
  persist();
  void (async () => {
    try {
      const res = await fetch('/api/investigation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw: input.raw, tourId: input.tourId }),
      });
      const questions: InvestigationQuestion[] = (await res.json()).questions || [];
      // Guard against a second submission having replaced this one mid-flight.
      if (!state || state.raw !== input.raw) return;
      state = { ...state, questions, parsed: true };
      persist();
      pump();
    } catch (err) {
      // Marked parsed even so: the screen waiting on this should hand over what
      // it has rather than hold a learner on "gathering" forever.
      console.error('[investigation] parse failed; the raw text is still recorded:', err);
      if (state && state.raw === input.raw) { state = { ...state, parsed: true }; persist(); }
    }
  })();
}

/**
 * Resume after a reload. Anything caught mid-flight is put back to `pending` —
 * the request that was in the air died with the page, and re-running it costs
 * one answer's worth of work against losing it entirely.
 */
export function resumeInvestigation(): void {
  if (state) return;
  const stored = load();
  if (!stored) return;
  state = {
    ...stored,
    questions: stored.questions.map((q) => (q.status === 'researching' ? { ...q, status: 'pending' } : q)),
  };
  persist();
  pump();
}

/** The learner's own filing of a contextual question into a P.A.S.T. lens. */
export function setInvestigationLens(id: string, lens: PastLens): void {
  patch(id, { lens });
}

/** Ticked off at the end of Act 1 as "I heard this answered on the tour". */
export function setInvestigationHeard(id: string, heard: boolean): void {
  patch(id, { heard });
}

/**
 * Try the failed lookups once more, and reset their attempt count so they get a
 * full set of tries again. Called when the learner opens the Facts sheet: asking
 * to see an answer is the clearest signal it is still wanted.
 */
export function retryFailedFactual(): void {
  if (!state) return;
  const failed = state.questions.filter((q) => q.kind === 'factual' && q.status === 'failed');
  if (!failed.length) return;
  failed.forEach((q) => tries.delete(q.id));
  state = {
    ...state,
    questions: state.questions.map((q) =>
      failed.some((f) => f.id === q.id) ? { ...q, status: 'pending' } : q),
  };
  persist();
  pump();
}

/** Clear it — a new tour, or the same learner starting again. */
export function clearInvestigation(): void {
  state = null;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  emit();
}

/**
 * `[questions, raw]`. Starts empty on every render and syncs in an effect: the
 * server has no sessionStorage, so seeding during render would break hydration.
 */
export function useInvestigation(): { questions: InvestigationQuestion[]; raw: string; pending: number; parsed: boolean } {
  const [snap, setSnap] = useState<Stored | null>(null);
  useEffect(() => {
    const h = () => setSnap(state ? { ...state } : null);
    subs.add(h);
    resumeInvestigation();
    h();
    return () => { subs.delete(h); };
  }, []);
  const questions = snap?.questions ?? [];
  return {
    questions,
    parsed: !!snap?.parsed,
    raw: snap?.raw ?? '',
    pending: questions.filter((q) => q.status === 'pending' || q.status === 'researching').length,
  };
}
