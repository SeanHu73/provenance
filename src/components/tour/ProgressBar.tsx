'use client';

import { useRef, useEffect, useState } from 'react';
import { Tour, TourSession, Stop } from '@/lib/types';
import { getLogicalStops, getContextOrderedStops, hasOpeningFrameContent } from '@/lib/tour-session';
import { getActiveStops, getTourMode } from '@/lib/tours-store';
import { stopThumbnailPhoto } from '@/lib/stop-thumbnail';

interface Props {
  tour: Tour;
  session: TourSession;
}

export default function ProgressBar({ tour, session }: Props) {
  if (tour.unstructuredMode) {
    return <UnstructuredProgressBar tour={tour} session={session} />;
  }
  return <LinearProgressBar tour={tour} session={session} />;
}

// ─── Unstructured mode ───────────────────────────────────────────

function UnstructuredProgressBar({ tour, session }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const [trackerOpen, setTrackerOpen] = useState(false);

  const logicalStops = getLogicalStops(tour);
  const completionOrder: string[] = session.completionOrder || [];
  const completedSet = new Set(completionOrder);
  const totalCount = logicalStops.length;
  const completedCount = completionOrder.length;

  const isClosing = ['eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end'].includes(session.currentPhase);
  const isIntro = ['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional'].includes(session.currentPhase);
  const isInStopPhase = !isClosing && !isIntro && session.currentPhase !== 'unstructured_map' && session.currentPhase !== 'midway_checkin';

  let label = '';
  if (isIntro) label = 'Starting the tour…';
  else if (isClosing) label = 'Closing reflection';
  else if (session.currentPhase === 'midway_checkin') label = 'Midway check-in';
  else label = `${completedCount} of ${totalCount} explored`;

  // Current logical stop during a stop phase
  const currentLogicalStop = isInStopPhase && session.currentStopIndex >= 0
    ? (() => {
        const cur = getActiveStops(tour)[session.currentStopIndex];
        if (!cur) return null;
        return logicalStops.find(
          ls => ls.id === cur.id || (cur.mergeGroup && ls.mergeGroup === cur.mergeGroup)
        ) ?? null;
      })()
    : null;

  // Build ordered pill list: completed (in click order) → current (if in
  // stop) → remaining upcoming. The upcoming pills exist so the explorer
  // can see how many stops are left at a glance; they're rendered as
  // anonymous dots, not by narrative position.
  const completedStops = completionOrder
    .map(id => logicalStops.find(ls => ls.id === id))
    .filter(Boolean) as typeof logicalStops;

  const remainingStops = logicalStops.filter(
    ls => !completedSet.has(ls.id) && ls.id !== currentLogicalStop?.id
  );

  const pillList = [
    ...completedStops.map(s => ({ stop: s, state: 'completed' as const })),
    ...(currentLogicalStop ? [{ stop: currentLogicalStop, state: 'current' as const }] : []),
    ...remainingStops.map(s => ({ stop: s, state: 'upcoming' as const })),
  ];

  const currentVisitNumber = completedCount + 1; // position of the current stop being visited

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const el = currentRef.current;
      const container = scrollRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
    }
  }, [session.currentStopIndex, session.currentPhase]);

  return (
    <>
      <div
        className="shrink-0 flex items-center border-b cursor-pointer"
        style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface-alt)' }}
        onClick={() => setTrackerOpen(true)}
      >
        {/* Fixed label */}
        <div className="shrink-0 pl-3 pr-2 py-2.5">
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
        </div>
        <div className="shrink-0 w-px h-4 self-center" style={{ backgroundColor: 'var(--th-border)' }} />
        {/* Scrollable pills */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 px-2 py-2.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {pillList.map(({ stop, state }) => (
            <Pill
              key={stop.id}
              stop={stop}
              state={state}
              visitNumber={state === 'current' ? currentVisitNumber : undefined}
              ref={state === 'current' ? currentRef : undefined}
            />
          ))}
        </div>
      </div>

      {trackerOpen && (
        <StopTrackerOverlay tour={tour} session={session} onClose={() => setTrackerOpen(false)} />
      )}
    </>
  );
}

