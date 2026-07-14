'use client';

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getTours, getActiveStops } from '@/lib/tours-store';
import { Tour, Stop } from '@/lib/types';
import { TourProvider, useTour } from '@/context/TourContext';
import { getActiveGroupId, getNextStopInGroup, getStopsInGroup } from '@/lib/tour-session';
import type { TourPinData, TourStopMarkerData } from '@/components/Map';
import TourOverview from '@/components/tour/TourOverview';
import Journal from '@/components/tour/Journal';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import ProgressBar from '@/components/tour/ProgressBar';
import UnstructuredMapControls, { MidwayCheckinCard } from '@/components/tour/cards/UnstructuredMapOverlay';
import UnstructuredClosingView from '@/components/tour/cards/UnstructuredClosingView';
import TourFooter from '@/components/tour/TourFooter';
import TourMenu from '@/components/tour/TourMenu';
import TourAudioSetup from '@/components/tour/TourAudioSetup';
import { requestAutoplayHint } from '@/lib/autoplay-hint';
import RoomLobby from '@/components/room/RoomLobby';
import RoomStopProposalOverlay from '@/components/room/RoomStopProposalOverlay';
import { useRoom } from '@/context/RoomContext';

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
    completeMidwayCheckin,
    enterUnstructuredStop,
  } = useTour();
  const { room, isHost: isRoomHost } = useRoom();

  // Per-tour audio (Listen/Read) setup gate — shown once at the start of each
  // tour. Keyed by session id (persisted for this tab so a reload mid-tour
  // doesn't re-show it).
  const [audioDoneFor, setAudioDoneFor] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try { return sessionStorage.getItem('provenance.audioSetupSession'); } catch { return null; }
  });
  const finishAudioSetup = useCallback(() => {
    if (!session) return;
    setAudioDoneFor(session.id);
    try { sessionStorage.setItem('provenance.audioSetupSession', session.id); } catch { /* ignore */ }
    // Pop the menu open pointing at the Auto-Play toggle so they know where to
    // change it. (Deferred a tick so it lands after the setup overlay unmounts.)
    setTimeout(() => requestAutoplayHint(), 350);
  }, [session]);
  // While the audio setup is still up, hold back the tour content so its
  // narration (e.g. "Meet Your Guide") doesn't start playing behind the overlay.
  const audioSetupPending = isActive && !!session && audioDoneFor !== session.id;

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
  // Linear tours in a room also drop onto the map between stops so the
  // host can tap the next pin (giving the group time to walk). Same
  // phase token, different controls.
  const isLinearRoomMapPhase = !!(activeTour && !activeTour.unstructuredMode && room && room.started && session?.currentPhase === 'unstructured_map');
  const isOnTourMap = isUnstructuredMapPhase || isLinearRoomMapPhase;
  const isMidwayCheckin = !!(activeTour?.unstructuredMode && session?.currentPhase === 'midway_checkin');
  const isUnstructuredClosing = !!(activeTour?.unstructuredMode && session && ['eq_closing_discuss', 'eq_closing', 'eq_closing_additional', 'eq_final_reflect', 'eq_questions', 'guide_outro', 'end'].includes(session.currentPhase));
  if (isActive && activeTour) {
    const activeStops = getActiveStops(activeTour);
    if (isUnstructuredMapPhase && session) {
      // In a room, the room's completedStopIds is the source of truth —
      // local completedStops doesn't update on the non-host's device
      // while the host is moving the group. Falls back to local when
      // running single-player.
      const completedSet = new Set(
        room && room.started ? (room.completedStopIds || []) : session.completedStops
      );
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
    } else if (isLinearRoomMapPhase && session) {
      // Linear room, between-stops map. Highlight the next unvisited
      // sequential stop as "active" so the host knows which pin to tap.
      const completedSet = new Set(room?.completedStopIds || []);
      let nextIdx = -1;
      for (let i = 0; i < activeStops.length; i++) {
        if (!completedSet.has(activeStops[i].id)) { nextIdx = i; break; }
      }
      for (let i = 0; i < activeStops.length; i++) {
        const stop = activeStops[i];
        if (!stop.location) continue;
        tourStopMarkers.push({
          stop,
          index: i,
          isActive: i === nextIdx,
          isCompleted: completedSet.has(stop.id),
        });
      }
    } else {
      // Linear mode (during a stop): show all stops with locations.
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

  // Map-peek mode: only the current stop's pin should show. This is a
  // local-only "where am I supposed to be" lookup — doesn't affect the
  // room and doesn't end the stop. Pins for other stops are filtered
  // out so the user can't tap into anything else by accident.
  const tourStopMarkersForRender = (() => {
    if (!mapPeek || !session || !activeTour) return tourStopMarkers;
    // Opening Frame peek: the tour hasn't entered a stop yet, so show a single
    // pin at the starting point rather than the first stop's pin.
    if (session.currentPhase === 'opening_frame' && activeTour.openingFrame?.location) {
      return [{
        stop: { id: '__opening_frame__', title: activeTour.title, location: activeTour.openingFrame.location } as unknown as Stop,
        index: 0,
        isActive: true,
        isCompleted: false,
      }];
    }
    const currentId = getActiveStops(activeTour)[session.currentStopIndex]?.id;
    if (!currentId) return tourStopMarkers;
    return tourStopMarkers.filter((m) => m.stop.id === currentId);
  })();

  const handleTourPinSelect = useCallback((tour: Tour) => {
    setPeekTour(tour);
  }, []);

  const handleTourStopSelect = useCallback((stop: Stop) => {
    if (isUnstructuredMapPhase) {
      setSelectedUnstructuredStopId(stop.id);
      return;
    }
    // Linear room interlude: tap directly proposes the stop (only the
    // host's tap does anything; enterUnstructuredStop is room-gated
    // inside TourContext).
    if (isLinearRoomMapPhase && isRoomHost && activeTour) {
      const idx = getActiveStops(activeTour).findIndex((s) => s.id === stop.id);
      if (idx >= 0) enterUnstructuredStop(idx);
    }
  }, [isUnstructuredMapPhase, isLinearRoomMapPhase, isRoomHost, activeTour, setSelectedUnstructuredStopId, enterUnstructuredStop]);

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
  const openingFrameHasLocation = !!activeTour?.openingFrame?.location;

  return (
    <div className="relative h-full w-full flex flex-col bg-cream">
      {/* Title bar — shown in document flow during unstructured map / midway / closing phases */}
      {isActive && (isOnTourMap || isMidwayCheckin || isUnstructuredClosing) && (
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
          {/* Empty placeholder keeps the title centred without offering a
              mid-tour exit. Leaving the tour is only available from the
              EndCard at the natural end of the experience. */}
          <div className="w-8" />
        </div>
      )}

      {/* Progress strip — shown in document flow during unstructured map / midway / closing phases */}
      {isActive && (isOnTourMap || isMidwayCheckin || isUnstructuredClosing) && activeTour && session && (
        <ProgressBar tour={activeTour} session={session} />
      )}

      {/* Midway check-in content (replaces map area). The midway card
          owns its own snap-scroll container; the inner frame is marked
          `relative` so that scroll container can position absolutely
          inside it. */}
      {isMidwayCheckin && activeTour && session && (
        <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: 'var(--th-surface)' }}>
          <div className="relative min-h-full rounded-2xl bg-warm-white shadow-lg px-5 py-6">
            <MidwayCheckinCard tour={activeTour} session={session} onComplete={completeMidwayCheckin} />
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
            tourStops={tourStopMarkersForRender}
            onTourStopSelect={handleTourStopSelect}
            hidePins={true}
            tourDefaultZoom={activeTour?.defaultZoom}
            isUnstructuredMap={isOnTourMap}
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
              onFlyToStop={handleStopSelectedFromGallery}
            />
          )}

          {/* Linear room — between-stops cue. Host taps the highlighted
              pin once the group has physically arrived. */}
          {isLinearRoomMapPhase && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[55] px-4 py-2 rounded-full text-sm font-semibold shadow-lg max-w-[88vw] text-center"
              style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
              {isRoomHost
                ? 'Tap the next pin when your group is there'
                : 'Walk with the group — host will pick the next stop'}
            </div>
          )}
        </div>
      )}

      {/* Pre-tour bottom bar — theme-colored, with the inverse-colored
          logo glyph + Provenance wordmark, centered. */}
      {!isActive && (
        <div
          className="shrink-0 px-4 py-3 z-10 flex items-center justify-center gap-3"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          <InvertedLogoGlyph height={36} />
          <span className="font-montserrat font-medium text-xl" style={{ color: 'var(--cream)' }}>
            Provenance
          </span>
        </div>
      )}

      {/* Persistent Journal + Ask (?) footer during the map / midway /
          closing phases that page.tsx renders outside Journal. */}
      {isActive && (isOnTourMap || isMidwayCheckin || isUnstructuredClosing) && activeTour && session && session.currentPhase !== 'end' && (
        <>
          <TourFooter tour={activeTour} session={session} />
          <TourMenu />
        </>
      )}

      {/* Per-tour audio setup — gates the tour once, right after Begin Tour. */}
      {isActive && session && audioDoneFor !== session.id && (
        <TourAudioSetup onDone={finishAudioSetup} />
      )}

      {/* Map peek return — full-width bottom bar shown when the user is
          temporarily viewing the map for orientation. Local-only: in a
          room this doesn't affect anyone else and doesn't end the stop. */}
      {isActive && mapPeek && (
        <div className="absolute bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3 pointer-events-none">
          <button
            onClick={() => setMapPeek(false)}
            className="pointer-events-auto w-full py-4 rounded-xl shadow-lg text-base font-semibold"
            style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
          >
            Return to tour
          </button>
        </div>
      )}

      {/* Tour overview — full-screen "table of contents" landing page shown
          when a pin is tapped, before the tour starts. Replaces the old
          bottom-sheet JournalPeek. */}
      {peekTour && !isActive && (
        <TourOverview
          tour={peekTour}
          onBegin={handleBeginTour}
          onDismiss={() => setPeekTour(null)}
        />
      )}

      {/* Tour journal — active tour playback; not shown while we're on
          the map, in midway check-in, or running the closing flow. */}
      {isActive && !audioSetupPending && !mapPeek && !isOnTourMap && !isMidwayCheckin && !isUnstructuredClosing && (
        <Journal
          onMapPeek={currentStopHasLocation || openingFrameHasLocation ? () => setMapPeek(true) : undefined}
        />
      )}

      {/* Room lobby — covers everything while a room is set up but the
          host hasn't tapped "Begin tour" yet. */}
      <RoomLobbyWrapper />

      {/* Stop-proposal overlay — hovers above the active tour UI any
          time the host has proposed a new stop and the group is still
          confirming. */}
      <RoomStopProposalOverlay />
    </div>
  );
}

