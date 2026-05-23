'use client';

import { useState } from 'react';
import { Tour, TourSession, Stop } from '@/lib/types';
import { getLogicalStops, getStopsInGroup, getActiveGroupId, getNextStopInGroup } from '@/lib/tour-session';
import { getActiveStops } from '@/lib/tours-store';
import { useTour } from '@/context/TourContext';
import MicButton from '../MicButton';

interface Props {
  tour: Tour;
  session: TourSession;
  onStopSelectedFromGallery?: (stop: Stop) => void;
  /** Pans the map to the given stop's location (used by the locked-stop card). */
  onFlyToStop?: (stop: Stop) => void;
}

// Transparent controls overlay rendered absolutely within the map container.
// Title bar and progress strip are rendered by the parent (HomeInner) in document flow.
export default function UnstructuredMapControls({ tour, session, onStopSelectedFromGallery, onFlyToStop }: Props) {
  const { selectedUnstructuredStopId, setSelectedUnstructuredStopId, enterUnstructuredStop } = useTour();
  const [view, setView] = useState<'map' | 'gallery'>('map');

  const activeStops = getActiveStops(tour);
  const selectedStop = selectedUnstructuredStopId
    ? activeStops.find((s) => s.id === selectedUnstructuredStopId) ?? null
    : null;
  const selectedStopIndex = selectedStop
    ? activeStops.findIndex((s) => s.id === selectedUnstructuredStopId)
    : -1;

  const completedIds = new Set(session.completedStops);

  // When the selected stop is a group leader that hasn't been started,
  // show the cluster carousel instead of the single-stop card. After at
  // least one sub-stop is done, the leader pin is gone from the main map
  // and we're on the mini-map (showing single sub-stops) — so this case
  // doesn't recur.
  const selectedGroupId = selectedStop?.mergeGroup ?? null;
  const groupStops = selectedGroupId ? getStopsInGroup(tour, selectedGroupId) : null;
  const groupAnyStarted = groupStops
    ? groupStops.some((s) => completedIds.has(s.id))
    : false;
  const showCluster = !!groupStops && groupStops.length > 1 && !groupAnyStarted;

  // Mini-map state — if a group is mid-progress, identify the next-due
  // sub-stop. Lets us render LockedStopOverlayCard for tapped locked pins
  // and target the "Show me next stop" pan.
  const activeGroupId = getActiveGroupId(tour, session);
  const nextStopInGroup = activeGroupId ? getNextStopInGroup(tour, activeGroupId, session) : null;
  const isSelectedLocked = !!(
    selectedStop &&
    activeGroupId &&
    selectedStop.mergeGroup === activeGroupId &&
    !completedIds.has(selectedStop.id) &&
    selectedStop.id !== nextStopInGroup?.id
  );

  // First uncompleted stop of the selected group (for the cluster banner
  // and Begin handler).
  const firstUncompletedInGroup = groupStops?.find((s) => !completedIds.has(s.id)) ?? null;

  const handleBeginStop = () => {
    if (selectedStopIndex >= 0) {
      enterUnstructuredStop(selectedStopIndex);
    }
  };

  const handleBeginCluster = () => {
    if (!firstUncompletedInGroup) return;
    const idx = activeStops.indexOf(firstUncompletedInGroup);
    if (idx >= 0) enterUnstructuredStop(idx);
  };

  const handleShowNextStop = () => {
    if (!nextStopInGroup) return;
    setSelectedUnstructuredStopId(null);
    onFlyToStop?.(nextStopInGroup);
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
              onSelectStop={(stop) => {
                setSelectedUnstructuredStopId(stop.id);
                setView('map');
                onStopSelectedFromGallery?.(stop);
              }}
            />
          </div>
        )}

        {/* Stop overlay card — anchored to bottom, above toggle.
            Switches to a cluster carousel when the selected pin is a
            group leader of an un-started group. */}
        {view === 'map' && selectedStop && (
          <div
            className="pointer-events-auto absolute bottom-16 left-3 right-3 z-10 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {showCluster && groupStops ? (
              <GroupClusterOverlayCard
                groupName={selectedGroupId || selectedStop.title}
                stops={groupStops}
                completedIds={completedIds}
                firstUncompleted={firstUncompletedInGroup}
                onBegin={handleBeginCluster}
                onDismiss={() => setSelectedUnstructuredStopId(null)}
              />
            ) : isSelectedLocked ? (
              <LockedStopOverlayCard
                stop={selectedStop}
                onShowNext={handleShowNextStop}
                onDismiss={() => setSelectedUnstructuredStopId(null)}
              />
            ) : (
              <StopOverlayCard
                stop={selectedStop}
                isCompleted={completedIds.has(selectedStop.id)}
                onBegin={handleBeginStop}
                onDismiss={() => setSelectedUnstructuredStopId(null)}
              />
            )}
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
  const thumbPhoto = pickStopThumb(stop);
  const seedPreview = stop.seed.text
    ? stop.seed.text.replace(/\[photo:\d+\]/g, '').trim().slice(0, 100)
    : null;
  const displayTitle = stop.title || stop.mergeGroup || '';

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
          {stop.category && (
            <p className="text-xs font-bold tracking-wider uppercase mb-1" style={{ color: 'var(--th-text-secondary)' }}>
              {stop.category}
            </p>
          )}
          <p className="text-xl font-semibold text-text-primary leading-snug">{displayTitle}</p>
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

