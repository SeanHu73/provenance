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
import ActionTitle, { SectionSubtitle } from './ActionTitle';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

/** The scene fields this card renders. Both `Tour.essentialQuestion` and
 *  `Tour.openingFrame` (Context-Prototype) satisfy this shape. */
export interface SceneData {
  scenePhotoUrl: string | null;
  sceneDescription: string;
  sceneAudioUrl: string | null;
  sceneAudioTitle: string | null;
  sceneAudioAutoplayDisabled?: boolean;
  openingFraming: string;
}

interface Props {
  /** EQ usage passes the tour and reads `essentialQuestion`. */
  tour?: Tour;
  /** Context-Prototype usage passes the Opening Frame data directly. */
  scene?: SceneData | null;
  subtitle?: string;
  buttonLabel?: string;
  /** Context Opening Frame layout: enlarge "Are you looking at this:" and
   *  move the "Setting the Scene" label below the photo, above the text. */
  openingVariant?: boolean;
  onContinue: () => void;
}

export default function EqSceneCard({
  tour,
  scene,
  subtitle = 'Setting the scene...',
  buttonLabel = "What's the question?",
  openingVariant = false,
  onContinue,
}: Props) {
  const eq: SceneData | null = scene ?? tour?.essentialQuestion ?? null;
  const [autoplayPref] = useAudioAutoplay();
  const [framingOpen, setFramingOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  if (!eq) return null;
  const shouldAutoplay = autoplayPref && !eq.sceneAudioAutoplayDisabled;

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {/* Title */}
      <ActionTitle action="FIND" />

      {/* Header — in the opening-frame variant the prompt is enlarged and the
          "Setting the Scene" label moves below the photo (above the text). */}
      {openingVariant ? (
        <p className="text-[28px] font-semibold leading-tight text-text-primary">
          Are you looking at this:
        </p>
      ) : (
        <div>
          <SectionSubtitle className="mb-2">{subtitle}</SectionSubtitle>
          <p className="text-[20px] font-semibold text-text-primary">
            Are you looking at this:
          </p>
        </div>
      )}

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

      {/* "Setting the Scene" label — opening-frame variant places it here,
          below the photo and above the description. */}
      {openingVariant && <SectionSubtitle>{subtitle}</SectionSubtitle>}

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
          {buttonLabel}
        </button>
      </div>

      {fullscreen && eq.scenePhotoUrl && (
        <FullscreenPhoto url={eq.scenePhotoUrl} caption={eq.sceneDescription || null} onClose={() => setFullscreen(false)} />
      )}
    </div>
  );
}
