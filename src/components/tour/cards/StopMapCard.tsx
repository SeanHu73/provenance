'use client';

/**
 * Context-Prototype — the "walk to your next stop" map shown before each
 * stop. All stops appear as numbered pins: the one they're walking to is
 * highlighted and enlarged, completed stops turn blue, the rest are smaller
 * but present. The very first stop's map plays a one-time 2.5s spotlight that
 * darkens the screen, cuts a hole around the target pin, and shows the walking
 * instruction; every later stop goes straight to the interactive map.
 */

import { useState, useEffect } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Tour, TourSession, Stop } from '@/lib/types';
import { getActiveStops } from '@/lib/tours-store';
import { getContextOrderedStops } from '@/lib/tour-session';
import { stopThumbnailPhoto } from '@/lib/stop-thumbnail';
import SpotlightOverlay from './SpotlightOverlay';

/** Thin wrapper over the shared resolver, keeping this file's `focal` shape.
 *  `done` = the stop is finished, at which point the notice photo is the better
 *  record of it; before that it would spoil the FIND activity. */
function pickStopThumb(stop: Stop, done: boolean): { url: string; focal?: { x: number; y: number } } | null {
  const p = stopThumbnailPhoto(stop, done);
  return p ? { url: p.url, focal: p.thumbnailFocalPoint ?? p.focalPoint } : null;
}

const FALLBACK_LOCATION = { lat: 37.42700, lng: -122.17015 };
const MAP_ID = 'b8f339c02d8c7d5bd3f12d1b';
const INTRO_MS = 2500;

// The first-stop map intro spotlight plays once per page load only.
let firstStopIntroShown = false;

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
  const targetStop = getActiveStops(tour)[session.currentStopIndex] ?? null;
  const targetId = targetStop?.id;
  const completed = new Set(session.completedStops);

  // Tapping the target pin opens a small confirm card (thumbnail + title)
  // so the group can be sure they're at the right spot before the stop opens.
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Almost always the info photo: this card is the "I'm here" confirm for a stop
  // they're about to explore. It resolves to the notice photo only on a revisit.
  const targetThumb = targetStop ? pickStopThumb(targetStop, completed.has(targetStop.id)) : null;
  const targetNumber = ordered.findIndex((s) => s.id === targetId) + 1;

  // Only the very first stop's map plays the spotlight intro, and only once.
  const isFirstStop = !!targetId && targetId === ordered[0]?.id;
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    if (!isFirstStop || firstStopIntroShown) return;
    firstStopIntroShown = true;
    setShowIntro(true);
    const t = setTimeout(() => setShowIntro(false), INTRO_MS);
    return () => clearTimeout(t);
  }, [isFirstStop]);

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
              <AdvancedMarker
                key={pin.id}
                position={pin.pos}
                zIndex={pin.state === 'target' ? 30 : pin.state === 'completed' ? 20 : 10}
                onClick={pin.state === 'target' ? () => setConfirmOpen(true) : undefined}
              >
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

      {/* First-appearance spotlight: darken the screen for 2.5s with a hole
          cut around the target pin and the walking instruction above it. */}
      {showIntro && !confirmOpen && (
        <SpotlightOverlay
          targetSelector="[data-stop-map-target]"
          message="Walk to your next stop. Tap pin when you are there."
          dimOpacity={0.62}
          padding={18}
        />
      )}

      {/* Confirm card — a small thumbnail + title shown after the target pin
          is tapped, so the group confirms they're at the right spot before
          the stop opens. */}
      {confirmOpen && targetStop && (
        <div className="absolute inset-0 z-30 flex flex-col justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmOpen(false)} />
          <div
            className="relative m-4 rounded-2xl shadow-xl overflow-hidden animate-slide-up"
            style={{ backgroundColor: 'var(--th-surface)' }}
          >
            <div className="flex items-center gap-3 p-4">
              {/* Small thumbnail */}
              <div
                className="shrink-0 w-20 h-20 rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--th-bg)' }}
              >
                {targetThumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={targetThumb.url}
                    alt=""
                    className="w-full h-full object-cover"
                    style={targetThumb.focal ? { objectPosition: `${targetThumb.focal.x}% ${targetThumb.focal.y}%` } : undefined}
                  />
                )}
              </div>
              <div className="min-w-0">
                {targetNumber > 0 && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--th-primary)' }}>
                    Stop {targetNumber}
                  </p>
                )}
                <h3 className="text-xl leading-tight font-display font-bold" style={{ color: 'var(--text-primary)' }}>
                  {targetStop.title || `Stop ${targetNumber}`}
                </h3>
              </div>
            </div>

            <div className="px-4 pb-4 space-y-2">
              <button
                onClick={onContinue}
                className="w-full py-3 rounded-full text-[15px] font-semibold"
                style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
              >
                I&apos;m here — explore this stop
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="w-full text-center text-sm py-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ─── Numbered map pin ──────────────────────────────────────────── */

function NumberedPin({ number, state }: { number: number; state: PinState }) {
  const size = state === 'target' ? 58 : state === 'completed' ? 32 : 28;
  const bg = state === 'completed' ? '#2563EB' : 'var(--th-primary)';
  // Target reads at full strength; completed + upcoming are faded back.
  const opacity = state === 'target' ? 1 : 0.78;
  // Highlighted (and completed) pins have a white border; upcoming pins are
  // bronze so the target stands out.
  const borderColor = state === 'upcoming' ? 'var(--th-accent-dark)' : '#fff';

  return (
    // AdvancedMarker anchors the element's bottom-centre at the coordinate;
    // shift down by half the height so the disc is centred on the point.
    <div style={{ transform: 'translateY(50%)' }}>
      <div
        className={`relative ${state === 'target' ? 'cursor-pointer' : ''}`}
        style={{ width: size, height: size }}
        data-stop-map-target={state === 'target' ? true : undefined}
      >
        {state === 'target' && (
          <div className="absolute" style={{ width: size * 1.5, height: size * 1.5, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: '#F59E0B', opacity: 0.4 }} />
          </div>
        )}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center font-bold text-white"
          style={{
            background: bg,
            opacity,
            border: `${Math.max(2, Math.round(size * 0.08))}px solid ${borderColor}`,
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
