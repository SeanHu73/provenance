'use client';

/**
 * Context Journal — top-level module component.
 *
 * Self-contained: owns its Firestore subscriptions (context-entries,
 * saved-contexts) and the shared state the panels read. Accepts a `placeId`
 * (defaults to one place for now). Vertical mobile layout, tested at 390px:
 *
 *   1. Map (top)      — ContextMap in BROWSE mode (Mapbox, route-only bundle)
 *   2. Timeline       — the range selector, single source of truth for filtering
 *   3. P.A.S.T. panel — four lenses, filtered by the selected range
 *
 * A single "Add context" entry opens the shared AddContextFlow (designer- and
 * learner-side entry points wire into this later).
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { DEFAULT_PLACE_ID, DEFAULT_DOMAIN, defaultRange, clampRange } from './constants';
import type { ContextEntry, MapType, TimeRange } from './types';
import { getViewerId, saveContext, unsaveContext, subscribeContextEntries, subscribeSavedIds, getPlaceConfig, addContextEntry } from './store';
import ContextMapLoader from './components/ContextMapLoader';
import ContextTimeline from './components/ContextTimeline';
import PastPanel from './components/PastPanel';
import ContextFullScreen from './components/ContextFullScreen';
import AddContextFlow from './components/AddContextFlow';

interface Props {
  /** When opened from a tour, the journal scopes its config + contexts to it.
   *  (Per-stop scoping drops in here later.) */
  tourId?: string;
}

export default function ContextJournal({ tourId }: Props) {
  const scopeId = tourId ?? DEFAULT_PLACE_ID;

  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // viewer id lives in a ref: it's read once (client-only localStorage) and only
  // ever needed inside event handlers, never during render.
  const viewerIdRef = useRef<string>('');
  // The domain (the two timeline ends) is editable by the viewer; the selection
  // re-fits whenever an end moves.
  const [domain, setDomain] = useState(DEFAULT_DOMAIN);
  const [range, setRange] = useState<TimeRange>(() => defaultRange(DEFAULT_DOMAIN));

  const changeDomain = (next: { start: number; end: number }) => {
    setDomain(next);
    setRange((r) => clampRange(r, next));
  };
  // The map + timeline collapse from the top (collapsed by default) so the
  // P.A.S.T. framework gets most of the space — the focus is choosing a question.
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [fullEntry, setFullEntry] = useState<ContextEntry | null>(null);
  // The context the viewer has tapped — drives the map (fly to its area); null
  // returns the map to the admin default view.
  const [focused, setFocused] = useState<ContextEntry | null>(null);
  // Admin-set default view, loaded from the per-tour config.
  const [defaultView, setDefaultView] = useState<{ center: [number, number]; zoom: number } | null>(null);
  // Basemap: the calm default, switching to a context's authored map on focus;
  // the viewer can also toggle it freely.
  const [mapType, setMapType] = useState<MapType>('default');

  // Focusing a context flies the map to its area and switches to the basemap it
  // was authored on; collapsing clears focus (map returns to the default view).
  const handleFocus = (entry: ContextEntry | null) => {
    setFocused(entry);
    if (entry) setMapType(entry.mapType ?? 'default');
  };

  useEffect(() => {
    const unsub = subscribeContextEntries(scopeId, setEntries);
    return unsub;
  }, [scopeId]);

  // Load the per-tour config: timeline domain + default map view.
  useEffect(() => {
    let active = true;
    (async () => {
      const cfg = await getPlaceConfig(scopeId);
      if (!active || !cfg) return;
      const d = { start: cfg.timelineStart, end: cfg.timelineEnd };
      setDomain(d);
      setRange(defaultRange(d));
      setDefaultView({ center: cfg.defaultCenter, zoom: cfg.defaultZoom });
    })();
    return () => { active = false; };
  }, [scopeId]);

  useEffect(() => {
    const id = getViewerId();
    viewerIdRef.current = id;
    const unsub = subscribeSavedIds(id, setSavedIds);
    return unsub;
  }, []);

  const toggleSave = (contextId: string) => {
    const viewerId = viewerIdRef.current;
    if (!viewerId) return;
    if (savedIds.has(contextId)) {
      setSavedIds((prev) => { const n = new Set(prev); n.delete(contextId); return n; });
      void unsaveContext(viewerId, contextId);
    } else {
      setSavedIds((prev) => new Set(prev).add(contextId));
      void saveContext(viewerId, contextId, scopeId);
    }
  };

  // keep the full-screen entry in sync with live data (e.g. after edits)
  const liveFull = fullEntry ? entries.find((e) => e.id === fullEntry.id) ?? fullEntry : null;

  return (
    <div className="flex flex-col" style={{ height: '100dvh', backgroundColor: 'var(--th-bg)' }}>
      {/* top bar */}
      <header className="shrink-0 flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: 'var(--th-primary)' }}>
        <Link href="/" aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center text-warm-white hover:bg-white/15">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="flex-1 font-display text-xl text-warm-white">Context Journal</h1>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold text-warm-white bg-white/20 hover:bg-white/30 border border-white/40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add context
        </button>
      </header>

      {/* 1 — collapsible map + timeline (collapsed by default) */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface)' }}>
        <button
          onClick={() => setShowMapPanel((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-text-secondary"
          aria-expanded={showMapPanel}
        >
          <span>Map &amp; timeline</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${showMapPanel ? 'rotate-180' : ''}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {showMapPanel && (
          <>
            <div style={{ height: '38vh' }}>
              <ContextMapLoader
                mode="browse"
                geolocate
                defaultView={defaultView}
                mapType={mapType}
                onMapTypeChange={setMapType}
                focus={focused ? { geometry: focused.geometry, camera: focused.camera } : null}
              />
            </div>
            <div className="border-t" style={{ borderColor: 'var(--th-border)' }}>
              <ContextTimeline value={range} onChange={setRange} domain={domain} onDomainChange={changeDomain} />
            </div>
          </>
        )}
      </div>

      {/* 2 — P.A.S.T. framework (the main space) */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="h-px flex-1 max-w-8" style={{ backgroundColor: 'var(--th-border)' }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">Look through the P.A.S.T.</span>
            <span className="h-px flex-1" style={{ backgroundColor: 'var(--th-border)' }} />
          </div>
          <h2 className="mt-3 font-display text-[26px] leading-tight text-text-primary">Which lens will you look through?</h2>
          <p className="mt-1 font-serif italic text-[15px] text-text-secondary leading-snug">
            Tap a lens to find a question worth asking — or add one of your own.
          </p>
        </div>
        <PastPanel
          entries={entries}
          selectedRange={range}
          savedIds={savedIds}
          focusedId={focused?.id ?? null}
          onFocus={handleFocus}
          onToggleSave={toggleSave}
          onOpenFull={setFullEntry}
        />
      </div>

      <AnimatePresence>
        {addOpen && (
          <AddContextFlow
            key="add"
            onClose={() => setAddOpen(false)}
            onSubmit={async (draft) => { await addContextEntry({ ...draft, placeId: scopeId }); }}
          />
        )}
        {liveFull && (
          <ContextFullScreen
            key="full"
            entry={liveFull}
            saved={savedIds.has(liveFull.id)}
            onToggleSave={() => toggleSave(liveFull.id)}
            onClose={() => setFullEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
