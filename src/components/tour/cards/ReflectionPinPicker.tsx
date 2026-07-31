'use client';

/**
 * Drop a pin on the spot the photo was taken.
 *
 * Google Maps rather than the Context Journal's mapbox editor: that one is a
 * layered drawing surface built for tracing an area, and this is one tap. It also
 * matches the map the learner has been walking with all tour, which matters more
 * than sharing an implementation.
 *
 * The learner is standing on the spot when they answer this, so "use where I am"
 * is offered first and is almost always the right answer. Tapping the map is the
 * fallback for photographing something across a courtyard, or answering later.
 */

import { useEffect, useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';

export interface PinLoc { lat: number; lng: number }

/** Falls back to the Main Quad when there is no fix and nothing else to go on. */
const FALLBACK: PinLoc = { lat: 37.4275, lng: -122.1697 };

export default function ReflectionPinPicker({
  value, onChange, centre,
}: {
  value: PinLoc | null;
  onChange: (p: PinLoc) => void;
  /** Where to open the map — the stop they are on, when we know it. */
  centre?: PinLoc | null;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [here, setHere] = useState<PinLoc | null>(null);
  const [locating, setLocating] = useState(false);

  // Ask once on mount, quietly. A fix takes a few seconds and having it ready
  // makes "use where I am" instant, which is the whole point of offering it.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* refused or unavailable — the map still works */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30_000 },
    );
  }, []);

  const useHere = () => {
    if (here) { onChange(here); return; }
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHere(p);
        onChange(p);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  if (!apiKey) {
    return (
      <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
        The map is unavailable, so this one can be answered without a pin.
      </p>
    );
  }

  const openAt = value ?? centre ?? here ?? FALLBACK;

  return (
    <div>
      <div
        className="relative w-full rounded-xl overflow-hidden"
        style={{ height: 220, border: '1px solid var(--th-border)' }}
      >
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            defaultCenter={openAt}
            defaultZoom={18}
            gestureHandling="greedy"
            disableDefaultUI
            mapId="reflection-pin"
            onClick={(e) => {
              const ll = e.detail?.latLng;
              if (ll) onChange({ lat: ll.lat, lng: ll.lng });
            }}
          >
            {value && <AdvancedMarker position={value} />}
            {/* Recentres when they use their location, which the map would
                otherwise ignore — defaultCenter is only read once. */}
            <Recentre to={value} />
          </GoogleMap>
        </APIProvider>
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={useHere}
          disabled={locating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border-2 disabled:opacity-50"
          style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {locating ? 'Finding you…' : 'I am standing here'}
        </button>
        <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          {value ? 'Tap the map to move the pin.' : 'Or tap the map to drop a pin.'}
        </span>
      </div>
    </div>
  );
}

function Recentre({ to }: { to: PinLoc | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && to) map.panTo(to);
  }, [map, to]);
  return null;
}
