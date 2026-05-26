'use client';

/**
 * Bottom sheet that appears when a tour stop pin is tapped.
 * Shows the tour overview — journal cover inviting the group to begin.
 */

import { Tour } from '@/lib/types';
import { guidePhotoStyle } from '@/lib/guide-photo';
import { getActiveStops } from '@/lib/tours-store';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  tour: Tour;
  onBegin: () => void;
  onDismiss: () => void;
}

export default function JournalPeek({ tour, onBegin, onDismiss }: Props) {
  const [autoplayPref] = useAudioAutoplay();
  const peekAutoplay = autoplayPref && !tour.peekAudioAutoplayDisabled;
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onDismiss} />

      {/* Sheet — capped at 3/4 of the viewport so the photo never gets
          pushed off-screen when the content area grows. The cover photo
          keeps its fixed height; only the text/audio/actions scroll. */}
      <div
        className="relative animate-slide-up rounded-t-2xl overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--th-journal)', maxHeight: '75vh' }}
      >
        {/* Cover photo */}
        {tour.coverPhotoUrl && (() => {
          const fp = tour.coverPhotoFocalPoint;
          const zoom = tour.coverPhotoZoom && tour.coverPhotoZoom > 1 ? tour.coverPhotoZoom : 1;
          const objPos = fp ? `${fp.x}% ${fp.y}%` : '50% 50%';
          return (
            <div className="shrink-0 w-full h-36 overflow-hidden relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tour.coverPhotoUrl}
                alt=""
                className="w-full h-full object-cover opacity-60"
                style={{
                  objectPosition: objPos,
                  transform: zoom > 1 ? `scale(${zoom})` : undefined,
                  transformOrigin: zoom > 1 ? objPos : undefined,
                }}
              />
              <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-transparent to-journal" />
            </div>
          );
        })()}

        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 pt-4 space-y-4">
          {/* Guide avatar + info */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold shrink-0"
              style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
            >
              {tour.guide.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tour.guide.photoUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  style={guidePhotoStyle(tour.guide)}
                />
              ) : (
                tour.guide.initials || '?'
              )}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--th-surface)' }}>
                {tour.guide.name || 'Your guide'}
              </p>
              {tour.guide.role && (
                <p className="text-xs" style={{ color: 'var(--th-border)' }}>{tour.guide.role}</p>
              )}
            </div>
          </div>

          {/* Tour info */}
          <div>
            <h2 className="text-[26px] leading-tight font-serif font-bold" style={{ color: 'var(--th-surface)' }}>
              {tour.title}
            </h2>
            {tour.subtitle && (
              <p className="text-base mt-1" style={{ color: 'var(--th-border)' }}>{tour.subtitle}</p>
            )}
          </div>

          {/* Stops + estimated time — surfaced near the title so groups
              know what they're committing to before they start. */}
          {(() => {
            const count = getActiveStops(tour).length;
            return (
              <div className="flex items-center gap-2" style={{ color: 'var(--th-surface)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-base font-semibold">
                  {count} stop{count !== 1 ? 's' : ''} · ~{count * 5} min
                </span>
              </div>
            );
          })()}

          {tour.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--th-border)' }}>
              {tour.description}
            </p>
          )}

          {/* Audio */}
          {tour.peekAudioUrl && (
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(255,248,238,0.15)' }}>
              {tour.peekAudioTitle && (
                <p className="text-xs font-semibold px-3 pt-2" style={{ color: 'var(--th-surface)' }}>{tour.peekAudioTitle}</p>
              )}
              <audio controls src={tour.peekAudioUrl} autoPlay={peekAutoplay} className="w-full h-8" style={{ filter: 'invert(1) hue-rotate(180deg)', opacity: 0.7 }} />
            </div>
          )}

          {/* Begin button */}
          <button
            onClick={onBegin}
            className="w-full py-3 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
          >
            Begin exploration
          </button>

          {/* Dismiss */}
          <button
            onClick={onDismiss}
            className="w-full text-center text-xs py-1"
            style={{ color: 'var(--th-border)' }}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
