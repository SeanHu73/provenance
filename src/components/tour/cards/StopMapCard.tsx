'use client';

/**
 * Context-Prototype — the "walk to your next stop" map shown before each
 * stop. All stops appear as numbered pins: the one they're walking to is
 * highlighted and enlarged, completed stops turn blue, the rest are smaller
 * but present. A flashing label cues them to walk over.
 */

import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Tour, TourSession } from '@/lib/types';
import { getActiveStops } from '@/lib/tours-store';
import { getContextOrderedStops } from '@/lib/tour-session';

const FALLBACK_LOCATION = { lat: 37.42700, lng: -122.17015 };
const MAP_ID = 'b8f339c02d8c7d5bd3f12d1b';

type PinState = 'completed' | 'target' | 'upcoming';

interface Props {
  tour: Tour;
  session: TourSession;
  onContinue: () => void;
}

export default function StopMapCard({ tour, session, onContinue }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const base = tour.location ?? FALLBACK_LOCATION;
  const ordered = getContextOrderedStops(tour);
  const targetId = getActiveStops(tour)[session.currentStopIndex]?.id;
  const completed = new Set(session.completedStops);

  // Build pin data. Stops without their own coordinates fan out in a small
  // ring around the tour pin so numbered pins don't perfectly overlap.
  let offsetIdx = 0;
  const pins = ordered.map((stop, i) => {
    let pos: { lat: number; lng: number };
    if (stop.location) {
      pos = stop.location;
    } else {
      const angle = (offsetIdx * 49 * Math.PI) / 180;
      const r = 0.00010 * (1 + Math.floor(offsetIdx / 7));
      pos = { lat: base.lat + r * Math.cos(angle), lng: base.lng + r * Math.sin(angle) };
      offsetIdx++;
    }
    const state: PinState = completed.has(stop.id) ? 'completed' : stop.id === targetId ? 'target' : 'upcoming';
    return { id: stop.id, number: i + 1, pos, state };
  });

  const center = pins.find((p) => p.state === 'target')?.pos ?? base;

  return (
    <div className="absolute inset-0" style={{ backgroundColor: '#E8D8C0' }}>
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            mapId={MAP_ID}
            defaultCenter={center}
            defaultZoom={18}
            defaultTilt={0}
            mapTypeId="satellite"
            gestureHandling="greedy"
            disableDefaultUI
            clickableIcons={false}
            style={{ width: '100%', height: '100%' }}
          >
            {pins.map((pin) => (
              <AdvancedMarker key={pin.id} position={pin.pos} zIndex={pin.state === 'target' ? 30 : pin.state === 'completed' ? 20 : 10}>
                <NumberedPin number={pin.number} state={pin.state} />
              </AdvancedMarker>
            ))}
          </GoogleMap>
        </APIProvider>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm italic">
          Map requires API key
        </div>
      )}

      {/* Flashing "walk to your next stop" cue */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none" style={{ top: 14 }}>
        <span
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold uppercase tracking-wide shadow-lg animate-pulse"
          style={{ backgroundColor: 'var(--th-primary)', color: 'var(--cream, #FFF8EE)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          Walk to your next stop
        </span>
      </div>

      {/* Floating continue control over the map */}
      <div className="absolute bottom-0 inset-x-0 p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35), transparent)' }}>
        <button
          onClick={onContinue}
          className="w-full py-3 rounded-lg text-base font-semibold bg-olive text-white shadow-lg"
        >
          I&apos;m here — continue
        </button>
      </div>
    </div>
  );
}

/* ─── Numbered map pin ──────────────────────────────────────────── */

function NumberedPin({ number, state }: { number: number; state: PinState }) {
  const size = state === 'target' ? 46 : state === 'completed' ? 32 : 28;
  const bg = state === 'completed' ? '#2563EB' : 'var(--th-primary)';
  const opacity = state === 'upcoming' ? 0.78 : 1;

  return (
    // AdvancedMarker anchors the element's bottom-centre at the coordinate;
    // shift down by half the height so the disc is centred on the point.
    <div style={{ transform: 'translateY(50%)' }}>
      <div className="relative" style={{ width: size, height: size }}>
        {state === 'target' && (
          <div className="absolute" style={{ width: size * 1.5, height: size * 1.5, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: 'var(--th-primary)', opacity: 0.4 }} />
          </div>
        )}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center font-bold text-white"
          style={{
            background: bg,
            opacity,
            border: `${Math.max(2, Math.round(size * 0.08))}px solid #fff`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            fontSize: Math.round(size * 0.45),
          }}
        >
          {number}
        </div>
      </div>
    </div>
  );
}