// ─── Linear mode ─────────────────────────────────────────────────

function LinearProgressBar({ tour, session }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const [trackerOpen, setTrackerOpen] = useState(false);

  // Context-Prototype walks stops in Act order, so its progress reflects the
  // flattened act sequence rather than the raw stops array.
  const isContext = getTourMode(tour) === 'context';
  const logicalStops = isContext ? getContextOrderedStops(tour) : getLogicalStops(tour);
  const completedIds = new Set(session.completedStops);
  const totalCount = logicalStops.length;
  const completedCount = logicalStops.filter(ls => completedIds.has(ls.id)).length;

  const isClosing = ['eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end'].includes(session.currentPhase);
  const isIntroPhase = ['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional', 'opening_frame', 'theme_question'].includes(session.currentPhase);
  const isInStopPhase = !isClosing && !isIntroPhase;

  let label = '';
  if (isIntroPhase) label = 'Starting the tour…';
  else if (isClosing) label = 'Closing reflection';
  else label = `${completedCount} of ${totalCount} explored`;

  // Which logical stop is currently active
  const currentLogicalIdx = (() => {
    if (!isInStopPhase || session.currentStopIndex < 0) return -1;
    const cur = getActiveStops(tour)[session.currentStopIndex];
    if (!cur) return -1;
    return logicalStops.findIndex(
      ls => ls.id === cur.id || (!isContext && cur.mergeGroup && ls.mergeGroup === cur.mergeGroup)
    );
  })();

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const el = currentRef.current;
      const container = scrollRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
    }
  }, [session.currentStopIndex, session.currentPhase]);

  // Progress fill bar percentage
  const hasIntro = isContext ? hasOpeningFrameContent(tour) : !!tour.essentialQuestion;
  const totalSegments = totalCount + (hasIntro ? 1 : 0) + 1;
  let pct = 0;
  if (isIntroPhase) {
    pct = (0.5 / totalSegments) * 100;
  } else if (isClosing) {
    const closingPhases = ['eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end'];
    const ci = closingPhases.indexOf(session.currentPhase);
    pct = ((totalSegments - 1 + (ci >= 0 ? ci / closingPhases.length : 0)) / totalSegments) * 100;
  } else if (session.currentPhase === 'end') {
    pct = 100;
  } else {
    const stopPhases = ['act_intro', 'act_opening', 'stop_map', 'seed', 'wonder', 'reveal', 'reflect', 'whats_next', 'act_closing', 'act_questions', 'community_forum', 'branch'];
    const pi = stopPhases.indexOf(session.currentPhase);
    const sub = pi >= 0 ? pi / stopPhases.length : 0.5;
    const base = hasIntro ? 1 : 0;
    pct = ((base + currentLogicalIdx + sub) / totalSegments) * 100;
  }
  pct = Math.min(Math.max(pct, 0), 100);

  return (
    <>
      <div
        className="shrink-0 flex items-center border-b cursor-pointer"
        style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface-alt)' }}
        onClick={() => setTrackerOpen(true)}
      >
        {/* Fixed label */}
        <div className="shrink-0 pl-3 pr-2 py-2.5">
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
        </div>
        <div className="shrink-0 w-px h-4 self-center" style={{ backgroundColor: 'var(--th-border)' }} />
        {/* Scrollable pills */}
        <div
          ref={scrollRef}
          className="flex items-center gap-1.5 px-2 py-2.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Intro pill — omitted in Context-Prototype (Acts stand on their own) */}
          {hasIntro && !isContext && (() => {
            const isIntroActive = isIntroPhase;
            const isIntroDone = !isIntroActive && !isIntroPhase;
            return (
              <div
                ref={isIntroActive ? currentRef : undefined}
                className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold text-white"
                style={{
                  backgroundColor: isIntroActive
                    ? '#F59E0B'
                    : isIntroDone
                      ? '#F59E0B'
                      : 'color-mix(in srgb, var(--th-border) 60%, transparent)',
                  minWidth: isIntroActive ? undefined : '20px',
                  height: '20px',
                }}
              >
                {isIntroActive && <span>Intro</span>}
              </div>
            );
          })()}

          {logicalStops.map((stop, i) => {
            const isCompleted = completedIds.has(stop.id);
            const isCurrent = i === currentLogicalIdx && isInStopPhase;
            const state = isCurrent ? 'current' : isCompleted ? 'completed' : 'upcoming';
            return (
              <Pill
                key={stop.id}
                stop={stop}
                state={state}
                visitNumber={state === 'current' ? i + 1 : undefined}
                plainTitle={isContext}
                ref={state === 'current' ? currentRef : undefined}
              />
            );
          })}

          {/* Closing pill */}
          <div
            ref={isClosing ? currentRef : undefined}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold text-white"
            style={{
              backgroundColor: isClosing
                ? '#F59E0B'
                : 'color-mix(in srgb, var(--th-border) 60%, transparent)',
              minWidth: '20px',
              height: '20px',
            }}
          >
            {isClosing && <span>{tour.essentialQuestion ? 'Closing' : '✦'}</span>}
          </div>
        </div>
      </div>

      {/* Fill bar */}
      <div className="shrink-0 w-full h-2" style={{ backgroundColor: 'color-mix(in srgb, var(--th-border) 40%, transparent)' }}>
        <div
          className="h-full transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${pct}%`, backgroundColor: '#F59E0B' }}
        />
      </div>

      {trackerOpen && (
        <StopTrackerOverlay tour={tour} session={session} onClose={() => setTrackerOpen(false)} />
      )}
    </>
  );
}

