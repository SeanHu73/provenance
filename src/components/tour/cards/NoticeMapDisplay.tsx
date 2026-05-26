'use client';

/**
 * "Indoor map" displayed on the Notice screen for stops where GPS pins
 * are unhelpful (e.g. inside a building). Shows an admin-uploaded
 * floorplan or room photo with one or more "this is where you go"
 * markers, plus a banner that makes the purpose unmistakable.
 *
 * When the map is flagged as a hint, it stays hidden behind a "Tap for
 * hint" button so the group has to actively choose to reveal it.
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
  // Hints start collapsed; non-hint maps render expanded immediately.
  const [revealed, setRevealed] = useState(!map.isHint);

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-aged-gold/50 bg-aged-gold/5 hover:bg-aged-gold/15 transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--aged-gold)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
          <circle cx="12" cy="9" r="2.5" fill="var(--aged-gold)" stroke="none" />
        </svg>
        <span className="text-sm font-semibold" style={{ color: 'var(--aged-gold)' }}>
          Tap for hint
        </span>
      </button>
    );
  }

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
          <span className="text-xs font-bold uppercase tracking-wider">
            {map.isHint ? 'Hint — where to go' : 'Where to go'}
          </span>
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
  // Anchor approach: a 0×0 point at (x%, y%). The pin SVG and label are
  // absolutely positioned relative to this anchor so adding/removing a
  // label can never shift the pin tip away from the pinned coordinate.
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, width: 0, height: 0 }}>
      {/* Pulsing halo centred on the anchor (the pin tip). Two-layer so
          animate-ping's scale doesn't fight with our positioning
          transform — the outer span owns the position, the inner span
          owns the scale animation. */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 32,
          height: 32,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      >
        <span
          className="absolute inset-0 rounded-full animate-ping"
          style={{ backgroundColor: 'var(--th-primary)', opacity: 0.45 }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{ backgroundColor: 'var(--th-primary)', opacity: 0.25 }}
        />
      </span>

      {/* Pin SVG — its tip (bottom of viewBox) sits exactly on the anchor */}
      <svg
        width="34"
        height="42"
        viewBox="0 0 24 30"
        fill="none"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          transform: 'translateX(-50%)',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.55))',
        }}
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

      {/* Label floats above the pin so it never overlaps the pin tip */}
      {label && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            // Sit above the pin (SVG is 42px tall, so push label above it)
            bottom: 44,
            transform: 'translateX(-50%)',
            padding: '2px 8px',
            borderRadius: 9999,
            backgroundColor: 'var(--th-primary)',
            color: 'var(--th-surface)',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
