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
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
        Question for you!
      </p>

      <p className="text-[20px] font-semibold text-text-primary italic">
        Please discuss...
      </p>

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
