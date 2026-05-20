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
  const isClosing = ['eq_closing', 'eq_final_reflect', 'eq_questions', 'end'].includes(session.currentPhase);

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
        style={{ borderColor: '#D4BFA0', backgroundColor: '#F0E0C8', scrollbarWidth: 'none' }}
        onClick={() => setTrackerOpen(true)}
      >
        {/* Intro pill — for essential question / intro phases */}
        {tour.essentialQuestion && (() => {
          const isIntroActive = ['intro', 'eq_opening'].includes(session.currentPhase);
          const isIntroDone = !isIntroActive && session.currentStopIndex >= 0 && !['intro', 'eq_opening'].includes(session.currentPhase);
          return (
            <div
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                isIntroActive
                  ? 'bg-[#C4923A] text-white shadow-sm'
                  : isIntroDone
                    ? 'bg-[#7A7A5E]/20 text-[#7A7A5E]'
                    : 'bg-[#D4BFA0]/30 text-[#6B5D4F]/40'
              }`}
            >
              <span className="text-xs">Intro</span>
            </div>
          );
        })()}

        {stops.map((stop, i) => {
          const isCompleted = completedIds.has(stop.id);
          const isCurrent = i === currentIdx && !isClosing;
          const isUpcoming = !isCompleted && !isCurrent;

          return (
            <div
              key={stop.id}
              ref={isCurrent ? currentRef : undefined}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                isCurrent
                  ? 'bg-[#C4923A] text-white shadow-sm'
                  : isCompleted
                    ? 'bg-[#7A7A5E]/20 text-[#7A7A5E]'
                    : 'bg-[#D4BFA0]/30 text-[#6B5D4F]/40'
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
              ? 'bg-[#C4923A] text-white shadow-sm'
              : 'bg-[#D4BFA0]/30 text-[#6B5D4F]/40'
          }`}
        >
          <span className="text-xs">{tour.essentialQuestion ? 'Closing' : '✦'}</span>
        </div>
      </div>

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
        className="relative bg-[#FFF8EE] shadow-2xl rounded-b-2xl animate-slide-down-enter"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#D4BFA0' }}>
          <p className="text-sm font-semibold text-[#2C2418]">Tour Progress</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B5D4F] hover:bg-[#D4BFA0]/30"
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
            const isActive = ['intro', 'eq_opening'].includes(session.currentPhase);
            const isDone = !isActive;
            return (
              <div
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isActive ? 'border-[#C4923A] shadow-lg' : 'border-[#7A7A5E]/30'
                }`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={`h-28 flex items-center justify-center ${isActive ? 'bg-[#C4923A]/10' : 'bg-[#F0E0C8]'}`}>
                  <span className="text-3xl">📖</span>
                </div>
                <div className="p-3 bg-[#FFF8EE]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#C4923A] text-white' : 'bg-[#7A7A5E]/20 text-[#7A7A5E]'}`}>
                      ★
                    </span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#C4923A] animate-pulse" />}
                    {isDone && !isActive && <span className="text-[#7A7A5E] text-xs">✓</span>}
                  </div>
                  <p className={`text-sm font-semibold ${isActive ? 'text-[#C4923A]' : 'text-[#2C2418]'}`}>
                    Guiding Question
                  </p>
                  <p className="text-[10px] text-[#6B5D4F] mt-0.5">
                    {isActive ? 'In progress' : 'Completed'}
                  </p>
                </div>
              </div>
            );
          })()}

          {tour.stops.map((stop, i) => {
            const isCompleted = completedIds.has(stop.id);
            const isCurrent = i === session.currentStopIndex && !['intro', 'eq_opening', 'eq_closing', 'eq_final_reflect', 'eq_questions', 'end'].includes(session.currentPhase);
            const isUpcoming = !isCompleted && !isCurrent;

            const firstPhoto = (stop.notice.photos || [])[0]?.url || stop.notice.photoUrl || (stop.seed.photos || [])[0]?.url || stop.seed.photoUrl || null;

            return (
              <div
                key={stop.id}
                ref={isCurrent ? currentRef : undefined}
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isCurrent
                    ? 'border-[#C4923A] shadow-lg'
                    : isCompleted
                      ? 'border-[#7A7A5E]/30'
                      : 'border-[#D4BFA0]/50'
                }`}
                style={{ scrollSnapAlign: 'center' }}
              >
                {/* Photo or placeholder */}
                <div className={`h-28 ${isUpcoming ? 'bg-[#D4BFA0]/20' : 'bg-[#F0E0C8]'}`}>
                  {!isUpcoming && firstPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={firstPhoto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-[#D4BFA0]">{i + 1}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 bg-[#FFF8EE]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isCurrent ? 'bg-[#C4923A] text-white' : isCompleted ? 'bg-[#7A7A5E]/20 text-[#7A7A5E]' : 'bg-[#D4BFA0]/30 text-[#6B5D4F]/50'
                    }`}>
                      {i + 1}
                    </span>
                    {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#C4923A] animate-pulse" />}
                    {isCompleted && <span className="text-[#7A7A5E] text-xs">✓</span>}
                  </div>
                  <p className={`text-sm font-semibold truncate ${isUpcoming ? 'text-[#6B5D4F]/40' : 'text-[#2C2418]'}`}>
                    {isUpcoming ? `Stop ${i + 1}` : (stop.title || `Stop ${i + 1}`)}
                  </p>
                  <p className="text-[10px] text-[#6B5D4F] mt-0.5">
                    {isCurrent ? 'In progress' : isCompleted ? 'Completed' : 'Upcoming'}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Closing card */}
          {(() => {
            const closingPhases = ['eq_closing', 'eq_final_reflect', 'eq_questions', 'end'];
            const isActive = closingPhases.includes(session.currentPhase);
            return (
              <div
                className={`shrink-0 w-[200px] rounded-xl overflow-hidden border-2 transition-all ${
                  isActive ? 'border-[#C4923A] shadow-lg' : 'border-[#D4BFA0]/50'
                }`}
                style={{ scrollSnapAlign: 'center' }}
              >
                <div className={`h-28 flex items-center justify-center ${isActive ? 'bg-[#C4923A]/10' : 'bg-[#D4BFA0]/20'}`}>
                  <span className="text-3xl">{tour.essentialQuestion ? '🔄' : '✦'}</span>
                </div>
                <div className="p-3 bg-[#FFF8EE]">
                  <p className={`text-sm font-semibold ${isActive ? 'text-[#C4923A]' : 'text-[#6B5D4F]/50'}`}>
                    {tour.essentialQuestion ? 'Closing Reflection' : 'Wrap Up'}
                  </p>
                  <p className="text-[10px] text-[#6B5D4F] mt-0.5">
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
