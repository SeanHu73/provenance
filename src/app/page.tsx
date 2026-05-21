'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getTours } from '@/lib/tours-store';
import { Tour, Stop } from '@/lib/types';
import { TourProvider, useTour } from '@/context/TourContext';
import { getLogicalStops } from '@/lib/tour-session';
import type { TourPinData, TourStopMarkerData } from '@/components/Map';
import JournalPeek from '@/components/tour/JournalPeek';
import Journal from '@/components/tour/Journal';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ProgressBar from '@/components/tour/ProgressBar';
import UnstructuredMapControls, { MidwayCheckinCard } from '@/components/tour/cards/UnstructuredMapOverlay';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function HomeInner() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [peekTour, setPeekTour] = useState<Tour | null>(null);
  const [mapPeek, setMapPeek] = useState(false); // temporarily show map during tour
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
  if (isActive && activeTour) {
    if (isUnstructuredMapPhase) {
      // Unstructured mode: show all logical stops with locations
      const logicalStopIds = new Set(getLogicalStops(activeTour).map((s) => s.id));
      for (let i = 0; i < activeTour.stops.length; i++) {
        const stop = activeTour.stops[i];
        if (!stop.location) continue;
        if (!logicalStopIds.has(stop.id)) continue; // skip merge-group secondaries
        tourStopMarkers.push({
          stop,
          index: i,
          isActive: false,
          isCompleted: session?.completedStops.includes(stop.id) ?? false,
          unstructuredMode: true,
          isSelectedOverlay: stop.id === selectedUnstructuredStopId,
        });
      }
    } else {
      // Linear mode (existing behavior)
      for (let i = 0; i < activeTour.stops.length; i++) {
        const stop = activeTour.stops[i];
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

  const handleBeginTour = useCallback(() => {
    if (peekTour) {
      startTour(peekTour);
      setPeekTour(null);
    }
  }, [peekTour, startTour]);

  // Current stop has a location → allow map peek
  const currentStop = activeTour && session
    ? activeTour.stops[session.currentStopIndex] ?? null
    : null;
  const currentStopHasLocation = currentStop?.location !== null && currentStop?.location !== undefined;

  return (
    <div className="relative h-full w-full flex flex-col bg-cream">
      {/* Title bar — shown in document flow during unstructured map / midway phases */}
      {isActive && (isUnstructuredMapPhase || isMidwayCheckin) && (
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

      {/* Progress strip — shown in document flow during unstructured map / midway phases */}
      {isActive && (isUnstructuredMapPhase || isMidwayCheckin) && activeTour && session && (
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

      {/* Map — hidden during midway check-in */}
      {!isMidwayCheckin && (
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
          />

          {/* Theme switcher — top-right of the map */}
          {(!isActive || mapPeek) && (
            <div className="absolute top-3 right-3 z-[60]">
              <ThemeSwitcher />
            </div>
          )}

          {/* Unstructured map controls — gallery / stop card / toggle */}
          {isUnstructuredMapPhase && activeTour && session && (
            <UnstructuredMapControls tour={activeTour} session={session} />
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

      {/* Tour journal — active tour playback; not shown during unstructured map or midway phases */}
      {isActive && !mapPeek && !isUnstructuredMapPhase && !isMidwayCheckin && (
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
