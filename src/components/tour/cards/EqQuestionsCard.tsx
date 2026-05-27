'use client';

/**
 * Final questions screen — after the closing reflection, before end.
 *
 * Two-section snap-scroll:
 *   1. Caption: "Before we wrap up - is there anything else you need
 *      to answer our discussion question? Anything else you're still
 *      curious about?"
 *   2. "Any remaining questions?" + textbox + previously-asked list +
 *      Finish-tour button.
 * The "Your questions from the tour" review screen follows the Finish
 * tap and runs as a single (non-snap) page.
 */

import { useEffect, useRef, useState } from 'react';
import { useTour } from '@/context/TourContext';
import MicButton from '../MicButton';
import SnapScrollHint from './SnapScrollHint';

const REVEAL_DELAY_MS = 200;
const REVEAL_TRANSITION_MS = 250;

export default function EqQuestionsCard() {
  const { tour, session, bankQuestion, finishTour, currentStop } = useTour();
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const formSectionRef = useRef<HTMLElement | null>(null);
  const [formRevealed, setFormRevealed] = useState(false);

  useEffect(() => {
    if (submitted || formRevealed) return;
    const el = formSectionRef.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(10);
            }
            timeoutId = setTimeout(() => setFormRevealed(true), REVEAL_DELAY_MS);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [submitted, formRevealed]);

  if (!tour || !session) return null;

  const allQuestions = session.bankedQuestions;

  const handleAddQuestion = () => {
    if (!question.trim()) return;
    bankQuestion({
      id: `bq_${Date.now().toString(36)}`,
      tourId: tour.id,
      sessionId: session.id,
      questionText: question.trim(),
      askedAfterStopId: currentStop?.id || 'end',
      aiResponse: 'banked',
      timestamp: new Date().toISOString(),
    });
    setQuestion('');
  };

  // Post-submit review screen — non-snap single page.
  if (submitted) {
    return (
      <div className="animate-fade-in flex flex-col justify-center min-h-full space-y-6">
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
          Your questions from the tour
        </p>

        {allQuestions.length === 0 ? (
          <p className="text-sm text-text-secondary italic">
            No questions were asked during this tour.
          </p>
        ) : (
          <ul className="space-y-3">
            {allQuestions.map((q) => (
              <li key={q.id} className="p-3 rounded-lg bg-white border border-sandstone-light">
                <p className="text-sm font-serif text-text-primary">&ldquo;{q.questionText}&rdquo;</p>
                <p className="text-[10px] text-text-secondary mt-1">
                  {q.aiResponse === 'coming_up' ? 'Addressed on the tour' : q.aiResponse === 'answered_off_path' ? 'Answered' : 'Saved'}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-text-secondary italic text-center">
          These questions help us understand what visitors are curious about. Thank you for asking them.
        </p>

        <button
          onClick={finishTour}
          className="w-full py-3 rounded-lg text-base font-semibold bg-journal text-warm-white"
        >
          Complete tour
        </button>
      </div>
    );
  }

  // Pre-submit: two-section snap-scroll.
  return (
    <div
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {/* Section 1 — caption only */}
      <section
        className="relative min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p className="text-[19px] leading-relaxed font-serif text-text-primary text-left">
          Before we wrap up — is there anything else you need to answer our discussion question? Anything else you&apos;re still curious about?
        </p>
        <SnapScrollHint />
      </section>

      {/* Section 2 — title + textbox + bank list + finish */}
      <section
        ref={formSectionRef}
        className="min-h-full flex flex-col justify-center space-y-6 px-5 pt-10 pb-6"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          opacity: formRevealed ? 1 : 0,
          transform: formRevealed ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease-out, transform ${REVEAL_TRANSITION_MS}ms ease-out`,
        }}
      >
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
          Any remaining questions?
        </p>

        <div className="space-y-3">
          <div className="flex gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type or speak your question..."
              rows={3}
              className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
            />
            <MicButton onTranscript={(t) => setQuestion((prev) => prev ? prev + ' ' + t : t)} />
          </div>
          <button
            onClick={handleAddQuestion}
            disabled={!question.trim()}
            className="w-full py-3 rounded-lg text-base font-semibold border-2 border-aged-gold text-aged-gold bg-aged-gold/10 disabled:opacity-30"
          >
            Add question
          </button>
        </div>

        {allQuestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold">
              Your questions ({allQuestions.length})
            </p>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {allQuestions.map((q) => (
                <li key={q.id} className="p-2 rounded-lg bg-white border border-sandstone-light text-xs font-serif text-text-primary">
                  &ldquo;{q.questionText}&rdquo;
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={() => setSubmitted(true)}
          className="w-full py-3 rounded-lg text-base font-semibold bg-olive text-white"
        >
          Finish tour
        </button>
      </section>
    </div>
  );
}
