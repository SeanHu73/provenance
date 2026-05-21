'use client';

import { useState } from 'react';
import { useTour } from '@/context/TourContext';
import { routeQuestion, type RouteResult } from '@/lib/tour-question-router';
import MicButton from '../MicButton';

export default function BranchCard() {
  const { tour, session, currentStop, returnFromBranch, bankQuestion } = useTour();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !tour || !session) return;
    setLoading(true);

    const res = await routeQuestion(question.trim(), tour, session);
    setResult(res);

    // Bank the question regardless of response type (for the question bank)
    if (res.type === 'banked' && currentStop) {
      bankQuestion({
        id: `bq_${Date.now().toString(36)}`,
        tourId: tour.id,
        sessionId: session.id,
        questionText: question.trim(),
        askedAfterStopId: currentStop.id,
        aiResponse: 'banked',
        timestamp: new Date().toISOString(),
      });
    } else if (res.type === 'answered' && currentStop) {
      bankQuestion({
        id: `bq_${Date.now().toString(36)}`,
        tourId: tour.id,
        sessionId: session.id,
        questionText: question.trim(),
        askedAfterStopId: currentStop.id,
        aiResponse: 'answered_off_path',
        timestamp: new Date().toISOString(),
      });
    } else if (res.type === 'coming_up' && currentStop) {
      bankQuestion({
        id: `bq_${Date.now().toString(36)}`,
        tourId: tour.id,
        sessionId: session.id,
        questionText: question.trim(),
        askedAfterStopId: currentStop.id,
        aiResponse: 'coming_up',
        timestamp: new Date().toISOString(),
      });
    }

    setLoading(false);
  };

  // Pre-result: show the question input
  if (!result) {
    return (
      <div className="animate-fade-in space-y-4 min-h-full flex flex-col justify-center">
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
          What are you curious about?
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type or speak your question..."
              rows={3}
              className="flex-1 px-3 py-2 rounded-lg border border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-aged-gold"
              autoFocus
            />
            <MicButton onTranscript={(t) => setQuestion((prev) => prev ? prev + ' ' + t : t)} />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!question.trim() || loading}
              className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white disabled:opacity-40"
            >
              {loading ? 'Thinking...' : 'Ask'}
            </button>
            <button
              type="button"
              onClick={returnFromBranch}
              className="px-4 py-3 rounded-lg text-sm text-text-secondary hover:bg-sandstone-light/30"
            >
              Skip
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Post-result: show the response
  return (
    <div className="animate-fade-in space-y-4 min-h-full flex flex-col justify-center">
      {/* Question echo */}
      <p className="text-xs text-text-secondary uppercase tracking-wide font-semibold">You asked</p>
      <p className="text-sm font-serif text-text-primary italic">&ldquo;{question}&rdquo;</p>

      {/* Response A: Coming up */}
      {result.type === 'coming_up' && (
        <div className="p-4 rounded-lg bg-olive/10 border border-olive/30">
          <p className="text-[20px] font-serif text-text-primary">
            Great question &mdash; you&apos;ll encounter something about that at stop {result.matchedStopOrder}. Hold onto it.
          </p>
        </div>
      )}

      {/* Response B: AI answer */}
      {result.type === 'answered' && (
        <div className="space-y-3">
          {result.data.observation && (
            <div className="p-3 rounded-lg bg-accent-dark/10 border border-accent-dark/20">
              <p className="text-[20px] font-serif text-text-primary">{result.data.observation}</p>
            </div>
          )}
          <div className="p-4 rounded-lg bg-aged-gold/10 border border-aged-gold/20">
            <p className="text-[20px] font-serif text-text-primary leading-relaxed">
              {result.data.answer}
            </p>
          </div>
        </div>
      )}

      {/* Response C: Banked */}
      {result.type === 'banked' && (
        <div className="p-4 rounded-lg bg-sandstone border border-sandstone-light">
          <p className="text-[20px] font-serif text-text-primary">
            That&apos;s a great question, but it&apos;s beyond what we know about this place right now.
            We&apos;ve saved it &mdash; you&apos;ll see it in your question bank at the end of the tour.
          </p>
        </div>
      )}

      {/* Return to tour */}
      <button
        onClick={returnFromBranch}
        className="w-full py-3 rounded-lg text-base font-semibold bg-olive text-white"
      >
        Return to the tour
      </button>
    </div>
  );
}
