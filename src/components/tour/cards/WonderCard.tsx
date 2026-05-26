'use client';

import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import BackButton from './BackButton';

interface Props {
  stop: Stop;
  onContinue: () => void;
  /** Whether a context (reveal) screen follows this discussion question. */
  hasContext?: boolean;
  /** True when this wonder is the final in-stop screen (no bridge → no whats_next). */
  isFinalInStop?: boolean;
}

export default function WonderCard({ stop, onContinue, hasContext = true, isFinalInStop = false }: Props) {
  if (!stop.wonder) return null;

  const buttonLabel = isFinalInStop
    ? "We've talked — continue tour"
    : hasContext
      ? "We've talked — show us"
      : "We've talked — what's next?";

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
        {stop.wonder?.questionType === 'opinion' ? "What’s your opinion?" : 'Chance to discuss...'}
      </p>

      {/* Audio player */}
      {stop.wonder?.audioUrl && <AudioButton audioUrl={stop.wonder.audioUrl} title={stop.wonder.audioTitle} />}

      {/* Discussion prompt + photos */}
      <PhotoContent
        text={stop.wonder.question}
        photos={stop.wonder.photos || []}
        textClass="text-[23px] leading-relaxed font-serif text-text-primary"
      />

      {/* Continue + Back */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
