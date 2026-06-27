'use client';

/**
 * Full-screen tour overview shown when a map pin is tapped — the
 * "table of contents" landing page for a tour (inspired by the National
 * Park Service self-guided tour layout). Replaces the older bottom-sheet
 * JournalPeek. Shows the cover, guide, time/length, description, and a
 * numbered, thumbnailed list of every stop, with a sticky "Begin tour"
 * button. "Begin" leads into onboarding the first time, then the tour.
 */

import { useState, useEffect } from 'react';
import { APIProvider, Map as GoogleMap, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { Tour, Stop } from '@/lib/types';
import { guidePhotoStyle } from '@/lib/guide-photo';
import { getActiveStops } from '@/lib/tours-store';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

const MAP_ID = 'b8f339c02d8c7d5bd3f12d1b';
const FALLBACK_LOCATION = { lat: 37.42700, lng: -122.17015 };
const BANNER_MAX_ZOOM = 19;

interface Props {
  tour: Tour;
  onBegin: () => void;
  onDismiss: () => void;
}

/** A pin position derived from a stop. Stops without their own coordinates
 *  fan out in a small ring around the tour pin so numbered pins don't overlap. */
function buildPinPositions(tour: Tour): { id: string; number: number; pos: { lat: number; lng: number } }[] {
  const base = tour.location ?? FALLBACK_LOCATION;
  const stops = getActiveStops(tour);
  let offsetIdx = 0;
  return stops.map((stop, i) => {
    let pos: { lat: number; lng: number };
    if (stop.location) {
      pos = stop.location;
    } else {
      const angle = (offsetIdx * 49 * Math.PI) / 180;
      const r = 0.00010 * (1 + Math.floor(offsetIdx / 7));
      pos = { lat: base.lat + r * Math.cos(angle), lng: base.lng + r * Math.sin(angle) };
      offsetIdx++;
    }
    return { id: stop.id, number: i + 1, pos };
  });
}

/** Fits the map to show every pin, capping how far it zooms in so a tour
 *  whose stops all share one location doesn't slam to street level. */
function FitAllPins({ positions }: { positions: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || positions.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google;
    if (!g?.maps?.LatLngBounds) return;
    const bounds = new g.maps.LatLngBounds();
    positions.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 36);
    const listener = g.maps.event.addListenerOnce(map, 'idle', () => {
      const z = map.getZoom?.();
      if (typeof z === 'number' && z > BANNER_MAX_ZOOM) map.setZoom(BANNER_MAX_ZOOM);
    });
    return () => listener?.remove?.();
  }, [map, positions]);
  return null;
}

/** Uniform numbered pin for the overview banner (all stops look the same —
 *  this is a preview, not a progress map). */
function OverviewPin({ number }: { number: number }) {
  const size = 30;
  return (
    <div style={{ transform: 'translateY(50%)' }}>
      <div
        className="rounded-full flex items-center justify-center font-bold text-white"
        style={{
          width: size,
          height: size,
          background: 'var(--th-primary)',
          border: '2px solid #fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.45)',
          fontSize: 13,
        }}
      >
        {number}
      </div>
    </div>
  );
}

/** Live satellite map banner showing all the tour's stop pins (NPS-style). */
function TourMapBanner({ tour }: { tour: Tour }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const pins = buildPinPositions(tour);
  const positions = pins.map((p) => p.pos);
  const center = positions[0] ?? tour.location ?? FALLBACK_LOCATION;

  if (!apiKey || pins.length === 0) {
    // Graceful fallback — a solid primary band when there's no map to show.
    return <div className="w-full h-full" style={{ backgroundColor: 'var(--th-primary)' }} />;
  }

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMap
        mapId={MAP_ID}
        defaultCenter={center}
        defaultZoom={17}
        defaultTilt={0}
        mapTypeId="satellite"
        gestureHandling="none"
        disableDefaultUI
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
      >
        <FitAllPins positions={positions} />
        {pins.map((pin) => (
          <AdvancedMarker key={pin.id} position={pin.pos}>
            <OverviewPin number={pin.number} />
          </AdvancedMarker>
        ))}
      </GoogleMap>
    </APIProvider>
  );
}

/** Pick a representative thumbnail for a stop — establishing (seed) photo
 *  first, then the observation (notice) photo, with legacy fallbacks. */
function pickStopThumb(stop: Stop): { url: string; focal?: { x: number; y: number } } | null {
  const seed = (stop.seed.photos || []).find((p) => p.url);
  if (seed) return { url: seed.url, focal: seed.thumbnailFocalPoint ?? seed.focalPoint };
  const notice = (stop.notice.photos || []).find((p) => p.url);
  if (notice) return { url: notice.url, focal: notice.thumbnailFocalPoint ?? notice.focalPoint };
  if (stop.seed.photoUrl) return { url: stop.seed.photoUrl };
  if (stop.notice.photoUrl) return { url: stop.notice.photoUrl };
  return null;
}

