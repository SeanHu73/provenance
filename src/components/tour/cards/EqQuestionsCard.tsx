'use client';

/**
 * Final questions screen — after the closing reflection, before end.
 * Lets the group add any remaining questions, then shows all their
 * questions collected throughout the tour.
 */

import { useState } from 'react';
import { useTour } from '@/context/TourContext';
import MicButton from '../MicButton';

export default function EqQuestionsCard() {
  const { tour, session, bankQuestion, finishTour, currentStop } = useTour();
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);

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

  return (
    <div className="animate-fade-in flex flex-col justify-center min-h-full space-y-6">
      {!submitted ? (
        <>
          <p className="text-2xl uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
            Any remaining questions?
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Before we wrap up — is there anything you&apos;re still curious about? Big or small, specific or open-ended.
          </p>

          {/* Question input */}
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

          {/* Questions added so far in this screen */}
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
        </>
      ) : (
        <>
          {/* Show all questions collected throughout the tour */}
          <p className="text-2xl uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
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
        </>
      )}
    </div>
  );
}
