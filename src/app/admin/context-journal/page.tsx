'use client';

/**
 * Admin — Context Journal place configuration.
 *
 * Per-place (one place for now) settings the viewer's Context Journal opens on:
 *   - Timeline domain (the two end years; 1000 BC … present).
 *   - Default map view: pan/zoom the map to frame the area, then "Use current
 *     view as default" — viewers open here and return here when no context is
 *     selected.
 *   - Optional "constrain" box: lock viewers to the current view's bounds.
 *
 * Writes to `context-journal-config/{placeId}` in Firestore (needs a console
 * rule block, like the other collections). Builder-only tool, no auth.
 */

import { useEffect, useState } from 'react';
import { DEFAULT_PLACE_ID, TIMELINE_BOUNDS, DEFAULT_DOMAIN, DEFAULT_CAMERA, formatYear } from '@/features/context-journal/constants';
import type { Bounds } from '@/features/context-journal/types';
import { getPlaceConfig, savePlaceConfig } from '@/features/context-journal/store';
import ContextMapLoader from '@/features/context-journal/components/ContextMapLoader';

type Viewport = { center: [number, number]; zoom: number; bounds: Bounds };

export default function ContextJournalAdminPage() {
  const placeId = DEFAULT_PLACE_ID;
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState(DEFAULT_DOMAIN.start);
  const [end, setEnd] = useState(DEFAULT_DOMAIN.end);
  const [view, setView] = useState<Viewport | null>(null);
  const [savedView, setSavedView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [lockPan, setLockPan] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const cfg = await getPlaceConfig(placeId);
      if (cfg) {
        setStart(cfg.timelineStart);
        setEnd(cfg.timelineEnd);
        setSavedView({ center: cfg.defaultCenter, zoom: cfg.defaultZoom });
        setLockPan(!!cfg.maxBounds);
      }
      setLoading(false);
    })();
  }, [placeId]);

  const clampYear = (n: number) => Math.min(TIMELINE_BOUNDS.end, Math.max(TIMELINE_BOUNDS.start, n));
  const rangeValid = start <= end;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    // Use the live view if the admin moved the map, else fall back to the saved
    // / default camera.
    const center = view?.center ?? savedView?.center ?? DEFAULT_CAMERA.center;
    const zoom = view?.zoom ?? savedView?.zoom ?? DEFAULT_CAMERA.zoom;
    const maxBounds: Bounds | null = lockPan ? (view?.bounds ?? null) : null;
    try {
      await savePlaceConfig({
        placeId,
        timelineStart: start,
        timelineEnd: end,
        defaultCenter: center,
        defaultZoom: zoom,
        maxBounds,
      });
      setSavedView({ center, zoom });
      setStatus('Saved. Viewers will open the Context Journal with these settings.');
      setTimeout(() => setStatus(null), 5000);
    } catch (err) {
      console.error(err);
      setStatus('Save failed — check the context-journal-config Firestore rule.');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 border-b border-stone-300 pb-3">
          <h1 className="text-2xl font-bold">Context Journal — Configuration</h1>
          <p className="text-sm text-stone-600 mt-1">
            Place: <code className="bg-stone-200 px-1 rounded">{placeId}</code>. Writes to{' '}
            <code className="bg-stone-200 px-1 rounded">context-journal-config</code>.
          </p>
          <nav className="mt-3 text-sm flex gap-4">
            <a href="/admin" className="text-blue-700 hover:underline">← Admin home</a>
            <a href="/context-journal" className="text-blue-700 hover:underline font-semibold">Open Context Journal →</a>
          </nav>
        </header>

        {status && (
          <div className="mb-4 p-3 rounded border border-green-300 bg-green-50 text-green-900 text-sm">{status}</div>
        )}

        {loading ? (
          <p className="text-stone-600">Loading configuration…</p>
        ) : (
          <div className="space-y-6">
            {/* Timeline domain */}
            <section className="p-4 border border-stone-300 rounded bg-white">
              <h2 className="font-semibold mb-1">Timeline domain</h2>
              <p className="text-xs text-stone-600 mb-3">
                The two ends the timeline opens on. Negative = BC (−500 = 500 BC). Viewers can still move the ends themselves.
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
                Pan and zoom to frame the area you want viewers to see by default. Then it&apos;s captured below — viewers
                open here and return here whenever no context is selected.
              </p>
              <div className="h-[420px] rounded overflow-hidden border border-stone-300">
                <ContextMapLoader
                  mode="browse"
                  geolocate
                  defaultView={savedView}
                  onViewportChange={setView}
                />
              </div>
              <p className="mt-2 text-xs text-stone-600">
                Current view: {view
                  ? `${view.center[1].toFixed(4)}, ${view.center[0].toFixed(4)} · zoom ${view.zoom.toFixed(1)}`
                  : savedView
                    ? `${savedView.center[1].toFixed(4)}, ${savedView.center[0].toFixed(4)} · zoom ${savedView.zoom.toFixed(1)} (saved)`
                    : '(move the map to set)'}
              </p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={lockPan} onChange={(e) => setLockPan(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="font-medium">Constrain viewers to this view</span>
                  <span className="block text-xs text-stone-500">
                    Locks panning/zooming to the current map bounds. {lockPan && !view && <span className="text-amber-700">Move the map once to capture its bounds.</span>}
                  </span>
                </span>
              </label>
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
