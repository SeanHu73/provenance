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

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { DEFAULT_PLACE_ID, DEFAULT_DOMAIN, defaultRange, clampRange, LENS_BY_KEY } from './constants';
import type { ContextEntry, MapType, NewContextEntry, TimeRange } from './types';
import { getViewerId, saveContext, unsaveContext, subscribeContextEntries, subscribeSavedIds, getPlaceConfig, addContextEntry, updateContextEntry, deleteContextEntry } from './store';
import { subscribeGuestContexts, addGuestContext, updateGuestContext, deleteGuestContext } from './guest-contexts';
import ContextMapLoader from './components/ContextMapLoader';
import ContextTimeline from './components/ContextTimeline';
import PastPanel from './components/PastPanel';
import ContextOverlay from './components/ContextOverlay';
import AddContextFlow from './components/AddContextFlow';

interface Props {
  /** When opened from a tour, the journal scopes its config + contexts to it.
   *  (Per-stop scoping drops in here later.) */
  tourId?: string;
  /** The tour's authored contexts for this act, shown as read-only *questions*
   *  to explore. Adding one persists a learner copy carrying its `sourceId`. */
  authored?: ContextEntry[];
  /** In-tour: the back control continues the tour (via onExit) instead of going
   *  home, and a footer "Continue" appears. */
  inTour?: boolean;
  onExit?: () => void;
  /** Label for the in-tour continue button (defaults to "Continue tour"). */
  continueLabel?: string;
}

