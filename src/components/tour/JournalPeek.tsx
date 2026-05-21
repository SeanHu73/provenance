'use client';

/**
 * Bottom sheet that appears when a tour stop pin is tapped.
 * Shows the tour overview — journal cover inviting the group to begin.
 */

import { Tour } from '@/lib/types';

interface Props {
  tour: Tour;
  onBegin: () => void;
  onDismiss: () => void;
}

export default function JournalPeek({ tour, onBegin, onDismiss }: Props) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onDismiss} />

      {/* Sheet */}
      <div className="relative animate-slide-up rounded-t-2xl overflow-hidden" style={{ backgroundColor: 'var(--th-journal)' }}>
        {/* Cover photo */}
        {tour.coverPhotoUrl && (
          <div className="w-full h-36 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tour.coverPhotoUrl}
              alt=""
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-transparent to-journal" />
          </div>
        )}

        <div className="px-6 pb-8 pt-4 space-y-4">
          {/* Guide avatar + info */}
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
            >
              {tour.guide.initials || '?'}
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
            <h2 className="text-xl font-serif font-bold" style={{ color: 'var(--th-surface)' }}>
              {tour.title}
            </h2>
            {tour.subtitle && (
              <p className="text-sm mt-0.5" style={{ color: 'var(--th-border)' }}>{tour.subtitle}</p>
            )}
          </div>

          {tour.description && (
            <p className="text-sm leading-relaxed" style={{ color: 'var(--th-border)' }}>
              {tour.description}
            </p>
          )}

          <p className="text-xs" style={{ color: 'var(--th-border)' }}>
            {tour.stops.length} stop{tour.stops.length !== 1 ? 's' : ''} &middot; ~{tour.stops.length * 5} min
          </p>

          {/* Audio */}
          {tour.peekAudioUrl && (
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(255,248,238,0.15)' }}>
              {tour.peekAudioTitle && (
                <p className="text-xs font-semibold px-3 pt-2" style={{ color: 'var(--th-surface)' }}>{tour.peekAudioTitle}</p>
              )}
              <audio controls src={tour.peekAudioUrl} className="w-full h-8" style={{ filter: 'invert(1) hue-rotate(180deg)', opacity: 0.7 }} />
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