// ─── Shared pill component ────────────────────────────────────────

import React from 'react';

const Pill = React.forwardRef<
  HTMLDivElement,
  { stop: Tour['stops'][number]; state: 'completed' | 'current' | 'upcoming'; visitNumber?: number; plainTitle?: boolean }
>(function Pill({ stop, state, visitNumber, plainTitle = false }, ref) {
  // Context-Prototype titles pills by the individual stop; merge groups only
  // apply to unstructured mode.
  const displayName = plainTitle ? stop.title : (stop.mergeGroup || stop.title);

  if (state === 'completed') {
    return (
      <div
        ref={ref}
        className="shrink-0 rounded-full transition-all duration-200"
        style={{ width: '20px', height: '20px', backgroundColor: '#F59E0B' }}
      />
    );
  }

  if (state === 'current') {
    return (
      <div
        ref={ref}
        className="shrink-0 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold"
        style={{ backgroundColor: '#F59E0B', maxWidth: '160px', color: 'rgba(0,0,0,0.8)' }}
      >
        <span className="shrink-0">{visitNumber}</span>
        {displayName && <span className="truncate">{displayName}</span>}
      </div>
    );
  }

  // upcoming
  return (
    <div
      ref={ref}
      className="shrink-0 rounded-full transition-all duration-200"
      style={{ width: '20px', height: '20px', backgroundColor: 'color-mix(in srgb, var(--th-border) 60%, transparent)' }}
    />
  );
});

// ─── Swipeable Stop Tracker Overlay ──────────────────────────────

