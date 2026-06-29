/**
 * Context Journal — data model.
 *
 * Self-contained types for the Context Journal module. The module owns the
 * Firestore `context-entries` and `saved-contexts` collections; nothing outside
 * src/features/context-journal/ should depend on these.
 */

import type { Timestamp } from 'firebase/firestore';
import type { Geometry } from 'geojson';

/** The four P.A.S.T. lenses. A context belongs to exactly one. */
export type PastCategory = 'place' | 'attitudes' | 'society' | 'technology';

/** Basemap style: the calm default (light) or satellite imagery. */
export type MapType = 'default' | 'satellite';

/** Inclusive year span. */
export interface TimeRange {
  start: number;
  end: number;
}

/** Map camera captured when a context's geometry was drawn. */
export interface Camera {
  center: [number, number]; // [lng, lat]
  zoom: number;
}

/** A single context entry, written to `context-entries`. */
/** A piece of media attached to a context — a photo or an audio clip, each
 *  titled. A context can hold several (e.g. an oral account + a song). */
export interface ContextMedia {
  id: string;
  kind: 'photo' | 'audio';
  url: string;
  title: string;
}

export interface ContextEntry {
  id: string;
  title: string;
  /** A framing question, shown in italics under the title (thumbnail + page). */
  question: string;
  shortSummary: string;
  longExplanation: string;
  pastCategory: PastCategory;
  timeRange: TimeRange;
  geometry: Geometry | null; // GeoJSON Point or Polygon
  camera: Camera | null;
  /** Basemap the context was authored on; the viewer's map switches to it on focus. */
  mapType: MapType;
  /** Photos + audio. The thumbnail photo is chosen by `thumbnailMediaId`. */
  media: ContextMedia[];
  thumbnailMediaId: string | null;
  placeId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Payload for creating a context (id/timestamps are assigned on write). */
export type NewContextEntry = Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt'>;

/** The authored content of a context, without where it's stored (placeId). The
 *  AddContextFlow form assembles this and hands it to its `onSubmit`. */
export type ContextDraft = Omit<NewContextEntry, 'placeId'>;

/** A bookmark, written to `saved-contexts`, keyed by an anonymous viewer id. */
export interface SavedContext {
  id: string; // `${viewerId}__${contextId}`
  viewerId: string;
  contextId: string;
  placeId: string;
  createdAt: Timestamp | null;
}

/** Map interaction modes. BROWSE is read-only; ADD enables drawing tools. */
export type MapMode = 'browse' | 'add';

/** What the user is drawing in ADD mode. `pin` drops a point, `highlight` is a
 *  freehand highlighter brush whose stroke is smoothed into a clean shape,
 *  `place` selects a city/state/country boundary by tap or search. */
export type DrawTool = 'pin' | 'highlight' | 'place';

/** Geometry + camera captured from the map's ADD/EDIT step. */
export interface DrawResult {
  geometry: Geometry | null;
  camera: Camera | null;
}

/** Lng/lat bounds: [[west, south], [east, north]]. */
export type Bounds = [[number, number], [number, number]];

/**
 * Admin-set, per-place configuration for the Context Journal: the timeline domain
 * the journal opens on, the default map view, and an optional pan constraint.
 * Stored at `context-journal-config/{placeId}`.
 */
export interface PlaceConfig {
  placeId: string;
  timelineStart: number;
  timelineEnd: number;
  defaultCenter: [number, number];
  defaultZoom: number;
  updatedAt: Timestamp | null;
}