export default function ContextJournal({ tourId, authored, inTour, onExit, continueLabel = 'Continue tour' }: Props) {
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
  // The learner's own added copy being edited (authored originals stay read-only).
  const [editEntry, setEditEntry] = useState<ContextEntry | null>(null);
  const [fullEntry, setFullEntry] = useState<ContextEntry | null>(null);
  // In-tour gate: the learner must open at least one context before continuing.
  const [explored, setExplored] = useState(false);
  // The continue gate is engagement with a *question*: tapping an authored
  // question (or asking your own — set on submit below), NOT just re-opening a
  // context that's already been added.
  const openFull = (entry: ContextEntry) => {
    setFullEntry(entry);
    if (entry.origin === 'authored') setExplored(true);
  };
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
    // Focusing a context reveals the map so its highlighted area is visible, and
    // moves the timeline selection to the context's own span so the map + timeline
    // both reflect the tapped context. (The active filter changes as a result —
    // the timeline hint tells learners they can move it to browse other periods.)
    if (entry) {
      setMapType(entry.mapType ?? 'default');
      setShowMapPanel(true);
      setRange(clampRange(entry.timeRange, domain));
    }
  };

  // In a tour, the learner's added contexts are guest-local (sessionStorage,
  // reset at tour end) — not persisted to Firestore. Standalone, they live in
  // Firestore. Both surface the same ContextEntry shape.
  useEffect(() => {
    return inTour
      ? subscribeGuestContexts(scopeId, setEntries)
      : subscribeContextEntries(scopeId, setEntries);
  }, [scopeId, inTour]);

  const persistAdd = (entry: NewContextEntry): Promise<string> =>
    inTour ? Promise.resolve(addGuestContext(scopeId, entry)) : addContextEntry(entry);
  const persistUpdate = (id: string, patch: Partial<NewContextEntry>): Promise<void> =>
    inTour ? Promise.resolve(updateGuestContext(scopeId, id, patch)) : updateContextEntry(id, patch);
  const persistDelete = (id: string): Promise<void> =>
    inTour ? Promise.resolve(deleteGuestContext(scopeId, id)) : deleteContextEntry(id);

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

  // Deselect a focused (tapped-once) thumbnail only on a genuine *tap* elsewhere
  // — a drag/scroll must NOT deselect. We record the pointer-down spot and only
  // act on pointer-up if it barely moved (a tap) and landed outside a
  // `data-cj-keep` zone (the map/timeline panel or the thumbnail rail), so
  // panning the map, scrolling the list, or switching cards keeps the selection.
  useEffect(() => {
    if (!focused) return;
    let sx = 0, sy = 0, moved = false;
    const onDown = (e: PointerEvent) => { sx = e.clientX; sy = e.clientY; moved = false; };
    const onMove = (e: PointerEvent) => {
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) moved = true;
    };
    const onUp = (e: PointerEvent) => {
      if (moved) return; // a drag/scroll, not a tap
      const el = e.target as HTMLElement | null;
      if (el?.closest('[data-cj-keep]')) return;
      setFocused(null);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [focused]);

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

  const removeEntry = async (id: string) => {
    setFullEntry(null);
    try { await persistDelete(id); }
    catch (err) { console.error('[context-journal] remove failed:', err); }
  };

  // Display = the act's authored questions (minus any already added) + the
  // learner's own added/self copies. Authored items render as questions; the rest
  // as thumbnails (distinguished by `origin`).
  const displayEntries = useMemo(() => {
    const addedSources = new Set(entries.map((e) => e.sourceId).filter(Boolean));
    const questions = (authored ?? []).filter((a) => !addedSources.has(a.id));
    return [...questions, ...entries];
  }, [authored, entries]);

  // Import a learner copy of an authored context (carries its sourceId so the
  // authored question hides once added).
  const addAuthored = async (entry: ContextEntry) => {
    try {
      await persistAdd({
        question: entry.question, title: entry.title, shortSummary: entry.shortSummary,
        longExplanation: entry.longExplanation, pastCategory: entry.pastCategory,
        timeRange: entry.timeRange, geometry: entry.geometry, camera: entry.camera,
        mapType: entry.mapType, media: entry.media, thumbnailMediaId: entry.thumbnailMediaId,
        sources: entry.sources, taggedQuestions: entry.taggedQuestions,
        sourceId: entry.id, origin: 'added', placeId: scopeId,
      });
      setFullEntry(null);
    } catch (err) {
      console.error('[context-journal] add failed:', err);
    }
  };

  // keep the full-screen entry in sync with live data (e.g. after edits)
  const liveFull = fullEntry
    ? entries.find((e) => e.id === fullEntry.id) ?? (authored ?? []).find((a) => a.id === fullEntry.id) ?? fullEntry
    : null;

  return (
    <div className="flex flex-col" style={{ height: '100dvh', backgroundColor: 'var(--th-bg)' }}>
      {/* top bar */}
      <header className="shrink-0 flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: 'var(--th-primary)' }}>
        {inTour ? (
          // No back affordance in-tour: the only way onward is the gated
          // "Continue tour" button, so a stray tap can't skip into later phases.
          <span className="w-9 h-9 flex items-center justify-center text-warm-white/80" aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </span>
        ) : (
          <Link href="/" aria-label="Back" className="w-9 h-9 rounded-full flex items-center justify-center text-warm-white hover:bg-white/15">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
        )}
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
      <div data-cj-keep className="shrink-0 border-b" style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface)' }}>
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
            <div style={{ height: '30vh' }}>
              <ContextMapLoader
                mode="browse"
                geolocate
                defaultView={defaultView}
                mapType={mapType}
                onMapTypeChange={setMapType}
                focus={focused ? { geometry: focused.geometry, camera: focused.camera, colour: LENS_BY_KEY[focused.pastCategory]?.colour } : null}
              />
            </div>
            <div className="border-t" style={{ borderColor: 'var(--th-border)' }}>
              <ContextTimeline value={range} onChange={setRange} domain={domain} onDomainChange={changeDomain} />
              <p className="px-4 pb-2.5 -mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted leading-snug">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v5l3 2" />
                </svg>
                Move the timeline to see which contexts apply to each period.
              </p>
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
          entries={displayEntries}
          selectedRange={range}
          savedIds={savedIds}
          focusedId={focused?.id ?? null}
          compact={showMapPanel}
          onFocus={handleFocus}
          onToggleSave={toggleSave}
          onOpenFull={openFull}
        />

        {/* Ask your own question (AI flow lands later; opens the add form for now) */}
        <div className="px-5 pb-8 pt-1">
          <button
            onClick={() => setAddOpen(true)}
            className="w-full py-3.5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 font-semibold text-text-secondary hover:bg-black/[0.02]"
            style={{ borderColor: 'var(--th-border)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Ask your own question
          </button>
        </div>

        {inTour && (
          <div className="px-5 pb-8 pt-1">
            <button
              onClick={onExit}
              disabled={!explored}
              className="w-full py-3.5 rounded-2xl text-base font-semibold text-warm-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--th-primary)' }}
            >
              {continueLabel}
            </button>
            {!explored && (
              <p className="mt-2 text-center text-xs text-text-muted">Ask a question — or tap one to explore — before continuing.</p>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {addOpen && (
          <AddContextFlow
            key="add"
            onClose={() => setAddOpen(false)}
            onSubmit={async (draft) => { await persistAdd({ ...draft, placeId: scopeId, origin: 'self' }); setExplored(true); }}
          />
        )}
        {liveFull && (
          <ContextOverlay
            key="full"
            entry={liveFull}
            saved={savedIds.has(liveFull.id)}
            onToggleSave={() => toggleSave(liveFull.id)}
            onClose={() => setFullEntry(null)}
            domain={domain}
            defaultView={defaultView}
            onDelete={liveFull.origin === 'authored' ? undefined : () => removeEntry(liveFull.id)}
            onEdit={liveFull.origin === 'authored' ? undefined : () => setEditEntry(liveFull)}
            onAdd={liveFull.origin === 'authored' ? () => addAuthored(liveFull) : undefined}
          />
        )}
        {editEntry && (
          <AddContextFlow
            key="edit"
            heading="Edit context"
            initial={editEntry}
            onClose={() => setEditEntry(null)}
            onSubmit={async (draft) => { await persistUpdate(editEntry.id, draft); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
