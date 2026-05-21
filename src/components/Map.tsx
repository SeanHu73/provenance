'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Pin, Stop, Tour } from '@/lib/types';

const MEMORIAL_CHURCH = { lat: 37.42700, lng: -122.17015 };
const MAX_AUTO_ZOOM = 17;
const NEAR_THRESHOLD_M = 300;
const SHOW_PIN_RADIUS_M = 8047; // 5 miles

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
}

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
 *
 * When the user is close (< 0.4 mi) drift = 0: user is exactly at center,
 * the zoom is chosen to put the pin 10% from the edge.
 *
 * When the user is farther away the map would have to zoom out a lot to keep
 * them at center. Instead we allow the user's dot to drift off-center (up to
 * 40% of screen from center at 0.8 mi+) so the zoom stays tighter. The pin
 * always stays at 10% from its nearest edge.
 *
 * Implemented via asymmetric fitBounds padding:
 *   user's side  → (50% − drift%) padding → places user at (drift%) from center
 *   pin's side   → 10% padding            → places pin at 10% from edge
 */
function fitToNearestTourPin(map: MapInstance, userPos: Loc, tourLocs: Loc[]) {
  if (!map) return;
  const target =
    tourLocs.length > 0
      ? tourLocs.reduce((best, loc) =>
          haversineDistanceM(userPos, loc) < haversineDistanceM(userPos, best) ? loc : best
        )
      : MEMORIAL_CHURCH;

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

  const DRIFT_START_M = 643.7; // 0.4 miles
  const MAX_DRIFT     = 0.25;  // user can shift at most 25% from center
  const PIN_EDGE      = 0.10;  // pin stays 10% from its nearest edge

  // Drift grows linearly from 0 at DRIFT_START_M to MAX_DRIFT at 2×DRIFT_START_M
  const drift = distM < DRIFT_START_M
    ? 0
    : Math.min(MAX_DRIFT, ((distM - DRIFT_START_M) / DRIFT_START_M) * MAX_DRIFT);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyMap = map as any;
  const mapDiv = anyMap.getDiv?.();
  const W = mapDiv?.offsetWidth  || window.innerWidth;
  const H = mapDiv?.offsetHeight || window.innerHeight;

  // User's side: (50%−drift%) keeps user at center when drift=0,
  // shifts them toward their edge as drift grows.
  const userPad = 0.5 - drift;

  // Asymmetric padding: pin's side is always PIN_EDGE, user's side is userPad.
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

  // Cap zoom in case the pin is very close
  g.maps.event.addListenerOnce(anyMap, 'idle', () => {
    const z = anyMap.getZoom?.();
    if (typeof z === 'number' && z > MAX_AUTO_ZOOM) anyMap.setZoom(MAX_AUTO_ZOOM);
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

function UserLocationTracker({ following, onLocationUpdate }: { following: boolean; onLocationUpdate: (pos: Loc | null) => void }) {
  const map = useMap();

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
  }, [onLocationUpdate, following, map]);

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

function TourParentPin({ tour, onClick }: { tour: Tour; onClick: () => void }) {
  if (!tour.location) return null;
  const size = 60;
  return (
    <AdvancedMarker position={tour.location} onClick={onClick} zIndex={5}>
      {/*
        translateY(calc(50% - 30px)) shifts the element down until the circle
        centre (30px from the element top) aligns with the geographic position,
        so the label always hangs below the pin and into the screen rather than
        behind/above it.
      */}
      <div
        className="flex flex-col items-center cursor-pointer"
        style={{ transform: 'translateY(calc(50% - 30px))' }}
      >
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <span
            className="absolute inline-flex h-full w-full rounded-full animate-ping"
            style={{ background: 'var(--th-primary)', opacity: 0.4 }}
          />
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: size,
              height: size,
              background: 'var(--th-primary)',
              border: '3px solid var(--th-surface-alt)',
              boxShadow: '0 0 0 3px color-mix(in srgb, var(--th-primary) 30%, transparent), 0 4px 12px rgba(0,0,0,0.35)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--th-surface-alt)" stroke="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"/>
            </svg>
          </div>
        </div>
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

  // Unstructured mode rendering
  if (data.unstructuredMode) {
    const baseSize = 36;
    const size = data.isCompleted
      ? Math.round(baseSize * 0.85)      // slightly smaller when done but still visible
      : data.isSelectedOverlay
        ? Math.round(baseSize * 1.5)     // larger when selected
        : baseSize;
    const displayTitle = data.stop.mergeGroup || data.stop.title;

    // Completed pin: use a muted version of the surface-alt color so it reads as "done"
    const completedBg = 'color-mix(in srgb, var(--th-primary) 22%, white)';

    return (
      <AdvancedMarker
        position={data.stop.location}
        onClick={onClick}
        zIndex={data.isSelectedOverlay ? 10 : data.isCompleted ? 1 : 5}
      >
        <div className="flex flex-col items-center" style={{ transform: 'translateY(calc(50% - 18px))' }}>
          <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            {/* Pulsing ring — only for selected, sits behind the circle */}
            {data.isSelectedOverlay && (
              <span
                className="absolute inline-flex rounded-full animate-ping"
                style={{
                  width: size + 18,
                  height: size + 18,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: '#F59E0B',
                  opacity: 0.45,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* Pin circle */}
            <div
              className="flex items-center justify-center rounded-full shadow-md transition-all duration-200 w-full h-full"
              style={{
                background: data.isCompleted
                  ? completedBg
                  : data.isSelectedOverlay
                    ? '#F59E0B'
                    : 'var(--th-primary)',
                border: data.isSelectedOverlay
                  ? '3px solid rgba(255,255,255,0.95)'
                  : data.isCompleted
                    ? '2px solid rgba(255,255,255,0.8)'
                    : '2px solid rgba(255,255,255,0.7)',
                boxShadow: data.isSelectedOverlay
                  ? '0 0 0 3px rgba(245,158,11,0.3), 0 4px 14px rgba(0,0,0,0.4)'
                  : '0 2px 6px rgba(0,0,0,0.3)',
              }}
            >
              {data.isCompleted ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--th-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="2 6 5 9 10 3" />
                </svg>
              ) : (
                <div className="w-2 h-2 rounded-full bg-white opacity-90" />
              )}
            </div>
          </div>

          {/* Title label — show for selected and incomplete pins */}
          {!data.isCompleted && displayTitle && (
            <div className="mt-1 px-2 py-0.5 bg-white rounded-md text-[9px] font-semibold text-gray-800 shadow-sm max-w-[110px] text-center leading-tight truncate">
              {displayTitle}
            </div>
          )}
        </div>
      </AdvancedMarker>
    );
  }

  // Linear mode rendering (unchanged)
  const size = data.isActive ? 40 : 32;
  return (
    <AdvancedMarker
      position={data.stop.location}
      onClick={onClick}
      zIndex={data.isActive ? 10 : 2}
    >
      <div className="flex flex-col items-center">
        <div
          className="flex items-center justify-center rounded-full shadow-md transition-all duration-200"
          style={{
            width: size,
            height: size,
            background: data.isCompleted ? 'var(--th-olive)' : 'var(--th-primary)',
            border: `3px solid ${data.isActive ? 'var(--th-surface)' : 'var(--th-surface-alt)'}`,
            boxShadow: data.isActive
              ? '0 0 0 3px color-mix(in srgb, var(--th-primary) 30%, transparent), 0 2px 8px rgba(0,0,0,0.3)'
              : '0 2px 6px rgba(0,0,0,0.25)',
            opacity: data.isCompleted && !data.isActive ? 0.7 : 1,
          }}
        >
          <span className="text-[11px] font-bold text-white">{data.index + 1}</span>
        </div>
      </div>
    </AdvancedMarker>
  );
}

export default function MapContainer({ pins, selectedPinId, onPinSelect, tourPins, onTourPinSelect, tourStops, onTourStopSelect, hidePins }: MapProps) {
  const [userLocation, setUserLocation] = useState<Loc | null>(null);
  const [following, setFollowing] = useState(false);
  const [navPrompt, setNavPrompt] = useState<{ tour: Tour; distanceM: number } | null>(null);

  const handleLocationUpdate = useCallback((pos: Loc | null) => setUserLocation(pos), []);

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

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return <div className="w-full h-full flex items-center justify-center bg-cream-dark text-text-muted text-sm font-sans">Map requires API key</div>;

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative w-full h-full">
        <GoogleMap
          mapId="memorial-church-map"
          defaultCenter={MEMORIAL_CHURCH}
          defaultZoom={17}
          defaultTilt={45}
          defaultHeading={0}
          mapTypeId="hybrid"
          gestureHandling="greedy"
          disableDefaultUI={false}
          zoomControl={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={true}
          className="w-full h-full"
        >
          <MapInitializer tourPins={tourPins} onLocationUpdate={handleLocationUpdate} />
          <UserLocationTracker following={following} onLocationUpdate={handleLocationUpdate} />
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

        <LocateButton
          following={following}
          onToggleFollow={() => setFollowing((f) => !f)}
          tourLocs={tourLocs}
        />

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
