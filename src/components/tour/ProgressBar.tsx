'use client';

/**
 * Horizontal progress bar showing stop numbers.
 * Highlights current stop, shows completed stops filled.
 * Scrolls to keep the current stop visible with neighbors.
 * Tap to open a swipeable stop tracker overlay.
 */

import { useRef, useEffect, useState } from 'react';
import { Tour, TourSession } from '@/lib/types';

interface Props {
  tour: Tour;
  session: TourSession;
}

export default function ProgressBar({ tour, session }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const [trackerOpen, setTrackerOpen] = useState(false);

  const stops = tour.stops;
  const currentIdx = session.currentStopIndex;
  const completedIds = new Set(session.completedStops);
  const isClosing = ['eq_closing_discuss', 'eq_closing', 'eq_final_reflect', 'eq_questions', 'end'].includes(session.currentPhase);
  const isIntroPhase = ['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional'].includes(session.currentPhase);
  const isInStopPhase = !isClosing && !isIntroPhase;

  // Auto-scroll to keep current stop centered
  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = currentRef.current;
      const offset = el.offsetLeft - container.offsetWidth / 2 + el.offsetWidth / 2;
      container.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
    }
  }, [currentIdx, session.currentPhase]);

  return (
    <>
      {/* Progress strip */}
      <div
        ref={scrollRef}
        className="shrink-0 flex items-center gap-1.5 px-3 py-3 overflow-x-auto border-b cursor-pointer"
        style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface-alt)', scrollbarWidth: 'none' }}
        onClick={() => setTrackerOpen(true)}
      >
        {/* Intro pill — for essential question / intro phases */}
        {tour.essentialQuestion && (() => {
          const isIntroActive = ['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional'].includes(session.currentPhase);
          const isIntroDone = !isIntroActive && session.currentStopIndex >= 0 && !['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional'].includes(session.currentPhase);
          return (
            <div
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                isIntroActive
                  ? 'bg-aged-gold text-white shadow-sm'
                  : isIntroDone
                    ? 'bg-olive/20 text-olive'
                    : 'bg-sandstone-light/30 text-text-secondary/40'
              }`}
            >
              <span className="text-xs">Intro</span>
            </div>
          );
        })()}

        {stops.map((stop, i) => {
          const isCompleted = completedIds.has(stop.id);
          const isCurrent = i === currentIdx && isInStopPhase;
          const isUpcoming = !isCompleted && !isCurrent;

          return (
            <div
              key={stop.id}
              ref={isCurrent ? currentRef : undefined}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                isCurrent
                  ? 'bg-aged-gold text-white shadow-sm'
                  : isCompleted
                    ? 'bg-olive/20 text-olive'
                    : 'bg-sandstone-light/30 text-text-secondary/40'
              }`}
            >
              <span className="text-xs">{i + 1}</span>
              {(isCurrent || isCompleted) && stop.title && (
                <span className="text-xs max-w-[80px] truncate">{stop.title}</span>
              )}
              {isUpcoming && (
                <span className="text-xs">&middot;&middot;&middot;</span>
              )}
            </div>
          );
        })}

        {/* Closing indicator */}
        <div
          className={`shrink-0 px-3 py-2 rounded-full text-sm font-semibold ${
            isClosing
              ? 'bg-aged-gold text-white shadow-sm'
              : 'bg-sandstone-light/30 text-text-secondary/40'
          }`}
        >
          <span className="text-xs">{tour.essentialQuestion ? 'Closing' : '✦'}</span>
        </div>
      </div>

      {/* Progress fill bar */}
      {(() => {
        const totalStops = stops.length;
        const hasIntro = !!tour.essentialQuestion;
        const totalSegments = totalStops + (hasIntro ? 1 : 0) + 1; // intro + stops + closing
        let pct = 0;
        if (isIntroPhase) {
          pct = (0.5 / totalSegments) * 100;
        } else if (isClosing) {
          const closingPhases = ['eq_closing_discuss', 'eq_closing', 'eq_final_reflect', 'eq_questions', 'end'];
          const ci = closingPhases.indexOf(session.currentPhase);
          pct = ((totalSegments - 1 + (ci >= 0 ? ci / closingPhases.length : 0)) / totalSegments) * 100;
        } else if (session.currentPhase === 'end') {
          pct = 100;
        } else {
          const stopPhases = ['seed', 'wonder', 'reveal', 'reflect', 'whats_next', 'branch'];
          const pi = stopPhases.indexOf(session.currentPhase);
          const sub = pi >= 0 ? pi / stopPhases.length : 0.5;
          const base = hasIntro ? 1 : 0;
          pct = ((base + currentIdx + sub) / totalSegments) * 100;
        }
        pct = Math.min(Math.max(pct, 0), 100);
        return (
          <div className="shrink-0 w-full h-2 bg-sandstone-light/30">
            <div
              className="h-full bg-aged-gold transition-all duration-500 ease-out rounded-r-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        );
      })()}

      {/* Swipeable stop tracker overlay */}
      {trackerOpen && (
        <StopTrackerOverlay
          tour={tour}
          session={session}
          onClose={() => setTrackerOpen(false)}
        />
      )}
    </>
  );
}

