'use client';

/**
 * Onboarding map embed — uses the real @vis.gl/react-google-maps
 * stack so the explorer sees the same kind of map they'll get during
 * the live tour. gestureHandling="none" + disableDefaultUI=true makes
 * the map non-interactive (no pan / zoom / rotate) so it reads like a
 * static screenshot but is real Google Maps content.
 *
 * The tour-entry pin is rendered as an AdvancedMarker carrying a
 * data-onboard-map-pin attribute so the onboarding SpotlightOverlay
 * can highlight it by selector.
 */

import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Tour } from '@/lib/types';

const FALLBACK_LOCATION = { lat: 37.42700, lng: -122.17015 }; // Stanford Memorial Church
const MAP_ID = 'b8f339c02d8c7d5bd3f12d1b';

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

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden shadow-md border-2 border-aged-gold/30"
      style={{ aspectRatio: '4 / 3', backgroundColor: '#E8D8C0' }}
    >
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            mapId={MAP_ID}
            defaultCenter={location}
            defaultZoom={17}
            defaultTilt={0}
            mapTypeId="roadmap"
            gestureHandling="none"
            disableDefaultUI
            clickableIcons={false}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={location} onClick={onPinTap}>
              <div data-onboard-map-pin className="relative">
                <span
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{ backgroundColor: 'var(--th-primary)', opacity: 0.4 }}
                />
                <div
                  className="relative w-[60px] h-[60px] rounded-full shadow-lg flex items-center justify-center"
                  style={{ backgroundColor: 'var(--th-primary)', border: '3px solid var(--th-surface)' }}
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
                </div>
              </div>
            </AdvancedMarker>
          </GoogleMap>
        </APIProvider>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm italic">
          Map requires API key
        </div>
      )}

      {pinLabel && (
        <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ bottom: '12%' }}>
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
