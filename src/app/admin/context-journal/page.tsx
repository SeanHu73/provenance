'use client';

/**
 * Admin — Context Journal configuration, per tour.
 *
 * Pick a tour, then set the Context Journal settings the viewer opens on for
 * that tour: the timeline domain (the two end years) and the default map view
 * (frame the map → "use current view as default"). Stored at
 * `context-journal-config/{tourId}`. (Per-stop config will slot in here later.)
 *
 * Writes to Firestore (needs a console rule block, like the other collections).
 * Builder-only tool, no auth.
 */

import { useEffect, useState } from 'react';
import { TIMELINE_BOUNDS, DEFAULT_DOMAIN, DEFAULT_CAMERA, formatYear } from '@/features/context-journal/constants';
import type { MapType } from '@/features/context-journal/types';
import { getPlaceConfig, savePlaceConfig } from '@/features/context-journal/store';
import ContextMapLoader from '@/features/context-journal/components/ContextMapLoader';
import { getTours } from '@/lib/tours-store';
import type { Tour } from '@/lib/types';

export default function ContextJournalAdminPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [tourId, setTourId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState(DEFAULT_DOMAIN.start);
  const [end, setEnd] = useState(DEFAULT_DOMAIN.end);
  const [view, setView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [savedView, setSavedView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [mapType, setMapType] = useState<MapType>('default');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load the tour list once.
  useEffect(() => {
    (async () => {
      const ts = await getTours();
      setTours(ts);
      if (ts.length && !tourId) setTourId(ts[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the selected tour's config.
  useEffect(() => {
    if (!tourId) return;
    let active = true;
    (async () => {
      const cfg = await getPlaceConfig(tourId);
      if (!active) return;
      setStart(cfg?.timelineStart ?? DEFAULT_DOMAIN.start);
      setEnd(cfg?.timelineEnd ?? DEFAULT_DOMAIN.end);
      setSavedView(cfg ? { center: cfg.defaultCenter, zoom: cfg.defaultZoom } : null);
      setView(null);
    })();
    return () => { active = false; };
  }, [tourId]);

  const clampYear = (n: number) => Math.min(TIMELINE_BOUNDS.end, Math.max(TIMELINE_BOUNDS.start, n));
  const rangeValid = start <= end;

  const save = async () => {
    if (!tourId) return;
    setSaving(true);
    setStatus(null);
    const center = view?.center ?? savedView?.center ?? DEFAULT_CAMERA.center;
    const zoom = view?.zoom ?? savedView?.zoom ?? DEFAULT_CAMERA.zoom;
    try {
      await savePlaceConfig({ placeId: tourId, timelineStart: start, timelineEnd: end, defaultCenter: center, defaultZoom: zoom });
      setSavedView({ center, zoom });
      setStatus('Saved. The Context Journal for this tour will open with these settings.');
      setTimeout(() => setStatus(null), 5000);
    } catch (err) {
      console.error(err);
      setStatus('Save failed — check the context-journal-config Firestore rule.');
    }
    setSaving(false);
  };

  const selectedTour = tours.find((t) => t.id === tourId);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 border-b border-stone-300 pb-3">
          <h1 className="text-2xl font-bold">Context Journal — Configuration</h1>
          <p className="text-sm text-stone-600 mt-1">
            Per tour. Writes to <code className="bg-stone-200 px-1 rounded">context-journal-config/&lt;tourId&gt;</code>.
            Per-stop configuration will be added here later.
          </p>
          <nav className="mt-3 text-sm flex gap-4">
            <a href="/admin" className="text-blue-700 hover:underline">← Admin home</a>
            {tourId && <a href={`/context-journal?tour=${encodeURIComponent(tourId)}`} className="text-blue-700 hover:underline font-semibold">Open this tour&apos;s Context Journal →</a>}
          </nav>
        </header>

        {status && (
          <div className="mb-4 p-3 rounded border border-green-300 bg-green-50 text-green-900 text-sm">{status}</div>
        )}

        {loading ? (
          <p className="text-stone-600">Loading…</p>
        ) : tours.length === 0 ? (
          <p className="text-stone-600">No tours found. Create a tour first under the Tours admin.</p>
        ) : (
          <div className="space-y-6">
            {/* Tour picker */}
            <section className="p-4 border border-stone-300 rounded bg-white">
              <label className="block">
                <span className="block text-sm font-semibold mb-1">Tour</span>
                <select value={tourId} onChange={(e) => setTourId(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm">
                  {tours.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.id})</option>)}
                </select>
              </label>
            </section>

            {/* Timeline domain */}
            <section className="p-4 border border-stone-300 rounded bg-white">
              <h2 className="font-semibold mb-1">Timeline domain</h2>
              <p className="text-xs text-stone-600 mb-3">
                The two ends the timeline opens on for {selectedTour?.title ?? 'this tour'}. Negative = BC (−500 = 500 BC). Viewers can still move the ends themselves.
              </p>
              <div className="flex items-center gap-3">
                <label className="text-sm">
                  <span className="block text-xs text-stone-500 mb-1">Start year</span>
                  <input type="number" value={start} min={TIMELINE_BOUNDS.start} max={TIMELINE_BOUNDS.end}
                    onChange={(e) => setStart(clampYear(parseInt(e.target.value, 10) || 0))}
                    className="w-32 px-2 py-1.5 border border-stone-300 rounded text-sm" />
                </label>
                <span className="text-stone-400 mt-5">→</span>
                <label className="text-sm">
                  <span className="block text-xs text-stone-500 mb-1">End year</span>
                  <input type="number" value={end} min={TIMELINE_BOUNDS.start} max={TIMELINE_BOUNDS.end}
                    onChange={(e) => setEnd(clampYear(parseInt(e.target.value, 10) || 0))}
                    className="w-32 px-2 py-1.5 border border-stone-300 rounded text-sm" />
                </label>
                <span className="text-sm text-stone-600 mt-5">= {formatYear(start)} → {formatYear(end)}</span>
              </div>
              {!rangeValid && <p className="mt-2 text-xs text-red-600">Start must be on or before end.</p>}
            </section>

            {/* Default view */}
            <section className="p-4 border border-stone-300 rounded bg-white">
              <h2 className="font-semibold mb-1">Default map view</h2>
              <p className="text-xs text-stone-600 mb-3">
                Pan/zoom to frame the area viewers should see by default — they open here and return here when no context is
                selected. (Use the Satellite toggle to find the spot; only the centre/zoom is saved.)
              </p>
              <div className="h-[420px] rounded overflow-hidden border border-stone-300">
                <ContextMapLoader
                  key={`${tourId}-${mapType}`}
                  mode="browse"
                  geolocate
                  mapType={mapType}
                  onMapTypeChange={setMapType}
                  defaultView={savedView}
                  onViewportChange={(v) => setView({ center: v.center, zoom: v.zoom })}
                />
              </div>
              <p className="mt-2 text-xs text-stone-600">
                Current view: {view
                  ? `${view.center[1].toFixed(4)}, ${view.center[0].toFixed(4)} · zoom ${view.zoom.toFixed(1)}`
                  : savedView
                    ? `${savedView.center[1].toFixed(4)}, ${savedView.center[0].toFixed(4)} · zoom ${savedView.zoom.toFixed(1)} (saved)`
                    : '(move the map to set)'}
              </p>
            </section>

            <div className="flex items-center gap-3">
              <button
                onClick={save}
                disabled={saving || !rangeValid}
                className="px-4 py-2 rounded bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save configuration'}
              </button>
              <span className="text-xs text-stone-500">Reads/writes need the <code className="bg-stone-200 px-1 rounded">context-journal-config</code> rule block.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
