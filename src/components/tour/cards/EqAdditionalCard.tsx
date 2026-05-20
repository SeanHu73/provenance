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
      <p className="text-2xl uppercase tracking-[0.14em] text-[#C4923A] font-semibold">
        {isOpinion ? "What's your opinion?" : 'Chance to discuss...'}
      </p>

      {/* The question — centered in translucent box */}
      <div className="rounded-xl px-5 py-6 text-center" style={{ backgroundColor: 'rgba(240, 224, 200, 0.7)' }}>
        <p className="text-[24px] leading-relaxed font-serif font-bold text-[#2C2418]">
          &ldquo;{aq.question}&rdquo;
        </p>
      </div>

      {/* Instruction */}
      <p className="text-[18px] text-[#6B5D4F] italic leading-relaxed text-center">
        {isOpinion
          ? 'Share your thoughts with your group before continuing.'
          : 'Talk this over with your group before continuing.'}
      </p>

      {/* Continue */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-[#7A7A5E] text-white"
        >
          Let&apos;s find the first stop...
        </button>
      </div>
    </div>
  );
}
