'use client';

import { useState, useEffect, useRef } from 'react';
import { Tour, TourSession, Stop } from '@/lib/types';
import { getLogicalStops, getStopsInGroup, getActiveGroupId, getNextStopInGroup } from '@/lib/tour-session';
import { getActiveStops } from '@/lib/tours-store';
import { useTour } from '@/context/TourContext';
import MicButton from '../MicButton';
import FormattedText from './FormattedText';
import AudioButton from './AudioButton';
import QuestionText from './QuestionText';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

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

        {/* First-time cue — shown above the map when the group has not
            yet entered any stop AND no pin is currently selected. Clears
            as soon as they tap a pin. */}
        {view === 'map' && !selectedStop && session.completedStops.length === 0 && (
          <div className="pointer-events-none absolute top-6 left-1/2 -translate-x-1/2 z-20 animate-bounce">
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg"
              style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
                <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
              </svg>
              <span className="text-sm font-semibold">Tap a pin to begin</span>
            </div>
          </div>
        )}
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
  const LOCKED_RED = '#B91C1C';
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
              filter: 'grayscale(0.85) brightness(0.7)',
              ...(thumbPhoto.thumbnailFocalPoint
                ? { objectPosition: `${thumbPhoto.thumbnailFocalPoint.x}% ${thumbPhoto.thumbnailFocalPoint.y}%` }
                : {}),
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
              style={{ backgroundColor: 'rgba(0,0,0,0.7)', border: '3px solid #fff' }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
          <p
            className="text-base font-semibold mt-2"
            style={{ color: LOCKED_RED }}
          >
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
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
            style={{
              backgroundColor: 'var(--th-surface)',
              border: '2px solid var(--th-primary)',
              color: 'var(--th-primary)',
            }}
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
  // Unused now that the headline is the group name; keep the prop wired
  // for parity with handleBeginCluster.
  void firstUncompleted;
  return (
    <div
      className="rounded-2xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--th-surface)' }}
    >
      {/* Cluster banner — small "STOP CLUSTER" label, then the group's
          own title (carousel cards below show each sub-stop's name). */}
      <div
        className="px-4 pt-3 pb-2.5"
        style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-85">
          Stop cluster
        </p>
        <p className="text-xl font-semibold leading-tight mt-1">{groupName}</p>
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

// ─── Mid Point Check-In Card ─────────────────────────────────────

export function MidwayCheckinCard({
  tour,
  session,
  onComplete,
}: {
  tour: Tour;
  session: TourSession;
  onComplete: (response: string) => void;
}) {
  const [response, setResponse] = useState('');
  const [autoplayPref] = useAudioAutoplay();
  const activeStops = getActiveStops(tour);
  const background = (tour.midwayQuestionBackground || '').trim();
  const hasBackground = background.length > 0;
  const bgAutoplay = autoplayPref && !tour.midwayQuestionBackgroundAudioAutoplayDisabled;
  // completionOrder holds logical-stop IDs (one per cluster). Expand
  // cluster entries into every sub-stop in authored order so the
  // explorer sees each stop they visited individually.
  const visitedStops: Stop[] = [];
  for (const id of session.completionOrder || []) {
    const stop = activeStops.find((s) => s.id === id);
    if (!stop) continue;
    if (stop.mergeGroup) {
      visitedStops.push(...getStopsInGroup(tour, stop.mergeGroup));
    } else {
      visitedStops.push(stop);
    }
  }

  // Reveal state for the question section — fires haptic + fade in
  // when the section first scrolls into view after the explorer has
  // reviewed the stops they've visited.
  const questionRef = useRef<HTMLElement | null>(null);
  const [questionRevealed, setQuestionRevealed] = useState(false);

  useEffect(() => {
    if (questionRevealed) return;
    const el = questionRef.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(10);
            }
            timeoutId = setTimeout(() => setQuestionRevealed(true), 100);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [questionRevealed]);

  // Same approach as SeedCard's snap layout: absolutely-positioned
  // scroll container sized to the parent frame so each `h-full` section
  // is exactly the visible area, no overshoot.
  return (
    <div
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {/* See SeedCard for the rationale on min-h-full + side padding:
          short content stays centred, long content grows the section so
          the top stays in view after a snap. */}
      {/* Section 1 — header + visited stops summary */}
      <section
        className="min-h-full flex flex-col justify-center space-y-6 px-5 py-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div>
          <p className="text-[22px] uppercase tracking-[0.12em] font-display font-semibold text-aged-gold mb-1">
            Mid point check-in
          </p>
          <p className="text-[18px] font-serif text-text-primary leading-relaxed">
            So these are the stops you have seen so far...
          </p>
        </div>

        {visitedStops.length > 0 && (
          <div className="space-y-2">
            {visitedStops.map((stop, idx) => (
              <VisitedStopThumb key={stop.id} stop={stop} visitNumber={idx + 1} />
            ))}
          </div>
        )}
      </section>

      {/* Optional background section — inserted between the visited
          stops summary and the question when the admin authored one. */}
      {hasBackground && (
        <section
          className="min-h-full flex flex-col justify-center space-y-5 px-5 py-6"
          style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
          {tour.midwayQuestionBackgroundAudioUrl && (
            <AudioButton
              audioUrl={tour.midwayQuestionBackgroundAudioUrl}
              title={tour.midwayQuestionBackgroundAudioTitle}
              autoplay={bgAutoplay}
            />
          )}
          <p className="text-[19px] leading-relaxed font-serif text-text-primary text-left">
            <FormattedText text={background} />
          </p>
        </section>
      )}

      {/* Question section — left-aligned, themed, no red overlay box */}
      <section
        ref={questionRef}
        className="min-h-full flex flex-col justify-center space-y-6 px-5 py-6"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          opacity: questionRevealed ? 1 : 0,
          transform: questionRevealed ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 250ms ease-out, transform 250ms ease-out',
        }}
      >
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
          Discuss
        </p>
        <QuestionText text={tour.midwayQuestion || ''} sizeClass="text-[26px]" />

        <div className="flex gap-2 items-start">
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Discuss this, but optional to write down"
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
          Continue tour
        </button>
      </section>
    </div>
  );
}

