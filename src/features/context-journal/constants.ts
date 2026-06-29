/**
 * Context Journal — shared constants.
 *
 * Lens colours match the P.A.S.T. onboarding (src/components/onboarding) but are
 * pinned here as fixed hex so the module stays self-contained and the lens
 * identity is stable across the red/teal themes.
 */

import type { PastCategory } from './types';

/** Default place this journal is scoped to (one place for now). */
export const DEFAULT_PLACE_ID = 'memorial-church';

/** Map defaults (Mapbox). Camera the browse map opens on for the default place. */
export const MAP_STYLE = 'mapbox://styles/mapbox/light-v11';
export const DEFAULT_CAMERA = { center: [-122.1697, 37.4272] as [number, number], zoom: 15.5 };

/** Firestore collections owned by this module. */
export const CONTEXT_ENTRIES = 'context-entries';
export const SAVED_CONTEXTS = 'saved-contexts';

/** Fixed timeline domain (years). */
export const TIMELINE_DOMAIN = { start: 1750, end: 2025 } as const;

/** Granularity cycle, in years. Tapping the Timeline title advances this. */
export const GRANULARITIES = [1, 10, 100] as const;
export type Granularity = (typeof GRANULARITIES)[number];
export const DEFAULT_GRANULARITY: Granularity = 10;

/** ms window to disambiguate a single tap from a double tap on a lens. */
export const TAP_DELAY_MS = 280;

export interface LensDef {
  key: PastCategory;
  label: string;
  definition: string;
  colour: string;
}

/** The four lenses, in canonical P.A.S.T. order. */
export const LENSES: LensDef[] = [
  { key: 'place',      label: 'Place',      colour: '#347C4A', definition: 'Geography, resources, natural disasters' },
  { key: 'attitudes',  label: 'Attitudes',  colour: '#B8752B', definition: 'Cultural values, important ideas' },
  { key: 'society',    label: 'Society',    colour: '#7B4EA3', definition: 'Social class, politics, economy' },
  { key: 'technology', label: 'Technology', colour: '#2C6488', definition: 'Useful tools, infrastructure, key inventions' },
];

export const LENS_BY_KEY: Record<PastCategory, LensDef> = LENSES.reduce(
  (acc, l) => { acc[l.key] = l; return acc; },
  {} as Record<PastCategory, LensDef>,
);

/** A context is in range when its span overlaps the selected span. */
export function overlapsRange(ctx: { start: number; end: number }, sel: { start: number; end: number }): boolean {
  return ctx.start <= sel.end && ctx.end >= sel.start;
}
