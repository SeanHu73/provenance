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
      <div className="space-y-1">
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
          Share your discussion...
        </p>
        <p className="text-sm text-text-secondary">
          You can type or tap and speak into the mic to respond.
        </p>
      </div>

      {/* The essential question — soft-edge blur-behind effect */}
      <div className="relative px-8 py-7 text-center">
        <div
          className="absolute inset-0"
          style={{
            background: 'var(--th-question-bg-solid)',
            filter: 'blur(8px)',
            transform: 'scale(0.93)',
            borderRadius: '12px',
          }}
        />
        <p className="relative text-[30px] leading-relaxed font-display font-bold" style={{ color: 'var(--th-surface)' }}>
          &ldquo;{eq.question}&rdquo;
        </p>
      </div>

      {/* Final interpretation */}
      <div className="space-y-2">
        <p className="text-[18px] font-semibold text-text-primary">
          {eq.finalReflectionPrompt}
        </p>
        <div className="flex gap-2">
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder={eq.finalReflectionPlaceholder}
            rows={4}
            className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
          />
          <MicButton onTranscript={(t) => setReflection((prev) => prev ? prev + ' ' + t : t)} />
        </div>
      </div>

      {/* Final reasoning */}
      <div className="space-y-2">
        <p className="text-[18px] font-semibold text-text-primary">
          {eq.finalReasoningPrompt}
        </p>
        <div className="flex gap-2">
          <textarea
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value)}
            placeholder={eq.finalReasoningPlaceholder}
            rows={4}
            className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
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
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white disabled:opacity-30"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
