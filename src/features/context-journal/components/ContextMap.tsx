'use client';

/**
 * ContextMap — the Context Journal's Mapbox GL map.
 *
 * Two modes:
 *   - browse: a plain base map (saved geometry is NOT drawn yet — deferred; the
 *     P.A.S.T. list is driven by the timeline, not geography, in this phase).
 *   - add:    editing tools enabled. A small toolbar lets the user drop a single
 *     Pin, or "colour in" a freehand Highlight region (falls back to polygon
 *     mode if the freehand mode fails to load). Drawn geometry is filled in the
 *     active lens colour at low opacity. The result (GeoJSON geometry + map
 *     centre/zoom) is emitted via onDrawChange.
 *
 * This component is the ONLY place mapbox-gl is imported, and it is loaded via a
 * dynamic import (ssr: false) from ContextMapLoader — so mapbox never enters the
 * tour bundle. Kept isolated so its behaviour can extend later.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import type { Geometry, Polygon } from 'geojson';
import { MAP_STYLES, DEFAULT_CAMERA } from '../constants';
import { searchPlaces, placesAtPoint, type PlaceResult, type PlaceCandidate } from '../places';
import type { Bounds, Camera, DrawResult, DrawTool, MapMode, MapType } from '../types';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

interface Props {
  mode: MapMode;
  /** Active lens colour for the highlight fill (add mode). */
  lensColour?: string;
  /** Camera/geometry to open on (e.g. when editing an existing context). */
  initialCamera?: { center: [number, number]; zoom: number } | null;
  initialGeometry?: Geometry | null;
  /** Fired as the user draws/clears in add mode. */
  onDrawChange?: (result: DrawResult) => void;
  /** Admin-set default view the browse map opens on / returns to. */
  defaultView?: { center: [number, number]; zoom: number } | null;
  /** Show the GPS "locate me" control (a dot at the viewer's position + recenter). */
  geolocate?: boolean;
  /** Fly the map to show this context's geometry; null returns to defaultView. */
  focus?: { geometry: Geometry | null; camera: Camera | null } | null;
  /** Fires on every settle (moveend) so an admin can capture the current view. */
  onViewportChange?: (v: { center: [number, number]; zoom: number; bounds: Bounds }) => void;
  /** Basemap style. */
  mapType?: MapType;
  /** When provided, a Map/Satellite toggle button is shown that calls this. */
  onMapTypeChange?: (t: MapType) => void;
}

/** Bounding box of a geometry, or null for a point / empty (caller flies instead). */
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
  visit((geom as { coordinates?: unknown }).coordinates);
  if (!found || (minX === maxX && minY === maxY)) return null;
  return [[minX, minY], [maxX, maxY]];
}

type Ring = [number, number][];

/** mapbox-gl-draw's draw.create payload (only the bits we read). */
interface DrawCreateEvt {
  features?: Array<{ id?: string | number; geometry: Geometry; properties?: Record<string, unknown> | null }>;
}

/** Perpendicular distance from p to the line a–b (planar; fine at these scales). */
function perpDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const [px, py] = p, [ax, ay] = a, [bx, by] = b;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** Douglas–Peucker simplification — strips the jitter out of a hand-drawn path. */
function simplify(points: Ring, tol: number): Ring {
  if (points.length < 3) return points;
  let maxD = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, idx + 1), tol).slice(0, -1), ...simplify(points.slice(idx), tol)];
}

/** Chaikin corner-cutting on a closed ring — rounds the simplified outline into
 *  a smooth, "complete" shape. */
function chaikin(ring: Ring, iterations = 2): Ring {
  let pts = ring.slice(0, -1); // drop the duplicate closing point
  for (let it = 0; it < iterations; it++) {
    const next: Ring = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % pts.length];
      next.push([x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25]);
      next.push([x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75]);
    }
    pts = next;
  }
  pts.push(pts[0]); // re-close
  return pts;
}

/** Turn a rough freehand polygon into a clean, smoothed shape. */
function smoothPolygon(geom: Geometry): Polygon | null {
  if (geom.type !== 'Polygon') return null;
  const ring = geom.coordinates[0] as Ring;
  if (!ring || ring.length < 4) return geom as Polygon;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  // Tolerance scales with the shape's size so it works at any zoom/region.
  const tol = Math.max(maxX - minX, maxY - minY) * 0.012;
  const simplified = simplify(ring, tol);
  if (simplified.length < 4) return geom as Polygon;
  return { type: 'Polygon', coordinates: [chaikin(simplified)] };
}

/** mapbox-gl-draw style set tinted to the active lens — the region reads like a
 *  translucent highlighter swipe (see-through fill + soft wide stroke). */
