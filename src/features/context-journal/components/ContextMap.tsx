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
import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson';
import { MAP_STYLES, DEFAULT_CAMERA } from '../constants';
import type { PlaceResult } from '../places';
import type { Bounds, Camera, DrawResult, DrawTool, MapMode, MapType } from '../types';

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
function parseGeometry(g: Geometry | null | undefined): { pins: LngLat[]; polys: Polygon[] } {
  const pins: LngLat[] = [];
  const polys: Polygon[] = [];
  const add = (geom: Geometry) => {
    switch (geom.type) {
      case 'Point': pins.push(geom.coordinates as LngLat); break;
      case 'MultiPoint': (geom.coordinates as LngLat[]).forEach((c) => pins.push(c)); break;
      case 'Polygon': polys.push(geom); break;
      case 'MultiPolygon': geom.coordinates.forEach((c) => polys.push({ type: 'Polygon', coordinates: c })); break;
      case 'GeometryCollection': geom.geometries.forEach(add); break;
      default: break;
    }
  };
  if (g) add(g);
  return { pins, polys };
}

/** Combine the layers back into a single stored geometry. */
function buildGeometry(pins: LngLat[], polys: Polygon[]): Geometry | null {
  const geoms: Geometry[] = [];
  if (pins.length === 1) geoms.push({ type: 'Point', coordinates: pins[0] });
  else if (pins.length > 1) geoms.push({ type: 'MultiPoint', coordinates: pins });
  polys.forEach((p) => geoms.push(p));
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
  return { type: 'FeatureCollection', features: polys.map((p): Feature => ({ type: 'Feature', properties: {}, geometry: p })) };
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
  const [polys] = useState<Polygon[]>(seed.polys); // display-only until region/place editing returns

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

    const onMapClick = (e: mapboxgl.MapMouseEvent) => {
      const pad = 12;
      const hits = map.queryRenderedFeatures(
        [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]],
        { layers: ['cj-pins-outer'] },
      );
      if (hits.length && hits[0].id != null) {
        const idx = Number(hits[0].id);
        setPins((prev) => prev.filter((_, i) => i !== idx));
      } else {
        setPins((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      }
    };

    const setup = () => {
      if (cancelled || !mapRef.current) return;
      if (!map.getSource('cj-polys')) {
        map.addSource('cj-polys', { type: 'geojson', data: polysFC(polys) });
        map.addLayer({ id: 'cj-polys-fill', type: 'fill', source: 'cj-polys', paint: { 'fill-color': lensColour, 'fill-opacity': 0.28 } });
        map.addLayer({ id: 'cj-polys-line', type: 'line', source: 'cj-polys', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': lensColour, 'line-width': 2.5 } });
      }
      if (!map.getSource('cj-pins')) {
        map.addSource('cj-pins', { type: 'geojson', data: pinsFC(pinsRef.current) });
        map.addLayer({ id: 'cj-pins-outer', type: 'circle', source: 'cj-pins', paint: { 'circle-radius': 9, 'circle-color': '#FFFFFF', 'circle-stroke-width': 1, 'circle-stroke-color': 'rgba(0,0,0,0.18)' } });
        map.addLayer({ id: 'cj-pins-inner', type: 'circle', source: 'cj-pins', paint: { 'circle-radius': 6, 'circle-color': lensColour } });
      }
      // frame any seeded geometry
      const g = buildGeometry(pinsRef.current, polys);
      if (g) { const bb = bboxOf(g); if (bb) map.fitBounds(bb, { padding: 44, duration: 0, maxZoom: 16 }); }
      map.getCanvas().style.cursor = 'crosshair';
      map.on('click', onMapClick);
    };

    if (map.isStyleLoaded()) setup(); else map.once('load', setup);
    return () => {
      cancelled = true;
      try { map.off('click', onMapClick); map.getCanvas().style.cursor = ''; } catch { /* map gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── sync pin data + emit whenever pins change ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'add') return;
    const src = map.getSource('cj-pins') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return; // setup will seed the first time
    src.setData(pinsFC(pins));
    const g = buildGeometry(pins, polys);
    const c = map.getCenter();
    onDrawChangeRef.current?.({ geometry: g, camera: g ? { center: [c.lng, c.lat], zoom: map.getZoom() } : null });
  }, [pins, polys, mode]);

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

  return (
    <div className="w-full h-full flex flex-col">
      {mode === 'add' && (
        <div className="shrink-0 flex items-center justify-between gap-2 px-2 py-1.5 bg-warm-white border-b" style={{ borderColor: 'var(--th-border)' }}>
          <span className="text-xs text-text-secondary">
            Tap the map to drop a pin{hasPins ? ' · tap a pin to remove it' : ''}.
            {polys.length > 0 && <span className="text-text-muted"> (Region/place kept — editing returns soon.)</span>}
          </span>
          {hasPins && (
            <button
              type="button"
              onClick={() => setPins([])}
              className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5"
            >
              Clear pins
            </button>
          )}
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
