/**
 * Place search — resolve a state/country (any named place with an administrative
 * boundary) to a GeoJSON polygon, so a context can be tied to a whole region
 * instead of a single pin.
 *
 * Backed by OpenStreetMap **Nominatim** (free, no key). `polygon_threshold`
 * simplifies the boundary server-side so the stored geometry stays small (a
 * detailed country outline is otherwise huge — and Firestore docs cap at 1 MB).
 *
 * Usage policy: low-volume, browser-driven authoring only; OSM data, © OpenStreetMap
 * contributors. If this ever needs heavy/automated use, move to a self-hosted or
 * paid boundary source.
 */

import type { Geometry, Polygon, MultiPolygon } from 'geojson';

const SEARCH = 'https://nominatim.openstreetmap.org/search';
const REVERSE = 'https://nominatim.openstreetmap.org/reverse';

export interface PlaceResult {
  /** Human-readable name, e.g. "California, United States". */
  name: string;
  /** Short type label, e.g. "state", "country". */
  kind: string;
  /** Simplified boundary polygon (already normalized to a single Polygon). */
  geometry: Polygon;
}

/** Largest-area Polygon of a MultiPolygon (mainland), or the Polygon itself.
 *  Editing/displaying a MultiPolygon in mapbox-gl-draw is unreliable, so island
 *  nations/exclaves collapse to their main landmass — fine for "this region". */
function toSinglePolygon(geom: Geometry): Polygon | null {
  if (geom.type === 'Polygon') return geom;
  if (geom.type === 'MultiPolygon') {
    const mp = geom as MultiPolygon;
    let best: Polygon['coordinates'] | null = null;
    let bestArea = -1;
    for (const poly of mp.coordinates) {
      const ring = poly[0] ?? [];
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of ring) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
      const area = (maxX - minX) * (maxY - minY);
      if (area > bestArea) { bestArea = area; best = poly; }
    }
    if (best) return { type: 'Polygon', coordinates: best };
  }
  return null;
}

interface NominatimItem {
  display_name?: string;
  type?: string;
  class?: string;
  geojson?: Geometry;
}

/** Search for places with a boundary polygon. Boundaries (states/countries/etc.)
 *  are surfaced first. Throws on network/HTTP failure. */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `${SEARCH}?format=jsonv2&polygon_geojson=1&polygon_threshold=0.008&limit=6&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Place search failed (${res.status})`);
  const data = (await res.json()) as NominatimItem[];
  const results: PlaceResult[] = [];
  for (const d of Array.isArray(data) ? data : []) {
    if (!d.geojson) continue;
    const poly = toSinglePolygon(d.geojson);
    if (!poly) continue;
    results.push({
      name: d.display_name ?? q,
      kind: d.class === 'boundary' ? (d.type ?? 'area') : (d.type ?? d.class ?? 'place'),
      geometry: poly,
    });
  }
  // Administrative boundaries first (what "select a state/country" means).
  results.sort((a, b) => Number(b.kind === 'administrative') - Number(a.kind === 'administrative'));
  return results;
}

/** A nameable area found under a tapped point, coarse → fine collapsed into a
 *  pickable list (city, state, country) so a tap can choose the level. */
export interface PlaceCandidate {
  /** Button label, e.g. "California (state)". */
  label: string;
  /** Query to resolve to a boundary via searchPlaces. */
  query: string;
}

interface NominatimReverse {
  address?: Record<string, string>;
}

/** Reverse-geocode a point straight to the boundary of the area under it (a
 *  region/city polygon), so a tap — especially on mobile, where hitting the tiny
 *  label is hard — selects the enclosing place directly. Null if none/HTTP fail. */
export async function boundaryAtPoint(lng: number, lat: number, signal?: AbortSignal): Promise<PlaceResult | null> {
  const url = `${REVERSE}?format=jsonv2&polygon_geojson=1&polygon_threshold=0.008&zoom=8&lat=${lat}&lon=${lng}`;
  try {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const d = (await res.json()) as NominatimItem;
    if (!d.geojson) return null;
    const poly = toSinglePolygon(d.geojson);
    if (!poly) return null;
    return { name: d.display_name ?? '', kind: d.class === 'boundary' ? (d.type ?? 'area') : (d.type ?? d.class ?? 'place'), geometry: poly };
  } catch {
    return null;
  }
}

/** Reverse-geocode a point to the city / state / country names sitting under it,
 *  so tapping the map offers those levels to highlight. Throws on HTTP failure. */
export async function placesAtPoint(lng: number, lat: number, signal?: AbortSignal): Promise<PlaceCandidate[]> {
  const url = `${REVERSE}?format=jsonv2&addressdetails=1&zoom=10&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Reverse lookup failed (${res.status})`);
  const data = (await res.json()) as NominatimReverse;
  const a = data.address ?? {};
  const country = a.country;
  const state = a.state ?? a.region ?? a.province;
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
  const out: PlaceCandidate[] = [];
  if (city) out.push({ label: `${city} (city)`, query: [city, state, country].filter(Boolean).join(', ') });
  if (state) out.push({ label: `${state} (state)`, query: [state, country].filter(Boolean).join(', ') });
  if (country) out.push({ label: `${country} (country)`, query: country });
  return out;
}
