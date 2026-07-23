'use client';

import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Pin, Stop, Tour } from '@/lib/types';

const CHURCH_LOCATION = { lat: 37.42700, lng: -122.17015 }; // Stanford Memorial Church
const MAX_AUTO_ZOOM = 17;
const NEAR_THRESHOLD_M = 300;
const SHOW_PIN_RADIUS_M = 8047; // 5 miles
const PIN_ASPECT = 320 / 442; // full logo glyph width / height
const BUBBLE_ASPECT = 319 / 225; // speech-bubble glyph width / height
const ARROW_SIZE = 46; // px — off-screen direction arrow

export interface TourPinData {
  tour: Tour;
}

export interface TourStopMarkerData {
  stop: Stop;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  unstructuredMode?: boolean;
  isSelectedOverlay?: boolean;
  // Merge-group rendering flags (unstructured mode only)
  isGroupLeader?: boolean;     // group entry pin on the main map; renders with `subStopCount` badge
  subStopCount?: number;       // number of stops in the group when isGroupLeader
  isNextInGroup?: boolean;     // the flashing/enlarged "next sub-stop" pin on the mini-map
  isLockedInGroup?: boolean;   // upcoming sub-stop on the mini-map; small and dim, no tap
}

type Bounds = { north: number; south: number; east: number; west: number };
type ContainerSize = { W: number; H: number };

interface MapProps {
  pins: Pin[];
  selectedPinId: string | null;
  onPinSelect: (pin: Pin) => void;
  /** Tour-level parent pins — shown before a tour starts */
  tourPins?: TourPinData[];
  onTourPinSelect?: (tour: Tour) => void;
  /** Individual stop pins — shown only during active tour */
  tourStops?: TourStopMarkerData[];
  onTourStopSelect?: (stop: Stop) => void;
  hidePins?: boolean;
  /** Admin-configured zoom level to use when the unstructured map phase starts */
  tourDefaultZoom?: number;
  /** True when the explorer is in the unstructured stop-picker phase */
  isUnstructuredMap?: boolean;
  /** True while the map is "peeked" — revealed behind a stop card (e.g. FIND's
   *  "Find on map"). GPS should be on here too. */
  mapPeek?: boolean;
  /** Pan+fitBounds animation target from gallery selection */
  flyTarget?: { stopLocation: Loc } | null;
  onFlyComplete?: () => void;
  /** Hide Google POI/transit pins while tour is active */
  isTourActive?: boolean;
}

type Loc = { lat: number; lng: number };

type MapInstance = {
  panTo: (pos: Loc) => void;
  setZoom: (zoom: number) => void;
} | null;

