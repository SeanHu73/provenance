'use client';

/**
 * Context-Prototype — the end-of-act "Context" page (no map pin), shown after
 * the Context intro splash.
 *
 * The explorer SEES the admin-framed question first (a full snap section), then
 * scrolls down to the full context / answer the admin provides. When only one
 * of the two is authored, it falls back to a single centred section.
 */

import { useTour } from '@/context/TourContext';
import { findActOfStop } from '@/lib/tour-session';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { usePhotoCues } from '../usePhotoCues';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import BackButton from './BackButton';
import FormattedText from './FormattedText';
import SnapScrollHint from './SnapScrollHint';
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
  const hasQuestion = !!ctx.question?.trim();
  const hasBody = !!(ctx.context?.trim() || (ctx.photos && ctx.photos.length > 0) || ctx.audioUrl);

  // The framed question, shown first / prominently.
  const questionBlock = (
    <>
      <p className="uppercase tracking-[0.18em] font-display font-semibold mb-3" style={{ fontSize: 13, color: 'var(--th-accent-dark)' }}>
        Context
      </p>
      <p className="font-serif leading-snug" style={{ fontSize: 28, color: 'var(--th-primary)' }}>
        <FormattedText text={ctx.question} />
      </p>
    </>
  );

  // The full context / answer.
  const bodyBlock = (
    <>
      <SectionSubtitle className="mb-2">The Context</SectionSubtitle>
      {ctx.audioUrl && (
        <AudioButton
          audioUrl={ctx.audioUrl}
          title={ctx.audioTitle}
          autoplay={autoplay}
          onTimeUpdate={cues.onTimeUpdate}
          onEnded={cues.onEnded}
        />
      )}
      <PhotoContent
        text={ctx.context || ''}
        photos={ctx.photos || []}
        highlightedUrl={cues.highlightedUrl}
      />
    </>
  );

  const footer = (
    <div className="flex gap-2 pt-1">
      <BackButton />
      <button
        onClick={onComplete}
        className="flex-1 py-3 rounded-lg text-base font-semibold bg-accent-dark text-white"
      >
        Continue
      </button>
    </div>
  );

  // Both authored → snap-scroll: question fills the screen, scroll to context.
  if (hasQuestion && hasBody) {
    return (
      <div className="animate-fade-in absolute inset-0 overflow-y-auto" style={{ scrollSnapType: 'y mandatory' }}>
        <section
          className="relative min-h-full flex flex-col justify-center px-5 pt-10 pb-6"
          style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
          {questionBlock}
          <SnapScrollHint />
        </section>
        <section
          className="min-h-full flex flex-col justify-center space-y-4 px-5 pt-10 pb-6"
          style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
          {bodyBlock}
          {footer}
        </section>
      </div>
    );
  }

  // Only one of the two — single centred section.
  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {hasQuestion ? questionBlock : bodyBlock}
      {footer}
    </div>
  );
}
