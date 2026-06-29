'use client';

/**
 * Context Journal configuration for a single tour, embedded in the tour editor.
 * Sets the timeline domain + default map view the viewer's Context Journal opens
 * on for this tour. Stored at `context-journal-config/{tourId}`. (Per-stop config
 * will slot in alongside this later.)
 */

import { useEffect, useState } from 'react';
import { TIMELINE_BOUNDS, DEFAULT_DOMAIN, DEFAULT_CAMERA, formatYear, LENS_BY_KEY } from '../constants';
import type { ContextEntry, MapType } from '../types';
import { getPlaceConfig, savePlaceConfig, subscribeContextEntries, deleteContextEntry } from '../store';
import ContextMapLoader from '../components/ContextMapLoader';

export default function ContextJournalConfig({ tourId }: { tourId: string }) {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [start, setStart] = useState(DEFAULT_DOMAIN.start);
  const [end, setEnd] = useState(DEFAULT_DOMAIN.end);
  const [view, setView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [savedView, setSavedView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [mapType, setMapType] = useState<MapType>('default');
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
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

  // Live list of contexts viewers (and admins) have added to this tour.
  useEffect(() => subscribeContextEntries(tourId, setEntries), [tourId]);

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteContextEntry(id);
      setConfirmId(null);
    } catch (err) {
      console.error('[context-journal] delete failed:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const clampYear = (n: number) => Math.min(TIMELINE_BOUNDS.end, Math.max(TIMELINE_BOUNDS.start, n));
  const rangeValid = start <= end;

  const save = async () => {
    setSaving(true);
    setStatus(null);
    const center = view?.center ?? savedView?.center ?? DEFAULT_CAMERA.center;
    const zoom = view?.zoom ?? savedView?.zoom ?? DEFAULT_CAMERA.zoom;
    try {
      await savePlaceConfig({ placeId: tourId, timelineStart: start, timelineEnd: end, defaultCenter: center, defaultZoom: zoom });
      setSavedView({ center, zoom });
      setStatus('Saved.');
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      console.error(err);
      setStatus('Save failed — check the context-journal-config Firestore rule.');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-stone-400">
        What this tour&apos;s Context Journal opens on. Stored at <code className="bg-stone-100 px-1 rounded">context-journal-config/{tourId}</code>.
        Viewers can still move the timeline ends and pan the map.
      </p>

      {/* Timeline domain */}
      <div>
        <div className="text-xs font-medium text-stone-600 mb-1">Timeline domain (negative = BC)</div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="number" value={start} min={TIMELINE_BOUNDS.start} max={TIMELINE_BOUNDS.end}
            onChange={(e) => setStart(clampYear(parseInt(e.target.value, 10) || 0))}
            className="w-28 px-2 py-1.5 border border-stone-300 rounded text-sm" />
          <span className="text-stone-400">→</span>
          <input type="number" value={end} min={TIMELINE_BOUNDS.start} max={TIMELINE_BOUNDS.end}
            onChange={(e) => setEnd(clampYear(parseInt(e.target.value, 10) || 0))}
            className="w-28 px-2 py-1.5 border border-stone-300 rounded text-sm" />
          <span className="text-xs text-stone-600">= {formatYear(start)} → {formatYear(end)}</span>
        </div>
        {!rangeValid && <p className="mt-1 text-xs text-red-600">Start must be on or before end.</p>}
      </div>

      {/* Default view */}
      <div>
        <div className="text-xs font-medium text-stone-600 mb-1">Default map view — frame the area, then save</div>
        <div className="h-72 rounded overflow-hidden border border-stone-300">
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
        <p className="mt-1 text-[11px] text-stone-500">
          {view
            ? `Current: ${view.center[1].toFixed(4)}, ${view.center[0].toFixed(4)} · zoom ${view.zoom.toFixed(1)}`
            : savedView
              ? `Saved: ${savedView.center[1].toFixed(4)}, ${savedView.center[0].toFixed(4)} · zoom ${savedView.zoom.toFixed(1)}`
              : '(move the map to set the default view)'}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving || !rangeValid}
          className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Context Journal settings'}
        </button>
        {status && <span className="text-xs text-stone-600">{status}</span>}
      </div>

      {/* Submitted contexts — view + delete */}
      <div className="pt-3 border-t border-stone-200">
        <div className="text-xs font-medium text-stone-600 mb-1">
          Submitted contexts ({entries.length})
        </div>
        <p className="text-[10px] text-stone-400 mb-2">
          Everything added to this tour&apos;s Context Journal (by you or viewers). Delete removes it for everyone.
        </p>
        {entries.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No contexts yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => {
              const lens = LENS_BY_KEY[e.pastCategory];
              const thumb = e.media?.find((m) => m.id === e.thumbnailMediaId && m.kind === 'photo')
                ?? e.media?.find((m) => m.kind === 'photo');
              return (
                <li key={e.id} className="flex items-center gap-2 p-2 rounded border border-stone-200">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb.url} alt="" className="w-9 h-9 rounded object-cover shrink-0" />
                  ) : (
                    <span className="w-9 h-9 rounded shrink-0" style={{ backgroundColor: `${lens?.colour ?? '#999'}22` }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-stone-800 truncate">{e.title || '(untitled)'}</div>
                    <div className="text-[11px] text-stone-400 truncate">
                      <span style={{ color: lens?.colour }}>{lens?.label ?? e.pastCategory}</span>
                      {e.question ? ` · ${e.question}` : ''}
                    </div>
                  </div>
                  {confirmId === e.id ? (
                    <span className="flex items-center gap-1 shrink-0">
                      <button onClick={() => void remove(e.id)} disabled={deletingId === e.id}
                        className="px-2 py-1 rounded bg-red-600 text-white text-[11px] hover:bg-red-700 disabled:opacity-50">
                        {deletingId === e.id ? 'Deleting…' : 'Confirm'}
                      </button>
                      <button onClick={() => setConfirmId(null)}
                        className="px-2 py-1 rounded text-[11px] text-stone-500 hover:bg-stone-100">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmId(e.id)}
                      className="shrink-0 px-2 py-1 rounded text-[11px] text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
