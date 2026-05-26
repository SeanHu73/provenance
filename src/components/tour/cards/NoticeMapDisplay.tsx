'use client';

/**
 * "Indoor map" displayed on the Notice screen for stops where GPS pins
 * are unhelpful (e.g. inside a building). Shows an admin-uploaded
 * floorplan or room photo with one or more "this is where you go"
 * markers, plus a banner that makes the purpose unmistakable.
 *
 * Tapping the map opens it fullscreen for closer inspection.
 */

import { useState } from 'react';
import type { NoticeMap } from '@/lib/types';
import FullscreenPhoto from './FullscreenPhoto';

interface Props {
  map: NoticeMap;
}

export default function NoticeMapDisplay({ map }: Props) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div className="rounded-xl overflow-hidden border-2 border-aged-gold/40 shadow-md bg-sandstone">
        {/* Banner — leaves no doubt this is location guidance */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
            <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wider">Where to go</span>
        </div>

        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="relative w-full block text-left"
          aria-label="Expand map"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={map.url}
            alt={map.caption || 'Stop location map'}
            className="w-full max-h-80 object-contain bg-black/5"
            draggable={false}
          />
          {/* Marker layer */}
          <div className="pointer-events-none absolute inset-0">
            {map.markers.map((m) => (
              <NoticeMapMarkerGlyph key={m.id} x={m.x} y={m.y} label={m.label} />
            ))}
          </div>
        </button>

        {map.caption && (
          <p className="text-xs px-3 py-2 italic text-text-secondary bg-sandstone/60">
            {map.caption}
          </p>
        )}
      </div>

      {fullscreen && (
        <FullscreenPhoto
          url={map.url}
          caption={map.caption || 'Stop location'}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  );
}

function NoticeMapMarkerGlyph({ x, y, label }: { x: number; y: number; label?: string }) {
  return (
    <div
      className="absolute flex flex-col items-center"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -100%)' }}
    >
      {/* Pulsing halo behind the pin to draw the eye */}
      <span
        className="absolute rounded-full animate-ping"
        style={{
          left: '50%',
          bottom: 4,
          width: 28,
          height: 28,
          backgroundColor: 'var(--th-primary)',
          opacity: 0.45,
          transform: 'translate(-50%, 50%)',
        }}
      />
      {/* The pin itself */}
      <svg
        width="34"
        height="42"
        viewBox="0 0 24 30"
        fill="none"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))', position: 'relative' }}
        aria-hidden="true"
      >
        <path
          d="M12 0 a 9 9 0 0 1 9 9 c 0 7 -9 21 -9 21 s -9 -14 -9 -21 a 9 9 0 0 1 9 -9 z"
          fill="var(--th-primary)"
          stroke="#fff"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="9" r="3.2" fill="#fff" />
      </svg>
      {label && (
        <span
          className="mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
          style={{
            backgroundColor: 'var(--th-primary)',
            color: 'var(--th-surface)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
