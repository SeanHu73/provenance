'use client';

/**
 * ContextMap — the Context Journal's Mapbox GL map.
 *
 *   - browse: a base map that draws a focused context's geometry (points +
 *     regions) and flies to it.
 *   - add:    layer-based editing. Each geometry kind lives on its OWN layer and
 *     is ADDITIVE — there is no mutually-exclusive "tool mode" and no deleteAll,
 *     so shapes can stack and nothing wipes your work. Pins are rebuilt here
 *     Draw-free (tap to drop, tap a pin to remove). Region + place layers are
 *     added next; any existing region/place shapes are preserved + shown.
 *
 * Only place mapbox-gl is imported; loaded via ContextMapLoader (ssr:false).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { Feature, FeatureCollection, Geometry, LineString, Polygon } from 'geojson';
import { MAP_STYLES, DEFAULT_CAMERA } from '../constants';
import { boundaryAtPoint, searchPlaces, type PlaceResult } from '../places';
import type { Bounds, Camera, DrawResult, DrawTool, MapMode, MapType } from '../types';

type Tool = 'pin' | 'paint' | 'select';
// A brush-shaped cursor for paint mode (hotspot at the brush tip); crosshair fallback.
const BRUSH_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='26' height='26' viewBox='0 0 24 24' fill='none' stroke='%23175E54' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9.5 3l6 6-8.5 8.5-4 1 1-4z'/%3E%3Cpath d='M14 5.5l1.8-1.8a1.5 1.5 0 012.1 0l.4.4a1.5 1.5 0 010 2.1L18 8'/%3E%3C/svg%3E\") 2 24, crosshair";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface Props {
  mode: MapMode;
  lensColour?: string;
  initialCamera?: { center: [number, number]; zoom: number } | null;
  initialGeometry?: Geometry | null;
  onDrawChange?: (result: DrawResult) => void;
  defaultView?: { center: [number, number]; zoom: number } | null;
  geolocate?: boolean;
  focus?: { geometry: Geometry | null; camera: Camera | null; colour?: string } | null;
  onViewportChange?: (v: { center: [number, number]; zoom: number; bounds: Bounds }) => void;
  mapType?: MapType;
  onMapTypeChange?: (t: MapType) => void;
  // Accepted for compatibility with the parent; region/place editing lands next.
  onToolChange?: (t: DrawTool) => void;
  onTapName?: (name: string | null) => void;
  onTapBoundary?: (result: PlaceResult) => void;
  boundary?: { geometry: Geometry; nonce: number } | null;
}

type LngLat = [number, number];

/** Bounding box of any geometry (incl. GeometryCollection). */
function bboxOf(geom: Geometry): Bounds | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, found = false;
  const visit = (c: unknown): void => {
    if (Array.isArray(c) && typeof c[0] === 'number') {
      const x = c[0] as number, y = c[1] as number;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      found = true;
    } else if (Array.isArray(c)) {
      c.forEach(visit);
    }
  };
  const geoms = geom.type === 'GeometryCollection' ? geom.geometries : [geom];
  for (const g of geoms) visit((g as { coordinates?: unknown }).coordinates);
  if (!found || (minX === maxX && minY === maxY)) return null;
  return [[minX, minY], [maxX, maxY]];
}

/** Split a stored geometry into its editable parts. */
function parseGeometry(g: Geometry | null | undefined): { pins: LngLat[]; polys: Polygon[]; strokes: LineString[] } {
  const pins: LngLat[] = [];
  const polys: Polygon[] = [];
  const strokes: LineString[] = [];
  const add = (geom: Geometry) => {
    switch (geom.type) {
      case 'Point': pins.push(geom.coordinates as LngLat); break;
      case 'MultiPoint': (geom.coordinates as LngLat[]).forEach((c) => pins.push(c)); break;
      case 'Polygon': polys.push(geom); break;
      case 'MultiPolygon': geom.coordinates.forEach((c) => polys.push({ type: 'Polygon', coordinates: c })); break;
      case 'LineString': strokes.push(geom); break;
      case 'MultiLineString': geom.coordinates.forEach((c) => strokes.push({ type: 'LineString', coordinates: c })); break;
      case 'GeometryCollection': geom.geometries.forEach(add); break;
      default: break;
    }
  };
  if (g) add(g);
  return { pins, polys, strokes };
}

