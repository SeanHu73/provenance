'use client';

/**
 * "Meet Your Guide" — shown after the intro screens, before the tour's
 * essential question. Introduces the guide with a round photo, name,
 * title, a brief intro, and optional audio.
 */

import { Tour } from '@/lib/types';
import { guidePhotoStyle } from '@/lib/guide-photo';
import AudioButton from './AudioButton';
import BackButton from './BackButton';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

export default function MeetGuideCard({ tour, onContinue }: Props) {
  const g = tour.guide;

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold text-center">
        Meet Your Guide
      </p>

      {/* Round photo + name + title */}
      <div className="flex flex-col items-center gap-2.5">
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

        <p className="text-[24px] font-display font-semibold text-text-primary text-center leading-tight">
          {g.name}
        </p>

        {g.role && (
          <p className="text-[16px] italic text-text-secondary text-center -mt-1">
            {g.role}
          </p>
        )}
      </div>

      {/* Audio */}
      {g.introAudioUrl && (
        <AudioButton audioUrl={g.introAudioUrl} title={g.introAudioTitle ?? null} />
      )}

      {/* Intro text */}
      {g.intro && (
        <p className="text-[21px] leading-relaxed font-serif text-text-primary">
          {g.intro}
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