function VisitedStopThumb({ stop, visitNumber }: { stop: Stop; visitNumber: number }) {
  const thumb = pickStopThumb(stop);
  const displayTitle = stop.title || `Stop ${visitNumber}`;
  const groupLabel = stop.mergeGroup || null;
  return (
    <div
      className="flex gap-3 p-3 rounded-xl border"
      style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface)' }}
    >
      {thumb ? (
        <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-sandstone">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb.url}
            alt=""
            className="w-full h-full object-cover"
            style={
              thumb.thumbnailFocalPoint
                ? { objectPosition: `${thumb.thumbnailFocalPoint.x}% ${thumb.thumbnailFocalPoint.y}%` }
                : undefined
            }
          />
        </div>
      ) : (
        <div
          className="w-20 h-20 rounded-lg shrink-0 flex items-center justify-center"
          style={{ backgroundColor: 'var(--th-surface-alt)' }}
        >
          <span className="text-lg font-semibold" style={{ color: 'var(--th-text-secondary)' }}>
            {visitNumber}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--th-text-secondary)' }}>
          Stop {visitNumber}
        </p>
        <p className="text-base font-semibold leading-snug" style={{ color: 'var(--th-text-primary)' }}>
          {displayTitle}
        </p>
        {groupLabel && (
          <p className="text-xs italic mt-0.5" style={{ color: 'var(--th-text-secondary)' }}>
            {groupLabel}
          </p>
        )}
        {stop.category && (
          <p className="text-xs uppercase tracking-wide mt-0.5" style={{ color: 'var(--th-text-secondary)' }}>
            {stop.category}
          </p>
        )}
      </div>
    </div>
  );
}