/** Combine the layers back into a single stored geometry. */
function buildGeometry(pins: LngLat[], polys: Polygon[], strokes: LineString[]): Geometry | null {
  const geoms: Geometry[] = [];
  if (pins.length === 1) geoms.push({ type: 'Point', coordinates: pins[0] });
  else if (pins.length > 1) geoms.push({ type: 'MultiPoint', coordinates: pins });
  polys.forEach((p) => geoms.push(p));
  strokes.forEach((s) => geoms.push(s));
  if (geoms.length === 0) return null;
  if (geoms.length === 1) return geoms[0];
  return { type: 'GeometryCollection', geometries: geoms };
}

function pinsFC(pins: LngLat[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((c, i): Feature => ({ type: 'Feature', id: i, properties: {}, geometry: { type: 'Point', coordinates: c } })),
  };
}
function polysFC(polys: Polygon[]): FeatureCollection {
  return { type: 'FeatureCollection', features: polys.map((p, i): Feature => ({ type: 'Feature', id: i, properties: {}, geometry: p })) };
}
function strokesFC(strokes: LineString[], live?: LngLat[]): FeatureCollection {
  const feats: Feature[] = strokes.map((s): Feature => ({ type: 'Feature', properties: {}, geometry: s }));
  if (live && live.length >= 2) feats.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: live } });
  return { type: 'FeatureCollection', features: feats };
}
/** All parts of a geometry as separate features (mapbox can't source a GeometryCollection). */
function geometryFC(g: Geometry | null): FeatureCollection {
  const geoms = !g ? [] : g.type === 'GeometryCollection' ? g.geometries : [g];
  return { type: 'FeatureCollection', features: geoms.map((geom): Feature => ({ type: 'Feature', properties: {}, geometry: geom })) };
}

