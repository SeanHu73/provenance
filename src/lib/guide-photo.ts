import type { CSSProperties } from 'react';
import type { Tour } from './types';

/**
 * Inline <img> style that applies the guide photo's framing — focal point
 * and zoom — chosen in the admin tour editor. Used wherever the round guide
 * photo is shown (Meet Your Guide screen, journal peek).
 *
 * The <img> it is applied to should be `w-full h-full object-cover` inside a
 * `rounded-full overflow-hidden` container.
 */
export function guidePhotoStyle(guide: Tour['guide']): CSSProperties {
  const fp = guide.photoFocalPoint;
  const zoom = guide.photoZoom && guide.photoZoom > 1 ? guide.photoZoom : 1;
  const pos = fp ? `${fp.x}% ${fp.y}%` : '50% 50%';
  return {
    objectPosition: pos,
    transform: zoom > 1 ? `scale(${zoom})` : undefined,
    transformOrigin: zoom > 1 ? pos : undefined,
  };
}
