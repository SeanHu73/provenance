'use client';

/**
 * Renders an admin's overlays (text labels, outlined circles/rectangles)
 * on top of a photo. The parent must establish `position: relative`
 * sizing — this component fills it with an absolutely-positioned layer
 * so the overlays scale with the image at any rendered size.
 *
 * Coordinates are percent-of-photo (0–100) for x/y and w/h. We use HTML
 * elements positioned with %s rather than SVG viewBox math so text and
 * shape strokes stay un-distorted across any photo aspect ratio.
 */

import type { PhotoOverlay } from '@/lib/types';

interface Props {
  overlays: PhotoOverlay[] | undefined;
}

export default function PhotoAnnotations({ overlays }: Props) {
  if (!overlays || overlays.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {overlays.map((a) => {
        if (a.kind === 'text') {
          // Position the text's centre at (x%, y%) of the photo.
          const fontSize = a.fontSize ?? 16;
          return (
            <span
              key={a.id}
              style={{
                position: 'absolute',
                left: `${a.x}%`,
                top: `${a.y}%`,
                transform: 'translate(-50%, -50%)',
                color: a.color,
                fontSize,
                fontWeight: 700,
                lineHeight: 1.1,
                textShadow: '0 1px 2px rgba(0,0,0,0.6), 0 0 2px rgba(0,0,0,0.45)',
                whiteSpace: 'pre',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {a.text}
            </span>
          );
        }
        // circle (ellipse) and rect: outlined box from (x,y) sized (w,h)
        const isCircle = a.kind === 'circle';
        return (
          <div
            key={a.id}
            style={{
              position: 'absolute',
              left: `${a.x}%`,
              top: `${a.y}%`,
              width: `${a.w}%`,
              height: `${a.h}%`,
              border: `3px solid ${a.color}`,
              borderRadius: isCircle ? '50%' : 4,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.25)',
            }}
          />
        );
      })}
    </div>
  );
}
