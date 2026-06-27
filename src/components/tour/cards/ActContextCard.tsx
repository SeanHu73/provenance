'use client';

/**
 * Context-Prototype — the end-of-act "Context" section (no map pin).
 *
 * Read-only: an admin-framed question plus the context/answer the admin
 * provides. The explorer reads it, then (next phase) is prompted for their own
 * context questions.
 */

import { useTour } from '@/context/TourContext';
import { findActOfStop } from '@/lib/tour-session';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { usePhotoCues } from '../usePhotoCues';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import BackButton from './BackButton';
import FormattedText from './FormattedText';
import { SectionSubtitle } from './ActionTitle';

interface Props {
  onComplete: () => void;
}

export default function ActContextCard({ onComplete }: Props) {
  const { tour, currentStop } = useTour();
  const [autoplayPref] = useAudioAutoplay();
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  const ctx = act?.context ?? null;
  const cues = usePhotoCues(undefined, ctx?.photos || [], false);

  if (!ctx) {
    // Shouldn't happen (we only route here when context is authored), but
    // never strand the explorer.
    return (
      <div className="animate-fade-in min-h-full flex flex-col justify-center space-y-5">
        <button onClick={onComplete} className="w-full py-3 rounded-lg text-base font-semibold bg-accent-dark text-white">Continue</button>
      </div>
    );
  }

  const autoplay = autoplayPref && !ctx.audioAutoplayDisabled;

  return (
    <div className="animate-fade-in space-y-5">
      <h2
        className="uppercase tracking-[0.12em] font-display font-bold leading-none"
        style={{ fontSize: 44, color: 'var(--th-accent-dark)' }}
      >
        Context
      </h2>

      {ctx.question?.trim() && (
        <p className="font-serif leading-snug" style={{ fontSize: 26, color: 'var(--th-primary)' }}>
          <FormattedText text={ctx.question} />
        </p>
      )}

      {ctx.audioUrl && (
        <AudioButton
          audioUrl={ctx.audioUrl}
          title={ctx.audioTitle}
          autoplay={autoplay}
          onTimeUpdate={cues.onTimeUpdate}
          onEnded={cues.onEnded}
        />
      )}

      {(ctx.context?.trim() || (ctx.photos && ctx.photos.length > 0)) && (
        <div>
          <SectionSubtitle className="mb-2">The Context</SectionSubtitle>
          <PhotoContent
            text={ctx.context || ''}
            photos={ctx.photos || []}
            highlightedUrl={cues.highlightedUrl}
          />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <BackButton />
        <button
          onClick={onComplete}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-accent-dark text-white"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
