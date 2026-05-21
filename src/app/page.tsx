'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getTours } from '@/lib/tours-store';
import { Tour } from '@/lib/types';
import { TourProvider, useTour } from '@/context/TourContext';
import type { TourPinData, TourStopMarkerData } from '@/components/Map';
import JournalPeek from '@/components/tour/JournalPeek';
import Journal from '@/components/tour/Journal';
import ThemeSwitcher from '@/components/ThemeSwitcher';

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function HomeInner() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [peekTour, setPeekTour] = useState<Tour | null>(null);
  const [mapPeek, setMapPeek] = useState(false); // temporarily show map during tour
  const { tour: activeTour, session, isActive, startTour } = useTour();

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
  if (isActive && activeTour) {
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

  const handleTourPinSelect = useCallback((tour: Tour) => {
    setPeekTour(tour);
  }, []);

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
      {/* Map */}
      <div className="flex-1 relative">
        <Map
          pins={[]}
          selectedPinId={null}
          onPinSelect={() => {}}
          tourPins={tourPins}
          onTourPinSelect={handleTourPinSelect}
          tourStops={tourStopMarkers}
          onTourStopSelect={() => {}}
          hidePins={true}
        />

        {/* Theme switcher — top-right of the map */}
        {(!isActive || mapPeek) && (
          <div className="absolute top-3 right-3 z-[60]">
            <ThemeSwitcher />
          </div>
        )}
      </div>

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

      {/* Tour journal — active tour playback (hidden during map peek) */}
      {isActive && !mapPeek && (
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
