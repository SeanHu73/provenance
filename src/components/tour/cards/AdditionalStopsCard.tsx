'use client';

/**
 * Context-Prototype — the post-tour "explore related stops" MAP.
 *
 * Shown once the last act ends, when the tour has any `additionalStops`. It marks
 * the end of the *guided* tour and drops the additional stops onto the map as
 * tappable pins. Tapping a pin opens a small confirm card (thumbnail + title);
 * "Explore this stop" plays its content and then its own (dismissible) Context
 * Journal, returning here after. A floating "End tour" button finishes the tour
 * (→ the closing screens).
 */

import { useState } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Tour, TourSession, Stop } from '@/lib/types';
import { getAdditionalStops } from '@/lib/tour-session';

const FALLBACK_LOCATION = { lat: 37.42700, lng: -122.17015 };
const MAP_ID = 'b8f339c02d8c7d5bd3f12d1b';

interface Props {
  tour: Tour;
  session: TourSession;
  onExplore: (stopId: string) => void;
  onFinish: () => void;
}

function pickStopThumb(stop: Stop): { url: string; focal?: { x: number; y: number } } | null {
  const seed = (stop.seed.photos || []).find((p) => p.url);
  if (seed) return { url: seed.url, focal: seed.thumbnailFocalPoint ?? seed.focalPoint };
  const notice = (stop.notice.photos || []).find((p) => p.url);
  if (notice) return { url: notice.url, focal: notice.thumbnailFocalPoint ?? notice.focalPoint };
  if (stop.seed.photoUrl) return { url: stop.seed.photoUrl };
  if (stop.notice.photoUrl) return { url: stop.notice.photoUrl };
  return null;
}

export default function AdditionalStopsCard({ tour, session, onExplore, onFinish }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const base = tour.location ?? FALLBACK_LOCATION;
  const stops = getAdditionalStops(tour);
  const explored = new Set(session.completedStops);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Build pin positions. Stops without their own coordinates fan out in a small
  // ring around the tour pin so pins don't perfectly overlap.
  let offsetIdx = 0;
  const pins = stops.map(({ stop, entry }, i) => {
    let pos: { lat: number; lng: number };
    if (stop.location) {
      pos = stop.location;
    } else {
      const angle = (offsetIdx * 49 * Math.PI) / 180;
      const r = 0.00012 * (1 + Math.floor(offsetIdx / 7));
      pos = { lat: base.lat + r * Math.cos(angle), lng: base.lng + r * Math.sin(angle) };
      offsetIdx++;
    }
    return { id: stop.id, stop, entry, number: i + 1, pos, done: explored.has(stop.id) };
  });

  const center = pins.find((p) => p.stop.location)?.pos ?? base;
  const selected = pins.find((p) => p.id === selectedId) ?? null;
  const selectedThumb = selected ? pickStopThumb(selected.stop) : null;

  return (
    <div className="absolute inset-0" style={{ backgroundColor: '#E8D8C0' }}>
      {apiKey && pins.length > 0 ? (
        <APIProvider apiKey={apiKey}>
          <GoogleMap
            mapId={MAP_ID}
            defaultCenter={center}
            defaultZoom={17}
            defaultTilt={0}
            mapTypeId="satellite"
            gestureHandling="greedy"
            disableDefaultUI
            clickableIcons={false}
            style={{ width: '100%', height: '100%' }}
          >
            {pins.map((pin) => (
              <AdvancedMarker
                key={pin.id}
                position={pin.pos}
                zIndex={pin.id === selectedId ? 30 : 10}
                onClick={() => setSelectedId(pin.id)}
              >
                <StopPin number={pin.number} done={pin.done} active={pin.id === selectedId} />
              </AdvancedMarker>
            ))}
          </GoogleMap>
        </APIProvider>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-text-secondary text-sm italic px-6 text-center">
          {pins.length === 0 ? 'No additional stops to explore.' : 'Map requires API key'}
        </div>
      )}

      {/* Top caption — end-of-guided-tour framing + how to explore. */}
      <div className="absolute top-3 inset-x-3 z-20 pointer-events-none">
        <div className="rounded-2xl px-4 py-3 shadow-lg" style={{ backgroundColor: 'var(--th-surface)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--th-primary)' }}>End of the guided tour</p>
          <p className="mt-0.5 text-[14px] font-serif leading-snug" style={{ color: 'var(--text-primary)' }}>
            Tap a stop on the map to explore it — or end the tour whenever you like.
          </p>
        </div>
      </div>

      {/* Selected-stop confirm card — thumbnail + title + Explore. */}
      {selected && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelectedId(null)} />
          <div className="relative m-4 mb-24 rounded-2xl shadow-xl overflow-hidden animate-slide-up" style={{ backgroundColor: 'var(--th-surface)' }}>
            <div className="flex items-center gap-3 p-4">
              <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--th-bg)' }}>
                {selectedThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedThumb.url} alt="" className="w-full h-full object-cover" style={selectedThumb.focal ? { objectPosition: `${selectedThumb.focal.x}% ${selectedThumb.focal.y}%` } : undefined} />
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--th-primary)" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                )}
              </div>
              <div className="min-w-0">
                {selected.done && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive">Explored</p>}
                <h3 className="text-xl leading-tight font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                  {selected.stop.title || selected.entry.guidingQuestion || `Stop ${selected.number}`}
                </h3>
                {selected.entry.guidingQuestion?.trim() && (
                  <p className="mt-0.5 text-[13px] font-serif italic line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{selected.entry.guidingQuestion}</p>
                )}
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
              <button
                onClick={() => onExplore(selected.id)}
                className="w-full py-3 rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
              >
                {selected.done ? 'Explore again' : 'Explore this stop'}
              </button>
              <button onClick={() => setSelectedId(null)} className="w-full text-center text-sm py-1" style={{ color: 'var(--text-secondary)' }}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating "End tour" button — hovers at the bottom over the map. */}
      {!selected && (
        <div className="absolute bottom-4 inset-x-4 z-20">
          <button
            onClick={onFinish}
            className="w-full py-3 rounded-full text-[15px] font-semibold shadow-lg bg-olive text-white"
          >
            End tour
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Additional-stop map pin ───────────────────────────────────── */

function StopPin({ number, done, active }: { number: number; done: boolean; active: boolean }) {
  const size = active ? 52 : 40;
  const bg = done ? '#2563EB' : 'var(--th-primary)';
  return (
    // AdvancedMarker anchors the element's bottom-centre at the coordinate;
    // shift down by half the height so the disc is centred on the point.
    <div style={{ transform: 'translateY(50%)' }}>
      <div className="relative cursor-pointer" style={{ width: size, height: size }}>
        {active && (
          <div className="absolute" style={{ width: size * 1.5, height: size * 1.5, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#F59E0B', opacity: 0.4 }} />
          </div>
        )}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center font-bold text-white"
          style={{
            background: bg,
            border: `${Math.max(2, Math.round(size * 0.08))}px solid #fff`,
            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
            fontSize: Math.round(size * 0.42),
          }}
        >
          {done ? (
            <svg width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          ) : number}
        </div>
      </div>
    </div>
  );
}