// ─── Swipeable Stop Tracker ─────────────────────────────────────

function StopTrackerOverlay({ tour, session, onClose }: { tour: Tour; session: TourSession; onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const completedIds = new Set(session.completedStops);

  // Scroll to current stop on open
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

      {/* Tracker panel — drops from top */}
      <div
        className="relative bg-warm-white shadow-2xl rounded-b-2xl animate-slide-down-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <p className="text-sm font-semibold text-text-primary">Tour Progress</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-text-secondary hover:bg-sandstone-light/30"
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
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isActive ? 'border-aged-gold shadow-lg' : 'border-olive/30'
                }`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={`h-28 flex items-center justify-center ${isActive ? 'bg-aged-gold/10' : 'bg-sandstone'}`}>
                  <span className="text-3xl">📖</span>
                </div>
                <div className="p-3 bg-warm-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-aged-gold text-white' : 'bg-olive/20 text-olive'}`}>
                      ★
                    </span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-aged-gold animate-pulse" />}
                    {isDone && !isActive && <span className="text-olive text-xs">✓</span>}
                  </div>
                  <p className={`text-sm font-semibold ${isActive ? 'text-aged-gold' : 'text-text-primary'}`}>
                    Discussion Question
                  </p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {isActive ? 'In progress' : 'Completed'}
                  </p>
                </div>
              </div>
            );
          })()}

          {tour.stops.map((stop, i) => {
            const isCompleted = completedIds.has(stop.id);
            const isCurrent = i === session.currentStopIndex && !['intro', 'eq_scene', 'eq_discuss', 'eq_opening', 'eq_additional', 'eq_closing_discuss', 'eq_closing', 'eq_final_reflect', 'eq_questions', 'end'].includes(session.currentPhase);
            const isUpcoming = !isCompleted && !isCurrent;

            const firstPhoto = (stop.notice.photos || [])[0]?.url || stop.notice.photoUrl || (stop.seed.photos || [])[0]?.url || stop.seed.photoUrl || null;

            return (
              <div
                key={stop.id}
                ref={isCurrent ? currentRef : undefined}
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isCurrent
                    ? 'border-aged-gold shadow-lg'
                    : isCompleted
                      ? 'border-olive/30'
                      : 'border-sandstone-light/50'
                }`}
                style={{ scrollSnapAlign: 'center' }}
              >
                {/* Photo or placeholder */}
                <div className={`h-28 ${isUpcoming ? 'bg-sandstone-light/20' : 'bg-sandstone'}`}>
                  {!isUpcoming && firstPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={firstPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-sandstone-light">{i + 1}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 bg-warm-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isCurrent ? 'bg-aged-gold text-white' : isCompleted ? 'bg-olive/20 text-olive' : 'bg-sandstone-light/30 text-text-secondary/50'
                    }`}>
                      {i + 1}
                    </span>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-aged-gold animate-pulse" />}
                    {isCompleted && <span className="text-olive text-xs">✓</span>}
                  </div>
                  <p className={`text-sm font-semibold truncate ${isUpcoming ? 'text-text-secondary/40' : 'text-text-primary'}`}>
                    {isUpcoming ? `Stop ${i + 1}` : (stop.title || `Stop ${i + 1}`)}
                  </p>
                  <p className="text-[10px] text-text-secondary mt-0.5">
                    {isCurrent ? 'In progress' : isCompleted ? 'Completed' : 'Upcoming'}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Closing card */}
          {(() => {
            const closingPhases = ['eq_closing_discuss', 'eq_closing', 'eq_final_reflect', 'eq_questions', 'end'];
            const isActive = closingPhases.includes(session.currentPhase);
            return (
              <div
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isActive ? 'border-aged-gold shadow-lg' : 'border-sandstone-light/50'
                }`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={`h-28 flex items-center justify-center ${isActive ? 'bg-aged-gold/10' : 'bg-sandstone-light/20'}`}>
                  <span className="text-3xl">{tour.essentialQuestion ? '🔄' : '✦'}</span>
                </div>
                <div className="p-3 bg-warm-white">
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