export function StopTrackerOverlay({ tour, session, onClose, onPreviewStop }: { tour: Tour; session: TourSession; onClose: () => void; onPreviewStop?: (stop: Stop) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const completedIds = new Set(session.completedStops);
  const isContext = getTourMode(tour) === 'context';

  // For unstructured tours, the thumbnail row should reflect the
  // journey the explorer is building, not the underlying authoring
  // order: completed stops in the order they entered them, then the
  // current stop (if mid-stop), then upcoming stops. Linear tours keep
  // the authoring order since that *is* the journey.
  //
  // completionOrder tracks one entry per *logical* stop (group leader
  // for merge groups, self for standalones). For per-sub-stop ordering
  // we look up each physical stop's group leader, find that leader's
  // index in completionOrder, and break ties within a group by
  // authored order so a group's sub-stops stay contiguous.
  const orderedStops = (() => {
    const active = getActiveStops(tour);
    if (!tour.unstructuredMode) return active;
    const completionOrder: string[] = session.completionOrder || [];

    const groupLogicalId = (s: Stop): string => s.mergeGroup
      ? (active.find(x => x.mergeGroup === s.mergeGroup)?.id ?? s.id)
      : s.id;

    const completed = active
      .filter(s => completedIds.has(s.id))
      .sort((a, b) => {
        const ai = completionOrder.indexOf(groupLogicalId(a));
        const bi = completionOrder.indexOf(groupLogicalId(b));
        // Sub-stops whose group hasn't been logged yet (e.g. mid-group)
        // sort to the tail of the completed section so they sit just
        // before the current/upcoming.
        const aRank = ai >= 0 ? ai : Number.MAX_SAFE_INTEGER - 1;
        const bRank = bi >= 0 ? bi : Number.MAX_SAFE_INTEGER - 1;
        if (aRank !== bRank) return aRank - bRank;
        return active.indexOf(a) - active.indexOf(b);
      });

    const currentStop = session.currentStopIndex >= 0 ? active[session.currentStopIndex] : null;
    const isInStop = !!currentStop && !completedIds.has(currentStop.id);
    const usedIds = new Set([
      ...completed.map(s => s.id),
      ...(isInStop && currentStop ? [currentStop.id] : []),
    ]);
    const remaining = active.filter(s => !usedIds.has(s.id));
    return [
      ...completed,
      ...(isInStop && currentStop ? [currentStop] : []),
      ...remaining,
    ];
  })();

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = currentRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
    }
  }, []);

  // Split the journey into guided stops (numbered) and bonus/additional stops
  // (shown as "Bonus Stop", never numbered) so the numbering + count exclude bonuses.
  const additionalIds = new Set((tour.additionalStops || []).map((a) => a.stopId));
  const mainStops = orderedStops.filter((s) => !additionalIds.has(s.id));
  const bonusStops = orderedStops.filter((s) => additionalIds.has(s.id));
  const exploredMain = mainStops.filter((s) => completedIds.has(s.id)).length;
  const inStopPhase = !['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional', 'eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end', 'unstructured_map', 'midway_checkin'].includes(session.currentPhase);
  const activeStopId = session.currentStopIndex >= 0 ? getActiveStops(tour)[session.currentStopIndex]?.id ?? null : null;
  // The DISCOVER photo until the stop is finished, the notice photo after — the
  // notice photo is what the FIND activity sends them to look for, so showing it
  // in this dropdown beforehand hands over the answer. See lib/stop-thumbnail.ts.
  // (`completedIds` is already in scope from the component body above.)
  const photoFor = (stop: Stop) => stopThumbnailPhoto(stop, completedIds.has(stop.id));

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel — drops from top */}
      <div
        className="relative shadow-2xl rounded-b-2xl animate-slide-down-enter"
        style={{ backgroundColor: 'var(--th-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — the count excludes bonus stops */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Stops explored</p>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--th-primary)' }}>{exploredMain} of {mainStops.length} stops</span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-sandstone-light/30"
              style={{ color: 'var(--text-secondary)' }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Horizontal scrollable stop cards */}
        <div
          ref={scrollRef}
          className="flex gap-3 px-4 py-4 overflow-x-auto"
          style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
        >
          {mainStops.map((stop, i) => {
            const isCompleted = completedIds.has(stop.id);
            const isCurrent = inStopPhase && stop.id === activeStopId && !isCompleted;
            const isUpcoming = !isCompleted && !isCurrent;
            const thumbPhoto = photoFor(stop);
            const canPreview = (isCompleted || isCurrent) && !!onPreviewStop;
            const groupLabel = isContext ? null : (stop.mergeGroup || null);
            return (
              <div
                key={stop.id}
                ref={isCurrent ? currentRef : undefined}
                onClick={canPreview ? () => { onPreviewStop!(stop); onClose(); } : undefined}
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isCurrent ? 'border-aged-gold shadow-lg' : isCompleted ? 'border-olive/30' : 'border-sandstone-light/50'
                } ${canPreview ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={`h-28 ${isUpcoming ? 'bg-sandstone-light/20' : 'bg-sandstone'}`}>
                  {!isUpcoming && thumbPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbPhoto.url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={thumbPhoto.thumbnailFocalPoint
                        ? { objectPosition: `${thumbPhoto.thumbnailFocalPoint.x}% ${thumbPhoto.thumbnailFocalPoint.y}%` }
                        : undefined}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-sandstone-light">{i + 1}</span>
                    </div>
                  )}
                </div>
                <div className="p-3" style={{ backgroundColor: 'var(--th-surface)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isCurrent ? 'bg-aged-gold text-white' : isCompleted ? 'bg-olive/20 text-olive' : 'bg-sandstone-light/30 text-text-secondary/50'
                    }`}>{i + 1}</span>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-aged-gold animate-pulse" />}
                    {isCompleted && <span className="text-olive text-xs">✓</span>}
                  </div>
                  <p className={`text-sm font-semibold truncate ${isUpcoming ? 'text-text-secondary/40' : 'text-text-primary'}`}>
                    {isUpcoming ? `Stop ${i + 1}` : (stop.title || `Stop ${i + 1}`)}
                  </p>
                  {groupLabel && !isUpcoming && (
                    <p className="text-[10px] italic truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>{groupLabel}</p>
                  )}
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {isCurrent ? 'In progress' : isCompleted ? 'Completed' : 'Upcoming'}{canPreview ? ' · tap to revisit' : ''}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Bonus / additional stops — shown as "Bonus Stop", never numbered */}
          {bonusStops.map((stop) => {
            const isCompleted = completedIds.has(stop.id);
            const isCurrent = inStopPhase && stop.id === activeStopId && !isCompleted;
            const thumbPhoto = photoFor(stop);
            const canPreview = (isCompleted || isCurrent) && !!onPreviewStop;
            return (
              <div
                key={stop.id}
                ref={isCurrent ? currentRef : undefined}
                onClick={canPreview ? () => { onPreviewStop!(stop); onClose(); } : undefined}
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isCurrent ? 'border-aged-gold shadow-lg' : 'border-sandstone-light/50'
                } ${canPreview ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className="h-28 bg-sandstone">
                  {thumbPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbPhoto.url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={thumbPhoto.thumbnailFocalPoint ? { objectPosition: `${thumbPhoto.thumbnailFocalPoint.x}% ${thumbPhoto.thumbnailFocalPoint.y}%` } : undefined}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: 'repeating-linear-gradient(45deg, var(--th-surface-alt), var(--th-surface-alt) 8px, var(--th-border) 8px, var(--th-border) 16px)' }}>
                      <span className="text-2xl">✦</span>
                    </div>
                  )}
                </div>
                <div className="p-3" style={{ backgroundColor: 'var(--th-surface)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-aged-gold/20 text-aged-gold">Bonus</span>
                    {isCompleted && <span className="text-olive text-xs">✓</span>}
                  </div>
                  <p className="text-sm font-semibold truncate text-text-primary">Bonus Stop</p>
                  <p className="text-[10px] text-text-secondary mt-0.5 truncate">{stop.title || 'Extra context'}{canPreview ? ' · tap to revisit' : ''}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
