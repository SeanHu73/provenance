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
const PIN_ASPECT = 320 / 442; // matches Map.tsx LogoGlyph aspect

const GLYPH_MASK = {
  maskSize: 'contain',
  WebkitMaskSize: 'contain',
  maskRepeat: 'no-repeat',
  WebkitMaskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskPosition: 'center',
} as const;

interface Props {
  tour: Tour;
  /** Click handler for the tappable pin. */
  onPinTap: () => void;
  /** When true, the "Tap to start" label fades up. */
  pinLabel?: boolean;
  /** When true, the wrapper has no aspect-ratio constraint and fills
   *  its parent (h/w 100%). Used by the take-over How It Works layout
   *  so the map covers the card just like the real tour map. */
  fill?: boolean;
}

export default function IntroMapMockup({ tour, onPinTap, pinLabel = false, fill = false }: Props) {
  const location = tour.location ?? FALLBACK_LOCATION;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <div
      className={
        fill
          ? 'relative w-full h-full overflow-hidden'
          : 'relative w-full rounded-2xl overflow-hidden shadow-md border-2 border-aged-gold/30'
      }
      style={fill ? { backgroundColor: '#E8D8C0' } : { aspectRatio: '4 / 3', backgroundColor: '#E8D8C0' }}
    >
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            mapId={MAP_ID}
            defaultCenter={location}
            defaultZoom={17}
            defaultTilt={0}
            mapTypeId="satellite"
            gestureHandling="none"
            disableDefaultUI
            clickableIcons={false}
            className="w-full h-full"
            style={{ width: '100%', height: '100%' }}
          >
            <AdvancedMarker position={location} onClick={onPinTap}>
              <div data-onboard-map-pin>
                <ProvenancePin />
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

/* ─── Pin glyph (matches the real TourParentPin) ──────────────── */

const D = 60; // disc diameter, matches Map.tsx TourParentPin
const BORDER = Math.max(2, Math.round(D * 0.06));
const GLYPH_HEIGHT = D * 0.66;

function ProvenancePin() {
  return (
    <div
      className="relative cursor-pointer"
      style={{ width: D, height: D, transform: `translateY(calc(50% - ${D / 2}px))` }}
    >
      {/* animate-ping ring — outer span sized 1.4x, inner span owns
          the scale animation so it doesn't clobber the disc layout. */}
      <div
        className="absolute"
        style={{
          width: D * 1.4,
          height: D * 1.4,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      >
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ background: 'var(--th-primary)', opacity: 0.4 }}
        />
      </div>
      {/* Disc with white border and the masked logo glyph */}
      <div
        className="absolute inset-0 rounded-full flex items-center justify-center"
        style={{
          background: 'var(--th-primary)',
          border: `${BORDER}px solid #fff`,
          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
        }}
      >
        <LogoGlyph height={GLYPH_HEIGHT} />
      </div>
    </div>
  );
}

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