function haversineDistanceM(a: Loc, b: Loc): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLng = (b.lng - a.lng) * (Math.PI / 180);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * (Math.PI / 180)) * Math.cos(b.lat * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function formatDist(m: number): string {
  const miles = m * 0.000621371;
  if (miles < 0.1) return `${Math.round(m * 3.28084)} ft`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Positions the map so the user is near center and the nearest tour pin is
 * ~10% from its screen edge.
 */
function fitToNearestTourPin(map: MapInstance, userPos: Loc, tourLocs: Loc[]) {
  if (!map) return;
  // fitBounds (below) resets the camera tilt to 0; remember it so we can restore
  // the slant the explorer was using.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const savedTilt: number | undefined = (map as any).getTilt?.();
  const target =
    tourLocs.length > 0
      ? tourLocs.reduce((best, loc) =>
          haversineDistanceM(userPos, loc) < haversineDistanceM(userPos, best) ? loc : best
        )
      : CHURCH_LOCATION;

  const distM = haversineDistanceM(userPos, target);

  if (distM > SHOW_PIN_RADIUS_M) {
    map.panTo(userPos);
    map.setZoom(MAX_AUTO_ZOOM);
    return;
  }

  if (distM < 30) {
    map.panTo(userPos);
    map.setZoom(MAX_AUTO_ZOOM);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google;
  if (!g?.maps?.LatLngBounds) {
    map.panTo(userPos);
    map.setZoom(15);
    return;
  }

  const DRIFT_START_M = 643.7;
  const MAX_DRIFT     = 0.25;
  const PIN_EDGE      = 0.10;

  const drift = distM < DRIFT_START_M
    ? 0
    : Math.min(MAX_DRIFT, ((distM - DRIFT_START_M) / DRIFT_START_M) * MAX_DRIFT);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyMap = map as any;
  const mapDiv = anyMap.getDiv?.();
  const W = mapDiv?.offsetWidth  || window.innerWidth;
  const H = mapDiv?.offsetHeight || window.innerHeight;

  const userPad = 0.5 - drift;
  const pinIsNorth = target.lat > userPos.lat;
  const pinIsEast  = target.lng > userPos.lng;

  const topPad    = Math.round((pinIsNorth ? PIN_EDGE : userPad) * H);
  const bottomPad = Math.round((pinIsNorth ? userPad  : PIN_EDGE) * H);
  const rightPad  = Math.round((pinIsEast  ? PIN_EDGE : userPad) * W);
  const leftPad   = Math.round((pinIsEast  ? userPad  : PIN_EDGE) * W);

  const bounds = new g.maps.LatLngBounds();
  bounds.extend(userPos);
  bounds.extend(target);

  anyMap.fitBounds(bounds, { top: topPad, right: rightPad, bottom: bottomPad, left: leftPad });

  g.maps.event.addListenerOnce(anyMap, 'idle', () => {
    const z = anyMap.getZoom?.();
    if (typeof z === 'number' && z > MAX_AUTO_ZOOM) anyMap.setZoom(MAX_AUTO_ZOOM);
    if (savedTilt != null) anyMap.setTilt?.(savedTilt);
  });
}

function PinMarker({ pin, isSelected, onClick }: { pin: Pin; isSelected: boolean; onClick: () => void }) {
  const size = isSelected ? 44 : 34;
  const dot = isSelected ? 14 : 10;
  return (
    <AdvancedMarker
      position={{ lat: pin.location.lat, lng: pin.location.lng }}
      onClick={onClick}
      zIndex={isSelected ? 10 : 1}
    >
      <div className="flex flex-col items-center">
        <div
          className="flex items-center justify-center rounded-full shadow-md transition-all duration-200"
          style={{
            width: size,
            height: size,
            background: isSelected ? 'var(--th-primary)' : 'var(--th-secondary)',
            border: `3px solid ${isSelected ? 'var(--th-secondary-hover)' : 'var(--th-surface)'}`,
            boxShadow: isSelected
              ? '0 0 0 3px color-mix(in srgb, var(--th-secondary) 30%, transparent), 0 2px 8px rgba(0,0,0,0.3)'
              : '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: dot,
              height: dot,
              background: isSelected ? 'var(--th-secondary-hover)' : 'var(--th-surface)',
            }}
          />
        </div>
        {isSelected && (
          <div className="mt-1 px-2 py-0.5 bg-white rounded-md text-xs font-medium text-gray-900 shadow-sm border border-gray-200 max-w-[160px] truncate font-sans">
            {pin.title}
          </div>
        )}
      </div>
    </AdvancedMarker>
  );
}

function UserLocationDot({ position }: { position: Loc }) {
  return (
    <AdvancedMarker position={position} zIndex={20}>
      <div className="relative flex items-center justify-center">
        <div className="absolute w-10 h-10 rounded-full animate-ping" style={{ background: 'rgba(66,133,244,0.2)' }} />
        <div className="absolute w-6 h-6 rounded-full" style={{ background: 'rgba(66,133,244,0.12)' }} />
        <div className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md" style={{ background: '#4285F4' }} />
      </div>
    </AdvancedMarker>
  );
}

function LocateButton({
  following,
  onToggleFollow,
  tourLocs,
}: {
  following: boolean;
  onToggleFollow: () => void;
  tourLocs: Loc[];
}) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (following) { onToggleFollow(); return; }
    if (!navigator.geolocation || !map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        fitToNearestTourPin(map as MapInstance, userPos, tourLocs);
        setLocating(false);
        onToggleFollow();
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-4 left-4 z-10 w-10 h-10 rounded-full shadow-lg flex items-center justify-center"
      style={{ background: following ? '#4285F4' : '#fff' }}
      title={following ? 'Stop following' : 'Find my location'}
    >
      {locating ? (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill={following ? '#fff' : 'none'} stroke={following ? '#fff' : '#4285F4'} strokeWidth="2.5">
          <polygon points="12,2 19,21 12,17 5,21" />
        </svg>
      )}
    </button>
  );
}

function UserLocationTracker({ following, mapActive, onLocationUpdate }: { following: boolean; mapActive: boolean; onLocationUpdate: (pos: Loc | null) => void }) {
  const map = useMap();

  // `mapActive` is a dep so the watch is torn down and re-created when the map is
  // (re-)shown — that fresh watch picks up permission granted late (after the first
  // tap primed it), which a watch started before the grant would never do.
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocationUpdate(loc);
        if (following && map) map.panTo(loc);
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 3000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [onLocationUpdate, following, map, mapActive]);

  return null;
}

/** Keeps the GPS "on" whenever the map is shown to the explorer — the exploration
 *  phase AND the FIND "Find on map" peek. Each time it becomes visible it acquires
 *  the user's location so the dot appears without pressing the locate button (the
 *  one-shot initial fetch on mount otherwise left later views blank). It only sets
 *  the location — the map's own centring (MapZoomer / flyTarget) is left alone —
 *  and the always-on UserLocationTracker then keeps the dot updated. */
function MapAutoLocate({ active, onLocationUpdate }: { active: boolean; onLocationUpdate: (pos: Loc | null) => void }) {
  const handled = useRef(false); // acquired once for the current visible period

  useEffect(() => {
    if (!active) { handled.current = false; return; } // reset so re-showing re-acquires
    if (handled.current || !navigator.geolocation) return;
    handled.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => onLocationUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { handled.current = false; }, // reset so a later show retries if this failed
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [active, onLocationUpdate]);

  return null;
}

/** Applies/removes POI + transit styles at runtime via setOptions (works with mapId). */
function PoiStyler({ isTourActive }: { isTourActive: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map as any).setOptions({
      styles: isTourActive
        ? [
            { featureType: 'poi',     stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ]
        : [],
    });
  }, [map, isTourActive]);
  return null;
}

/** Imperatively applies the map tilt for the chosen map type (45° for 3D, flat
 *  otherwise). Only fires when the desired tilt changes, so two-finger gesture
 *  tilting within a mode isn't fought. */
function TiltController({ tilt }: { tilt: number }) {
  const map = useMap();
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (map) (map as any).setTilt?.(tilt);
  }, [map, tilt]);
  return null;
}

