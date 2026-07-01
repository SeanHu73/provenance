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
import { boundaryAtPoint, type PlaceResult } from '../places';
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
  /** Show this context's geometry on the browse map (drawn + framed); null clears
   *  it and returns to defaultView. `colour` tints the highlight to its lens. */
  focus?: { geometry: Geometry | null; camera: Camera | null; colour?: string } | null;
  /** Fires on every settle (moveend) so an admin can capture the current view. */
  onViewportChange?: (v: { center: [number, number]; zoom: number; bounds: Bounds }) => void;
  /** Basemap style. */
  mapType?: MapType;
  /** When provided, a Map/Satellite toggle button is shown that calls this. */
  onMapTypeChange?: (t: MapType) => void;
  /** Reports the active draw tool so the parent can render the matching controls
   *  (e.g. the place search bar) OUTSIDE the map. */
  onToolChange?: (t: DrawTool) => void;
  /** Place tool: when the user taps a place label on the map, its name is
   *  reported here (null = tapped somewhere with no place name). */
  onTapName?: (name: string | null) => void;
  /** Place tool: a tap that resolved straight to a boundary (touch fallback). */
  onTapBoundary?: (result: PlaceResult) => void;
  /** Place tool: a boundary the parent wants shown (from its search) — bumping
   *  `nonce` re-applies it even if the geometry is unchanged. */
  boundary?: { geometry: Geometry; nonce: number } | null;
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
  onToolChange, onTapName, onTapBoundary, boundary,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onDrawChangeRef = useRef(onDrawChange);
  onDrawChangeRef.current = onDrawChange;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const onTapNameRef = useRef(onTapName);
  onTapNameRef.current = onTapName;
  const onTapBoundaryRef = useRef(onTapBoundary);
  onTapBoundaryRef.current = onTapBoundary;
  const [tool, setTool] = useState<DrawTool>('pin');
  const toolRef = useRef<DrawTool>('pin');
  toolRef.current = tool;
  const [hasGeometry, setHasGeometry] = useState(false);
  const [usingFreehand, setUsingFreehand] = useState(true);

  // Report the active tool up so the parent can render the place search bar
  // OUTSIDE the map.
  const onToolChangeRef = useRef(onToolChange);
  onToolChangeRef.current = onToolChange;
  useEffect(() => { onToolChangeRef.current?.(tool); }, [tool]);

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
    // The +/- zoom buttons (NavigationControl) are the source of the "tap zooms"
    // bug on the authoring map — a tap ends up firing the focused "+" button's
    // handler (Map.zoomIn). Drawing taps must never zoom, and pinch/scroll cover
    // deliberate zoom, so omit the control in add mode. Browse maps keep it.
    if (mode !== 'add') {
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    }
    // In add/edit mode a tap (to drop a pin, pick a place, or finish a region)
    // must NOT also zoom — disable double-click zoom so taps don't jump the map.
    if (mode === 'add') {
      // A tap must never zoom. Double-click zoom off, and scroll/trackpad zoom
      // off too — Mac trackpad taps can emit a stray wheel event that Mapbox
      // turns into a +1 zoom. Deliberate zoom is via the +/- buttons (and pinch).
      map.doubleClickZoom.disable();
      // Root cause of "a map tap fires a toolbar/zoom button": focus stays on the
      // last button, and the tap gets routed to it. Blur any focused button the
      // instant the map canvas is touched, BEFORE the click is dispatched.
      map.getCanvas().addEventListener('pointerdown', () => {
        const ae = document.activeElement;
        if (ae instanceof HTMLElement && ae.tagName === 'BUTTON') ae.blur();
      }, { passive: true });
      // scrollZoom stays ENABLED so trackpad pinch still zooms — the tap-zoom is a
      // programmatic zoomTo (per the trace), not scroll, so this is safe.
      // Narrow guard: the tap-zoom fires ~4ms after the tap, so cancel any zoom
      // that starts within 150ms of a tap (a deliberate pinch won't be that close).
      let tapAt = 0;
      let zoomAtTap = map.getZoom();
      let correcting = false;
      map.on('click', (e) => {
        tapAt = performance.now();
        zoomAtTap = map.getZoom();
        console.log('[cj-map] click @', Math.round(e.point.x), Math.round(e.point.y), '· zoom', map.getZoom().toFixed(2));
      });
      map.on('zoomstart', () => {
        if (correcting) return;
        const since = Math.round(performance.now() - tapAt);
        if (since < 150) {
          const stack = (new Error().stack || '')
            .split('\n').slice(2, 14)
            .map((s) => s.trim().replace(/https?:\/\/[^)]*\/chunks\//, '').replace(/\)$/, ''))
            .join('\n  ');
          console.log('[cj-map] tap-zoom src:\n  ' + stack);
          correcting = true;
          map.stop();
          map.setZoom(zoomAtTap);
          setTimeout(() => { correcting = false; }, 60);
        }
      });
    }
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

  // ── browse: draw + frame the focused context's geometry; null clears it ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'browse') return;
    const SRC = 'cj-focus';
    const colour = focus?.colour ?? '#175E54';
    const apply = () => {
      // upsert the highlight source + layers, tinted to the lens colour
      const data = {
        type: 'FeatureCollection' as const,
        features: focus?.geometry ? [{ type: 'Feature' as const, properties: {}, geometry: focus.geometry }] : [],
      };
      const existing = map.getSource(SRC) as mapboxgl.GeoJSONSource | undefined;
      if (!existing) {
        map.addSource(SRC, { type: 'geojson', data: data as GeoJSON.FeatureCollection });
        map.addLayer({ id: 'cj-focus-fill', type: 'fill', source: SRC, filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': colour, 'fill-opacity': 0.28 } });
        map.addLayer({ id: 'cj-focus-line', type: 'line', source: SRC, filter: ['==', '$type', 'Polygon'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': colour, 'line-width': 2.5 } });
        map.addLayer({ id: 'cj-focus-pt-outer', type: 'circle', source: SRC, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 9, 'circle-color': '#FFFFFF' } });
        map.addLayer({ id: 'cj-focus-pt-inner', type: 'circle', source: SRC, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': colour } });
      } else {
        existing.setData(data as GeoJSON.FeatureCollection);
        if (map.getLayer('cj-focus-fill')) map.setPaintProperty('cj-focus-fill', 'fill-color', colour);
        if (map.getLayer('cj-focus-line')) map.setPaintProperty('cj-focus-line', 'line-color', colour);
        if (map.getLayer('cj-focus-pt-inner')) map.setPaintProperty('cj-focus-pt-inner', 'circle-color', colour);
      }
      // then frame it
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
  }, [focus, defaultView, mode]);

  // ── add-mode drawing tools ──
  // Depend on `mode` ONLY. It used to also depend on `lensColour`, which tore
  // the whole draw down (deleting the in-progress shape) whenever the parent
  // re-rendered — that's why a tap's pin, and a drawn highlight, were wiped by a
  // fresh startTool right after being created.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'add') return;
    console.log('[cj-map] add-effect RUN · initGeom', initialGeometry ? (initialGeometry as Geometry).type : 'null');

    let cancelled = false;
    let draw: MapboxDraw;

    const emit = () => {
      const feats = draw.getAll().features;
      let geometry: Geometry | null = null;
      if (feats.length === 1) {
        geometry = feats[0].geometry as Geometry;
      } else if (feats.length > 1) {
        // Several pins → one MultiPoint; otherwise fall back to the first shape.
        const pts = feats.filter((f) => f.geometry.type === 'Point').map((f) => (f.geometry as GeoJSON.Point).coordinates);
        geometry = pts.length === feats.length
          ? { type: 'MultiPoint', coordinates: pts }
          : (feats[0].geometry as Geometry);
      }
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
      // Belt-and-suspenders: ensure no click/dblclick zoom while drawing.
      map.doubleClickZoom.disable();

      // Seed any existing geometry (edit case): keep it, frame it, and make it
      // editable. Crucially we must NOT then run startTool — it calls deleteAll()
      // and would wipe the seeded shape (that was the "edit loses the map" bug).
      const seededIds = initialGeometry
        ? draw.add({ type: 'Feature', properties: {}, geometry: initialGeometry as Geometry })
        : [];

      map.on('draw.create', onCreate);
      map.on('draw.update', emit);
      map.on('draw.delete', emit);
      map.on('click', onPlaceClick);

      // Arm the tool as soon as the style is ready — NOT on 'idle', which may
      // never fire while the modal animates/resizes (that left the draw in
      // select mode, so taps didn't create pins).
      const finish = () => {
        if (cancelled) return;
        if (initialGeometry) {
          setHasGeometry(true);
          const bb = bboxOf(initialGeometry as Geometry);
          if (bb) map.fitBounds(bb, { padding: 44, duration: 0, maxZoom: 16 });
          // Polygons → direct_select so vertices/midpoints drag; points → movable.
          const t = (initialGeometry as Geometry).type;
          if ((t === 'Polygon' || t === 'MultiPolygon') && seededIds[0]) {
            try { draw.changeMode('direct_select', { featureId: seededIds[0] }); }
            catch { draw.changeMode('simple_select'); }
          } else {
            draw.changeMode('simple_select');
          }
        } else {
          startTool(tool, draw);
        }
      };
      if (map.isStyleLoaded()) finish(); else map.once('load', finish);
    };

    // Smooth a freehand-painted region into a clean shape on completion. The
    // re-added smoothed feature carries `properties.s` so it isn't smoothed again
    // (and programmatic adds — boundary select — skip straight to emit).
    const onCreate = (e: DrawCreateEvt) => {
      const f = e.features?.[0];
      console.log('[cj-map] created', f?.geometry?.type, '· tool', toolRef.current, '· s', f?.properties?.s ?? 0);
      // Highlight: smooth the freehand path once (re-add carries properties.s).
      if (f && toolRef.current === 'highlight' && f.geometry?.type === 'Polygon' && !f.properties?.s) {
        const smooth = smoothPolygon(f.geometry);
        if (smooth && f.id != null) {
          draw.delete(String(f.id));
          draw.add({ type: 'Feature', properties: { s: 1 }, geometry: smooth });
          return; // the re-add fires draw.create again (s:1) → handled below
        }
      }
      // A polygon has settled → open vertex editing so its dots/midpoints drag.
      if (f && f.geometry?.type === 'Polygon' && f.id != null) {
        const id = String(f.id);
        setTimeout(() => { if (!cancelled) { try { draw.changeMode('direct_select', { featureId: id }); } catch { /* keep current */ } } }, 0);
      }
      // Pin: re-arm so the learner can drop more pins (emit combines to MultiPoint).
      if (toolRef.current === 'pin' && f?.geometry?.type === 'Point') {
        setTimeout(() => { if (!cancelled && toolRef.current === 'pin') { try { draw.changeMode('draw_point'); } catch { /* keep current */ } } }, 0);
      }
      emit();
    };

    // Place tool: a tap picks a place. First try the label under the tap (a
    // generous box so a finger lands on it); if none — common on touch, where
    // labels are tiny — fall back to reverse-geocoding the tapped point so a tap
    // *near* a place still resolves it. The resolved name is reported up.
    const onPlaceClick = (e: mapboxgl.MapMouseEvent) => {
      if (toolRef.current !== 'place') return;
      const pad = 16;
      const hits = map.queryRenderedFeatures(
        [[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]],
      );
      const label = hits.find((f) =>
        /label/.test(String(f.layer?.id ?? '')) &&
        (f.properties?.name_en || f.properties?.name));
      if (label) {
        const name = String(label.properties?.name_en || label.properties?.name);
        console.debug('[context-journal] place tap → label', name);
        onTapNameRef.current?.(name);
        return;
      }
      // No label under the tap (common on touch) → reverse-geocode the point
      // straight to the enclosing boundary and select it directly.
      console.debug('[context-journal] place tap → no label, reverse-geocoding boundary');
      boundaryAtPoint(e.lngLat.lng, e.lngLat.lat)
        .then((result) => {
          if (result && onTapBoundaryRef.current) onTapBoundaryRef.current(result);
          else onTapNameRef.current?.(null);
        })
        .catch((err) => { console.error('[context-journal] reverse lookup failed:', err); onTapNameRef.current?.(null); });
    };

    void setup();
    return () => {
      console.log('[cj-map] add-effect CLEANUP');
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
    // Only `mode` — NOT lensColour (see note above). Lens colour changes update
    // the draw styles via the effect below without rebuilding the draw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Retint the draw layers when the lens colour changes (no rebuild).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== 'add') return;
    for (const [id, prop] of [['gl-draw-polygon-fill.hot', 'fill-color'], ['gl-draw-polygon-fill.cold', 'fill-color'], ['gl-draw-polygon-stroke-active.hot', 'line-color'], ['gl-draw-polygon-stroke-active.cold', 'line-color'], ['gl-draw-point-inner.hot', 'circle-color'], ['gl-draw-point-inner.cold', 'circle-color']] as const) {
      try { if (map.getLayer(id)) map.setPaintProperty(id, prop, lensColour); } catch { /* layer id may differ across draw versions */ }
    }
  }, [lensColour, mode]);

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
    const stack = (new Error().stack || '').split('\n').slice(2, 7)
      .map((s) => s.trim().replace(/https?:\/\/[^)]*\/chunks\//, '').replace(/\)$/, '')).join('\n  ');
    console.log('[cj-map] startTool →', next, '\n  ' + stack);
    draw.deleteAll();
    setHasGeometry(false);
    onDrawChangeRef.current?.({ geometry: null, camera: null });
    if (next === 'pin') draw.changeMode('draw_point');
    else if (next === 'highlight') draw.changeMode('draw_polygon');
    else draw.changeMode('simple_select'); // place: tap/search drives it
  }

  const handleTool = (next: DrawTool) => {
    setTool(next);
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

  // ── show a boundary chosen in the parent's place search ──
  // Draw it as a movable region (simple_select keeps map-drag/pan working), fit
  // to it, and emit so the geometry flows back through onDrawChange like any draw.
  useEffect(() => {
    if (!boundary) return;
    const draw = drawRef.current;
    const map = mapRef.current;
    if (!draw) return;
    draw.deleteAll();
    draw.add({ type: 'Feature', properties: {}, geometry: boundary.geometry });
    draw.changeMode('simple_select');
    const bb = bboxOf(boundary.geometry);
    if (map && bb) map.fitBounds(bb, { padding: 36, duration: 800 });
    pushGeometry(boundary.geometry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundary?.nonce]);

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
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => { if (e.detail === 0) return; handleClear(); e.currentTarget.blur(); }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5"
            >
              Clear
            </button>
          </div>

          <div className="absolute bottom-2 left-0 right-0 z-10 text-center pointer-events-none">
            <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-black/55 text-white">
              {hasGeometry
                ? '✓ Location set — drag to move, or Clear to redo'
                : tool === 'pin'
                  ? 'Tap the map to drop pins — add as many as you like'
                  : tool === 'place'
                    ? 'Tap a place name on the map, or use the search above'
                    : usingFreehand ? 'Draw around an area to highlight it' : 'Tap to outline a region, double-tap to finish'}
            </span>
          </div>
        </>
      )}

      {/* Map / Satellite toggle */}
      {onMapTypeChange && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { onMapTypeChange(mapType === 'default' ? 'satellite' : 'default'); e.currentTarget.blur(); }}
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
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        console.log('[cj-map] toolbtn onClick', label, '· detail', e.detail, '· trusted', e.isTrusted);
        if (e.detail === 0) return; // ignore synthetic / keyboard-focus activations
        onClick();
        e.currentTarget.blur();
      }}
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
