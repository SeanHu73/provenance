'use client';

import { useState } from 'react';
import { Tour, TourSession, Stop } from '@/lib/types';
import { getLogicalStops } from '@/lib/tour-session';
import { useTour } from '@/context/TourContext';
import MicButton from '../MicButton';

interface Props {
  tour: Tour;
  session: TourSession;
}

// Transparent controls overlay rendered absolutely within the map container.
// Title bar and progress strip are rendered by the parent (HomeInner) in document flow.
export default function UnstructuredMapControls({ tour, session }: Props) {
  const { selectedUnstructuredStopId, setSelectedUnstructuredStopId, enterUnstructuredStop } = useTour();
  const [view, setView] = useState<'map' | 'gallery'>('map');

  const selectedStop = selectedUnstructuredStopId
    ? tour.stops.find((s) => s.id === selectedUnstructuredStopId) ?? null
    : null;
  const selectedStopIndex = selectedStop
    ? tour.stops.findIndex((s) => s.id === selectedUnstructuredStopId)
    : -1;

  const completedIds = new Set(session.completedStops);

  const handleBeginStop = () => {
    if (selectedStopIndex >= 0) {
      enterUnstructuredStop(selectedStopIndex);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
      {/* Transparent middle — map shows through */}
      <div
        className="flex-1 relative"
        onClick={(e) => {
          if (selectedUnstructuredStopId) {
            e.stopPropagation();
            setSelectedUnstructuredStopId(null);
          }
        }}
      >
        {/* Gallery view — slides over the map */}
        {view === 'gallery' && (
          <div
            className="pointer-events-auto absolute inset-0 overflow-y-auto"
            style={{ backgroundColor: 'var(--th-surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <GalleryView
              tour={tour}
              completedIds={completedIds}
              onSelectStop={(stopId) => { setSelectedUnstructuredStopId(stopId); setView('map'); }}
            />
          </div>
        )}

        {/* Stop overlay card — anchored to bottom, above toggle */}
        {view === 'map' && selectedStop && (
          <div
            className="pointer-events-auto absolute bottom-16 left-3 right-3 z-10 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <StopOverlayCard
              stop={selectedStop}
              isCompleted={completedIds.has(selectedStop.id)}
              onBegin={handleBeginStop}
              onDismiss={() => setSelectedUnstructuredStopId(null)}
            />
          </div>
        )}

        {/* Map / Gallery toggle — centered at bottom */}
        <div
          className="pointer-events-auto absolute bottom-3 left-1/2 -translate-x-1/2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <MapGalleryToggle view={view} onChange={setView} />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function StopOverlayCard({
  stop,
  isCompleted,
  onBegin,
  onDismiss,
}: {
  stop: Stop;
  isCompleted: boolean;
  onBegin: () => void;
  onDismiss: () => void;
}) {
  const thumbPhoto =
    (stop.notice.photos || []).find(p => p.url) ||
    (stop.notice.photoUrl ? { url: stop.notice.photoUrl, caption: stop.notice.photoCaption } : null) ||
    (stop.seed.photos || []).find(p => p.url) ||
    (stop.seed.photoUrl ? { url: stop.seed.photoUrl, caption: stop.seed.photoCaption } : null) ||
    null;
  const seedPreview = stop.seed.text
    ? stop.seed.text.replace(/\[photo:\d+\]/g, '').trim().slice(0, 100)
    : null;
  const displayTitle = stop.mergeGroup || stop.title;

  return (
    <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--th-surface)' }}>
      {thumbPhoto && (
        <div className="h-28 bg-sandstone">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbPhoto.url}
            alt=""
            className="w-full h-full object-cover"
            style={thumbPhoto.thumbnailFocalPoint
              ? { objectPosition: `${thumbPhoto.thumbnailFocalPoint.x}% ${thumbPhoto.thumbnailFocalPoint.y}%` }
              : undefined}
          />
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          <p className="text-base font-semibold text-text-primary leading-snug">{displayTitle}</p>
          {stop.category && (
            <p className="text-xs text-text-secondary mt-0.5 uppercase tracking-wide">{stop.category}</p>
          )}
        </div>
        {seedPreview && (
          <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">{seedPreview}</p>
        )}
        {isCompleted ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium" style={{ color: 'var(--th-olive)' }}>Explored</span>
            <button
              onClick={onDismiss}
              className="ml-auto text-sm text-text-secondary px-3 py-2 rounded-lg border"
              style={{ borderColor: 'var(--th-border)' }}
            >
              Dismiss
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onDismiss}
              className="px-4 py-2.5 rounded-lg text-sm text-text-secondary border"
              style={{ borderColor: 'var(--th-border)' }}
            >
              Not now
            </button>
            <button
              onClick={onBegin}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-aged-gold"
            >
              Begin this stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MapGalleryToggle({ view, onChange }: { view: 'map' | 'gallery'; onChange: (v: 'map' | 'gallery') => void }) {
  return (
    <div
      className="flex rounded-full shadow-lg overflow-hidden"
      style={{ backgroundColor: 'var(--th-surface)', border: '1.5px solid var(--th-border)' }}
    >
      <button
        onClick={() => onChange('map')}
        className="px-5 py-2 text-sm font-semibold transition-colors"
        style={{
          backgroundColor: view === 'map' ? 'var(--th-primary)' : 'transparent',
          color: view === 'map' ? 'var(--th-surface)' : 'var(--th-text-secondary)',
        }}
      >
        Map
      </button>
      <button
        onClick={() => onChange('gallery')}
        className="px-5 py-2 text-sm font-semibold transition-colors"
        style={{
          backgroundColor: view === 'gallery' ? 'var(--th-primary)' : 'transparent',
          color: view === 'gallery' ? 'var(--th-surface)' : 'var(--th-text-secondary)',
        }}
      >
        Gallery
      </button>
    </div>
  );
}

function GalleryView({
  tour,
  completedIds,
  onSelectStop,
}: {
  tour: Tour;
  completedIds: Set<string>;
  onSelectStop: (stopId: string) => void;
}) {
  const categories = tour.categories || [];
  const logicalStopIds = new Set(getLogicalStops(tour).map((s) => s.id));
  const stopsByCategory: Record<string, Stop[]> = {};
  const uncategorized: Stop[] = [];

  for (const stop of tour.stops) {
    if (!logicalStopIds.has(stop.id)) continue; // skip merge-group secondaries
    const cat = stop.category;
    if (cat && categories.includes(cat)) {
      if (!stopsByCategory[cat]) stopsByCategory[cat] = [];
      stopsByCategory[cat].push(stop);
    } else {
      uncategorized.push(stop);
    }
  }

  return (
    <div className="p-4 pb-20 space-y-6">
      <div className="pt-2">
        <p className="text-base font-semibold text-text-primary">Choose a stop to explore</p>
        <p className="text-xs text-text-secondary mt-0.5">Tap any stop — you can explore them in any order.</p>
      </div>

      {categories.map((cat) => {
        const stops = stopsByCategory[cat] || [];
        if (stops.length === 0) return null;
        return (
          <div key={cat}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-3">{cat}</p>
            <div className="space-y-2">
              {stops.map((stop) => (
                <GalleryCard
                  key={stop.id}
                  stop={stop}
                  isCompleted={completedIds.has(stop.id)}
                  onSelect={() => onSelectStop(stop.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {uncategorized.length > 0 && (
        <div>
          {categories.length > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-3">Other</p>
          )}
          <div className="space-y-2">
            {uncategorized.map((stop) => (
              <GalleryCard
                key={stop.id}
                stop={stop}
                isCompleted={completedIds.has(stop.id)}
                onSelect={() => onSelectStop(stop.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GalleryCard({
  stop,
  isCompleted,
  onSelect,
}: {
  stop: Stop;
  isCompleted: boolean;
  onSelect: () => void;
}) {
  const thumbPhoto =
    (stop.notice.photos || []).find(p => p.url) ||
    (stop.notice.photoUrl ? { url: stop.notice.photoUrl, caption: stop.notice.photoCaption } : null) ||
    (stop.seed.photos || []).find(p => p.url) ||
    (stop.seed.photoUrl ? { url: stop.seed.photoUrl, caption: stop.seed.photoCaption } : null) ||
    null;
  const displayTitle = stop.mergeGroup || stop.title;

  return (
    <button
      onClick={onSelect}
      className={`w-full flex gap-3 p-3 rounded-xl border text-left transition-all ${isCompleted ? 'opacity-50' : ''}`}
      style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface)' }}
    >
      {thumbPhoto ? (
        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbPhoto.url}
            alt=""
            className="w-full h-full object-cover"
            style={thumbPhoto.thumbnailFocalPoint
              ? { objectPosition: `${thumbPhoto.thumbnailFocalPoint.x}% ${thumbPhoto.thumbnailFocalPoint.y}%` }
              : undefined}
          />
        </div>
      ) : (
        <div
          className="w-16 h-16 rounded-lg shrink-0 flex items-center justify-center"
          style={{ backgroundColor: 'var(--th-surface-alt)' }}
        >
          {isCompleted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--th-olive)' }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--th-primary)', opacity: 0.4 }} />
          )}
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-sm font-semibold truncate" style={{ color: isCompleted ? 'var(--th-text-secondary)' : 'var(--th-text-primary)' }}>
          {displayTitle}
        </p>
        {stop.category && (
          <p className="text-[10px] text-text-secondary uppercase tracking-wide mt-0.5">{stop.category}</p>
        )}
        {isCompleted && (
          <p className="text-xs mt-1" style={{ color: 'var(--th-olive)' }}>Explored</p>
        )}
      </div>
    </button>
  );
}

// ─── Midway Check-In Card ────────────────────────────────────────

export function MidwayCheckinCard({ tour, onComplete }: { tour: Tour; onComplete: (response: string) => void }) {
  const [response, setResponse] = useState('');

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      <div>
        <p className="text-[22px] uppercase tracking-[0.12em] font-display font-semibold text-aged-gold mb-3">
          Halfway there
        </p>
        <p className="text-[24px] leading-snug font-display font-bold text-text-primary">
          {tour.midwayQuestion}
        </p>
      </div>

      <div className="flex gap-2 items-start">
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Your thoughts so far..."
          rows={4}
          className="flex-1 px-4 py-3 rounded-lg text-base font-serif text-text-primary resize-none focus:outline-none"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--th-surface-alt) 60%, transparent)',
            border: '1px solid var(--th-border)',
          }}
        />
        <MicButton onTranscript={(t) => setResponse((r) => r + (r ? ' ' : '') + t)} />
      </div>

      <button
        onClick={() => onComplete(response)}
        className="w-full py-3 rounded-lg text-base font-semibold text-white bg-aged-gold"
      >
        Continue exploring
      </button>
    </div>
  );
}