/** Runs once on mount: gets user location and fits the map to show user + nearest tour pin. */
function MapInitializer({
  tourPins,
  onLocationUpdate,
}: {
  tourPins?: TourPinData[];
  onLocationUpdate: (pos: Loc | null) => void;
}) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !map || !navigator.geolocation) return;
    initialized.current = true;

    const tourLocs = (tourPins ?? []).filter((tp) => tp.tour.location).map((tp) => tp.tour.location!);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onLocationUpdate(userPos);
        fitToNearestTourPin(map as MapInstance, userPos, tourLocs);
      },
      () => onLocationUpdate(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [map, tourPins, onLocationUpdate]);

  return null;
}

/**
 * Re-centres the map on the user at the tour's configured zoom level every
 * time the explorer (re-)enters the unstructured map phase — i.e. on the
 * initial entry AND on every return from a stop. Previously this used a
 * one-shot ref, which meant the zoom level only got reset on first mount
 * and would persist whatever the in-stop / flyer animations left behind.
 */
function MapZoomer({
  isUnstructuredMap,
  defaultZoom,
  userLocation,
}: {
  isUnstructuredMap: boolean;
  defaultZoom: number;
  userLocation: Loc | null;
}) {
  const map = useMap();
  const wasUnstructured = useRef(false);

  useEffect(() => {
    // Fire on every false→true transition. Subsequent userLocation
    // updates while already in the map phase don't re-zoom (the ref
    // stays true until we leave the phase).
    if (isUnstructuredMap && !wasUnstructured.current && map) {
      const target = userLocation || CHURCH_LOCATION;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyMap = map as any;
      anyMap.panTo(target);
      anyMap.setZoom(defaultZoom);
    }
    wasUnstructured.current = isUnstructuredMap;
  }, [isUnstructuredMap, map, userLocation, defaultZoom]);

  return null;
}

/**
 * Tracks the map's current viewport bounds and container size.
 * Calls onChange whenever the visible area changes.
 */
function BoundsTracker({
  onChange,
}: {
  onChange: (bounds: Bounds, size: ContainerSize) => void;
}) {
  const map = useMap();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMap = map as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;

    const update = () => {
      const b = anyMap.getBounds?.();
      const div = anyMap.getDiv?.();
      if (!b || !div) return;
      onChangeRef.current(
        {
          north: b.getNorthEast().lat(),
          south: b.getSouthWest().lat(),
          east:  b.getNorthEast().lng(),
          west:  b.getSouthWest().lng(),
        },
        { W: div.offsetWidth, H: div.offsetHeight }
      );
    };

    const listener = g?.maps?.event.addListener(anyMap, 'bounds_changed', update);
    update();
    return () => listener?.remove();
  }, [map]);

  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}


/**
 * Three-phase fly animation driven by requestAnimationFrame:
 *
 * Phase 1 — Pan (1 200 ms): smoothly moves the map centre from the
 *   current position to the selected stop, centring it on screen.
 * Phase 2 — Pause (500 ms): holds the view so the user can see the pin.
 * Phase 3 — Zoom out (1 200 ms): zooms out in place (stop stays centred)
 *   to the level where the user's location dot becomes visible on screen.
 */
