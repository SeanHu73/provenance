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
import { useReadMode } from '@/lib/read-mode';

/** The scene fields this card renders. Both `Tour.essentialQuestion` and
 *  `Tour.openingFrame` (Context-Prototype) satisfy this shape. */
export interface SceneData {
  scenePhotoUrl: string | null;
  sceneDescription: string;
  sceneAudioUrl: string | null;
  sceneAudioTitle: string | null;
  sceneAudioAutoplayDisabled?: boolean;
  openingFraming: string;
  location?: { lat: number; lng: number } | null;
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
  /** "Find pin" map-peek handler — shown (opening variant) when the scene
   *  carries a location. */
  onPeekMap?: () => void;
  onContinue: () => void;
}

export default function EqSceneCard({
  tour,
  scene,
  subtitle = 'Setting the scene...',
  buttonLabel = "What's the question?",
  openingVariant = false,
  onPeekMap,
  onContinue,
}: Props) {
  const eq: SceneData | null = scene ?? tour?.essentialQuestion ?? null;
  const [autoplayPref] = useAudioAutoplay();
  const [readMode] = useReadMode();
  const [framingOpen, setFramingOpen] = useState(readMode);
  const [fullscreen, setFullscreen] = useState(false);
  if (!eq) return null;
  const shouldAutoplay = autoplayPref && !eq.sceneAudioAutoplayDisabled;

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {/* Title */}
      <ActionTitle action="FIND" />

      {/* Find pin — peeks the map to the starting point (opening frame only). */}
      {openingVariant && onPeekMap && eq.location && (
        <div>
          <button
            onClick={onPeekMap}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--th-primary)',
              border: '1px solid var(--th-primary)',
              backgroundColor: 'color-mix(in srgb, var(--th-primary) 6%, transparent)',
            }}
            title="Find the starting point on the map"
            aria-label="Find the starting point on the map"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
              <circle cx="12" cy="9" r="2" fill="currentColor" stroke="none" />
            </svg>
            Find pin
          </button>
        </div>
      )}

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

      {/* Scene description — centered in the opening-frame variant */}
      {eq.sceneDescription && (
        <p className={`text-[21px] leading-relaxed font-serif text-text-primary ${openingVariant ? 'text-center' : ''}`}>
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
