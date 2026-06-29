/**
 * Geometry (de)serialization for Firestore.
 *
 * Firestore rejects **nested arrays**, and a GeoJSON Polygon's `coordinates`
 * are nested (`[[[lng,lat], …]]`) — so writing a drawn region as a raw object
 * makes `setDoc` throw and the save fails. We store geometry as a JSON **string**
 * instead, and parse it back on read.
 *
 * A Point's coordinates (`[lng,lat]`) are flat, so older entries that stored a
 * raw Point object still load — `geometryFromStore` passes objects through.
 */

import type { Geometry } from 'geojson';

/** Geometry → Firestore value (JSON string, or null). */
export function geometryToStore(g: Geometry | null | undefined): string | null {
  return g ? JSON.stringify(g) : null;
}

/** Firestore value → geometry. Accepts the new JSON string and legacy raw
 *  objects (pre-serialization Point entries); anything unparseable → null. */
export function geometryFromStore(v: unknown): Geometry | null {
  if (!v) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as Geometry;
    } catch {
      return null;
    }
  }
  if (typeof v === 'object') return v as Geometry; // legacy raw Point object
  return null;
}