function MapFlyer({
  flyTarget,
  onFlyComplete,
  defaultZoom,
}: {
  flyTarget: { stopLocation: Loc } | null;
  onFlyComplete: () => void;
  defaultZoom: number;
}) {
  const map = useMap();
  const prevTarget = useRef<{ stopLocation: Loc } | null>(null);
  const onFlyCompleteRef = useRef(onFlyComplete);
  onFlyCompleteRef.current = onFlyComplete;
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!flyTarget || !map || flyTarget === prevTarget.current) return;
    prevTarget.current = flyTarget;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMap = map as any;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Small delay so the gallery close animation finishes before we start.
    timerRef.current = setTimeout(() => {
      const startLat: number = anyMap.getCenter().lat();
      const startLng: number = anyMap.getCenter().lng();
      const startZoom: number = anyMap.getZoom() ?? 17;
      const { lat: stopLat, lng: stopLng } = flyTarget.stopLocation;

      // End the flyer at the tour's configured default zoom so the
      // explorer always lands at the same zoom regardless of whether
      // they came from the map, a stop, or the gallery. Previously this
      // computed a "fit user and stop" zoom that left them slightly
      // further out than the default.
      const fitZoom = defaultZoom;

      const PAN_MS  = 900;
      const ZOOM_MS = 1400;

      // ── Phase 1: pan to stop ──────────────────────────────────────
      let panStart = 0;
      function phase1(now: number) {
        if (!panStart) panStart = now;
        const t = Math.min((now - panStart) / PAN_MS, 1);
        const e = easeInOutCubic(t);
        anyMap.setCenter({ lat: lerpNum(startLat, stopLat, e), lng: lerpNum(startLng, stopLng, e) });
        if (t < 1) {
          rafRef.current = requestAnimationFrame(phase1);
        } else {
          // ── Phase 2: pause 400 ms ─────────────────────────────────
          timerRef.current = setTimeout(() => {
            // ── Phase 3: zoom out in place ────────────────────────────
            let zoomStart = 0;
            function phase3(now: number) {
              if (!zoomStart) zoomStart = now;
              const t = Math.min((now - zoomStart) / ZOOM_MS, 1);
              const e = easeInOutCubic(t);
              anyMap.setZoom(lerpNum(startZoom, fitZoom, e));
              if (t < 1) {
                rafRef.current = requestAnimationFrame(phase3);
              } else {
                onFlyCompleteRef.current();
              }
            }
            rafRef.current = requestAnimationFrame(phase3);
          }, 400);
        }
      }
      rafRef.current = requestAnimationFrame(phase1);
    }, 120);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [flyTarget, map]);

  return null;
}

const GLYPH_MASK = {
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
} as const;

