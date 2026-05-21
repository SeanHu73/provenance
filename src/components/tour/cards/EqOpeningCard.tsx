'use client';

/**
 * Essential Question — Written response screen.
 * Captures the group's initial theory and reasoning.
 * The question was already discussed verbally on the previous screen.
 */

import { useState } from 'react';
import { Tour } from '@/lib/types';
import BackButton from './BackButton';
import MicButton from '../MicButton';

interface Props {
  tour: Tour;
  onComplete: (theory: string, reasoning: string) => void;
}

export default function EqOpeningCard({ tour, onComplete }: Props) {
  const eq = tour.essentialQuestion!;
  const [theory, setTheory] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [theoryCommitted, setTheoryCommitted] = useState(false);
  const [reasoningCommitted, setReasoningCommitted] = useState(false);

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-2xl uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
        Discussion Question
      </p>

      {/* Reminder of the question — centered in dark box */}
      <div className="rounded-xl px-5 py-6 text-center border-3" style={{ backgroundColor: 'var(--th-question-bg)', borderColor: 'var(--th-secondary)' }}>
        <p className="text-[28px] leading-relaxed font-display font-bold" style={{ color: 'var(--th-surface)' }}>
          &ldquo;{eq.question}&rdquo;
        </p>
      </div>

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
    </div>
  );
}
