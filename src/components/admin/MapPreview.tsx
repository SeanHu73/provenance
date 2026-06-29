'use client';

/**
 * Throwaway 3D map preview (Mapbox Standard style) to judge how a "walk around
 * campus in 3D" experience would feel before building it for real:
 *   - extruded 3D buildings + terrain (Standard style), tilted.
 *   - test pins (do they read in 3D? they fade when behind a building via
 *     `occludedOpacity`).
 *   - GPS "locate me" with a heading cone.
 *   - "Follow my compass" toggle: rotates the map to the phone's heading.
 *
 * Mapbox is imported only here (this route), never in the tour/app bundle.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// A few Stanford landmarks to sanity-check pins in 3D.
const PINS: Array<{ name: string; lngLat: [number, number] }> = [
  { name: 'Memorial Church', lngLat: [-122.1697, 37.4272] },
  { name: 'Hoover Tower', lngLat: [-122.1664, 37.4275] },
  { name: 'Main Quad', lngLat: [-122.1701, 37.4274] },
  { name: 'The Oval', lngLat: [-122.1701, 37.4300] },
];

export default function MapPreview() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [compass, setCompass] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/standard', // v3: 3D buildings + lighting
      center: [-122.1697, 37.4272],
      zoom: 16.5,
      pitch: 62,
      bearing: 20,
      antialias: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }), 'top-right');
    map.on('error', (e) => console.error('[map-preview] error:', e.error?.message || e));
    mapRef.current = map;

    // Pins: labelled markers that fade when an extruded building occludes them.
    for (const p of PINS) {
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;';
      el.innerHTML =
        '<div style="width:16px;height:16px;border-radius:50%;background:#8B2538;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>' +
        `<div style="margin-top:4px;padding:2px 7px;border-radius:8px;background:#fff;color:#3A3A32;font:600 11px system-ui;box-shadow:0 1px 4px rgba(0,0,0,0.3);white-space:nowrap">${p.name}</div>`;
      new mapboxgl.Marker({ element: el, occludedOpacity: 0.25 }).setLngLat(p.lngLat).addTo(map);
    }

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);
    map.once('load', () => map.resize());
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  // Compass follow: rotate the map to the phone heading (smoothed).
  useEffect(() => {
    if (!compass) return;
    const map = mapRef.current;
    if (!map) return;
    let raf = 0;
    let target = map.getBearing();

    const onOrient = (e: DeviceOrientationEvent) => {
      // iOS exposes a true compass heading; others give alpha (0 = device top
      // north), which we convert to a map bearing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const heading = (e as any).webkitCompassHeading ?? (e.alpha != null ? 360 - e.alpha : null);
      if (heading != null) target = heading;
    };
    const tick = () => {
      const cur = map.getBearing();
      const diff = ((target - cur + 540) % 360) - 180; // shortest path
      if (Math.abs(diff) > 0.2) map.setBearing(cur + diff * 0.15); // smoothing
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      window.addEventListener('deviceorientationabsolute', onOrient as EventListener);
      window.addEventListener('deviceorientation', onOrient as EventListener);
      raf = requestAnimationFrame(tick);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOE = window.DeviceOrientationEvent as any;
    if (DOE && typeof DOE.requestPermission === 'function') {
      DOE.requestPermission().then((res: string) => {
        if (res === 'granted') start();
        else { setNote('Compass permission denied.'); setCompass(false); }
      }).catch(() => { setNote('Compass unavailable.'); setCompass(false); });
    } else {
      start();
    }

    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrient as EventListener);
      window.removeEventListener('deviceorientation', onOrient as EventListener);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [compass]);

  if (!TOKEN) {
    return <div className="w-full h-screen flex items-center justify-center text-stone-600">Set NEXT_PUBLIC_MAPBOX_TOKEN to preview the 3D map.</div>;
  }

  return (
    <div className="relative w-full" style={{ height: '100dvh' }}>
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-3 left-3 z-10 max-w-[260px] rounded-xl bg-white/95 shadow-lg p-3 text-[12px] text-stone-700">
        <p className="font-semibold mb-1">3D preview</p>
        <p className="leading-snug">Pinch to tilt, two-finger drag to rotate. Pins fade when a building is in front. On a phone, try “Follow my compass”.</p>
        <a href="/admin" className="inline-block mt-2 text-blue-700 hover:underline">← Admin</a>
      </div>

      <button
        onClick={() => setCompass((c) => !c)}
        className="absolute bottom-4 left-4 z-10 px-3 py-2 rounded-lg text-sm font-semibold shadow-lg"
        style={{ background: compass ? '#8B2538' : '#fff', color: compass ? '#fff' : '#3A3A32' }}
      >
        {compass ? '🧭 Following compass' : '🧭 Follow my compass'}
      </button>
      {note && <div className="absolute bottom-16 left-4 z-10 px-3 py-1.5 rounded bg-black/70 text-white text-xs">{note}</div>}
    </div>
  );
}