function RoomLobbyWrapper() {
  const { room } = useRoom();
  if (!room || room.started) return null;
  return <RoomLobby />;
}

export default function Home() {
  return (
    <TourProvider>
      <HomeInner />
    </TourProvider>
  );
}

// Aspect of the full pin glyph (width / height of the source PNG mask).
const PIN_GLYPH_ASPECT = 320 / 442;
const GLYPH_MASK = {
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
} as const;

/**
 * The Provenance pin in "inverse" colors against a theme-primary
 * background: outer pin and dots are cream, the speech-bubble area
 * blends with the bar (rendered in theme-primary), giving the
 * impression of a cream pin with a bar-colored bubble cutout.
 *
 * Built from the same CSS-mask glyph PNGs used by the map pins so
 * it stays in sync with the rest of the brand.
 */
function InvertedLogoGlyph({ height }: { height: number }) {
  const width = height * PIN_GLYPH_ASPECT;
  return (
    <div style={{ position: 'relative', width, height }} aria-hidden="true">
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--cream)',
          WebkitMaskImage: 'url(/pin-glyph-base.png)',
          maskImage: 'url(/pin-glyph-base.png)',
          ...GLYPH_MASK,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--th-primary)',
          WebkitMaskImage: 'url(/pin-glyph-p.png)',
          maskImage: 'url(/pin-glyph-p.png)',
          ...GLYPH_MASK,
        }}
      />
    </div>
  );
}
