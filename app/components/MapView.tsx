"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
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

export default function MapView({
  pins,
  selectedPin,
  highlightedPinIds,
  onPinClick,
}: MapViewProps) {
  const mapId = "provenance-map";

  return (
    <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
      <Map
        mapId={mapId}
        defaultCenter={{ lat: 37.4275, lng: -122.17 }}
        defaultZoom={15}
        gestureHandling="greedy"
        disableDefaultUI={true}
        className="w-full h-full"
      >
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
    </APIProvider>
  );
}
