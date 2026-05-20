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
      <p className="text-2xl uppercase tracking-[0.14em] text-[#C4923A] font-semibold">
        Discussion Question
      </p>

      {/* Reminder of the question — centered in dark box */}
      <div className="rounded-xl px-5 py-6 text-center border-3" style={{ backgroundColor: '#7A1A1A90', borderColor: '#C4923A' }}>
        <p className="text-[28px] leading-relaxed font-serif font-bold" style={{ color: '#FFF8EE' }}>
          &ldquo;{eq.question}&rdquo;
        </p>
      </div>

      {/* Theory input */}
      <div className="space-y-2">
        <p className="text-[18px] font-semibold text-[#2C2418]">
          {eq.theoryPrompt}
        </p>
        <div className="flex gap-2">
          <textarea
            value={theory}
            onChange={(e) => { setTheory(e.target.value); if (theoryCommitted) setTheoryCommitted(false); }}
            placeholder={eq.theoryPlaceholder}
            rows={3}
            className={`flex-1 px-4 py-3 rounded-lg text-[20px] font-serif text-[#2C2418] placeholder:text-[#6B5D4F]/40 focus:outline-none transition-all border-2 ${
              theoryCommitted
                ? 'border-[#C4923A]/40 bg-[#C4923A]/5'
                : 'border-[#D4BFA0] bg-white'
            }`}
          />
          <MicButton onTranscript={(t) => { setTheory((prev) => prev ? prev + ' ' + t : t); if (theoryCommitted) setTheoryCommitted(false); }} />
        </div>
        {!theoryCommitted && (
          <button
            onClick={() => setTheoryCommitted(true)}
            disabled={!theory.trim()}
            className="w-full py-3 rounded-lg text-base font-semibold text-[#C4923A] border-2 border-[#C4923A] bg-[#C4923A]/10 hover:bg-[#C4923A]/20 disabled:opacity-50 transition-colors"
          >
            Propose theory
          </button>
        )}
        {theoryCommitted && (
          <span className="text-xs text-[#7A7A5E]">&#10003; Theory proposed</span>
        )}
      </div>

      {/* Reasoning input — appears after theory is committed */}
      {theoryCommitted && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-[18px] font-semibold text-[#2C2418]">
            {eq.reasoningPrompt}
          </p>
          <div className="flex gap-2">
            <textarea
              value={reasoning}
              onChange={(e) => { setReasoning(e.target.value); if (reasoningCommitted) setReasoningCommitted(false); }}
              placeholder={eq.reasoningPlaceholder}
              rows={3}
              className={`flex-1 px-4 py-3 rounded-lg text-[20px] font-serif text-[#2C2418] placeholder:text-[#6B5D4F]/40 focus:outline-none transition-all border-2 ${
                reasoningCommitted
                  ? 'border-[#C4923A]/40 bg-[#C4923A]/5'
                  : 'border-[#D4BFA0] bg-white'
              }`}
            />
            <MicButton onTranscript={(t) => { setReasoning((prev) => prev ? prev + ' ' + t : t); if (reasoningCommitted) setReasoningCommitted(false); }} />
          </div>
          {!reasoningCommitted && (
            <button
              onClick={() => setReasoningCommitted(true)}
              disabled={!reasoning.trim()}
              className="w-full py-3 rounded-lg text-base font-semibold text-[#C4923A] border-2 border-[#C4923A] bg-[#C4923A]/10 hover:bg-[#C4923A]/20 disabled:opacity-50 transition-colors"
            >
              Confirm your explanation
            </button>
          )}
          {reasoningCommitted && (
            <span className="text-xs text-[#7A7A5E]">&#10003; Explanation confirmed</span>
          )}
        </div>
      )}

      {/* Continue */}
      {theoryCommitted && reasoningCommitted && (
        <div className="flex gap-2 animate-fade-in">
          <BackButton />
          <button
            onClick={() => onComplete(theory.trim(), reasoning.trim())}
            className="flex-1 py-3 rounded-lg text-base font-semibold bg-[#7A7A5E] text-white"
          >
            {eq.additionalQuestion ? 'Continue' : "Let's find the first stop..."}
          </button>
        </div>
      )}

      {/* Skip */}
      <button
        onClick={() => onComplete('', '')}
        className="w-full py-3 rounded-lg text-base font-semibold text-[#6B5D4F] border-2 border-[#D4BFA0] bg-[#F0E0C8]/50 hover:bg-[#D4BFA0]/30 transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}