function LogoGlyph({ height }: { height: number }) {
  return (
    <div style={{ position: 'relative', width: height * PIN_ASPECT, height }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#fff',
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

function BubbleGlyph({ height }: { height: number }) {
  return (
    <div
      style={{
        width: height * BUBBLE_ASPECT,
        height,
        background: '#fff',
        WebkitMaskImage: 'url(/pin-glyph-bubble.png)',
        maskImage: 'url(/pin-glyph-bubble.png)',
        ...GLYPH_MASK,
      }}
    />
  );
}

function DiscMarker({
  diameter,
  glyph,
  ring = false,
  ringColor = 'var(--th-primary)',
  badge,
  dim = false,
}: {
  diameter: number;
  glyph: ReactNode;
  ring?: boolean;
  ringColor?: string;
  badge?: { text?: string; check?: boolean };
  dim?: boolean;
}) {
  const border = Math.max(2, Math.round(diameter * 0.06));
  const bs = Math.max(16, Math.round(diameter * 0.46));
  return (
    <div
      style={{
        position: 'relative',
        width: diameter,
        height: diameter,
        opacity: dim ? 0.5 : 1,
        transition: 'width 0.18s ease, height 0.18s ease, opacity 0.18s ease',
      }}
    >
      {ring && (
        <div
          className="absolute"
          style={{
            width: diameter * 1.4,
            height: diameter * 1.4,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ background: ringColor, opacity: 0.4 }}
          />
        </div>
      )}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center"
        style={{
          background: 'var(--th-primary)',
          border: `${border}px solid #fff`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}
      >
        {glyph}
      </div>
      {badge && (
        <div
          className="font-sans"
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: bs,
            height: bs,
            padding: '0 3px',
            borderRadius: 999,
            background: '#fff',
            border: '1.5px solid var(--th-primary)',
            color: 'var(--th-primary)',
            fontSize: Math.max(9, Math.round(bs * 0.56)),
            fontWeight: 800,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        >
          {badge.check ? (
            <svg
              width={Math.round(bs * 0.6)}
              height={Math.round(bs * 0.6)}
              viewBox="0 0 12 12"
              fill="none"
              stroke="var(--th-primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="2 6 5 9 10 3" />
            </svg>
          ) : (
            badge.text
          )}
        </div>
      )}
    </div>
  );
}

function TourParentPin({ tour, onClick }: { tour: Tour; onClick: () => void }) {
  if (!tour.location) return null;
  const D = 60;
  return (
    <AdvancedMarker position={tour.location} onClick={onClick} zIndex={5}>
      <div
        className="flex flex-col items-center cursor-pointer"
        style={{ transform: `translateY(calc(50% - ${D / 2}px))` }}
      >
        <DiscMarker diameter={D} ring glyph={<LogoGlyph height={D * 0.66} />} />
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <div className="px-3 py-1 bg-white rounded-lg text-sm font-semibold text-gray-900 shadow-md border border-gray-200 max-w-[200px] text-center font-sans leading-snug">
            {tour.title}
          </div>
          <div
            className="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide font-sans shadow-md"
            style={{ background: 'var(--th-primary)', color: 'var(--th-surface)' }}
          >
            Tap to start
          </div>
        </div>
      </div>
    </AdvancedMarker>
  );
}

function TourStopPin({ data, onClick }: { data: TourStopMarkerData; onClick: () => void }) {
  if (!data.stop.location) return null;

  if (data.unstructuredMode) {
    // Sizes
    //   main-map standalone / cluster leader → 42 (unified)
    //   mini-map next sub-stop → 56 + animated ring (the "flashing" cue)
    //   mini-map completed → 28, dim, check badge
    //   mini-map locked → 30, normal colour, clickable (overlay tells the
    //     explorer to finish prior stops; button pans them to the next pin).
    //     Locked pins keep their small size and no ring even when selected,
    //     so taps don't visually promote them above the flashing next pin.
    const D = data.isLockedInGroup
      ? 30
      : data.isNextInGroup
        ? 56
        : data.isSelectedOverlay
          ? 50
          : data.isCompleted
            ? 28
            : 42;
    const ring = !data.isLockedInGroup && (data.isNextInGroup || data.isSelectedOverlay);
    const zIndex = data.isNextInGroup ? 11 : data.isLockedInGroup ? 2 : data.isSelectedOverlay ? 10 : data.isGroupLeader ? 6 : data.isCompleted ? 1 : 5;
    const badge = data.isCompleted
      ? { check: true }
      : data.isGroupLeader && data.subStopCount
        ? { text: String(data.subStopCount) }
        : undefined;
    return (
      <AdvancedMarker
        position={data.stop.location}
        onClick={onClick}
        zIndex={zIndex}
      >
        <div className="flex flex-col items-center" style={{ transform: `translateY(calc(50% - ${D / 2}px))` }}>
          <DiscMarker
            diameter={D}
            ring={ring}
            ringColor="#F59E0B"
            dim={data.isCompleted}
            badge={badge}
            glyph={<BubbleGlyph height={D * 0.56} />}
          />
        </div>
      </AdvancedMarker>
    );
  }

  const D = data.isActive ? 40 : 32;
  // Linear pins: no index number. Number badges are reserved for
  // cluster sub-stop counts; a stand-alone pin's "position in the
  // sequence" is implied by walking the tour, not stamped on the map.
  // Completed stops still get a check badge so explorers can read
  // their own progress at a glance.
  const badge = data.isCompleted && !data.isActive ? { check: true } : undefined;
  return (
    <AdvancedMarker
      position={data.stop.location}
      onClick={onClick}
      zIndex={data.isActive ? 10 : 2}
    >
      <div className="flex flex-col items-center" style={{ transform: `translateY(calc(50% - ${D / 2}px))` }}>
        <DiscMarker
          diameter={D}
          ring={data.isActive}
          dim={data.isCompleted && !data.isActive}
          badge={badge}
          glyph={<BubbleGlyph height={D * 0.56} />}
        />
      </div>
    </AdvancedMarker>
  );
}

/**
 * After a stop overlay card appears, pans the map so the selected stop pin
 * and user location dot are both above the overlay card. Uses Mercator math
 * to calculate actual screen positions rather than a fixed offset.
 * Defers until any fly animation finishes. Resets when overlay is dismissed.
 */
function OverlayAwarePanner({
  tourStops,
  flyTarget,
}: {
  tourStops?: TourStopMarkerData[];
  flyTarget?: { stopLocation: Loc } | null;
}) {
  const map = useMap();
  const pannedForRef = useRef<string | null>(null);

  const selected = tourStops?.find(ts => ts.isSelectedOverlay) ?? null;
  const selectedId = selected?.stop.id ?? null;
  const isAnimating = !!flyTarget;

  useEffect(() => {
    if (!selectedId) { pannedForRef.current = null; return; }
    if (!map || isAnimating || pannedForRef.current === selectedId) return;
    if (!selected?.stop.location) return;
    pannedForRef.current = selectedId;
    const stopLoc = selected.stop.location;

    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyMap = map as any;
      const div = anyMap.getDiv?.();
      if (!div) return;
      const H: number = div.offsetHeight;
      const zoom: number = anyMap.getZoom() ?? 17;
      const center = anyMap.getCenter();
      const toMerc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
      const scale = 256 * Math.pow(2, zoom);
      const screenY = (lat: number) =>
        H / 2 - (toMerc(lat) - toMerc(center.lat())) * scale / (2 * Math.PI);

      // Overlay card: ~260px tall, anchored bottom-16 (64px) from bottom
      const overlayTop = H - 340;
      const stopY = screenY(stopLoc.lat);

      // Only lift the stop pin above the overlay — including the user location
      // dot causes excessive panning at high zoom (user can be 300+ px below).
      // Cap at 180px so no pin can fly off the top of the screen.
      if (stopY > overlayTop - 20) {
        anyMap.panBy(0, Math.min(stopY - overlayTop + 40, 180));
      }
    }, 150);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selectedId, isAnimating]);

  return null;
}

// ─── Off-screen direction arrows ────────────────────────────────────────────

const SECTOR_ANGLES_DEG = [0, 45, 90, 135, 180, -135, -90, -45];

function computeOffScreenArrows(
  tourStops: TourStopMarkerData[],
  bounds: Bounds,
  size: ContainerSize,
): Array<{ angleDeg: number; edgeX: number; edgeY: number; count: number }> {
  const { north, south, east, west } = bounds;
  const { W, H } = size;
  const cLat = (north + south) / 2;
  const cLng = (east + west) / 2;
  const lngSpan = east - west || 0.001;
  const latSpan = north - south || 0.001;

  // Sector counts indexed by SECTOR_ANGLES_DEG
  const counts = new Array(8).fill(0);

  for (const ts of tourStops) {
    // Skip completed stops — pointing the group at pins they've
    // already done would mislead them into thinking there's still
    // something to find in that direction.
    if (ts.isCompleted) continue;
    const loc = ts.stop.location;
    if (!loc) continue;
    // Is this stop outside the current viewport?
    if (loc.lat >= south && loc.lat <= north && loc.lng >= west && loc.lng <= east) continue;

    // Screen delta from center
    const sdx = (loc.lng - cLng) / lngSpan * W;
    const sdy = -(loc.lat - cLat) / latSpan * H; // negative: lat up = screen y down

    // Angle from up, clockwise (degrees)
    const angleDeg = Math.atan2(sdx, -sdy) * (180 / Math.PI);

    // Find nearest sector
    let bestSector = 0;
    let bestDiff = Infinity;
    for (let i = 0; i < SECTOR_ANGLES_DEG.length; i++) {
      let diff = Math.abs(angleDeg - SECTOR_ANGLES_DEG[i]);
      if (diff > 180) diff = 360 - diff;
      if (diff < bestDiff) { bestDiff = diff; bestSector = i; }
    }
    counts[bestSector]++;
  }

  const margin = ARROW_SIZE / 2 + 12;
  const halfW = W / 2;
  const halfH = H / 2;

  return SECTOR_ANGLES_DEG.flatMap((deg, i) => {
    if (counts[i] === 0) return [];
    const rad = deg * (Math.PI / 180);
    // Direction vector in screen space (from up, clockwise)
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);

    // t to hit the inner rectangle (W - 2*margin) × (H - 2*margin)
    const tX = Math.abs(dx) > 1e-6 ? (halfW - margin) / Math.abs(dx) : Infinity;
    const tY = Math.abs(dy) > 1e-6 ? (halfH - margin) / Math.abs(dy) : Infinity;
    const t = Math.min(tX, tY);

    return [{ angleDeg: deg, edgeX: halfW + dx * t, edgeY: halfH + dy * t, count: counts[i] }];
  });
}

// Arrow SVG pointing upward (tip at top). Rotated per angleDeg.
function DirectionArrow({ angleDeg, edgeX, edgeY, count }: { angleDeg: number; edgeX: number; edgeY: number; count: number }) {
  const half = ARROW_SIZE / 2;
  return (
    <div
      className="absolute pointer-events-none animate-pulse"
      style={{
        left: edgeX - half,
        top: edgeY - half,
        width: ARROW_SIZE,
        height: ARROW_SIZE,
        transform: `rotate(${angleDeg}deg)`,
      }}
    >
      <svg width={ARROW_SIZE} height={ARROW_SIZE} viewBox="0 0 36 36" fill="none">
        {/* Drop shadow */}
        <path d="M18 3 L31 30 L18 23 L5 30 Z" fill="rgba(0,0,0,0.35)" transform="translate(0,2)" />
        {/* Arrow body */}
        <path d="M18 3 L31 30 L18 23 L5 30 Z" fill="#F59E0B" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      {count > 1 && (
        <div
          className="absolute font-sans font-bold"
          style={{
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            borderRadius: 999,
            background: 'white',
            color: '#B45309',
            fontSize: 9,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            // Counter-rotate so the badge text stays upright
            transform: `rotate(${-angleDeg}deg)`,
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}

// ─── Main container ──────────────────────────────────────────────────────────

export default function MapContainer({
  pins,
  selectedPinId,
  onPinSelect,
  tourPins,
  onTourPinSelect,
  tourStops,
  onTourStopSelect,
  hidePins,
  tourDefaultZoom,
  isUnstructuredMap,
  mapPeek,
  flyTarget,
  onFlyComplete,
  isTourActive,
}: MapProps) {
  const [userLocation, setUserLocation] = useState<Loc | null>(null);
  const [following, setFollowing] = useState(false);
  // Map type: 3D (tilted satellite) is the default; flat satellite; or plain map.
  const [mapType, setMapType] = useState<'3d' | 'satellite' | 'default'>('3d');
  const [mapMenuOpen, setMapMenuOpen] = useState(false);
  const [navPrompt, setNavPrompt] = useState<{ tour: Tour; distanceM: number } | null>(null);
  const [mapBounds, setMapBounds] = useState<Bounds | null>(null);
  const [containerSize, setContainerSize] = useState<ContainerSize>({ W: window?.innerWidth ?? 400, H: window?.innerHeight ?? 600 });

  const handleLocationUpdate = useCallback((pos: Loc | null) => setUserLocation(pos), []);
  const handleBoundsChange = useCallback((b: Bounds, s: ContainerSize) => {
    setMapBounds(b);
    setContainerSize(s);
  }, []);

  // Google calls this global when it rejects the Maps key (bad/absent key,
  // HTTP-referrer restriction that doesn't allow this site, billing disabled, or
  // the Maps JavaScript API not enabled). Surface a clear, actionable message
  // instead of only Google's grey "This page can't load Google Maps correctly."
  const [authFailed, setAuthFailed] = useState(false);
  useEffect(() => {
    const w = window as unknown as { gm_authFailure?: () => void };
    const prev = w.gm_authFailure;
    w.gm_authFailure = () => setAuthFailed(true);
    return () => { w.gm_authFailure = prev; };
  }, []);

  const tourLocs = (tourPins ?? []).filter((tp) => tp.tour.location).map((tp) => tp.tour.location!);

  function handleTourPinClick(tour: Tour) {
    if (userLocation && tour.location) {
      const distM = haversineDistanceM(userLocation, tour.location);
      if (distM > NEAR_THRESHOLD_M) {
        setNavPrompt({ tour, distanceM: distM });
        return;
      }
    }
    onTourPinSelect?.(tour);
  }

  // Compute off-screen arrows for unstructured map phase
  const offScreenArrows =
    isUnstructuredMap && mapBounds && tourStops
      ? computeOffScreenArrows(tourStops, mapBounds, containerSize)
      : [];

  const MAP_TYPES = {
    '3d':        { id: 'hybrid'  as const, tilt: 45, label: '3D' },
    'satellite': { id: 'hybrid'  as const, tilt: 0,  label: 'Satellite' },
    'default':   { id: 'roadmap' as const, tilt: 0,  label: 'Map' },
  };
  const mapTypeId = MAP_TYPES[mapType].id;
  const mapTilt = MAP_TYPES[mapType].tilt;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return <div className="w-full h-full flex items-center justify-center bg-cream-dark text-text-muted text-sm font-sans">Map requires API key</div>;

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative w-full h-full">
        {authFailed && (
          <div className="absolute inset-0 z-[40] flex items-center justify-center p-6 text-center font-sans" style={{ backgroundColor: 'var(--th-surface)' }}>
            <div className="max-w-xs">
              <p className="font-semibold text-text-primary">Map couldn&rsquo;t load</p>
              <p className="mt-1.5 text-sm text-text-secondary leading-snug">
                Google rejected the Maps key. In Google Cloud, check that this site is in the key&rsquo;s allowed referrers, the Maps JavaScript API is enabled, and billing is active.
              </p>
            </div>
          </div>
        )}
        <GoogleMap
          mapId="b8f339c02d8c7d5bd3f12d1b"
          defaultCenter={CHURCH_LOCATION}
          defaultZoom={17}
          defaultTilt={45}
          defaultHeading={0}
          mapTypeId={mapTypeId}
          gestureHandling="greedy"
          disableDefaultUI={true}
          zoomControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={false}
          className="w-full h-full"
        >
          <PoiStyler isTourActive={!!isTourActive} />
          <TiltController tilt={mapTilt} />
          <MapInitializer tourPins={tourPins} onLocationUpdate={handleLocationUpdate} />
          <UserLocationTracker following={following} mapActive={!!isUnstructuredMap || !!mapPeek} onLocationUpdate={handleLocationUpdate} />
          <MapAutoLocate active={!!isUnstructuredMap || !!mapPeek} onLocationUpdate={handleLocationUpdate} />
          <BoundsTracker onChange={handleBoundsChange} />
          <MapZoomer
            isUnstructuredMap={!!isUnstructuredMap}
            defaultZoom={tourDefaultZoom ?? 17}
            userLocation={userLocation}
          />
          <MapFlyer
            flyTarget={flyTarget ?? null}
            onFlyComplete={onFlyComplete ?? (() => {})}
            defaultZoom={tourDefaultZoom ?? 17}
          />
          <OverlayAwarePanner tourStops={tourStops} flyTarget={flyTarget} />
          {userLocation && <UserLocationDot position={userLocation} />}
          {!hidePins && pins.map((pin) => (
            <PinMarker
              key={pin.id}
              pin={pin}
              isSelected={pin.id === selectedPinId}
              onClick={() => onPinSelect(pin)}
            />
          ))}
          {tourPins?.map((tp) => (
            <TourParentPin
              key={tp.tour.id}
              tour={tp.tour}
              onClick={() => handleTourPinClick(tp.tour)}
            />
          ))}
          {tourStops?.map((data) => (
            <TourStopPin
              key={data.stop.id}
              data={data}
              onClick={() => onTourStopSelect?.(data.stop)}
            />
          ))}
        </GoogleMap>

        {/* Off-screen direction arrows */}
        {offScreenArrows.map((arrow) => (
          <DirectionArrow key={arrow.angleDeg} {...arrow} />
        ))}

        <LocateButton
          following={following}
          onToggleFollow={() => setFollowing((f) => !f)}
          tourLocs={tourLocs}
        />

        {/* Map type menu — 3D (tilted) / Satellite (flat) / Map (roadmap) */}
        <div className="absolute bottom-4 right-4 z-10 flex flex-col items-end gap-1.5">
          {mapMenuOpen && (
            <div className="rounded-xl bg-white shadow-xl overflow-hidden font-sans animate-slide-up">
              {(['3d', 'satellite', 'default'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setMapType(t); setMapMenuOpen(false); }}
                  className="w-full flex items-center justify-between gap-4 px-4 py-2.5 text-sm font-semibold hover:bg-stone-100"
                  style={{ color: mapType === t ? 'var(--th-primary)' : '#3A3A32' }}
                >
                  {MAP_TYPES[t].label}
                  {mapType === t && <span>✓</span>}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setMapMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full shadow-lg text-xs font-semibold font-sans"
            style={{ background: '#fff', color: '#3A3A32' }}
            title="Change map type"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
            </svg>
            {MAP_TYPES[mapType].label}
          </button>
        </div>

        {navPrompt && navPrompt.tour.location && (
          <div
            className="absolute bottom-16 left-4 right-4 z-20 rounded-xl shadow-xl overflow-hidden animate-slide-up"
            style={{ background: 'var(--th-surface)' }}
          >
            <div className="p-4 space-y-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--th-text)' }}>
                {navPrompt.tour.title}
              </p>
              <p className="text-sm" style={{ color: 'var(--th-text-muted)' }}>
                You&apos;re {formatDist(navPrompt.distanceM)} away. Want directions to get there first?
              </p>
              <div className="flex gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${navPrompt.tour.location.lat},${navPrompt.tour.location.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-center"
                  style={{ background: 'var(--th-primary)', color: 'var(--th-surface)' }}
                >
                  Get directions
                </a>
                <button
                  onClick={() => { onTourPinSelect?.(navPrompt.tour); setNavPrompt(null); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold border-2"
                  style={{ borderColor: 'var(--th-border)', color: 'var(--th-text)' }}
                >
                  Start anyway
                </button>
              </div>
              <button
                onClick={() => setNavPrompt(null)}
                className="w-full text-xs py-1"
                style={{ color: 'var(--th-text-muted)' }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </APIProvider>
  );
}
