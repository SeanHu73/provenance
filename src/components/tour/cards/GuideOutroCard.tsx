'use client';

/**
 * "Last words from <guide>" — an optional closing thank-you message from
 * the guide, shown after the final questions and before the end card.
 */

import { Tour } from '@/lib/types';
import { guidePhotoStyle } from '@/lib/guide-photo';
import AudioButton from './AudioButton';
import BackButton from './BackButton';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

export default function GuideOutroCard({ tour, onContinue }: Props) {
  const g = tour.guide;
  const [autoplayPref] = useAudioAutoplay();
  const shouldAutoplay = autoplayPref && !g.thankYouAudioAutoplayDisabled;

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-[24px] uppercase tracking-[0.12em] font-display text-aged-gold font-semibold text-center leading-tight">
        Last words from {g.name}
      </p>

      {/* Round photo */}
      <div className="flex justify-center">
        <div className="w-32 h-32 rounded-full overflow-hidden shadow-md border-[3px] border-aged-gold flex items-center justify-center bg-[var(--th-primary)]">
          {g.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={g.photoUrl}
              alt={g.name}
              className="w-full h-full object-cover"
              style={guidePhotoStyle(g)}
            />
          ) : (
            <span className="text-3xl font-bold" style={{ color: 'var(--th-surface)' }}>
              {g.initials || '?'}
            </span>
          )}
        </div>
      </div>

      {/* Audio */}
      {g.thankYouAudioUrl && (
        <AudioButton audioUrl={g.thankYouAudioUrl} title={g.thankYouAudioTitle ?? null} autoplay={shouldAutoplay} />
      )}

      {/* Message */}
      {g.thankYouMessage && (
        <p className="text-[21px] leading-relaxed font-serif text-text-primary">
          {g.thankYouMessage}
        </p>
      )}

      {/* Continue */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
