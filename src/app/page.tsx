'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getTours, getActiveStops } from '@/lib/tours-store';
import { Tour, Stop } from '@/lib/types';
import { TourProvider, useTour } from '@/context/TourContext';
import { getActiveGroupId, getNextStopInGroup, getStopsInGroup } from '@/lib/tour-session';
import type { TourPinData, TourStopMarkerData } from '@/components/Map';
import JournalPeek from '@/components/tour/JournalPeek';
import Journal from '@/components/tour/Journal';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ProgressBar from '@/components/tour/ProgressBar';
import UnstructuredMapControls, { MidwayCheckinCard } from '@/components/tour/cards/UnstructuredMapOverlay';
import UnstructuredClosingView from '@/components/tour/cards/UnstructuredClosingView';

type FlyTarget = { stopLocation: { lat: number; lng: number } };

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function HomeInner() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [peekTour, setPeekTour] = useState<Tour | null>(null);
  const [mapPeek, setMapPeek] = useState(false); // temporarily show map during tour
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const {
    tour: activeTour,
    session,
    isActive,
    startTour,
    selectedUnstructuredStopId,
    setSelectedUnstructuredStopId,
    canGoBack,
    goBack,
    endTour,
    completeMidwayCheckin,
  } = useTour();

  useEffect(() => {
    getTours().then(setTours).catch((err) => {
      console.error('[page] getTours failed:', err);
    });
  }, []);

  // Before tour: show one parent pin per tour
  const tourPins: TourPinData[] = !isActive
    ? tours.filter((t) => t.location).map((t) => ({ tour: t }))
    : [];

  // During tour: show stop pins that have locations
  const tourStopMarkers: TourStopMarkerData[] = [];
  const isUnstructuredMapPhase = !!(activeTour?.unstructuredMode && session?.currentPhase === 'unstructured_map');
  const isMidwayCheckin = !!(activeTour?.unstructuredMode && session?.currentPhase === 'midway_checkin');
  const isUnstructuredClosing = !!(activeTour?.unstructuredMode && session && ['eq_closing_discuss', 'eq_closing', 'eq_final_reflect', 'eq_questions', 'guide_outro', 'end'].includes(session.currentPhase));
  if (isActive && activeTour) {
    const activeStops = getActiveStops(activeTour);
    if (isUnstructuredMapPhase && session) {
      const completedSet = new Set(session.completedStops);
      const activeGroupId = getActiveGroupId(activeTour, session);
      const nextInGroupId = activeGroupId
        ? getNextStopInGroup(activeTour, activeGroupId, session)?.id ?? null
        : null;

      if (activeGroupId) {
        // ── Mini-map: only this group's pins ──
        const groupStops = getStopsInGroup(activeTour, activeGroupId);
        for (const stop of groupStops) {
          if (!stop.location) continue;
          const i = activeStops.indexOf(stop);
          const isStopCompleted = completedSet.has(stop.id);
          const isNext = stop.id === nextInGroupId;
          tourStopMarkers.push({
            stop,
            index: i,
            isActive: false,
            isCompleted: isStopCompleted,
            unstructuredMode: true,
            isSelectedOverlay: stop.id === selectedUnstructuredStopId,
            isNextInGroup: isNext,
            // Future sub-stops (not next, not completed) are locked
            isLockedInGroup: !isStopCompleted && !isNext,
          });
        }
      } else {
        // ── Main map ──
        // For each group: leader pin if not started; every member as a
        // toured indicator if fully done; (mid-progress → mini-map, not here).
        const seenGroups = new Set<string>();
        for (let i = 0; i < activeStops.length; i++) {
          const stop = activeStops[i];
          if (!stop.location) continue;
          const groupId = stop.mergeGroup || null;

          if (groupId) {
            if (seenGroups.has(groupId)) continue;
            seenGroups.add(groupId);
            const groupStops = getStopsInGroup(activeTour, groupId);
            const allDone = groupStops.every((s) => completedSet.has(s.id));

            if (allDone) {
              // Show every member as a small toured pin
              for (const sub of groupStops) {
                if (!sub.location) continue;
                tourStopMarkers.push({
                  stop: sub,
                  index: activeStops.indexOf(sub),
                  isActive: false,
                  isCompleted: true,
                  unstructuredMode: true,
                  isSelectedOverlay: sub.id === selectedUnstructuredStopId,
                });
              }
            } else {
              // Not started — show leader as a cluster entry
              const leader = groupStops[0];
              if (leader.location) {
                tourStopMarkers.push({
                  stop: leader,
                  index: activeStops.indexOf(leader),
                  isActive: false,
                  isCompleted: false,
                  unstructuredMode: true,
                  isSelectedOverlay: leader.id === selectedUnstructuredStopId,
                  isGroupLeader: true,
                  subStopCount: groupStops.length,
                });
              }
            }
          } else {
            // Standalone stop
            tourStopMarkers.push({
              stop,
              index: i,
              isActive: false,
              isCompleted: completedSet.has(stop.id),
              unstructuredMode: true,
              isSelectedOverlay: stop.id === selectedUnstructuredStopId,
            });
          }
        }
      }
    } else {
      // Linear mode: show all stops with locations
      for (let i = 0; i < activeStops.length; i++) {
        const stop = activeStops[i];
        if (!stop.location) continue;
        tourStopMarkers.push({
          stop,
          index: i,
          isActive: session?.currentStopIndex === i,
          isCompleted: session?.completedStops.includes(stop.id) ?? false,
        });
      }
    }
  }

  const handleTourPinSelect = useCallback((tour: Tour) => {
    setPeekTour(tour);
  }, []);

  const handleTourStopSelect = useCallback((stop: Stop) => {
    if (isUnstructuredMapPhase) {
      setSelectedUnstructuredStopId(stop.id);
    }
  }, [isUnstructuredMapPhase, setSelectedUnstructuredStopId]);

  const handleStopSelectedFromGallery = useCallback((stop: Stop) => {
    if (stop.location) {
      setFlyTarget({ stopLocation: stop.location });
    }
  }, []);

  const handleBeginTour = useCallback(() => {
    if (peekTour) {
      startTour(peekTour);
      setPeekTour(null);
    }
  }, [peekTour, startTour]);

  // Current stop has a location → allow map peek
  const currentStop = activeTour && session
    ? getActiveStops(activeTour)[session.currentStopIndex] ?? null
    : null;
  const currentStopHasLocation = currentStop?.location !== null && currentStop?.location !== undefined;

  return (
    <div className="relative h-full w-full flex flex-col bg-cream">
      {/* Title bar — shown in document flow during unstructured map / midway / closing phases */}
      {isActive && (isUnstructuredMapPhase || isMidwayCheckin || isUnstructuredClosing) && (
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          <div className="w-8">
            {canGoBack && (
              <button
                onClick={goBack}
                className="w-8 h-8 rounded-full flex items-center justify-center text-warm-white hover:bg-white/15"
                title="Go back"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-lg font-display font-bold text-warm-white text-center">{activeTour?.title}</p>
          <div className="w-8">
            <button
              onClick={endTour}
              className="w-8 h-8 rounded-full flex items-center justify-center text-warm-white hover:bg-white/15 text-sm"
              title="Exit tour"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Progress strip — shown in document flow during unstructured map / midway / closing phases */}
      {isActive && (isUnstructuredMapPhase || isMidwayCheckin || isUnstructuredClosing) && activeTour && session && (
        <ProgressBar tour={activeTour} session={session} />
      )}

      {/* Midway check-in content (replaces map area) */}
      {isMidwayCheckin && activeTour && (
        <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: 'var(--th-surface)' }}>
          <div className="min-h-full rounded-2xl bg-warm-white shadow-lg px-5 py-6">
            <MidwayCheckinCard tour={activeTour} onComplete={completeMidwayCheckin} />
          </div>
        </div>
      )}

      {/* Closing content for unstructured tours (replaces map area) */}
      {isUnstructuredClosing && <UnstructuredClosingView />}

      {/* Map — hidden during midway check-in and unstructured closing */}
      {!isMidwayCheckin && !isUnstructuredClosing && (
        <div className="flex-1 relative">
          <Map
            pins={[]}
            selectedPinId={null}
            onPinSelect={() => {}}
            tourPins={tourPins}
            onTourPinSelect={handleTourPinSelect}
            tourStops={tourStopMarkers}
            onTourStopSelect={handleTourStopSelect}
            hidePins={true}
            tourDefaultZoom={activeTour?.defaultZoom}
            isUnstructuredMap={isUnstructuredMapPhase}
            flyTarget={flyTarget}
            onFlyComplete={() => setFlyTarget(null)}
            isTourActive={isActive}
          />

          {/* Theme switcher — top-right of the map */}
          {(!isActive || mapPeek) && (
            <div className="absolute top-3 right-3 z-[60]">
              <ThemeSwitcher />
            </div>
          )}

          {/* Unstructured map controls — gallery / stop card / toggle */}
          {isUnstructuredMapPhase && activeTour && session && (
            <UnstructuredMapControls
              tour={activeTour}
              session={session}
              onStopSelectedFromGallery={handleStopSelectedFromGallery}
            />
          )}
        </div>
      )}

      {/* Bottom bar */}
      {!isActive && (
        <div className="shrink-0 border-t px-4 py-3 z-10" style={{ backgroundColor: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
          <div className="flex items-center gap-3">
            <div>
              <p className="font-display text-sm font-bold text-warm-white leading-tight">Memorial Church</p>
              <p className="text-[10px] text-warm-white/70 font-sans tracking-wide uppercase">Provenance</p>
            </div>
            {tours.length > 0 && !peekTour && (
              <p className="text-xs text-warm-white/80 ml-auto">
                Tap a pin to begin
              </p>
            )}
          </div>
        </div>
      )}

      {/* Map peek return button — shown when map is visible during active tour */}
      {isActive && mapPeek && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setMapPeek(false)}
            className="px-5 py-3 rounded-full shadow-lg text-sm font-semibold"
            style={{ backgroundColor: 'var(--th-journal)', color: 'var(--th-surface)' }}
          >
            Return to journal
          </button>
        </div>
      )}

      {/* Tour journal peek — before tour starts */}
      {peekTour && !isActive && (
        <JournalPeek
          tour={peekTour}
          onBegin={handleBeginTour}
          onDismiss={() => setPeekTour(null)}
        />
      )}

      {/* Tour journal — active tour playback; not shown during unstructured map, midway, or closing phases */}
      {isActive && !mapPeek && !isUnstructuredMapPhase && !isMidwayCheckin && !isUnstructuredClosing && (
        <Journal
          onMapPeek={currentStopHasLocation ? () => setMapPeek(true) : undefined}
        />
      )}
    </div>
  );
}

export default function Home() {
  return (
    <TourProvider>
      <HomeInner />
    </TourProvider>
  );
}
