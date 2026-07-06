'use client';

/**
 * Shared component that renders text interleaved with photos using
 * [photo:N] markers. Used by SeedCard, NoticeCard, and RevealCard.
 * Text is rendered with FormattedText to support **bold**, *italic*,
 * and {{#color}}colored{{/}} text.
 *
 * Tapping any photo opens it fullscreen.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import FormattedText from './FormattedText';
import FullscreenPhoto from './FullscreenPhoto';
import PhotoAnnotations from './PhotoAnnotations';
import type { PhotoOverlay } from '@/lib/types';

export interface Photo {
  url: string;
  caption: string | null;
  displayMode?: 'cover' | 'contain';
  focalPoint?: { x: number; y: number };
  zoom?: number;
  overlays?: PhotoOverlay[];
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
  /** When set, the photo with this URL gets the audio-cue glow. */
  highlightedUrl?: string | null;
}

export default function PhotoContent({
  text,
  photos,
  legacyPhotoUrl,
  legacyPhotoCaption,
  textClass = 'text-[21px] leading-relaxed font-serif text-text-primary',
  borderColor,
  highlightedUrl,
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
          {allPhotos.length > 1 ? (
            <PhotoCarousel photos={allPhotos} highlightedUrl={highlightedUrl} onTapPhoto={setFullscreen} />
          ) : (
            allPhotos.map((photo, i) => (
              <PhotoBlock key={i} photo={photo} onTap={() => setFullscreen(photo)} highlighted={!!highlightedUrl && photo.url === highlightedUrl} />
            ))
          )}
        </div>
        {fullscreen && (
          <FullscreenPhoto url={fullscreen.url} caption={fullscreen.caption} overlays={fullscreen.overlays} onClose={() => setFullscreen(null)} />
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
              return <PhotoBlock key={`p-${i}`} photo={allPhotos[idx]} onTap={() => setFullscreen(allPhotos[idx])} highlighted={!!highlightedUrl && allPhotos[idx].url === highlightedUrl} />;
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

        {/* Remaining photos not placed by markers — a carousel when several. */}
        {(() => {
          const remaining = allPhotos.filter((_, i) => !usedIndices.has(i));
          if (remaining.length > 1) {
            return <PhotoCarousel photos={remaining} highlightedUrl={highlightedUrl} onTapPhoto={setFullscreen} />;
          }
          return remaining.map((photo) => (
            <PhotoBlock key={`r-${photo.url}`} photo={photo} onTap={() => setFullscreen(photo)} highlighted={!!highlightedUrl && photo.url === highlightedUrl} />
          ));
        })()}
      </div>
      {fullscreen && (
        <FullscreenPhoto url={fullscreen.url} caption={fullscreen.caption} overlays={fullscreen.overlays} onClose={() => setFullscreen(null)} />
      )}
    </>
  );
}

/**
 * A horizontal, swipeable photo gallery used whenever a section has more than
 * one photo (replacing the old vertical stack). Slides snap-center and are a
 * touch narrower than the viewport so the neighbouring photos peek in on the
 * sides, signalling there's more to swipe to.
 *
 * When the audio cues a photo (`highlightedUrl`), the carousel auto-slides to
 * it — overriding wherever the learner had manually scrolled — and the cued
 * photo keeps its glow. The one-shot haptic that accompanies the change lives
 * in `usePhotoCues` (fires on every highlight change, carousel or not).
 */
export function PhotoCarousel({
  photos,
  highlightedUrl,
  onTapPhoto,
}: {
  photos: Photo[];
  highlightedUrl?: string | null;
  onTapPhoto: (photo: Photo) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [current, setCurrent] = useState(0);

  const scrollToIndex = useCallback((i: number, smooth = true) => {
    const container = scrollRef.current;
    const slide = slideRefs.current[i];
    if (!container || !slide) return;
    const left = slide.offsetLeft - (container.clientWidth - slide.clientWidth) / 2;
    container.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Audio cue → slide to the cued photo, even if the learner scrolled elsewhere.
  // Only act when the cue actually *changes* (tracked via a ref) — the audio
  // ticks time updates several times a second, so acting on every render would
  // continuously yank the carousel back and fight the learner's own swipes. The
  // resulting scroll fires onScroll, which keeps the dots (`current`) in sync.
  const prevHighlight = useRef<string | null>(null);
  useEffect(() => {
    if (highlightedUrl === prevHighlight.current) return;
    prevHighlight.current = highlightedUrl ?? null;
    if (!highlightedUrl) return;
    const idx = photos.findIndex((p) => p.url === highlightedUrl);
    if (idx < 0) return;
    scrollToIndex(idx);
  }, [highlightedUrl, photos, scrollToIndex]);

  // Keep the dots in sync with whatever slide is centred as the user swipes.
  const onScroll = () => {
    const container = scrollRef.current;
    if (!container) return;
    const center = container.scrollLeft + container.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    slideRefs.current.forEach((s, i) => {
      if (!s) return;
      const c = s.offsetLeft + s.clientWidth / 2;
      const d = Math.abs(c - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setCurrent(best);
  };

  return (
    <div className="my-3">
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-hide flex gap-3 overflow-x-auto snap-x snap-mandatory px-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {photos.map((photo, i) => (
          <div
            key={photo.url + i}
            ref={(el) => { slideRefs.current[i] = el; }}
            className="snap-center snap-always shrink-0 w-[85%]"
          >
            <PhotoBlock
              photo={photo}
              onTap={() => onTapPhoto(photo)}
              highlighted={!!highlightedUrl && photo.url === highlightedUrl}
            />
          </div>
        ))}
      </div>
      {/* Position dots — tappable, and the active one stretches into a pill. */}
      <div className="mt-1 flex justify-center gap-1.5">
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); scrollToIndex(i); }}
            aria-label={`Go to photo ${i + 1}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === current ? 18 : 6,
              backgroundColor: i === current ? 'var(--th-primary)' : 'var(--th-border)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PhotoBlock({ photo, onTap, highlighted = false }: { photo: Photo; onTap: () => void; highlighted?: boolean }) {
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
      className={`w-full rounded-lg shadow-md border border-sandstone-light my-3 text-left cursor-pointer ${isLetterbox ? 'bg-black' : 'bg-sandstone'} ${highlighted ? 'photo-glow' : ''}`}
      style={{ overflow: 'clip' }}
    >
      {isCover ? (
        <div className="relative w-full h-72" style={{ overflow: 'clip' }}>
          {/* Scale wrapper — keeps overflow:clip reliable when zooming */}
          <div
            style={{
              width: '100%', height: '100%',
              transform: zoom > 1 ? `scale(${zoom})` : undefined,
              transformOrigin: zoom > 1 ? transformOrigin : undefined,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={photo.caption || ''}
              className="w-full h-full object-cover"
              style={{ objectPosition }}
            />
          </div>
          <PhotoAnnotations overlays={photo.overlays} />
        </div>
      ) : (
        <div className="relative w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.caption || ''}
            className="w-full max-h-72 object-contain"
          />
          <PhotoAnnotations overlays={photo.overlays} />
        </div>
      )}
      {photo.caption && (
        <p className={`text-xs px-3 py-1.5 italic ${isLetterbox ? 'text-white/70 bg-black/50' : 'text-text-secondary bg-sandstone/50'}`}>
          {photo.caption}
        </p>
      )}
    </button>
  );
}
