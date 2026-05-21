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
      <div className="relative rounded-xl overflow-hidden px-8 py-7" style={{ background: 'var(--th-question-bg)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--th-surface) 0%, transparent 22px, transparent calc(100% - 22px), var(--th-surface) 100%)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, var(--th-surface) 0%, transparent 22px, transparent calc(100% - 22px), var(--th-surface) 100%)' }} />
        <p className="relative text-[30px] leading-relaxed font-display font-bold text-center" style={{ color: 'var(--th-surface)' }}>
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
