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

import { useEffect, useRef, useState } from 'react';
import { setInvestigationHeard } from '@/lib/investigation-store';
import { requestFactsHint } from '@/lib/facts-hint';
import type { InvestigationQuestion } from '@/lib/types';

interface Props {
  questions: InvestigationQuestion[];
  /** False while the opening submission is still being split into questions.
   *  Without this the screen could not tell "they asked nothing we answer here"
   *  from "the parse has not landed yet", and skipped itself on both — which a
   *  learner who moved through act 1 quickly would hit every time. */
  parsed: boolean;
  onComplete: () => void;
}

export default function InvestigationReturnCard({ questions, parsed, onComplete }: Props) {
  const [step, setStep] = useState<'tick' | 'answers'>('tick');
  // Seeded from the questions themselves so a tick survives leaving and coming
  // back, and merged rather than replaced because the list can still be filling
  // in underneath this screen.
  const [heard, setHeard] = useState<Record<string, boolean>>({});
  const marks: Record<string, boolean> = Object.fromEntries(
    questions.map((q) => [q.id, heard[q.id] ?? !!q.heard]),
  );

  // Ticking does not wait on research. What the screen asks — "did the tour
  // answer this?" — is a question about the walk they just did, and they can
  // answer it whether or not anything has come back. Only the second screen
  // depends on the answers, and it has somewhere to send them when they are not
  // ready. Bowing out is reserved for genuinely having nothing: the split ran and
  // produced no question this screen handles.
  const nothingToShow = parsed && questions.length === 0;
  const doneRef = useRef(onComplete);
  doneRef.current = onComplete;
  useEffect(() => {
    if (nothingToShow) doneRef.current();
  }, [nothingToShow]);
  if (nothingToShow) return null;

  if (!parsed) {
    return (
      <div className="animate-fade-in min-h-full flex flex-col justify-center px-1">
        <p className="font-serif italic text-center" style={{ fontSize: 17, color: 'var(--text-secondary)' }}>
          Gathering your questions&hellip;
        </p>
      </div>
    );
  }

  const toggle = (id: string) => {
    const next = !marks[id];
    setHeard((prev) => ({ ...prev, [id]: next }));
    setInvestigationHeard(id, next);
  };

  const remaining = questions.filter((q) => !marks[q.id]);
  const unready = remaining.filter((q) => q.status !== 'later' && !(q.status === 'answered' && q.answer));

  if (step === 'tick') {
    return (
      <div className="animate-fade-in min-h-full flex flex-col justify-center px-1 space-y-5">
        <p
          className="font-serif leading-snug"
          style={{ fontSize: 'clamp(21px, 5.8vw, 27px)', color: 'var(--text-primary)' }}
        >
          Here are{' '}
          <span className="font-semibold" style={{ color: 'var(--th-primary)' }}>your questions</span>{' '}
          returned, tap those you{' '}
          <span className="font-semibold" style={{ color: 'var(--th-primary)' }}>heard answers to</span>{' '}
          on the tour.
        </p>

        <ul className="space-y-2.5">
          {questions.map((q) => {
            const on = !!marks[q.id];
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
                      : 'Still looking…'}
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
        onClick={() => {
          // Show them where, rather than telling them. A line of text on a screen
          // they are leaving is read once and gone; the menu opening itself with
          // the row called out is what they will remember when an answer lands.
          if (unready.length > 0) requestFactsHint();
          onComplete();
        }}
        className="w-full py-3.5 rounded-full text-[17px] font-semibold text-white"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        Let&rsquo;s Contextualize
      </button>
    </div>
  );
}