export default function ContextMap({
  mode, lensColour = '#347C4A', initialCamera, initialGeometry, onDrawChange,
  defaultView, geolocate, focus, onViewportChange, mapType = 'default', onMapTypeChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const onDrawChangeRef = useRef(onDrawChange);
  onDrawChangeRef.current = onDrawChange;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;

  const seed = useMemo(() => parseGeometry(initialGeometry ?? null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [pins, setPins] = useState<LngLat[]>(seed.pins);
  const [places, setPlaces] = useState<Polygon[]>(seed.polys); // tapped-in region/place boundaries
  const [strokes, setStrokes] = useState<LineString[]>(seed.strokes);
  const [tool, setTool] = useState<Tool>('pin');
  const [paintMode, setPaintMode] = useState<'paint' | 'pan'>('paint'); // brush vs move the map
  const [selecting, setSelecting] = useState(false); // place lookup in flight
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const paintModeRef = useRef(paintMode);
  paintModeRef.current = paintMode;
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const placesRef = useRef(places);
  placesRef.current = places;
  // Timestamp of the last paint stroke — used to swallow the phantom desktop
  // click that otherwise flips the tool back to Pin right after a swipe.
  const lastStrokeEndRef = useRef(0);

  const changeTool = (next: Tool) => {
    if (next === 'pin' && lastStrokeEndRef.current && performance.now() - lastStrokeEndRef.current < 500) return;
    setTool(next);
  };

  // Fallback: add the boundary of whatever place sits under a lng/lat when the
  // tap wasn't near any visible label (reverse geocode).
  const addPlaceAt = async (lng: number, lat: number) => {
    setSelecting(true);
    try {
      const res = await boundaryAtPoint(lng, lat);
      if (res?.geometry?.type === 'Polygon') setPlaces((prev) => [...prev, res.geometry as Polygon]);
    } catch { /* ignore */ }
    finally { setSelecting(false); }
  };

  // Resolve a place *name* to a boundary, picking the match nearest the point
  // the user tapped — so "Stanford" becomes the Stanford they clicked, not a
  // list of every Stanford. The name is echoed into the search bar to confirm.
  const selectByName = async (name: string, near: LngLat) => {
    setSelecting(true);
    setQuery(name);
    try {
      const rs = await searchPlaces(name);
      setResults(rs);
      let best: PlaceResult | null = null;
      let bestD = Infinity;
      for (const r of rs) {
        const bb = bboxOf(r.geometry);
        if (!bb) continue;
        const cx = (bb[0][0] + bb[1][0]) / 2, cy = (bb[0][1] + bb[1][1]) / 2;
        const d = (cx - near[0]) ** 2 + (cy - near[1]) ** 2;
        if (d < bestD) { bestD = d; best = r; }
      }
      if (best) setPlaces((prev) => [...prev, best.geometry]);
      else await addPlaceAt(near[0], near[1]); // name found no boundary — fall back
    } catch { /* ignore */ }
    finally { setSelecting(false); }
  };

  const addPlaceFromResult = (res: PlaceResult) => {
    if (res.geometry?.type === 'Polygon') setPlaces((prev) => [...prev, res.geometry as Polygon]);
    setQuery('');
    setResults([]);
    const map = mapRef.current;
    if (map && res.geometry) { const bb = bboxOf(res.geometry); if (bb) map.fitBounds(bb, { padding: 44, duration: 500, maxZoom: 14 }); }
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try { setResults(await searchPlaces(q)); }
    catch { setResults([]); }
    finally { setSearching(false); }
  };

  // ── init map (once) ──
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES[mapType],
      center: initialCamera?.center ?? defaultView?.center ?? DEFAULT_CAMERA.center,
      zoom: initialCamera?.zoom ?? defaultView?.zoom ?? DEFAULT_CAMERA.zoom,
      attributionControl: false,
    });
    if (mode !== 'add') map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    if (geolocate) {
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showUserHeading: true,
      }), 'top-right');
    }
    map.on('error', (e) => console.error('[context-journal] map error:', e.error?.message || e));
    map.on('moveend', () => {
      const cb = onViewportChangeRef.current;
      if (!cb) return;
      const c = map.getCenter();
      const b = map.getBounds();
      if (!b) return;
      cb({ center: [c.lng, c.lat], zoom: map.getZoom(), bounds: [[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]] });
    });
    mapRef.current = map;
    map.once('load', () => map.resize());
    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── basemap switching (browse only; add mode never changes basemap) ──
  const styleRef = useRef<MapType>(mapType);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleRef.current === mapType) return;
    styleRef.current = mapType;
    map.setStyle(MAP_STYLES[mapType]);
    map.once('style.load', () => map.resize());
  }, [mapType]);

  // ── browse: draw + frame a focused context's geometry ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'browse') return;
    const SRC = 'cj-focus';
    const colour = focus?.colour ?? '#175E54';
    const apply = () => {
      const data = geometryFC(focus?.geometry ?? null);
      const existing = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
      if (!existing) {
        map.addSource(SRC, { type: 'geojson', data });
        map.addLayer({ id: 'cj-focus-fill', type: 'fill', source: SRC, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': colour, 'fill-opacity': 0.28 } });
        map.addLayer({ id: 'cj-focus-line', type: 'line', source: SRC, filter: ['==', '$type', 'Polygon'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colour, 'line-width': 2.5 } });
        map.addLayer({ id: 'cj-focus-pt-outer', type: 'circle', source: SRC, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 9, 'circle-color': '#FFFFFF' } });
        map.addLayer({ id: 'cj-focus-pt-inner', type: 'circle', source: SRC, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': colour } });
      } else {
        existing.setData(data);
        if (map.getLayer('cj-focus-fill')) map.setPaintProperty('cj-focus-fill', 'fill-color', colour);
        if (map.getLayer('cj-focus-line')) map.setPaintProperty('cj-focus-line', 'line-color', colour);
        if (map.getLayer('cj-focus-pt-inner')) map.setPaintProperty('cj-focus-pt-inner', 'circle-color', colour);
      }
      if (focus?.geometry) {
        const bb = bboxOf(focus.geometry);
        if (bb) map.fitBounds(bb, { padding: 56, duration: 900, maxZoom: 16 });
        else {
          const c = focus.camera?.center ?? (focus.geometry.type === 'Point' ? (focus.geometry.coordinates as LngLat) : null);
          if (c) map.flyTo({ center: c, zoom: focus.camera?.zoom ?? 15, duration: 900 });
        }
      } else if (defaultView) {
        map.flyTo({ center: defaultView.center, zoom: defaultView.zoom, duration: 900 });
      }
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [focus, defaultView, mode]);

  // ── add mode: pins + polys layers (Draw-free, additive) ──
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'add') return;
    let cancelled = false;

    const canvas = map.getCanvas();

    // The visible place label nearest a screen point (country/state/city/…),
    // ignoring roads/water/POIs — so a tap lands on the name you can see.
    const nameFromLabels = (pt: mapboxgl.Point): string | null => {
      const pad = 44;
      const feats = map.queryRenderedFeatures([[pt.x - pad, pt.y - pad], [pt.x + pad, pt.y + pad]]);
      let best: string | null = null;
      let bestD = Infinity;
      for (const f of feats) {
        const layerId = f.layer?.id ?? '';
        if (!/label/i.test(layerId)) continue;
        if (/road|street|water|natural|poi|transit|airport|rail|marine|building|house/i.test(layerId)) continue;
        if (!/country|state|settlement|place|city|town|village|region|province|subdivision|district|county|locality|neighou?rhood/i.test(layerId)) continue;
        const props = f.properties ?? {};
        const nm = (props.name_en || props.name) as string | undefined;
        if (!nm || f.geometry?.type !== 'Point') continue;
        const p = map.project(f.geometry.coordinates as [number, number]);
        const d = (p.x - pt.x) ** 2 + (p.y - pt.y) ** 2;
        if (d < bestD) { bestD = d; best = String(nm); }
      }
      return best;
    };

    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      const pad = 12;
      const box: [mapboxgl.PointLike, mapboxgl.PointLike] =
        [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]];
      // Select mode: tap a selected area to remove it; otherwise read the visible
      // name nearest the tap and highlight that place (nearest match to the tap).
      if (toolRef.current === 'select') {
        // Swallow the phantom desktop click that would otherwise flip us to Pin.
        lastStrokeEndRef.current = performance.now();
        const onPlace = map.queryRenderedFeatures(box, { layers: ['cj-polys-fill'] });
        if (onPlace.length && onPlace[0].id != null) {
          const idx = Number(onPlace[0].id);
          setPlaces((prev) => prev.filter((_, i) => i !== idx));
          return;
        }
        const near: LngLat = [e.lngLat.lng, e.lngLat.lat];
        const label = nameFromLabels(e.point);
        if (label) void selectByName(label, near);
        else void addPlaceAt(near[0], near[1]); // no visible name → reverse geocode
        return;
      }
      // Pin mode: tap to add a pin, tap a pin to remove it.
      if (toolRef.current !== 'pin') return;
      const hits = map.queryRenderedFeatures(box, { layers: ['cj-pins-outer'] });
      if (hits.length && hits[0].id != null) {
        const idx = Number(hits[0].id);
        setPins((prev) => prev.filter((_, i) => i !== idx));
      } else {
        setPins((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      }
    };

    // Paint mode: press and drag to paint a highlighter swipe.
    let painting = false;
    let current: LngLat[] = [];
    const toLngLat = (clientX: number, clientY: number): LngLat => {
      const rect = canvas.getBoundingClientRect();
      const ll = map.unproject([clientX - rect.left, clientY - rect.top]);
      return [ll.lng, ll.lat];
    };
    const renderStrokes = () => {
      const src = map.getSource('cj-strokes') as mapboxgl.GeoJSONSource | undefined;
      if (src) src.setData(strokesFC(strokesRef.current, painting ? current : undefined));
    };
    const onPointerDown = (e: PointerEvent) => {
      if (toolRef.current !== 'paint' || paintModeRef.current !== 'paint') return;
      painting = true;
      current = [toLngLat(e.clientX, e.clientY)];
      map.dragPan.disable();
      try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
      renderStrokes();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!painting) return;
      current.push(toLngLat(e.clientX, e.clientY));
      renderStrokes();
    };
    const onPointerUp = () => {
      if (!painting) return;
      painting = false;
      map.dragPan.enable();
      lastStrokeEndRef.current = performance.now();
      const done = current;
      current = [];
      if (done.length >= 2) setStrokes((prev) => [...prev, { type: 'LineString', coordinates: done }]);
      else renderStrokes();
    };

    const setup = () => {
      if (cancelled || !mapRef.current) return;
      if (!map.getSource('cj-polys')) {
        map.addSource('cj-polys', { type: 'geojson', data: polysFC(placesRef.current) });
        map.addLayer({ id: 'cj-polys-fill', type: 'fill', source: 'cj-polys', paint: { 'fill-color': lensColour, 'fill-opacity': 0.28 } });
        map.addLayer({ id: 'cj-polys-line', type: 'line', source: 'cj-polys', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': lensColour, 'line-width': 2.5 } });
      }
      if (!map.getSource('cj-strokes')) {
        map.addSource('cj-strokes', { type: 'geojson', data: strokesFC(strokesRef.current) });
        map.addLayer({ id: 'cj-strokes', type: 'line', source: 'cj-strokes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': lensColour, 'line-width': 20, 'line-opacity': 0.35 } });
      }
      if (!map.getSource('cj-pins')) {
        map.addSource('cj-pins', { type: 'geojson', data: pinsFC(pinsRef.current) });
        map.addLayer({ id: 'cj-pins-outer', type: 'circle', source: 'cj-pins', paint: { 'circle-radius': 9, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': 'rgba(0,0,0,0.18)' } });
        map.addLayer({ id: 'cj-pins-inner', type: 'circle', source: 'cj-pins', paint: { 'circle-radius': 6, 'circle-color': lensColour } });
      }
      // frame any seeded geometry
      const g = buildGeometry(pinsRef.current, placesRef.current, strokesRef.current);
      if (g) { const bb = bboxOf(g); if (bb) map.fitBounds(bb, { padding: 44, duration: 0, maxZoom: 16 }); }
      map.on('click', onMapClick);
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
    };

    if (map.isStyleLoaded()) setup(); else map.once('load', setup);
    return () => {
      cancelled = true;
      try {
        map.off('click', onMapClick);
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.style.cursor = '';
      } catch { /* map gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Cursor reflects the active tool: brush for painting, grab hand (Mapbox
  // default) for pin/move so it reads as pannable, precise cross for select.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'add') return;
    const c = tool === 'paint' ? (paintMode === 'paint' ? BRUSH_CURSOR : '') : tool === 'select' ? 'crosshair' : '';
    try { map.getCanvas().style.cursor = c; } catch { /* ok */ }
  }, [tool, paintMode, mode]);

  // ── sync data + emit whenever pins, strokes, or places change ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'add') return;
    const pinsSrc = map.getSource('cj-pins') as mapboxgl.GeoJSONSource | undefined;
    const strokesSrc = map.getSource('cj-strokes') as mapboxgl.GeoJSONSource | undefined;
    const polysSrc = map.getSource('cj-polys') as mapboxgl.GeoJSONSource | undefined;
    if (!pinsSrc) return; // setup will seed the first time
    pinsSrc.setData(pinsFC(pins));
    if (strokesSrc) strokesSrc.setData(strokesFC(strokes));
    if (polysSrc) polysSrc.setData(polysFC(places));
    const g = buildGeometry(pins, places, strokes);
    const c = map.getCenter();
    onDrawChangeRef.current?.({ geometry: g, camera: g ? { center: [c.lng, c.lat], zoom: map.getZoom() } : null });
  }, [pins, strokes, places, mode]);

  if (!TOKEN) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-sandstone-light/40 text-center px-6">
        <div className="max-w-xs">
          <p className="font-display text-lg text-text-primary mb-1">Map unavailable</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Set <code className="px-1 rounded bg-black/5">NEXT_PUBLIC_MAPBOX_TOKEN</code> to enable the Context Journal map.
          </p>
        </div>
      </div>
    );
  }

  const hasPins = pins.length > 0;
  const hasStrokes = strokes.length > 0;
  const hasPlaces = places.length > 0;
  const TOOLS = [
    { id: 'pin' as const, label: 'Pin', icon: <><path d="M12 21s-7-6.4-7-11a7 7 0 0114 0c0 4.6-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></> },
    { id: 'paint' as const, label: 'Highlighter', icon: <><path d="M9.5 3l6 6-8.5 8.5-4 1 1-4z" /><path d="M14 5.5l1.8-1.8a1.5 1.5 0 012.1 0l.4.4a1.5 1.5 0 010 2.1L18 8" /></> },
    { id: 'select' as const, label: 'Select', icon: <><circle cx="12" cy="10" r="7" /><path d="M12 21v-4 M5 10h4 M15 10h4" /></> },
  ];

  return (
    <div className="w-full h-full flex flex-col">
      {mode === 'add' && (
        <div className="relative z-30 shrink-0 bg-warm-white border-b" style={{ borderColor: 'var(--th-border)' }}>
          <div className="flex items-center gap-1.5 px-2 pt-2">
            {TOOLS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => changeTool(t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={tool === t.id ? { backgroundColor: lensColour, color: '#fff' } : { color: 'var(--th-text-secondary)' }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
                {t.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1.5">
              {tool === 'pin' && hasPins && (
                <button type="button" onClick={() => setPins([])} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5">Clear pins</button>
              )}
              {tool === 'select' && hasPlaces && (
                <button type="button" onClick={() => setPlaces([])} className="px-2.5 py-1 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5">Clear places</button>
              )}
            </div>
          </div>

          {/* Highlighter: paint vs move (pan) the map — own row so it never wraps oddly. */}
          {tool === 'paint' && (
            <div className="flex items-center gap-1.5 px-2 pt-2">
              <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
                {(['paint', 'pan'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaintMode(m)}
                    className="px-3 py-1 text-[11px] font-semibold transition-colors"
                    style={paintMode === m ? { backgroundColor: lensColour, color: '#fff' } : { color: 'var(--th-text-secondary)' }}
                  >
                    {m === 'paint' ? 'Paint' : 'Move'}
                  </button>
                ))}
              </div>
              {hasStrokes && (
                <button type="button" onClick={() => setStrokes([])} className="ml-auto px-2.5 py-1 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5">Clear brush</button>
              )}
            </div>
          )}

          {tool === 'select' && (
            <div className="px-2 pt-2">
              <div className="flex items-center gap-1.5">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runSearch(); } }}
                  placeholder="Tap a name on the map, or search here…"
                  className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-xs bg-black/[0.03] border border-black/10 focus:outline-none focus:border-black/25"
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(''); setResults([]); }} className="shrink-0 px-2 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5" aria-label="Clear search">✕</button>
                )}
                <button type="button" onClick={() => void runSearch()} disabled={searching || !query.trim()} className="shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: lensColour }}>
                  {searching ? '…' : 'Search'}
                </button>
              </div>
              {/* Floating results — overlay the top of the map so they don't steal map height. */}
              {results.length > 0 && (
                <ul className="absolute left-2 right-2 mt-1.5 max-h-52 overflow-y-auto rounded-lg border border-black/10 bg-warm-white shadow-xl divide-y divide-black/5">
                  {results.map((r, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => addPlaceFromResult(r)} className="w-full text-left px-2.5 py-2 text-xs hover:bg-black/5">
                        <span className="font-medium text-text-primary">{r.name}</span>
                        <span className="ml-1 text-text-muted">· {r.kind}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="px-2.5 pb-1.5 pt-1 text-[11px] text-text-muted">
            {tool === 'pin'
              ? `Tap the map to drop a pin${hasPins ? ' · tap a pin to remove it' : ''}.`
              : tool === 'paint'
                ? (paintMode === 'paint' ? 'Press and drag to paint a highlight — swipe over the area.' : 'Move mode: drag to pan the map. Switch to Paint to highlight.')
                : selecting
                  ? 'Finding the place you tapped…'
                  : `Tap a place name on the map to select it${hasPlaces ? ' · tap a selected area to remove it' : ''}.`}
          </p>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="w-full h-full" />

        {onMapTypeChange && (
          <button
            type="button"
            onClick={() => onMapTypeChange(mapType === 'default' ? 'satellite' : 'default')}
            className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-warm-white/95 shadow-lg backdrop-blur text-text-primary"
            aria-label={`Switch to ${mapType === 'default' ? 'satellite' : 'map'} view`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
            </svg>
            {mapType === 'default' ? 'Satellite' : 'Map'}
          </button>
        )}
      </div>
    </div>
  );
}
