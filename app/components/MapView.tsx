"use client";

import { useState, useEffect, useCallback } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Pin, TYPE_ICONS, TYPE_COLORS } from "../lib/types";

interface MapViewProps {
  pins: Pin[];
  selectedPin: Pin | null;
  highlightedPinIds: Set<string>;
  onPinClick: (pin: Pin) => void;
}

function PinMarker({
  pin,
  isSelected,
  isHighlighted,
  onClick,
}: {
  pin: Pin;
  isSelected: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const color = TYPE_COLORS[pin.type];
  const glowing = isHighlighted && !isSelected;
  return (
    <AdvancedMarker
      position={{ lat: pin.lat, lng: pin.lng }}
      onClick={onClick}
      zIndex={isSelected ? 10 : isHighlighted ? 5 : 1}
    >
      <div className="flex flex-col items-center">
        <div
          className="flex items-center justify-center rounded-full shadow-md transition-transform"
          style={{
            width: isSelected ? 44 : glowing ? 40 : 36,
            height: isSelected ? 44 : glowing ? 40 : 36,
            background: isSelected ? color : "#fff",
            border: `2.5px solid ${color}`,
            boxShadow: glowing
              ? `0 0 0 3px ${color}40, 0 2px 8px rgba(0,0,0,0.2)`
              : undefined,
          }}
        >
          <span
            className="leading-none"
            style={{ fontSize: isSelected ? 20 : glowing ? 18 : 16 }}
          >
            {TYPE_ICONS[pin.type]}
          </span>
        </div>
        {(isSelected || glowing) && (
          <div className="mt-1 px-2 py-0.5 bg-white rounded-md text-xs font-medium text-gray-900 shadow-sm border border-gray-200 max-w-[140px] truncate">
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
        {/* Pulsing ring */}
        <div
          className="absolute w-10 h-10 rounded-full animate-ping"
          style={{ background: "rgba(66, 133, 244, 0.2)" }}
        />
        {/* Accuracy circle */}
        <div
          className="absolute w-6 h-6 rounded-full"
          style={{ background: "rgba(66, 133, 244, 0.12)" }}
        />
        {/* Dot */}
        <div
          className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-md"
          style={{ background: "#4285F4" }}
        />
      </div>
    </AdvancedMarker>
  );
}

function LocateButton({
  following,
  onToggleFollow,
}: {
  following: boolean;
  onToggleFollow: () => void;
}) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (following) {
      // Already following — turn it off
      onToggleFollow();
      return;
    }

    if (!navigator.geolocation || !map) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.panTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        // Zoom 19 ≈ ~100 yards across — street-level for place-based discovery
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
      style={{
        background: following ? "#4285F4" : "#fff",
      }}
      title={following ? "Stop following" : "Follow my location"}
    >
      {locating ? (
        <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill={following ? "#fff" : "none"}
          stroke={following ? "#fff" : "#4285F4"}
          strokeWidth="2.5"
        >
          <polygon points="12,2 19,21 12,17 5,21" />
        </svg>
      )}
    </button>
  );
}

function UserLocationTracker({
  following,
  onLocationUpdate,
}: {
  following: boolean;
  onLocationUpdate: (pos: { lat: number; lng: number } | null) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        onLocationUpdate(loc);
        if (following && map) {
          map.panTo(loc);
        }
      },
      () => {
        // Permission denied or error — no dot shown
      },
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onLocationUpdate, following, map]);

  return null;
}

export default function MapView({
  pins,
  selectedPin,
  highlightedPinIds,
  onPinClick,
}: MapViewProps) {
  const mapId = "provenance-map";
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [following, setFollowing] = useState(false);

  const handleLocationUpdate = useCallback(
    (pos: { lat: number; lng: number } | null) => setUserLocation(pos),
    []
  );

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <div className="relative w-full h-full">
        <Map
          mapId={mapId}
          defaultCenter={{ lat: 37.4275, lng: -122.17 }}
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

          {pins.map((pin) => (
            <PinMarker
              key={pin.id}
              pin={pin}
              isSelected={selectedPin?.id === pin.id}
              isHighlighted={highlightedPinIds.has(pin.id)}
              onClick={() => onPinClick(pin)}
            />
          ))}
        </Map>

        <LocateButton
          following={following}
          onToggleFollow={() => setFollowing((f) => !f)}
        />
      </div>
    </APIProvider>
  );
}
