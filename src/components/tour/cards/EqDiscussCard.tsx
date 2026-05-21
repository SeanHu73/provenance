'use client';

/**
 * "Question for you! Please discuss..." — poses the essential question
 * for verbal discussion before written prompts.
 */

import { Tour } from '@/lib/types';
import BackButton from './BackButton';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

export default function EqDiscussCard({ tour, onContinue }: Props) {
  const eq = tour.essentialQuestion!;

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-2xl uppercase tracking-[0.14em] text-aged-gold font-semibold">
        Question for you!
      </p>

      <p className="text-[20px] font-semibold text-text-primary italic">
        Please discuss...
      </p>

      {/* The essential question — centered in dark box */}
      <div className="rounded-xl px-5 py-6 text-center border-3" style={{ backgroundColor: 'var(--th-question-bg)', borderColor: 'var(--th-secondary)' }}>
        <p className="text-[28px] leading-relaxed font-serif font-bold" style={{ color: 'var(--th-surface)' }}>
          &ldquo;{eq.question}&rdquo;
        </p>
      </div>

      {/* Instruction */}
      <p className="text-[18px] text-text-secondary italic leading-relaxed">
        Talk this over with your group before continuing.
      </p>

      {/* Continue */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
        >
          Discussed! What&apos;s next?
        </button>
      </div>
    </div>
  );
}
