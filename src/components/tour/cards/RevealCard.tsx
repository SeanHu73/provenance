'use client';

import { useState } from 'react';
import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import FullscreenPhoto from './FullscreenPhoto';
import AudioButton from './AudioButton';
import BackButton from './BackButton';

interface Props {
  stop: Stop;
  onContinue: () => void;
}

export default function RevealCard({ stop, onContinue }: Props) {
  const hasAudio = !!stop.reveal.audioUrl;
  const [textExpanded, setTextExpanded] = useState(!hasAudio);
  const [fullscreen, setFullscreen] = useState<{ url: string; caption: string | null } | null>(null);

  // Collect all photos (legacy + array)
  const allPhotos = [
    ...(stop.reveal.photoUrl ? [{ url: stop.reveal.photoUrl, caption: stop.reveal.photoCaption ?? null }] : []),
    ...(stop.reveal.photos || []),
  ].filter((p) => p.url);

  return (
    <div className="animate-fade-in space-y-4 min-h-full flex flex-col justify-center">
      {/* Title */}
      <p className="text-2xl uppercase tracking-[0.14em] text-aged-gold font-semibold">
        Context
      </p>

      {/* Audio player */}
      {hasAudio && <AudioButton audioUrl={stop.reveal.audioUrl!} title={stop.reveal.audioTitle} />}

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

          {/* Photos always visible below */}
          {allPhotos.length > 0 && (
            <div className="space-y-3">
              {allPhotos.map((photo, i) => (
                <button
                  key={i}
                  onClick={() => setFullscreen(photo)}
                  className="w-full rounded-lg overflow-hidden shadow-md border border-sandstone-light text-left cursor-pointer bg-sandstone"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt={photo.caption || ''} className="w-full max-h-72 object-contain" />
                  {photo.caption && <p className="text-xs text-text-secondary px-3 py-1.5 bg-sandstone/50 italic">{photo.caption}</p>}
                </button>
              ))}
            </div>
          )}
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
          Continue
        </button>
      </div>

      {fullscreen && (
        <FullscreenPhoto url={fullscreen.url} caption={fullscreen.caption} onClose={() => setFullscreen(null)} />
      )}
    </div>
  );
}
