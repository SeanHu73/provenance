'use client';

import { useState, useEffect, useCallback } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Pin, Stop, Tour } from '@/lib/types';

const MEMORIAL_CHURCH = { lat: 37.42700, lng: -122.17015 };

export interface TourPinData {
  tour: Tour;
}

export interface TourStopMarkerData {
  stop: Stop;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
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

function UserLocationDot({ position }: { position: { lat: number; lng: number } }) {
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

function LocateButton({ following, onToggleFollow }: { following: boolean; onToggleFollow: () => void }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (following) { onToggleFollow(); return; }
    if (!navigator.geolocation || !map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        map.setZoom(19);
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

function UserLocationTracker({ following, onLocationUpdate }: { following: boolean; onLocationUpdate: (pos: { lat: number; lng: number } | null) => void }) {
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

function TourParentPin({ tour, onClick }: { tour: Tour; onClick: () => void }) {
  if (!tour.location) return null;
  const size = 60;
  return (
    <AdvancedMarker position={tour.location} onClick={onClick} zIndex={5}>
      <div className="flex flex-col items-center cursor-pointer">
        {/* Pin with an attention-drawing pulse */}
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          {/* Pulsing ring — "tap me" cue */}
          <span
            className="absolute inline-flex h-full w-full rounded-full animate-ping"
            style={{ background: 'var(--th-primary)', opacity: 0.4 }}
          />
          {/* Pin body */}
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
        {/* Tour title + tap-to-start cue */}
        <div className="mt-1.5 flex flex-col items-center gap-1">
          <div className="px-2.5 py-0.5 bg-white rounded-md text-xs font-semibold text-gray-900 shadow-sm border border-gray-200 max-w-[180px] truncate font-sans">
            {tour.title}
          </div>
          <div
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide font-sans shadow-sm"
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
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [following, setFollowing] = useState(false);

  const handleLocationUpdate = useCallback(
    (pos: { lat: number; lng: number } | null) => setUserLocation(pos),
    []
  );

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return <div className="w-full h-full flex items-center justify-center bg-cream-dark text-text-muted text-sm font-sans">Map requires API key</div>;

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative w-full h-full">
        <GoogleMap
          mapId="memorial-church-map"
          defaultCenter={MEMORIAL_CHURCH}
          defaultZoom={16}
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
              onClick={() => onTourPinSelect?.(tp.tour)}
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

        <LocateButton following={following} onToggleFollow={() => setFollowing((f) => !f)} />
      </div>
    </APIProvider>
  );
}
