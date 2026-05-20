'use client';

/**
 * Closing discussion screen — revisit the essential question verbally
 * before the written closing prompts.
 */

import { Tour } from '@/lib/types';
import BackButton from './BackButton';
import AudioButton from './AudioButton';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

export default function EqClosingDiscussCard({ tour, onContinue }: Props) {
  const eq = tour.essentialQuestion!;

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-2xl uppercase tracking-[0.14em] text-[#C4923A] font-semibold">
        Going back to the discussion question...
      </p>

      {/* Audio */}
      {eq.closingAudioUrl && <AudioButton audioUrl={eq.closingAudioUrl} title={eq.closingAudioTitle} />}

      {/* Closing framing */}
      <p className="text-[18px] text-[#6B5D4F] italic leading-relaxed">
        {eq.closingFraming}
      </p>

      {/* The essential question — cardinal box */}
      <div className="rounded-xl px-5 py-6 text-center border-3" style={{ backgroundColor: '#7A1A1A90', borderColor: '#C4923A' }}>
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
