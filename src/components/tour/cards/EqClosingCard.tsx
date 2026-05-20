'use client';

/**
 * Essential Question — Closing written response screen.
 * Shows the question again and captures final interpretation.
 */

import { useState } from 'react';
import { Tour } from '@/lib/types';
import BackButton from './BackButton';
import MicButton from '../MicButton';

interface Props {
  tour: Tour;
  onComplete: (finalReflection: string, finalReasoning: string) => void;
}

export default function EqClosingCard({ tour, onComplete }: Props) {
  const eq = tour.essentialQuestion!;
  const [reflection, setReflection] = useState('');
  const [reasoning, setReasoning] = useState('');

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-2xl uppercase tracking-[0.14em] text-[#C4923A] font-semibold">
        Discussion Question
      </p>

      {/* The essential question — cardinal box */}
      <div className="rounded-xl px-5 py-6 text-center border-3" style={{ backgroundColor: '#7A1A1A90', borderColor: '#C4923A' }}>
        <p className="text-[28px] leading-relaxed font-serif font-bold" style={{ color: '#FFF8EE' }}>
          &ldquo;{eq.question}&rdquo;
        </p>
      </div>

      {/* Final interpretation */}
      <div className="space-y-2">
        <p className="text-[18px] font-semibold text-[#2C2418]">
          {eq.finalReflectionPrompt}
        </p>
        <div className="flex gap-2">
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder={eq.finalReflectionPlaceholder}
            rows={4}
            className="flex-1 px-4 py-3 rounded-lg border-2 border-[#D4BFA0] bg-white text-[20px] font-serif text-[#2C2418] placeholder:text-[#6B5D4F]/40 focus:outline-none focus:border-[#C4923A]"
          />
          <MicButton onTranscript={(t) => setReflection((prev) => prev ? prev + ' ' + t : t)} />
        </div>
      </div>

      {/* Final reasoning */}
      <div className="space-y-2">
        <p className="text-[18px] font-semibold text-[#2C2418]">
          {eq.finalReasoningPrompt}
        </p>
        <div className="flex gap-2">
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder={eq.finalReasoningPlaceholder}
            rows={4}
            className="flex-1 px-4 py-3 rounded-lg border-2 border-[#D4BFA0] bg-white text-[20px] font-serif text-[#2C2418] placeholder:text-[#6B5D4F]/40 focus:outline-none focus:border-[#C4923A]"
          />
          <MicButton onTranscript={(t) => setReasoning((prev) => prev ? prev + ' ' + t : t)} />
        </div>
      </div>

      {/* Submit + Back */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={() => onComplete(reflection.trim(), reasoning.trim())}
          disabled={!reflection.trim()}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-[#7A7A5E] text-white disabled:opacity-30"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
