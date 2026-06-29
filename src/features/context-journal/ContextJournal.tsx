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
import { DEFAULT_PLACE_ID } from './constants';
import type { ContextEntry, TimeRange } from './types';
import { getViewerId, saveContext, unsaveContext, subscribeContextEntries, subscribeSavedIds } from './store';
import ContextMapLoader from './components/ContextMapLoader';
import ContextTimeline from './components/ContextTimeline';
import PastPanel from './components/PastPanel';
import ContextFullScreen from './components/ContextFullScreen';
import AddContextFlow from './components/AddContextFlow';

interface Props {
  placeId?: string;
}

export default function ContextJournal({ placeId = DEFAULT_PLACE_ID }: Props) {
  const [entries, setEntries] = useState<ContextEntry[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  // viewer id lives in a ref: it's read once (client-only localStorage) and only
  // ever needed inside event handlers, never during render.
  const viewerIdRef = useRef<string>('');
  const [range, setRange] = useState<TimeRange>({ start: 1900, end: 1910 });
  const [addOpen, setAddOpen] = useState(false);
  const [fullEntry, setFullEntry] = useState<ContextEntry | null>(null);

  useEffect(() => {
    const unsub = subscribeContextEntries(placeId, setEntries);
    return unsub;
  }, [placeId]);

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
      void saveContext(viewerId, contextId, placeId);
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

      {/* 1 — map (top) */}
      <div className="shrink-0" style={{ height: '42vh' }}>
        <ContextMapLoader mode="browse" />
      </div>

      {/* 2 — timeline */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface)' }}>
        <ContextTimeline value={range} onChange={setRange} />
      </div>

      {/* 3 — P.A.S.T. panel (remaining space) */}
      <div className="flex-1 overflow-y-auto">
        <PastPanel
          entries={entries}
          selectedRange={range}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          onOpenFull={setFullEntry}
        />
      </div>

      <AnimatePresence>
        {addOpen && (
          <AddContextFlow key="add" placeId={placeId} onClose={() => setAddOpen(false)} />
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
