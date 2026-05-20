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
      <p className="text-2xl uppercase tracking-[0.14em] text-[#C4923A] font-semibold">
        Question for you!
      </p>

      <p className="text-[20px] font-semibold text-[#2C2418]">
        Please discuss...
      </p>

      {/* The essential question — centered in dark box */}
      <div className="rounded-xl px-5 py-6 text-center border-2" style={{ backgroundColor: '#2C2418', borderColor: '#FFF8EE' }}>
        <p className="text-[28px] leading-relaxed font-serif font-bold" style={{ color: '#FFF8EE' }}>
          &ldquo;{eq.question}&rdquo;
        </p>
      </div>

      {/* Instruction */}
      <p className="text-[18px] text-[#6B5D4F] italic leading-relaxed">
        Talk this over with your group before continuing.
      </p>

      {/* Continue */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-[#C4923A] text-white"
        >
          Discussed! What&apos;s next?
        </button>
      </div>
    </div>
  );
}