function LockedStopOverlayCard({
  stop,
  onShowNext,
  onDismiss,
}: {
  stop: Stop;
  onShowNext: () => void;
  onDismiss: () => void;
}) {
  const thumbPhoto = pickStopThumb(stop);
  const displayTitle = stop.title || '';
  return (
    <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--th-surface)' }}>
      {thumbPhoto && (
        <div className="h-28 bg-sandstone relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbPhoto.url}
            alt=""
            className="w-full h-full object-cover"
            style={{
              filter: 'grayscale(0.6)',
              ...(thumbPhoto.thumbnailFocalPoint
                ? { objectPosition: `${thumbPhoto.thumbnailFocalPoint.x}% ${thumbPhoto.thumbnailFocalPoint.y}%` }
                : {}),
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
          </div>
        </div>
      )}
      <div className="p-4 space-y-3">
        <div>
          {stop.category && (
            <p className="text-xs font-bold tracking-wider uppercase mb-1" style={{ color: 'var(--th-text-secondary)' }}>
              {stop.category}
            </p>
          )}
          <p className="text-xl font-semibold text-text-primary leading-snug">{displayTitle}</p>
          <p className="text-sm italic mt-1" style={{ color: 'var(--th-text-secondary)' }}>
            Please complete prior stops first
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-lg text-sm text-text-secondary border"
            style={{ borderColor: 'var(--th-border)' }}
          >
            Dismiss
          </button>
          <button
            onClick={onShowNext}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white bg-aged-gold"
          >
            Show me next stop
          </button>
        </div>
      </div>
    </div>
  );
}

function pickStopThumb(stop: Stop) {
  return (
    (stop.notice.photos || []).find((p) => p.url) ||
    (stop.notice.photoUrl
      ? { url: stop.notice.photoUrl, caption: stop.notice.photoCaption }
      : null) ||
    (stop.seed.photos || []).find((p) => p.url) ||
    (stop.seed.photoUrl
      ? { url: stop.seed.photoUrl, caption: stop.seed.photoCaption }
      : null) ||
    null
  );
}

function GroupClusterOverlayCard({
  groupName,
  stops,
  completedIds,
  firstUncompleted,
  onBegin,
  onDismiss,
}: {
  groupName: string;
  stops: Stop[];
  completedIds: Set<string>;
  firstUncompleted: Stop | null;
  onBegin: () => void;
  onDismiss: () => void;
}) {
  const total = stops.length;
  const headlineTitle = firstUncompleted?.title || groupName;
  return (
    <div
      className="rounded-2xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--th-surface)' }}
    >
      {/* Cluster banner — tiny "STOP CLUSTER · <group>" label, then the
          first uncompleted stop's name in big type so the explorer knows
          exactly what Begin will start. */}
      <div
        className="px-4 pt-3 pb-2.5"
        style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-85">
          Stop cluster · {groupName}
        </p>
        <p className="text-xl font-semibold leading-tight mt-1">{headlineTitle}</p>
        <p className="text-xs opacity-85 mt-1">{total} stops · go in order</p>
      </div>

      {/* Swipeable carousel — peek next card on right */}
      <div className="py-3" style={{ backgroundColor: 'var(--th-surface)' }}>
        <div
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory px-3 scrollbar-hide"
          style={{ scrollPadding: '12px' }}
        >
          {stops.map((s, i) => {
            const isDone = completedIds.has(s.id);
            const isFirstUncompleted =
              !isDone && stops.slice(0, i).every((p) => completedIds.has(p.id));
            const isLocked = !isDone && !isFirstUncompleted;
            return (
              <ClusterCarouselCard
                key={s.id}
                stop={s}
                index={i}
                total={total}
                isDone={isDone}
                isActive={isFirstUncompleted}
                isLocked={isLocked}
              />
            );
          })}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-3 pt-1 flex gap-2">
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
          Begin first stop
        </button>
      </div>
    </div>
  );
}

function ClusterCarouselCard({
  stop,
  index,
  total,
  isDone,
  isActive,
  isLocked,
}: {
  stop: Stop;
  index: number;
  total: number;
  isDone: boolean;
  isActive: boolean;
  isLocked: boolean;
}) {
  const thumb = pickStopThumb(stop);
  const displayTitle = stop.title || `Stop ${index + 1}`;
  return (
    <div
      className="snap-start shrink-0 rounded-xl overflow-hidden border"
      style={{
        width: '76%',
        borderColor: isActive ? 'var(--th-primary)' : 'var(--th-border)',
        borderWidth: isActive ? 2 : 1,
        backgroundColor: 'var(--th-surface)',
        opacity: isLocked ? 0.6 : 1,
      }}
    >
      <div className="relative h-24 bg-sandstone">
        {thumb && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumb.url}
            alt=""
            className="w-full h-full object-cover"
            style={
              thumb.thumbnailFocalPoint
                ? {
                    objectPosition: `${thumb.thumbnailFocalPoint.x}% ${thumb.thumbnailFocalPoint.y}%`,
                    filter: isLocked ? 'grayscale(0.6)' : undefined,
                  }
                : { filter: isLocked ? 'grayscale(0.6)' : undefined }
            }
          />
        )}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-md"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="11" width="16" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 space-y-1">
        <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: isActive ? 'var(--th-primary)' : 'var(--th-text-secondary)' }}>
          {index + 1} of {total}
          {isDone && ' · Explored'}
          {isActive && ' · Up next'}
          {isLocked && ' · Locked'}
        </p>
        <p
          className="text-base font-semibold leading-snug line-clamp-2"
          style={{ color: 'var(--th-text-primary)' }}
        >
          {displayTitle}
        </p>
        {stop.category && (
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--th-text-secondary)' }}>
            {stop.category}
          </p>
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
  onSelectStop: (stop: Stop) => void;
}) {
  const categories = tour.categories || [];
  const logicalStopIds = new Set(getLogicalStops(tour).map((s) => s.id));
  const stopsByCategory: Record<string, Stop[]> = {};
  const uncategorized: Stop[] = [];

  for (const stop of getActiveStops(tour)) {
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
                  onSelect={() => onSelectStop(stop)}
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
                onSelect={() => onSelectStop(stop)}
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
