'use client';

/**
 * End of Act 1 — the learner's opening questions come back to them.
 *
 * Two screens, in this order and for this reason:
 *
 *   1. **Tick off what you heard.** Their questions, no answers, no title. They
 *      mark the ones the tour already answered. This is the pedagogy of the whole
 *      feature: it asks them to notice that exploring answered their own
 *      questions, which is a different experience from being handed answers.
 *   2. **Remaining Questions.** Only the ones they did NOT tick — the tour did not
 *      cover those, so here is what we found.
 *
 * Factual questions only. The contextual ones are deliberately held back: they go
 * to the P.A.S.T. categorisation screen in the context onboarding, still
 * unanswered, because sorting a question into a lens is a different thought from
 * reading its answer.
 *
 * Questions the tour covers in a later act never reach either screen with an
 * answer — they show "You will hear about it later!" and stay on screen one.
 */

import { useState } from 'react';
import { setInvestigationHeard } from '@/lib/investigation-store';
import type { InvestigationQuestion } from '@/lib/types';

interface Props {
  questions: InvestigationQuestion[];
  onComplete: () => void;
}

export default function InvestigationReturnCard({ questions, onComplete }: Props) {
  const [step, setStep] = useState<'tick' | 'answers'>('tick');
  const [heard, setHeard] = useState<Record<string, boolean>>(
    () => Object.fromEntries(questions.map((q) => [q.id, !!q.heard])),
  );

  const toggle = (id: string) => {
    const next = !heard[id];
    setHeard((prev) => ({ ...prev, [id]: next }));
    setInvestigationHeard(id, next);
  };

  // What's left to answer: not ticked, and something to show. A question still
  // researching shows as that rather than being silently dropped.
  const remaining = questions.filter((q) => !heard[q.id]);

  if (step === 'tick') {
    return (
      <div className="animate-fade-in min-h-full flex flex-col justify-center px-1 space-y-5">
        <p
          className="font-serif leading-snug"
          style={{ fontSize: 'clamp(18px, 5vw, 23px)', color: 'var(--text-primary)' }}
        >
          Here are your questions returned, tap those you heard answers to.
        </p>

        <ul className="space-y-2.5">
          {questions.map((q) => {
            const on = !!heard[q.id];
            return (
              <li key={q.id}>
                <button
                  onClick={() => toggle(q.id)}
                  aria-pressed={on}
                  className="w-full text-left px-4 py-3 rounded-xl border-2 transition-colors"
                  style={{
                    borderColor: on ? 'var(--th-border)' : 'var(--th-primary)',
                    backgroundColor: on ? 'transparent' : 'var(--th-surface)',
                  }}
                >
                  <span
                    className="font-serif leading-snug"
                    style={{
                      fontSize: 17,
                      color: on ? 'var(--text-secondary)' : 'var(--text-primary)',
                      textDecoration: on ? 'line-through' : 'none',
                      opacity: on ? 0.6 : 1,
                    }}
                  >
                    {q.text}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setStep('answers')}
          className="w-full py-3.5 rounded-full text-[17px] font-semibold text-white"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-full flex flex-col justify-center px-1 space-y-5">
      <h2
        className="font-display leading-tight"
        style={{ fontSize: 'clamp(28px, 8vw, 42px)', color: 'var(--th-primary)' }}
      >
        Remaining Questions
      </h2>

      {remaining.length === 0 ? (
        <p className="font-serif italic text-[17px]" style={{ color: 'var(--text-secondary)' }}>
          You heard them all answered on the tour.
        </p>
      ) : (
        <div className="space-y-5">
          {remaining.map((q) => (
            <div key={q.id}>
              <p
                className="font-serif italic leading-snug"
                style={{ fontSize: 14, color: 'var(--text-secondary)' }}
              >
                {q.text}
              </p>
              <p
                className="font-serif leading-relaxed mt-1"
                style={{ fontSize: 17, color: 'var(--text-primary)' }}
              >
                {q.status === 'later'
                  ? 'You will hear about it later!'
                  : q.status === 'answered' && q.answer
                    ? q.answer
                    : q.status === 'failed'
                      ? 'We could not find a reliable answer to this one.'
                      : 'Still researching…'}
              </p>
              {q.status === 'answered' && (q.sources || []).length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
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
          ))}
        </div>
      )}

      <button
        onClick={onComplete}
        className="w-full py-3.5 rounded-full text-[17px] font-semibold text-white"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        Let&rsquo;s Contextualize
      </button>
    </div>
  );
}
