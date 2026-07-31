'use client';

/**
 * "Facts" — every lookup question the learner asked at the opening, and its
 * answer, for as long as the tour lasts.
 *
 * The end-of-act-1 screen hands these back once, and once is not enough: the
 * research can still be running when they reach it, and a learner who has just
 * been told an answer is coming has nowhere to go and look. So this is the place
 * it lives. Everything they asked is here from the start — answered, still being
 * looked for, or held back because a later stop covers it — and it does not
 * empty as they read.
 *
 * Deliberately not the Context Journal. These are facts, small and settled; the
 * journal is for the contextual questions the Detective builds a world around.
 * Mixing them would blur a distinction the whole tour rests on.
 */

import { useEffect } from 'react';
import { useInvestigation, retryFailedFactual } from '@/lib/investigation-store';
import type { InvestigationQuestion } from '@/lib/types';

export function factualQuestions(all: InvestigationQuestion[]): InvestigationQuestion[] {
  return all.filter((q) => q.kind === 'factual');
}

/** How many are still out — drives the menu row's subtitle. */
export function pendingFactualCount(all: InvestigationQuestion[]): number {
  return factualQuestions(all).filter(
    (q) => q.status === 'pending' || q.status === 'researching' || q.status === 'failed',
  ).length;
}

export default function FactsSheet({ onClose }: { onClose: () => void }) {
  const { questions } = useInvestigation();
  const facts = factualQuestions(questions);

  // Opening the sheet is also the cue to have another go at anything that came
  // back empty. A lookup that failed once is usually a search that went wide
  // rather than a question with no answer, and the learner asking to see it is
  // the clearest signal that it is still wanted.
  useEffect(() => { retryFailedFactual(); }, []);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col" style={{ backgroundColor: 'var(--th-surface)' }}>
      <header
        className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 border-b"
        style={{ borderColor: 'var(--th-border)' }}
      >
        <div className="min-w-0">
          <h3 className="font-display font-bold text-[21px] leading-tight" style={{ color: 'var(--th-primary)' }}>
            Facts
          </h3>
          <p className="text-[13px] leading-snug mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            The questions you asked at the start.
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--th-bg)', color: 'var(--text-primary)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        {facts.length === 0 ? (
          <p className="font-serif italic text-[15px]" style={{ color: 'var(--text-secondary)' }}>
            You did not ask any lookup questions at the start of this tour.
          </p>
        ) : facts.map((q) => <FactRow key={q.id} q={q} />)}
      </div>
    </div>
  );
}

function FactRow({ q }: { q: InvestigationQuestion }) {
  const ready = q.status === 'answered' && !!q.answer;
  return (
    <div>
      <p className="font-serif leading-snug" style={{ fontSize: 17, color: 'var(--text-primary)' }}>
        {q.text}
      </p>

      {ready ? (
        <p className="font-serif leading-relaxed mt-1.5" style={{ fontSize: 16, color: 'var(--text-secondary)' }}>
          {q.answer}
        </p>
      ) : q.status === 'later' ? (
        <p className="font-serif italic mt-1.5" style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
          You will hear about it later!
        </p>
      ) : (
        <p className="flex items-center gap-2 mt-1.5" style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
          <span
            className="block w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0"
            style={{ borderColor: 'var(--th-border)', borderTopColor: 'var(--th-primary)' }}
            aria-hidden
          />
          <span className="font-serif italic">Still looking&hellip;</span>
        </p>
      )}

      {ready && (q.sources || []).length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {(q.sources || []).map((s, i) => (
            <li key={i} className="text-[12px]">
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
