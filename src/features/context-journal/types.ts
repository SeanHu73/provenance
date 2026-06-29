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
export interface ContextEntry {
  id: string;
  title: string;
  shortSummary: string;
  longExplanation: string;
  pastCategory: PastCategory;
  timeRange: TimeRange;
  geometry: Geometry | null; // GeoJSON Point or Polygon
  camera: Camera | null;
  photoUrl: string | null;
  placeId: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Payload for creating a context (id/timestamps are assigned on write). */
export type NewContextEntry = Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt'>;

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

/** What the user is drawing in ADD mode. */
export type DrawTool = 'pin' | 'highlight';

/** Geometry + camera captured from the map's ADD/EDIT step. */
export interface DrawResult {
  geometry: Geometry | null;
  camera: Camera | null;
}
