'use client';

/**
 * Shared component that renders text interleaved with photos using
 * [photo:N] markers. Used by SeedCard, NoticeCard, and RevealCard.
 * Text is rendered with FormattedText to support **bold**, *italic*,
 * and {{#color}}colored{{/}} text.
 *
 * Tapping any photo opens it fullscreen.
 */

import { useState } from 'react';
import FormattedText from './FormattedText';
import FullscreenPhoto from './FullscreenPhoto';

interface Photo {
  url: string;
  caption: string | null;
  displayMode?: 'cover' | 'contain';
  focalPoint?: { x: number; y: number };
  zoom?: number;
}

interface Props {
  text: string;
  photos: Photo[];
  /** Legacy single photo — merged as photo 0 before the array */
  legacyPhotoUrl?: string | null;
  legacyPhotoCaption?: string | null;
  /** CSS class for text blocks */
  textClass?: string;
  /** Optional left border on text blocks */
  borderColor?: string;
}

export default function PhotoContent({
  text,
  photos,
  legacyPhotoUrl,
  legacyPhotoCaption,
  textClass = 'text-[21px] leading-relaxed font-serif text-text-primary',
  borderColor,
}: Props) {
  const [fullscreen, setFullscreen] = useState<Photo | null>(null);

  // Build full photo list: legacy + array
  const allPhotos: Photo[] = [
    ...(legacyPhotoUrl ? [{ url: legacyPhotoUrl, caption: legacyPhotoCaption ?? null }] : []),
    ...photos,
  ].filter((p) => p.url);

  // If no markers in text, render text then all photos
  if (!/\[photo:\d+\]/i.test(text)) {
    return (
      <>
        <div className="space-y-5">
          {text.trim() && (
            <div className={borderColor ? `border-l-4 pl-4` : ''} style={borderColor ? { borderColor } : undefined}>
              <FormattedText text={text} className={textClass} />
            </div>
          )}
          {allPhotos.map((photo, i) => (
            <PhotoBlock key={i} photo={photo} onTap={() => setFullscreen(photo)} />
          ))}
        </div>
        {fullscreen && (
          <FullscreenPhoto url={fullscreen.url} caption={fullscreen.caption} onClose={() => setFullscreen(null)} />
        )}
      </>
    );
  }

  // Split on [photo:N] markers
  const parts = text.split(/\[photo:(\d+)\]/gi);
  const usedIndices = new Set<number>();

  return (
    <>
      <div className="space-y-5">
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            const idx = parseInt(part, 10) - 1;
            if (idx >= 0 && idx < allPhotos.length) {
              usedIndices.add(idx);
              return <PhotoBlock key={`p-${i}`} photo={allPhotos[idx]} onTap={() => setFullscreen(allPhotos[idx])} />;
            }
            return null;
          }
          const trimmed = part.trim();
          if (!trimmed) return null;
          return (
            <div
              key={`t-${i}`}
              className={borderColor ? `border-l-4 pl-4` : ''}
              style={borderColor ? { borderColor } : undefined}
            >
              <FormattedText text={trimmed} className={textClass} />
            </div>
          );
        })}

        {/* Remaining photos not placed by markers */}
        {allPhotos.map((photo, i) => {
          if (usedIndices.has(i)) return null;
          return <PhotoBlock key={`r-${i}`} photo={photo} onTap={() => setFullscreen(photo)} />;
        })}
      </div>
      {fullscreen && (
        <FullscreenPhoto url={fullscreen.url} caption={fullscreen.caption} onClose={() => setFullscreen(null)} />
      )}
    </>
  );
}

function PhotoBlock({ photo, onTap }: { photo: Photo; onTap: () => void }) {
  const isCover = photo.displayMode === 'cover';
  const isLetterbox = photo.displayMode === 'contain';
  const objectPosition = isCover && photo.focalPoint
    ? `${photo.focalPoint.x}% ${photo.focalPoint.y}%`
    : '50% 50%';
  const zoom = isCover && photo.zoom && photo.zoom > 1 ? photo.zoom : 1;
  const transformOrigin = isCover && photo.focalPoint
    ? `${photo.focalPoint.x}% ${photo.focalPoint.y}%`
    : 'center';

  return (
    <button
      onClick={onTap}
      className={`w-full rounded-lg overflow-hidden shadow-md border border-sandstone-light my-3 text-left cursor-pointer ${isLetterbox ? 'bg-black' : 'bg-sandstone'}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || ''}
        className={`w-full ${isCover ? 'h-72 object-cover' : 'max-h-72 object-contain'}`}
        style={isCover ? {
          objectPosition,
          transform: zoom > 1 ? `scale(${zoom})` : undefined,
          transformOrigin: zoom > 1 ? transformOrigin : undefined,
        } : undefined}
      />
      {photo.caption && (
        <p className={`text-xs px-3 py-1.5 italic ${isLetterbox ? 'text-white/70 bg-black/50' : 'text-text-secondary bg-sandstone/50'}`}>
          {photo.caption}
        </p>
      )}
    </button>
  );
}
