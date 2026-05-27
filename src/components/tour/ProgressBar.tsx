'use client';

import { useRef, useEffect, useState } from 'react';
import { Tour, TourSession, Stop } from '@/lib/types';
import { getLogicalStops } from '@/lib/tour-session';
import { getActiveStops } from '@/lib/tours-store';

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

  const logicalStops = getLogicalStops(tour);
  const completedIds = new Set(session.completedStops);
  const totalCount = logicalStops.length;
  const completedCount = logicalStops.filter(ls => completedIds.has(ls.id)).length;

  const isClosing = ['eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end'].includes(session.currentPhase);
  const isIntroPhase = ['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional'].includes(session.currentPhase);
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
      ls => ls.id === cur.id || (cur.mergeGroup && ls.mergeGroup === cur.mergeGroup)
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
  const hasIntro = !!tour.essentialQuestion;
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
    const stopPhases = ['seed', 'wonder', 'reveal', 'reflect', 'whats_next', 'branch'];
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
          {/* Intro pill */}
          {hasIntro && (() => {
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
  { stop: Tour['stops'][number]; state: 'completed' | 'current' | 'upcoming'; visitNumber?: number }
>(function Pill({ stop, state, visitNumber }, ref) {
  const displayName = stop.mergeGroup || stop.title;

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

function StopTrackerOverlay({ tour, session, onClose }: { tour: Tour; session: TourSession; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const completedIds = new Set(session.completedStops);

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel — drops from top */}
      <div
        className="relative shadow-2xl rounded-b-2xl animate-slide-down-enter"
        style={{ backgroundColor: 'var(--th-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tour Progress</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-sandstone-light/30"
            style={{ color: 'var(--text-secondary)' }}
          >
            &times;
          </button>
        </div>

        {/* Horizontal scrollable stop cards */}
        <div
          ref={scrollRef}
          className="flex gap-3 px-4 py-4 overflow-x-auto"
          style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
        >
          {/* Intro card */}
          {tour.essentialQuestion && (() => {
            const isActive = ['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional'].includes(session.currentPhase);
            const isDone = !isActive;
            return (
              <div
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${isActive ? 'border-aged-gold shadow-lg' : 'border-olive/30'}`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={`h-28 flex items-center justify-center ${isActive ? 'bg-aged-gold/10' : 'bg-sandstone'}`}>
                  <span className="text-3xl">📖</span>
                </div>
                <div className="p-3" style={{ backgroundColor: 'var(--th-surface)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-aged-gold text-white' : 'bg-olive/20 text-olive'}`}>★</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-aged-gold animate-pulse" />}
                    {isDone && !isActive && <span className="text-olive text-xs">✓</span>}
                  </div>
                  <p className={`text-sm font-semibold ${isActive ? 'text-aged-gold' : 'text-text-primary'}`}>Discussion Question</p>
                  <p className="text-[10px] text-text-secondary mt-0.5">{isActive ? 'In progress' : 'Completed'}</p>
                </div>
              </div>
            );
          })()}

          {orderedStops.map((stop, i) => {
            const isCompleted = completedIds.has(stop.id);
            const inStopPhase = !['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional', 'eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end', 'unstructured_map', 'midway_checkin'].includes(session.currentPhase);
            const activeStopId = session.currentStopIndex >= 0 ? getActiveStops(tour)[session.currentStopIndex]?.id : null;
            const isCurrent = inStopPhase && stop.id === activeStopId && !isCompleted;
            const isUpcoming = !isCompleted && !isCurrent;

            const thumbPhoto =
              (stop.notice.photos || []).find(p => p.url) ||
              (stop.notice.photoUrl ? { url: stop.notice.photoUrl, caption: stop.notice.photoCaption } : null) ||
              (stop.seed.photos || []).find(p => p.url) ||
              (stop.seed.photoUrl ? { url: stop.seed.photoUrl, caption: stop.seed.photoCaption } : null) ||
              null;

            const displayTitle = stop.title;
            const groupLabel = stop.mergeGroup || null;

            return (
              <div
                key={stop.id}
                ref={isCurrent ? currentRef : undefined}
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isCurrent ? 'border-aged-gold shadow-lg' : isCompleted ? 'border-olive/30' : 'border-sandstone-light/50'
                }`}
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
                    {isUpcoming ? `Stop ${i + 1}` : (displayTitle || `Stop ${i + 1}`)}
                  </p>
                  {groupLabel && !isUpcoming && (
                    <p className="text-[10px] italic truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {groupLabel}
                    </p>
                  )}
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {isCurrent ? 'In progress' : isCompleted ? 'Completed' : 'Upcoming'}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Closing card */}
          {(() => {
            const closingPhases = ['eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'end'];
            const isActive = closingPhases.includes(session.currentPhase);
            return (
              <div
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${isActive ? 'border-aged-gold shadow-lg' : 'border-sandstone-light/50'}`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={`h-28 flex items-center justify-center ${isActive ? 'bg-aged-gold/10' : 'bg-sandstone-light/20'}`}>
                  <span className="text-3xl">{tour.essentialQuestion ? '🔄' : '✦'}</span>
                </div>
                <div className="p-3" style={{ backgroundColor: 'var(--th-surface)' }}>
                  <p className={`text-sm font-semibold ${isActive ? 'text-aged-gold' : 'text-text-secondary/50'}`}>
                    {tour.essentialQuestion ? 'Closing Reflection' : 'Wrap Up'}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {isActive ? 'In progress' : session.currentPhase === 'end' ? 'Completed' : 'Upcoming'}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
