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
import type { Geometry } from 'geojson';
import { MAP_STYLE, DEFAULT_CAMERA } from '../constants';
import type { Bounds, Camera, DrawResult, DrawTool, MapMode } from '../types';

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
  /** Constrain panning/zooming to this box (the admin "constrain" box). */
  maxBounds?: Bounds | null;
  /** Show the GPS "locate me" control (a dot at the viewer's position + recenter). */
  geolocate?: boolean;
  /** Fly the map to show this context's geometry; null returns to defaultView. */
  focus?: { geometry: Geometry | null; camera: Camera | null } | null;
  /** Fires on every settle (moveend) so an admin can capture the current view. */
  onViewportChange?: (v: { center: [number, number]; zoom: number; bounds: Bounds }) => void;
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

/** Minimal mapbox-gl-draw style set, tinted to the active lens colour. */
function drawStyles(colour: string) {
  return [
    // Polygon fill (highlight region) — low opacity wash.
    { id: 'gl-draw-polygon-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon']],
      paint: { 'fill-color': colour, 'fill-opacity': 0.22 } },
    { id: 'gl-draw-polygon-stroke', type: 'line', filter: ['all', ['==', '$type', 'Polygon']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': colour, 'line-width': 2.5 } },
    // Point (pin).
    { id: 'gl-draw-point-outer', type: 'circle', filter: ['all', ['==', '$type', 'Point']],
      paint: { 'circle-radius': 9, 'circle-color': '#FFFFFF' } },
    { id: 'gl-draw-point-inner', type: 'circle', filter: ['all', ['==', '$type', 'Point']],
      paint: { 'circle-radius': 6, 'circle-color': colour } },
  ];
}

export default function ContextMap({
  mode, lensColour = '#347C4A', initialCamera, initialGeometry, onDrawChange,
  defaultView, maxBounds, geolocate, focus, onViewportChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const onDrawChangeRef = useRef(onDrawChange);
  onDrawChangeRef.current = onDrawChange;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const [tool, setTool] = useState<DrawTool>('pin');
  const [hasGeometry, setHasGeometry] = useState(false);
  const [usingFreehand, setUsingFreehand] = useState(true);

  // ── init map (once) ──
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
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

  // ── pan/zoom constraint (the admin "constrain" box) ──
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    // setMaxBounds(null) clears the constraint at runtime; v3's type is strict.
    (m.setMaxBounds as (b: Bounds | null) => void)(maxBounds ?? null);
  }, [maxBounds]);

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

      map.on('draw.create', emit);
      map.on('draw.update', emit);
      map.on('draw.delete', emit);
      // Start in the currently-selected tool.
      map.once('idle', () => { if (!cancelled) startTool(tool, draw); });
    };

    void setup();
    return () => {
      cancelled = true;
      if (draw) {
        map.off('draw.create', emit);
        map.off('draw.update', emit);
        map.off('draw.delete', emit);
        try { map.removeControl(draw); } catch { /* already gone */ }
      }
      drawRef.current = null;
    };
    // re-init drawing when colour changes so the fill matches the active lens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, lensColour]);

  /** Switch the active drawing tool: one pin, or a single freehand region. */
  function startTool(next: DrawTool, draw = drawRef.current) {
    if (!draw) return;
    draw.deleteAll();
    setHasGeometry(false);
    onDrawChangeRef.current?.({ geometry: null, camera: null });
    if (next === 'pin') draw.changeMode('draw_point');
    else draw.changeMode('draw_polygon');
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
          <div className="absolute top-2 left-2 z-10 flex gap-1.5 rounded-xl p-1 bg-warm-white/95 shadow-lg backdrop-blur">
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
            <button
              onClick={handleClear}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-text-secondary hover:bg-black/5"
            >
              Clear
            </button>
          </div>

          <div className="absolute bottom-2 left-2 right-2 z-10 text-center pointer-events-none">
            <span className="inline-block px-3 py-1.5 rounded-full text-xs font-medium bg-black/55 text-white">
              {hasGeometry
                ? '✓ Location set — adjust or Clear to redraw'
                : tool === 'pin'
                  ? 'Tap the map to drop a pin'
                  : usingFreehand ? 'Drag to colour in a region' : 'Tap to outline a region, double-tap to finish'}
            </span>
          </div>
        </>
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
