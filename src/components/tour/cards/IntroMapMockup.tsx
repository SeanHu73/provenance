'use client';

/**
 * Real-map mockup card used inside the onboarding flow.
 *
 * Uses Google Static Maps — single round-trip image request keyed by
 * the tour's location (with a Stanford Memorial Church fallback if
 * the admin hasn't set tour.location yet). The pin glyph is drawn as
 * a real `<button data-onboard-map-pin>` centered over the map so it
 * looks and behaves like the live tour-entry marker and so the
 * onboarding SpotlightOverlay can highlight it by selector.
 *
 * Falls back to a simple cream surface if the Google Maps API key is
 * missing (e.g. in unit tests) so the rest of the onboarding still
 * works.
 */

import { useEffect, useRef, useState } from 'react';
import { Tour } from '@/lib/types';

const FALLBACK_LOCATION = { lat: 37.42700, lng: -122.17015 }; // Stanford Memorial Church

interface Props {
  tour: Tour;
  /** Click handler for the tappable pin. */
  onPinTap: () => void;
  /** When true, the "Tap to start" label fades up. */
  pinLabel?: boolean;
}

export default function IntroMapMockup({ tour, onPinTap, pinLabel = false }: Props) {
  const location = tour.location ?? FALLBACK_LOCATION;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Measure the rendered card so we can request a sharp Static Map at
  // the right pixel size (max 640 per request without Premium). Two-
  // step measurement: first render at a sensible default, then upgrade
  // once the container has measured itself.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 600, h: 450 });
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(640, Math.max(300, Math.round(el.clientWidth)));
      const h = Math.min(640, Math.max(220, Math.round(w * 0.75)));
      setSize({ w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const mapUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}` +
      `&zoom=17` +
      `&size=${size.w}x${size.h}` +
      `&scale=2` +
      `&maptype=roadmap` +
      // Hide POI markers + transit so the map reads as the surrounding
      // streets and parcels, with our overlay pin standing out.
      `&style=feature:poi%7Cvisibility:off` +
      `&style=feature:transit%7Cvisibility:off` +
      `&key=${apiKey}`
    : null;

  return (
    <div
      ref={wrapperRef}
      className="relative w-full rounded-2xl overflow-hidden shadow-md border-2 border-aged-gold/30"
      style={{ aspectRatio: '4 / 3', backgroundColor: '#E8D8C0' }}
    >
      {mapUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mapUrl}
          alt="Map of the tour starting area"
          className="absolute inset-0 w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm italic">
          Map preview
        </div>
      )}

      {/* Pin button — anchored at map centre, same glyph approach the
          live map uses. Outer span owns the translate-centering so the
          animate-ping inner span can run its own scale transform
          without clobbering it (Build_State §7). */}
      <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="relative block">
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: 'var(--th-primary)', opacity: 0.4 }}
          />
          <button
            type="button"
            data-onboard-map-pin
            onClick={onPinTap}
            className="relative block w-[60px] h-[60px] rounded-full shadow-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--th-primary)', border: '3px solid var(--th-surface)' }}
            aria-label="Tap this pin"
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--th-surface)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 11.5a8.5 8.5 0 0 1-15.4 4.9L3 21l4.6-2.6A8.5 8.5 0 1 1 21 11.5z" />
              <text x="12" y="14" textAnchor="middle" fontSize="9" fontFamily="serif" fontWeight="700" fill="var(--th-surface)" stroke="none">
                P
              </text>
            </svg>
          </button>
        </span>
      </span>

      {pinLabel && (
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '12%' }}>
          <span
            className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider shadow"
            style={{ backgroundColor: 'var(--th-surface)', color: 'var(--th-primary)' }}
          >
            Tap to start
          </span>
        </div>
      )}
    </div>
  );
}
