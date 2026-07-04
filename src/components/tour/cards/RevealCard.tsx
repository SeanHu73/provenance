'use client';

import { useState } from 'react';
import { Stop } from '@/lib/types';
import { usePhotoCues } from '../usePhotoCues';
import PhotoContent, { PhotoCarousel } from './PhotoContent';
import FullscreenPhoto from './FullscreenPhoto';
import AudioButton from './AudioButton';
import SpeechBar from './SpeechBar';
import BackButton from './BackButton';
import InquiryReminder from './InquiryReminder';
import ActionTitle from './ActionTitle';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useReadMode } from '@/lib/read-mode';
import { useTour } from '@/context/TourContext';
import { getTourMode } from '@/lib/tours-store';

/** Order photos by where their [photo:N] markers first appear in `text`
 *  (1-based). Photos not referenced in the text are appended in array order. */
function orderPhotosByText<T>(text: string, photos: T[]): T[] {
  const ordered: T[] = [];
  const seen = new Set<number>();
  const re = /\[photo:(\d+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const idx = parseInt(m[1], 10) - 1;
    if (idx >= 0 && idx < photos.length && !seen.has(idx)) {
      seen.add(idx);
      ordered.push(photos[idx]);
    }
  }
  photos.forEach((p, i) => { if (!seen.has(i)) ordered.push(p); });
  return ordered;
}

interface Props {
  stop: Stop;
  onContinue: () => void;
  /** True when this reveal is the final in-stop screen (no bridge → no whats_next). */
  isFinalInStop?: boolean;
}

export default function RevealCard({ stop, onContinue, isFinalInStop = false }: Props) {
  const hasAudio = !!stop.reveal.audioUrl;
  const [autoplayPref] = useAudioAutoplay();
  const [readMode] = useReadMode();
  // A voiceover audio IS the narration → no auto TTS. Otherwise we read the Stop
  // Info text. The narration (voiceover audio OR the TTS) takes autoplay
  // priority; a non-voiceover clip never autoplays alongside the TTS.
  const isVoiceover = hasAudio && stop.reveal.audioIsVoiceover === true;
  const showTts = !isVoiceover && !!stop.reveal.text.trim();
  const shouldAutoplay = autoplayPref && !stop.reveal.audioAutoplayDisabled && !showTts;
  const ttsAutoplay = autoplayPref && showTts;
  // Expanded by default when there's no narration audio, or when "Read" was chosen.
  const [textExpanded, setTextExpanded] = useState(!hasAudio || readMode);
  const [fullscreen, setFullscreen] = useState<{ url: string; caption: string | null } | null>(null);

  // Audio-synced photo highlight (the cued photo glows until the next cue).
  const { onTimeUpdate, onEnded, highlightedUrl } = usePhotoCues(stop.reveal.photoCues, stop.reveal.photos || [], stop.reveal.photoCuesHoldLast);
  // Every third stop (3, 6, 9, …) flash a one-shot reminder over the
  // Context screen that the "? Inquiries" footer button is there for
  // questions. Counts by completedStops length + the stop we're
  // currently sitting in.
  const { session, tour } = useTour();
  const stopNumber = (session?.completedStops.length ?? 0) + 1;
  // Context-Prototype has no Inquiries feature, so never flash the reminder.
  const showInquiryReminder = !!tour && getTourMode(tour) !== 'context' && stopNumber > 0 && stopNumber % 3 === 0;

  // Collect all photos (legacy + array)
  const allPhotos = [
    ...(stop.reveal.photoUrl ? [{ url: stop.reveal.photoUrl, caption: stop.reveal.photoCaption ?? null }] : []),
    ...(stop.reveal.photos || []),
  ].filter((p) => p.url);

  return (
    <div className="animate-fade-in space-y-4 min-h-full flex flex-col justify-center">
      {/* Title */}
      <div>
        <ActionTitle action="DISCOVER" />
        {stop.title && <p className="mt-1 font-serif italic text-text-secondary text-[22px] leading-snug">{stop.title}</p>}
      </div>

      {/* Audio player */}
      {hasAudio && <AudioButton audioUrl={stop.reveal.audioUrl!} title={stop.reveal.audioTitle} autoplay={shouldAutoplay} onTimeUpdate={onTimeUpdate} onEnded={onEnded} />}
      {/* Auto text-to-speech of the Stop Info when there's no uploaded voiceover. */}
      {showTts && <SpeechBar text={stop.reveal.text} title={stop.reveal.audioTitle || 'Stop Info'} autoplay={ttsAutoplay} />}

      {/* When text is hidden: "tap to read along" then photos */}
      {hasAudio && !textExpanded && (
        <>
          <button
            onClick={() => setTextExpanded(true)}
            className="w-full py-2 rounded-lg text-base text-aged-gold border-2 border-aged-gold/40 bg-aged-gold/5 flex items-center justify-center gap-2"
          >
            <span className="text-sm">▶</span>
            Tap to read along
          </button>

          {/* Photos always visible below — ordered to match where their
              [photo:N] markers appear in the (collapsed) context text. A
              swipeable carousel when there are several, a single block otherwise. */}
          {allPhotos.length > 1 ? (
            <PhotoCarousel
              photos={orderPhotosByText(stop.reveal.text, allPhotos)}
              highlightedUrl={highlightedUrl}
              onTapPhoto={setFullscreen}
            />
          ) : allPhotos.length === 1 ? (
            <button
              onClick={() => setFullscreen(allPhotos[0])}
              className={`w-full rounded-lg overflow-hidden shadow-md border border-sandstone-light text-left cursor-pointer bg-sandstone ${highlightedUrl && allPhotos[0].url === highlightedUrl ? 'photo-glow' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={allPhotos[0].url} alt={allPhotos[0].caption || ''} className="w-full max-h-72 object-contain" />
              {allPhotos[0].caption && <p className="text-xs text-text-secondary px-3 py-1.5 bg-sandstone/50 italic">{allPhotos[0].caption}</p>}
            </button>
          ) : null}
        </>
      )}

      {/* When text is shown: full interleaved content */}
      {textExpanded && (
        <div className={hasAudio ? 'animate-fade-in' : 'animate-blur-reveal'}>
          {hasAudio && (
            <button
              onClick={() => setTextExpanded(false)}
              className="text-sm text-text-secondary/60 mb-3 flex items-center gap-1"
            >
              <span className="text-xs">▼</span>
              Hide text
            </button>
          )}
          <PhotoContent
            text={stop.reveal.text}
            photos={stop.reveal.photos || []}
            legacyPhotoUrl={stop.reveal.photoUrl}
            legacyPhotoCaption={stop.reveal.photoCaption}
            borderColor="var(--th-primary)"
            highlightedUrl={highlightedUrl}
          />
        </div>
      )}

      {/* Continue + Back */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white transition-colors"
        >
          {isFinalInStop ? 'Continue Tour' : 'Continue'}
        </button>
      </div>

      {fullscreen && (
        <FullscreenPhoto url={fullscreen.url} caption={fullscreen.caption} onClose={() => setFullscreen(null)} />
      )}

      {showInquiryReminder && <InquiryReminder />}
    </div>
  );
}
