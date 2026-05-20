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

interface Props {
  tour: Tour;
  onContinue: () => void;
}

export default function EqSceneCard({ tour, onContinue }: Props) {
  const eq = tour.essentialQuestion!;
  const [framingOpen, setFramingOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-2xl uppercase tracking-[0.14em] text-[#C4923A] font-semibold">
        Setting the scene...
      </p>

      <p className="text-[20px] font-semibold text-[#2C2418]">
        Please find this:
      </p>

      {/* Scene photo */}
      {eq.scenePhotoUrl && (
        <button
          onClick={() => setFullscreen(true)}
          className="w-full rounded-xl overflow-hidden shadow-md border border-[#D4BFA0] text-left bg-[#F0E0C8]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={eq.scenePhotoUrl} alt="" className="w-full max-h-64 object-contain" />
        </button>
      )}

      {/* Scene description */}
      {eq.sceneDescription && (
        <p className="text-[21px] leading-relaxed font-serif text-[#2C2418]">
          {eq.sceneDescription}
        </p>
      )}

      {/* Scene audio */}
      {eq.sceneAudioUrl && (
        <AudioButton audioUrl={eq.sceneAudioUrl} title={eq.sceneAudioTitle} />
      )}

      {/* Opening framing — toggle */}
      {eq.openingFraming && (
        <>
          <button
            onClick={() => setFramingOpen(!framingOpen)}
            className="text-base text-[#6B5D4F] flex items-center gap-2 py-2 px-3 rounded-lg border border-[#D4BFA0] hover:bg-[#D4BFA0]/20"
          >
            <span className="text-xs">{framingOpen ? '▼' : '▶'}</span>
            {framingOpen ? 'Hide context' : 'More context'}
          </button>
          {framingOpen && (
            <p className="text-[18px] text-[#6B5D4F] italic leading-relaxed animate-fade-in">
              {eq.openingFraming}
            </p>
          )}
        </>
      )}

      {/* Continue */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-[#C4923A] text-white"
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