function drawStyles(colour: string) {
  return [
    { id: 'gl-draw-polygon-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon']],
      paint: { 'fill-color': colour, 'fill-opacity': 0.32 } },
    // Soft wide band under a crisper edge — evokes a marker stroke.
    { id: 'gl-draw-polygon-glow', type: 'line', filter: ['all', ['==', '$type', 'Polygon']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colour, 'line-width': 10, 'line-opacity': 0.18 } },
    { id: 'gl-draw-polygon-stroke', type: 'line', filter: ['all', ['==', '$type', 'Polygon']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colour, 'line-width': 2, 'line-opacity': 0.55 } },
    // Point (pin).
    { id: 'gl-draw-point-outer', type: 'circle', filter: ['all', ['==', '$type', 'Point']],
      paint: { 'circle-radius': 9, 'circle-color': '#FFFFFF' } },
    { id: 'gl-draw-point-inner', type: 'circle', filter: ['all', ['==', '$type', 'Point']],
      paint: { 'circle-radius': 6, 'circle-color': colour } },
  ];
}

export default function ContextMap({
  mode, lensColour = '#347C4A', initialCamera, initialGeometry, onDrawChange,
  defaultView, geolocate, focus, onViewportChange, mapType = 'default', onMapTypeChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onDrawChangeRef = useRef(onDrawChange);
  onDrawChangeRef.current = onDrawChange;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const [tool, setTool] = useState<DrawTool>('pin');
  const toolRef = useRef<DrawTool>('pin');
  toolRef.current = tool;
  const [hasGeometry, setHasGeometry] = useState(false);
  const [usingFreehand, setUsingFreehand] = useState(true);
  // Place tool: boundary search (type) + tap-to-pick candidates (tap the map).
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

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
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    if (geolocate) {
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
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

    // In a flex/dynamic layout the container can settle to its real size AFTER
    // the map initialises; without a resize the map computes zero tile coverage
    // and stays blank. Observe the container and resize the map to match.
    map.once('load', () => map.resize());
    const ro = new ResizeObserver(() => map.resize());
    if (containerRef.current) ro.observe(containerRef.current);

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── basemap switching (browse) ──
  // In ADD mode the parent remounts the map on a type change (re-seeding the
  // drawn geometry), so setStyle here only ever runs for the browse map — where
  // there's no draw control to clobber. A ref guards the initial mount.
  const styleRef = useRef<MapType>(mapType);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleRef.current === mapType) return;
    styleRef.current = mapType;
    map.setStyle(MAP_STYLES[mapType]);
    map.once('style.load', () => map.resize());
  }, [mapType]);

  // ── fly to a focused context's area; null returns to the default view ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      if (focus?.geometry) {
        const bb = bboxOf(focus.geometry);
        if (bb) {
          map.fitBounds(bb, { padding: 56, duration: 900, maxZoom: 16 });
        } else {
          const c = focus.camera?.center
            ?? (focus.geometry.type === 'Point' ? (focus.geometry.coordinates as [number, number]) : null);
          if (c) map.flyTo({ center: c, zoom: focus.camera?.zoom ?? 15, duration: 900 });
        }
      } else if (defaultView) {
        map.flyTo({ center: defaultView.center, zoom: defaultView.zoom, duration: 900 });
      }
    };
    if (map.isStyleLoaded()) apply(); else map.once('load', apply);
  }, [focus, defaultView]);

  // ── add-mode drawing tools ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'add') return;

    let cancelled = false;
    let draw: MapboxDraw;

    const emit = () => {
      const fc = draw.getAll();
      const feature = fc.features[0];
      const geometry = (feature?.geometry as Geometry) ?? null;
      setHasGeometry(!!geometry);
      const c = map.getCenter();
      onDrawChangeRef.current?.({
        geometry,
        camera: geometry ? { center: [c.lng, c.lat], zoom: map.getZoom() } : null,
      });
    };

    const setup = async () => {
      // Prefer freehand "colour in" mode; fall back to standard polygon.
      const modes: Record<string, object> = { ...MapboxDraw.modes };
      let freehandOk = true;
      try {
        const Freehand = (await import('mapbox-gl-draw-freehand-mode')).default;
        modes.draw_polygon = Freehand;
      } catch {
        freehandOk = false;
      }
      if (cancelled) return;
      setUsingFreehand(freehandOk);

      draw = new MapboxDraw({
        displayControlsDefault: false,
        // Freehand mode is a plain mode object; relax the strict modes typing.
        modes: modes as NonNullable<ConstructorParameters<typeof MapboxDraw>[0]>['modes'],
        styles: drawStyles(lensColour),
      });
      drawRef.current = draw;
      map.addControl(draw);

      // Seed any existing geometry (edit case).
      if (initialGeometry) {
        draw.add({ type: 'Feature', properties: {}, geometry: initialGeometry as Geometry });
        setHasGeometry(true);
      }

      map.on('draw.create', onCreate);
      map.on('draw.update', emit);
      map.on('draw.delete', emit);
      map.on('click', onPlaceClick);
      // Start in the currently-selected tool.
      map.once('idle', () => { if (!cancelled) startTool(tool, draw); });
    };

    // Smooth a freehand-painted region into a clean shape on completion. The
    // re-added smoothed feature carries `properties.s` so it isn't smoothed again
    // (and programmatic adds — boundary select — skip straight to emit).
    const onCreate = (e: DrawCreateEvt) => {
      const f = e.features?.[0];
      if (f && toolRef.current === 'highlight' && f.geometry?.type === 'Polygon' && !f.properties?.s) {
        const smooth = smoothPolygon(f.geometry);
        if (smooth && f.id != null) {
          draw.delete(String(f.id));
          draw.add({ type: 'Feature', properties: { s: 1 }, geometry: smooth });
          return; // the re-add fires draw.create again (s:1) → emits below
        }
      }
      emit();
    };

    // Place tool: tapping the map reverse-geocodes the point into city/state/
    // country options to highlight (the typed search is the other way in).
    const onPlaceClick = (e: mapboxgl.MapMouseEvent) => {
      if (toolRef.current !== 'place') return;
      console.debug('[context-journal] place tap', e.lngLat.lng.toFixed(4), e.lngLat.lat.toFixed(4));
      setPlaceCandidates([]);
      setPlaceResults([]);
      setPlaceBusy(true);
      setPlaceError(null);
      placesAtPoint(e.lngLat.lng, e.lngLat.lat)
        .then((cands) => {
          console.debug('[context-journal] place tap →', cands.length, 'candidates');
          setPlaceCandidates(cands);
          if (cands.length === 0) setPlaceError('No named area found there — try the search box.');
        })
        .catch((err) => {
          console.error('[context-journal] place tap failed:', err);
          setPlaceError('Tap lookup failed — try the search box.');
        })
        .finally(() => setPlaceBusy(false));
    };

    void setup();
    return () => {
      cancelled = true;
      if (draw) {
        map.off('draw.create', onCreate);
        map.off('draw.update', emit);
        map.off('draw.delete', emit);
        map.off('click', onPlaceClick);
        try { map.removeControl(draw); } catch { /* already gone */ }
      }
      drawRef.current = null;
    };
    // re-init drawing when colour changes so the fill matches the active lens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lensColour]);

  /** Emit the current geometry with the live camera (used when geometry is set
   *  outside the draw event flow — boundary select). */
  const pushGeometry = (geometry: Geometry | null) => {
    const map = mapRef.current;
    setHasGeometry(!!geometry);
    const c = map?.getCenter();
    onDrawChangeRef.current?.({
      geometry,
      camera: geometry && c && map ? { center: [c.lng, c.lat], zoom: map.getZoom() } : null,
    });
  };

  /** Switch the active tool. Each tool starts empty; pin/highlight draw
   *  immediately, place selects a boundary by tap or search. */
  function startTool(next: DrawTool, draw = drawRef.current) {
    if (!draw) return;
    draw.deleteAll();
    setHasGeometry(false);
    onDrawChangeRef.current?.({ geometry: null, camera: null });
    if (next === 'pin') draw.changeMode('draw_point');
    else if (next === 'highlight') draw.changeMode('draw_polygon');
    else draw.changeMode('simple_select'); // place: tap/search drives it
  }

  const handleTool = (next: DrawTool) => {
    setTool(next);
    if (next !== 'place') { setPlaceResults([]); setPlaceCandidates([]); setPlaceError(null); }
    startTool(next);
  };

  const handleClear = () => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    setHasGeometry(false);
    onDrawChangeRef.current?.({ geometry: null, camera: null });
    startTool(tool);
  };

  /** Drop a selected boundary onto the map as an editable region. */
  const applyBoundary = (result: PlaceResult) => {
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw) return;
    draw.deleteAll();
    draw.add({ type: 'Feature', properties: {}, geometry: result.geometry });
    draw.changeMode('simple_select');
    const bb = bboxOf(result.geometry);
    if (map && bb) map.fitBounds(bb, { padding: 36, duration: 800 });
    pushGeometry(result.geometry);
    setPlaceResults([]);
    setPlaceCandidates([]);
  };

  const runPlaceSearch = async () => {
    const q = placeQuery.trim();
    if (!q) return;
    setPlaceBusy(true);
    setPlaceError(null);
    setPlaceCandidates([]);
    try {
      const results = await searchPlaces(q);
      setPlaceResults(results);
      if (results.length === 0) setPlaceError('No matching place found.');
    } catch {
      setPlaceError('Search failed — check your connection and try again.');
    } finally {
      setPlaceBusy(false);
    }
  };

  /** Resolve a tapped candidate (e.g. "California (state)") to its boundary. */
  const selectCandidate = async (c: PlaceCandidate) => {
    setPlaceBusy(true);
    setPlaceError(null);
    try {
      const results = await searchPlaces(c.query);
      if (results[0]) applyBoundary(results[0]);
      else setPlaceError('Could not load that boundary.');
    } catch {
      setPlaceError('Could not load that boundary — try again.');
    } finally {
      setPlaceBusy(false);
    }
  };

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

  return (
    <div className="relative w-full h-full">
      {/* NB: mapbox-gl.css forces `.mapboxgl-map { position: relative }`, which
         would override an `absolute inset-0` here and collapse the height to 0.
         Size the container with h-full instead. */}
      <div ref={containerRef} className="w-full h-full" />

      {mode === 'add' && (
        <>
          <div className="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-center gap-1.5 rounded-xl p-1 bg-warm-white/95 shadow-lg backdrop-blur">
            <ToolBtn active={tool === 'pin'} onClick={() => handleTool('pin')} label="Pin" colour={lensColour}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-6.4-7-11a7 7 0 0114 0c0 4.6-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" />
              </svg>
            </ToolBtn>
            <ToolBtn active={tool === 'highlight'} onClick={() => handleTool('highlight')} label="Highlight" colour={lensColour}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
              </svg>
            </ToolBtn>
            <ToolBtn active={tool === 'place'} onClick={() => handleTool('place')} label="Place" colour={lensColour}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" />
              </svg>
            </ToolBtn>
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5"
            >
              Clear
            </button>
          </div>

          {/* Place — tap the map or search a city / state / country boundary */}
          {tool === 'place' && (
            <div className="absolute top-14 left-2 right-2 z-20 rounded-xl bg-warm-white/97 shadow-lg backdrop-blur p-2">
              <div className="flex gap-1.5">
                <input
                  value={placeQuery}
                  onChange={(e) => setPlaceQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runPlaceSearch(); } }}
                  placeholder="Search a city, state, or country…"
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-white text-sm"
                  style={{ borderColor: 'var(--th-border)' }}
                />
                <button
                  onClick={() => void runPlaceSearch()}
                  disabled={placeBusy || !placeQuery.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: lensColour }}
                >
                  {placeBusy ? '…' : 'Search'}
                </button>
              </div>
              <p className="mt-1 px-1 text-[11px] text-text-muted">…or tap the map to pick the area under your finger.</p>
              {placeError && <p className="mt-1 px-1 text-xs text-text-secondary">{placeError}</p>}
              {/* Tapped-point candidates (city / state / country) */}
              {placeCandidates.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {placeCandidates.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => void selectCandidate(c)}
                      className="px-2.5 py-1.5 rounded-full text-xs font-semibold border-2"
                      style={{ color: lensColour, borderColor: `${lensColour}66` }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              {/* Typed-search results */}
              {placeResults.length > 0 && (
                <ul className="mt-1.5 max-h-40 overflow-y-auto divide-y" style={{ borderColor: 'var(--th-border)' }}>
                  {placeResults.map((r, i) => (
                    <li key={i}>
                      <button
                        onClick={() => applyBoundary(r)}
                        className="w-full text-left px-2 py-2 hover:bg-black/5 rounded-md"
                      >
                        <span className="block text-sm text-text-primary leading-snug">{r.name}</span>
                        <span className="block text-[11px] text-text-muted capitalize">{r.kind}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="absolute bottom-2 left-0 right-0 z-10 text-center pointer-events-none">
            <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-black/55 text-white">
              {hasGeometry
                ? '✓ Location set — adjust or Clear to redraw'
                : tool === 'pin'
                  ? 'Tap the map to drop a pin'
                  : tool === 'place'
                    ? 'Tap an area, or search a city / state / country'
                    : usingFreehand ? 'Draw around an area to highlight it' : 'Tap to outline a region, double-tap to finish'}
            </span>
          </div>
        </>
      )}

      {/* Map / Satellite toggle */}
      {onMapTypeChange && (
        <button
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
  );
}

function ToolBtn({ active, onClick, label, colour, children }: {
  active: boolean; onClick: () => void; label: string; colour: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        active ? 'text-white' : 'text-text-secondary hover:bg-black/5'
      }`}
      style={active ? { backgroundColor: colour } : undefined}
    >
      {children}
      {label}
    </button>
  );
}