/** Strip inline-markup markers so a teaser reads as plain prose. */
function plain(text: string): string {
  return text
    .replace(/\[photo:\d+\]/gi, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\{\{\/\}\}/g, '')
    .replace(/[*_#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function StopRow({ stop, index }: { stop: Stop; index: number }) {
  const [open, setOpen] = useState(false);
  const thumb = pickStopThumb(stop);
  const teaser = plain(stop.seed.text || '').slice(0, 180);
  const canExpand = teaser.length > 0;

  return (
    <div className="border-b" style={{ borderColor: 'var(--th-border)' }}>
      <button
        onClick={() => canExpand && setOpen((v) => !v)}
        className="w-full flex items-center gap-3 py-3 text-left"
        style={{ cursor: canExpand ? 'pointer' : 'default' }}
      >
        {/* Number badge */}
        <div
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold"
          style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
        >
          {index + 1}
        </div>

        {/* Thumbnail */}
        <div
          className="shrink-0 w-14 h-14 rounded-lg overflow-hidden"
          style={{ backgroundColor: 'var(--th-border)' }}
        >
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb.url}
              alt=""
              className="w-full h-full object-cover"
              style={thumb.focal ? { objectPosition: `${thumb.focal.x}% ${thumb.focal.y}%` } : undefined}
            />
          )}
        </div>

        {/* Title + optional location tag */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
            {stop.title || `Stop ${index + 1}`}
          </p>
          {stop.mergeGroup && (
            <p className="text-xs italic mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {stop.mergeGroup}
            </p>
          )}
        </div>

        {/* Chevron — only when there's a teaser to reveal */}
        {canExpand && (
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 transition-transform duration-200"
            style={{ color: 'var(--text-secondary)', transform: open ? 'rotate(90deg)' : 'none' }}
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
      </button>

      {/* Inline teaser */}
      {open && canExpand && (
        <p className="pl-[68px] pr-2 pb-3 -mt-1 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {teaser}
          {plain(stop.seed.text || '').length > 180 ? '…' : ''}
        </p>
      )}
    </div>
  );
}

export default function TourOverview({ tour, onBegin, onDismiss }: Props) {
  const [autoplayPref] = useAudioAutoplay();
  const peekAutoplay = autoplayPref && !tour.peekAudioAutoplayDisabled;
  const [descExpanded, setDescExpanded] = useState(false);

  const stops = getActiveStops(tour);
  const count = stops.length;
  const minutes = count * 5;

  const longDesc = (tour.description || '').length > 180;

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col animate-fade-in"
      style={{ backgroundColor: 'var(--th-surface)' }}
    >
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Banner — live satellite map showing every stop pin (NPS-style) */}
        <div className="relative w-full h-52 overflow-hidden" style={{ backgroundColor: 'var(--th-bg)' }}>
          <TourMapBanner tour={tour} />
          {/* Soft fade at the bottom so the map reads cleanly into the page */}
          <div className="absolute inset-x-0 bottom-0 h-8 pointer-events-none" style={{ background: 'linear-gradient(to top, var(--th-surface), transparent)' }} />

          {/* Back / dismiss */}
          <button
            onClick={onDismiss}
            className="absolute top-3 left-3 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm z-10"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)', color: '#fff' }}
            title="Back to map"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-6 space-y-4">
          {/* Title block — below the map, NPS-style */}
          <div>
            {tour.subtitle && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--th-primary)' }}>
                {tour.subtitle}
              </p>
            )}
            <h1 className="text-[30px] leading-[1.05] font-display font-bold" style={{ color: 'var(--text-primary)' }}>
              {tour.title}
            </h1>
          </div>

          {/* Guide + meta row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
              >
                {tour.guide.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tour.guide.photoUrl} alt="" className="w-full h-full object-cover" style={guidePhotoStyle(tour.guide)} />
                ) : (
                  tour.guide.initials || '?'
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {tour.guide.name || 'Your guide'}
                </p>
                {tour.guide.role && (
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{tour.guide.role}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0" style={{ color: 'var(--th-primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="text-[13px] font-semibold whitespace-nowrap">
                {count} stop{count !== 1 ? 's' : ''} · ~{minutes} min
              </span>
            </div>
          </div>

          {/* Description with Read more */}
          {tour.description && (
            <div>
              <p
                className="text-[15px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {descExpanded || !longDesc
                  ? tour.description
                  : `${tour.description.slice(0, 180).trim()}… `}
                {longDesc && (
                  <button
                    onClick={() => setDescExpanded((v) => !v)}
                    className="font-semibold"
                    style={{ color: 'var(--th-primary)' }}
                  >
                    {descExpanded ? 'Read less' : 'Read more'}
                  </button>
                )}
              </p>
            </div>
          )}

          {/* Peek audio */}
          {tour.peekAudioUrl && (
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              {tour.peekAudioTitle && (
                <p className="text-xs font-semibold px-3 pt-2" style={{ color: 'var(--text-primary)' }}>{tour.peekAudioTitle}</p>
              )}
              <audio controls src={tour.peekAudioUrl} autoPlay={peekAutoplay} className="w-full h-9" />
            </div>
          )}

          {/* Stop list */}
          <div className="pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--th-primary)' }}>
              {count} stop{count !== 1 ? 's' : ''} on this tour
            </p>
            <div className="border-t" style={{ borderColor: 'var(--th-border)' }}>
              {stops.map((stop, i) => (
                <StopRow key={stop.id} stop={stop} index={i} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom action bar */}
      <div
        className="shrink-0 px-5 py-3 border-t"
        style={{ backgroundColor: 'var(--th-surface)', borderColor: 'var(--th-border)' }}
      >
        <button
          onClick={onBegin}
          className="w-full py-3.5 rounded-full text-[15px] font-semibold flex items-center justify-center gap-2"
          style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
          Begin tour
        </button>
      </div>
    </div>
  );
}
