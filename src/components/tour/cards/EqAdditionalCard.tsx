'use client';

/**
 * Additional discussion/opinion question after the written prompts,
 * before the first stop.
 */

import { Tour } from '@/lib/types';
import BackButton from './BackButton';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

export default function EqAdditionalCard({ tour, onContinue }: Props) {
  const aq = tour.essentialQuestion?.additionalQuestion;
  if (!aq) return null;

  const isOpinion = aq.questionType === 'opinion';

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
        {isOpinion ? "What's your opinion?" : 'Chance to discuss...'}
      </p>

      {/* The question — edges fade softly into background */}
      <div className="px-5 py-6 text-center" style={{ backgroundColor: 'var(--th-question-bg)', maskImage: 'radial-gradient(ellipse 85% 80% at 50% 50%, black 50%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 85% 80% at 50% 50%, black 50%, transparent 100%)' }}>
        <p className="text-[30px] leading-relaxed font-display font-bold" style={{ color: 'var(--th-surface)' }}>
          &ldquo;{aq.question}&rdquo;
        </p>
      </div>

      {/* Instruction */}
      <p className="text-[18px] text-text-secondary italic leading-relaxed text-center">
        {isOpinion
          ? 'Share your thoughts with your group before continuing.'
          : 'Talk this over with your group before continuing.'}
      </p>

      {/* Continue */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white"
        >
          Let&apos;s find the first stop...
        </button>
      </div>
    </div>
  );
}
