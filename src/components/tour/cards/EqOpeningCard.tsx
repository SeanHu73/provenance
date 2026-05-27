'use client';

/**
 * Essential Question — Written response screen ("Share your discussion").
 *
 * Two-section snap-scroll:
 *   1. Title + caption explaining that the opening and closing are the
 *      only required-record moments. SnapScrollHint cues the next
 *      section.
 *   2. The restated question + theory / reasoning textboxes + Continue.
 */

import { useEffect, useRef, useState } from 'react';
import { Tour } from '@/lib/types';
import BackButton from './BackButton';
import MicButton from '../MicButton';
import QuestionText from './QuestionText';
import SnapScrollHint from './SnapScrollHint';

interface Props {
  tour: Tour;
  onComplete: (theory: string, reasoning: string) => void;
}

const REVEAL_DELAY_MS = 200;
const REVEAL_TRANSITION_MS = 250;

export default function EqOpeningCard({ tour, onComplete }: Props) {
  const eq = tour.essentialQuestion!;
  const [theory, setTheory] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [theoryCommitted, setTheoryCommitted] = useState(false);
  const [reasoningCommitted, setReasoningCommitted] = useState(false);

  const formSectionRef = useRef<HTMLElement | null>(null);
  const [formRevealed, setFormRevealed] = useState(false);

  useEffect(() => {
    if (formRevealed) return;
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
  }, [formRevealed]);

  return (
    <div
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {/* Section 1 — title + recording-context note */}
      <section
        className="relative min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
          Share your discussion...
        </p>
        <div className="space-y-2">
          <p className="text-[18px] leading-relaxed text-text-primary">
            You will only be asked to record an answer here and at the end. All others are optional.
          </p>
          <p className="text-[14px] italic leading-relaxed text-text-secondary">
            This allows you to look back and see how your thinking has changed.
            It also helps our team learn with you.
          </p>
        </div>
        <SnapScrollHint />
      </section>

      {/* Section 2 — the question + theory / reasoning textboxes */}
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
        <QuestionText text={eq.question} />

        {/* Theory input */}
        <div className="space-y-2">
          <p className="text-[18px] font-semibold text-text-primary">
            {eq.theoryPrompt}
          </p>
          <div className="flex gap-2">
            <textarea
              value={theory}
              onChange={(e) => { setTheory(e.target.value); if (theoryCommitted) setTheoryCommitted(false); }}
              placeholder={eq.theoryPlaceholder}
              rows={3}
              className={`flex-1 px-4 py-3 rounded-lg text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all border-2 ${
                theoryCommitted
                  ? 'border-aged-gold/40 bg-aged-gold/5'
                  : 'border-sandstone-light bg-white'
              }`}
            />
            <MicButton onTranscript={(t) => { setTheory((prev) => prev ? prev + ' ' + t : t); if (theoryCommitted) setTheoryCommitted(false); }} />
          </div>
          {!theoryCommitted && (
            <button
              onClick={() => setTheoryCommitted(true)}
              disabled={!theory.trim()}
              className="w-full py-3 rounded-lg text-base font-semibold text-white bg-aged-gold hover:bg-aged-gold-light disabled:opacity-40 transition-colors"
            >
              Propose theory
            </button>
          )}
          {theoryCommitted && (
            <span className="text-xs text-olive">&#10003; Theory proposed</span>
          )}
        </div>

        {/* Reasoning input — appears after theory is committed */}
        {theoryCommitted && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-[18px] font-semibold text-text-primary">
              {eq.reasoningPrompt}
            </p>
            <div className="flex gap-2">
              <textarea
                value={reasoning}
                onChange={(e) => { setReasoning(e.target.value); if (reasoningCommitted) setReasoningCommitted(false); }}
                placeholder={eq.reasoningPlaceholder}
                rows={3}
                className={`flex-1 px-4 py-3 rounded-lg text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all border-2 ${
                  reasoningCommitted
                    ? 'border-aged-gold/40 bg-aged-gold/5'
                    : 'border-sandstone-light bg-white'
                }`}
              />
              <MicButton onTranscript={(t) => { setReasoning((prev) => prev ? prev + ' ' + t : t); if (reasoningCommitted) setReasoningCommitted(false); }} />
            </div>
            {!reasoningCommitted && (
              <button
                onClick={() => setReasoningCommitted(true)}
                disabled={!reasoning.trim()}
                className="w-full py-3 rounded-lg text-base font-semibold text-white bg-aged-gold hover:bg-aged-gold-light disabled:opacity-40 transition-colors"
              >
                Confirm your explanation
              </button>
            )}
            {reasoningCommitted && (
              <span className="text-xs text-olive">&#10003; Explanation confirmed</span>
            )}
          </div>
        )}

        {/* Continue */}
        {theoryCommitted && reasoningCommitted && (
          <div className="flex gap-2 animate-fade-in">
            <BackButton />
            <button
              onClick={() => onComplete(theory.trim(), reasoning.trim())}
              className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white"
            >
              {eq.additionalQuestion ? 'Continue' : "Let's find the first stop..."}
            </button>
          </div>
        )}

        {/* Skip */}
        <button
          onClick={() => onComplete('', '')}
          className="w-full py-3 rounded-lg text-base font-semibold text-text-secondary border-2 border-sandstone-light bg-sandstone/50 hover:bg-sandstone-light/30 transition-colors"
        >
          Skip for now
        </button>
      </section>
    </div>
  );
}
