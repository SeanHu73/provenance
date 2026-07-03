/**
 * Context Journal — shared constants.
 *
 * Lens colours match the P.A.S.T. onboarding (src/components/onboarding) but are
 * pinned here as fixed hex so the module stays self-contained and the lens
 * identity is stable across the red/teal themes.
 */

import type { PastCategory, TimeRange, MapType, ContextEntry } from './types';

/** Default scope when the journal isn't opened in a tour context. */
export const DEFAULT_PLACE_ID = 'memorial-church';

/** Basemap styles. `default` is the calm light map; `satellite` is imagery. */
export const MAP_STYLES: Record<MapType, string> = {
  default: 'mapbox://styles/mapbox/light-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};
export const DEFAULT_CAMERA = { center: [-122.1697, 37.4272] as [number, number], zoom: 15.5 };

/** Firestore collections owned by this module. */
export const CONTEXT_ENTRIES = 'context-entries';
export const SAVED_CONTEXTS = 'saved-contexts';
export const PLACE_CONFIG = 'context-journal-config';

/** "Present day" — placeholder for the live clock; the timeline's upper bound. */
export const PRESENT_YEAR = 2026;

/** Hard outer bounds the timeline may ever span: 1000 BC … present. */
export const TIMELINE_BOUNDS = { start: -1000, end: PRESENT_YEAR } as const;

/**
 * Default browse domain. The admin sets this per tour stop; until that UI exists
 * this is the placeholder default (e.g. a stop might use 1600 → present).
 */
export const DEFAULT_DOMAIN = { start: 1600, end: PRESENT_YEAR };

/** Segment sizes, in years. */
export const GRANULARITIES = [1, 10, 100] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/**
 * Keep the timeline readable: never show many more than this many segments. The
 * finest granularity that stays within it is the floor; the user may pick
 * coarser, never finer. At 100y (the cap) a 1000 BC → present domain runs a
 * little over this, which is accepted.
 */
export const MAX_SEGMENTS = 30;

export function segmentCount(span: number, g: number): number {
  return Math.ceil(span / g);
}

/** Finest granularity (1 → 10 → 100) keeping segments ≤ MAX_SEGMENTS; 100 caps it. */
export function floorGranularity(domain: { start: number; end: number }): Granularity {
  const span = domain.end - domain.start;
  for (const g of GRANULARITIES) {
    if (segmentCount(span, g) <= MAX_SEGMENTS) return g;
  }
  return 100;
}

/** Format a year for axis/labels: negative = BC, the present bound = "Present". */
export function formatYear(y: number): string {
  if (y >= PRESENT_YEAR) return 'Present';
  if (y < 0) return `${-y} BC`;
  return `${y}`;
}

/** A sensible default selection: one segment near the middle of the domain. */
export function defaultRange(domain: { start: number; end: number }): TimeRange {
  const g = floorGranularity(domain);
  const mid = (domain.start + domain.end) / 2;
  let start = Math.round((mid - domain.start) / g) * g + domain.start;
  start = Math.min(Math.max(domain.start, start), domain.end - g);
  return { start, end: Math.min(domain.end, start + g) };
}

/** Smallest span the domain (its two ends) is allowed to shrink to. */
export const MIN_DOMAIN_SPAN = 20;

/** Re-fit a selection into a (possibly just-edited) domain, ≥ one segment wide. */
export function clampRange(range: TimeRange, domain: { start: number; end: number }): TimeRange {
  const g = floorGranularity(domain);
  const start = Math.max(domain.start, Math.min(range.start, domain.end - g));
  const end = Math.min(domain.end, Math.max(range.end, start + g));
  return { start, end };
}

export interface LensDef {
  key: PastCategory;
  label: string;
  /** The lens's sub-topics joined for display, e.g. "Geography | Natural resources". */
  definition: string;
  /** Individual sub-topics — drive the per-category icons on the lens card. */
  categories: string[];
  /** Sample context questions shown on the lens card. */
  questions: string[];
  colour: string;
}

/** The four lenses, in canonical P.A.S.T. order. NB: the `attitudes` key is kept
 *  (stored on existing contexts) but the "A" now reads **Affairs**. */
export const LENSES: LensDef[] = [
  {
    key: 'place', label: 'Place', colour: '#347C4A',
    categories: ['Geography', 'Natural resources'],
    definition: 'Geography | Natural resources',
    questions: ['What resources are important?', 'How did the climate affect events?'],
  },
  {
    key: 'attitudes', label: 'Affairs', colour: '#B8752B',
    categories: ['Relevant events of the time', 'Natural disasters'],
    definition: 'Relevant events of the time | Natural disasters',
    questions: ['How did an election affect decisions?', 'What were the consequences of new diseases?'],
  },
  {
    key: 'society', label: 'Society', colour: '#9B6FC9',
    categories: ['Cultural values', 'Social class', 'Political system', 'Economy'],
    definition: 'Cultural values | Social class | Political system | Economy',
    questions: ['Who held power?', 'What religion did the society have?', 'Were there changing ideas?', 'How was the economy?'],
  },
  {
    key: 'technology', label: 'Technology', colour: '#2C6488',
    categories: ['Useful tools', 'Infrastructure', 'Key inventions'],
    definition: 'Useful tools | Infrastructure | Key inventions',
    questions: ['Were there important new inventions?', 'How did it change daily life?'],
  },
];

export const LENS_BY_KEY: Record<PastCategory, LensDef> = LENSES.reduce(
  (acc, l) => { acc[l.key] = l; return acc; },
  {} as Record<PastCategory, LensDef>,
);

/** A context is in range when its span overlaps the selected span. */
export function overlapsRange(ctx: { start: number; end: number }, sel: { start: number; end: number }): boolean {
  return ctx.start <= sel.end && ctx.end >= sel.start;
}

// ── media helpers ──
export const contextPhotos = (e: ContextEntry) => (e.media ?? []).filter((m) => m.kind === 'photo');
export const contextAudio = (e: ContextEntry) => (e.media ?? []).filter((m) => m.kind === 'audio');

/** The photo URL used for the thumbnail (the chosen one, or the first photo). */
export function thumbnailPhotoUrl(e: ContextEntry): string | null {
  const photos = contextPhotos(e);
  if (!photos.length) return null;
  const chosen = e.thumbnailMediaId ? photos.find((p) => p.id === e.thumbnailMediaId) : null;
  return (chosen ?? photos[0]).url;
}
