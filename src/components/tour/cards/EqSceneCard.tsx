'use client';

/**
 * "Setting the scene..." — shows where to find the starting point,
 * with optional photo, description, audio, and opening framing toggle.
 */

import { useState } from 'react';
import { Tour } from '@/lib/types';
import AudioButton from './AudioButton';
import BackButton from './BackButton';
import FullscreenPhoto from './FullscreenPhoto';
import FormattedText from './FormattedText';
import ActionTitle from './ActionTitle';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

export default function EqSceneCard({ tour, onContinue }: Props) {
  const eq = tour.essentialQuestion!;
  const [autoplayPref] = useAudioAutoplay();
  const shouldAutoplay = autoplayPref && !eq.sceneAudioAutoplayDisabled;
  const [framingOpen, setFramingOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {/* Title */}
      <ActionTitle action="FIND" investigation subtitle="Setting the scene..." />

      <p className="text-[20px] font-semibold text-text-primary">
        Are you looking at this:
      </p>

      {/* Scene photo */}
      {eq.scenePhotoUrl && (
        <button
          onClick={() => setFullscreen(true)}
          className="w-full rounded-xl overflow-hidden shadow-md border border-sandstone-light text-left bg-sandstone"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={eq.scenePhotoUrl} alt="" className="w-full max-h-64 object-contain" />
        </button>
      )}

      {/* Scene description */}
      {eq.sceneDescription && (
        <p className="text-[21px] leading-relaxed font-serif text-text-primary">
          <FormattedText text={eq.sceneDescription} />
        </p>
      )}

      {/* Scene audio */}
      {eq.sceneAudioUrl && (
        <AudioButton audioUrl={eq.sceneAudioUrl} title={eq.sceneAudioTitle} autoplay={shouldAutoplay} />
      )}

      {/* Opening framing — toggle */}
      {eq.openingFraming && (
        <>
          <button
            onClick={() => setFramingOpen(!framingOpen)}
            className="text-base text-text-secondary flex items-center gap-2 py-2 px-3 rounded-lg border border-sandstone-light hover:bg-sandstone-light/20"
          >
            <span className="text-xs">{framingOpen ? '▼' : '▶'}</span>
            {framingOpen ? 'Hide text' : 'Tap to read along'}
          </button>
          {framingOpen && (
            <p className="text-[18px] text-text-secondary italic leading-relaxed animate-fade-in">
              <FormattedText text={eq.openingFraming} />
            </p>
          )}
        </>
      )}

      {/* Continue */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
        >
          What&apos;s the question?
        </button>
      </div>

      {fullscreen && eq.scenePhotoUrl && (
        <FullscreenPhoto url={eq.scenePhotoUrl} caption={eq.sceneDescription || null} onClose={() => setFullscreen(false)} />
      )}
    </div>
  );
}
