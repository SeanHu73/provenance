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
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
        Going back to the discussion question...
      </p>

      {/* Audio */}
      {eq.closingAudioUrl && <AudioButton audioUrl={eq.closingAudioUrl} title={eq.closingAudioTitle} />}

      {/* Closing framing */}
      <p className="text-[18px] text-text-secondary italic leading-relaxed">
        {eq.closingFraming}
      </p>

      {/* The essential question — edges fade softly into background */}
      <div className="rounded-xl px-5 py-6 text-center" style={{ backgroundColor: 'var(--th-question-bg)', maskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)', maskComposite: 'intersect', WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 20px), transparent), linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)', WebkitMaskComposite: 'destination-in' }}>
        <p className="text-[30px] leading-relaxed font-display font-bold" style={{ color: 'var(--th-surface)' }}>
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
