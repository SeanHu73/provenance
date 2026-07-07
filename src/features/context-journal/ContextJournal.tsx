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
import { AnimatePresence, motion } from 'framer-motion';
import { DEFAULT_PLACE_ID, DEFAULT_DOMAIN, defaultRange, clampRange, LENS_BY_KEY } from './constants';
import type { ContextEntry, MapType, NewContextEntry, TimeRange } from './types';
import { getViewerId, saveContext, unsaveContext, subscribeContextEntries, subscribeSavedIds, getPlaceConfig, addContextEntry, updateContextEntry, deleteContextEntry } from './store';
import { subscribeGuestContexts, addGuestContext, updateGuestContext, deleteGuestContext } from './guest-contexts';
import ContextMapLoader from './components/ContextMapLoader';
import ContextTimeline from './components/ContextTimeline';
import PastPanel from './components/PastPanel';
import ContextOverlay from './components/ContextOverlay';
import AddContextFlow from './components/AddContextFlow';
import ContextAskFlow from './components/ContextAskFlow';

/** Comic ink shared with the P.A.S.T. lens buttons, for the "Ask" CTA's border
 *  + hard offset shadow (see PastLens). */
const INK = '#241f1b';
const INK_SHADOW = 'rgba(26,20,14,0.9)';
/** Warm coral accent shared with the context splashes (mirrors ContextIntroCard's
 *  CONTEXT_ACCENT) — used on the ask-first gate's kicker. No P.A.S.T. lens uses it. */
const CONTEXT_ACCENT = '#E08A5F';

/** Optional light haptic tick (matches the repo pattern). */
function haptic(ms = 8) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

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
  /** Revisit: opened mid-tour from the footer to browse. Reads the same
   *  guest-local contexts as the in-tour flow, but is a plain *closeable*
   *  overlay — no Continue gate; the header shows a close button (→ onExit). */
  revisit?: boolean;
  onExit?: () => void;
  /** Label for the in-tour continue button (defaults to "Continue tour"). */
  continueLabel?: string;
  /** The learner's own prior reflections, shown in the header menu so they can
   *  revisit what they wrote. (In-tour; built from the session.) */
  responses?: { actTitle: string; promptText: string; text: string }[];
  /** The act's guiding question, shown atop the P.A.S.T. section in a tour. */
  guidingQuestion?: string;
  /** Context ids the learner has already listened to. An authored question with
   *  an `unlockAfterContextId` stays hidden until that id appears here. */
  viewedContextIds?: string[];
  /** Called when the learner opens a context to read/listen — records it as
   *  viewed so unlock dependencies can fire. */
  onContextViewed?: (ctx: { contextId: string; title: string; lens: string; question?: string }) => void;
  /** Titles of the stops the learner has already completed on the tour. Passed to
   *  the Ask-your-own flow as the learner's *prior knowledge* (background only —
   *  the Detective never argues from stop content). */
  priorStopTitles?: string[];
  /** In-tour, from the second act onward (never on additional stops): require the
   *  learner to pose their *own* context question and see a response before the
   *  journal (exploring other contexts) opens. */
  askFirst?: boolean;
}

export default function ContextJournal({ tourId, authored, inTour, revisit, onExit, continueLabel = 'Continue tour', responses = [], guidingQuestion, viewedContextIds = [], onContextViewed, priorStopTitles = [], askFirst = false }: Props) {
  const scopeId = tourId ?? DEFAULT_PLACE_ID;
  // Both the in-tour flow and the revisit overlay read/write the learner's
  // guest-local contexts (sessionStorage); only a bare standalone visit uses
  // Firestore.
  const guestLocal = !!inTour || !!revisit;

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
  const [askOpen, setAskOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // A prior response opened full-screen from the menu (previews are clamped, so
  // long reflections don't blow out the dropdown).
  const [viewResponse, setViewResponse] = useState<{ actTitle: string; promptText: string; text: string } | null>(null);
  // The learner's own added copy being edited (authored originals stay read-only).
  const [editEntry, setEditEntry] = useState<ContextEntry | null>(null);
  const [fullEntry, setFullEntry] = useState<ContextEntry | null>(null);
  // In-tour gate: the learner must open at least one context before continuing.
  const [explored, setExplored] = useState(false);
  // Ask-first gate (act 2+, not additional stops): the journal stays closed until
  // the learner poses their own question and sees a response. `gateAskOpen` shows
  // the question screen straight away; `sawResponseRef` records that they reached a
  // response, so closing the ask flow (Done or after adding) unlocks the journal.
  const [askedOwn, setAskedOwn] = useState(false);
  const [gateAskOpen, setGateAskOpen] = useState(true);
  const sawResponseRef = useRef(false);
  // The continue gate is engagement with a *question*: tapping an authored
  // question (or asking your own — set on submit below), NOT just re-opening a
  // context that's already been added.
  const openFull = (entry: ContextEntry) => {
    setFullEntry(entry);
    if (entry.origin === 'authored') setExplored(true);
    onContextViewed?.({ contextId: entry.id, title: entry.title, lens: entry.pastCategory, question: entry.question });
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
    // Only pop the map open for a context that actually has a place/time to show
    // (opted in, or a legacy one with geometry). Otherwise leave it as it was.
    if (entry && (entry.includePlaceTime ?? !!entry.geometry)) {
      setMapType(entry.mapType ?? 'default');
      setShowMapPanel(true);
      setRange(clampRange(entry.timeRange, domain));
    }
  };

  // In a tour, the learner's added contexts are guest-local (sessionStorage,
  // reset at tour end) — not persisted to Firestore. Standalone, they live in
  // Firestore. Both surface the same ContextEntry shape.
  useEffect(() => {
    return guestLocal
      ? subscribeGuestContexts(scopeId, setEntries)
      : subscribeContextEntries(scopeId, setEntries);
  }, [scopeId, guestLocal]);

  const persistAdd = (entry: NewContextEntry): Promise<string> =>
    guestLocal ? Promise.resolve(addGuestContext(scopeId, entry)) : addContextEntry(entry);
  const persistUpdate = (id: string, patch: Partial<NewContextEntry>): Promise<void> =>
    guestLocal ? Promise.resolve(updateGuestContext(scopeId, id, patch)) : updateContextEntry(id, patch);
  const persistDelete = (id: string): Promise<void> =>
    guestLocal ? Promise.resolve(deleteGuestContext(scopeId, id)) : deleteContextEntry(id);

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
    // Authored questions still to ask (already-added ones drop out). Locked ones
    // are *kept* now — they show as a locked row (see `lockInfo`) rather than
    // being hidden, so the red count + lens cue still advertise them.
    const questions = (authored ?? []).filter((a) => !addedSources.has(a.id));
    return [...questions, ...entries];
  }, [authored, entries]);

  // Which authored questions are still locked, and the lens the learner must
  // explore to unlock each. The prerequisite always points to another context in
  // the same act, so we can name its lens for the "explore … first" hint.
  const lockInfo = useMemo(() => {
    const viewed = new Set(viewedContextIds);
    const byId = new Map((authored ?? []).map((a) => [a.id, a] as const));
    const m = new Map<string, { lensLabel: string; lensColour: string }>();
    for (const a of authored ?? []) {
      if (a.unlockAfterContextId && !viewed.has(a.unlockAfterContextId)) {
        const req = byId.get(a.unlockAfterContextId);
        const lens = req ? LENS_BY_KEY[req.pastCategory] : null;
        m.set(a.id, { lensLabel: lens?.label ?? 'another lens', lensColour: lens?.colour ?? 'var(--th-primary)' });
      }
    }
    return m;
  }, [authored, viewedContextIds]);

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
        // Preserve the author's place/time opt-in and cached narration on the
        // copy — otherwise the added context loses `includePlaceTime` (falls back
        // to "show map when geometry exists") and its OpenAI narration cache.
        includePlaceTime: entry.includePlaceTime,
        voiceoverUrl: entry.voiceoverUrl, voiceoverTitle: entry.voiceoverTitle,
        ttsAudioUrl: entry.ttsAudioUrl, ttsAudioHash: entry.ttsAudioHash,
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

  // Ask-first gate — from the second act onward the learner must pose their own
  // context question and see a response before the journal opens. Replaces the
  // whole screen (no journal access) with a framed prompt + the question flow
  // ready to go. Additional stops and act 1 pass askFirst=false and skip this.
  if (askFirst && !askedOwn) {
    return (
      <div
        className="fixed inset-0 z-[55] flex flex-col items-center justify-center text-center px-8 select-none"
        style={{ backgroundColor: 'var(--th-journal)' }}
      >
        <div style={{ maxWidth: '20ch' }}>
          <span className="font-display block" style={{ fontSize: 'clamp(14px, 4vw, 18px)', letterSpacing: '0.14em', textTransform: 'uppercase', color: CONTEXT_ACCENT }}>
            Your turn
          </span>
          <h1 className="font-display mt-3" style={{ fontSize: 'clamp(30px, 8vw, 46px)', lineHeight: 1.05, color: 'var(--th-surface)' }}>
            Try asking your own context question first!
          </h1>
          <p className="font-serif mt-5" style={{ fontSize: 'clamp(16px, 4.4vw, 20px)', lineHeight: 1.4, color: 'var(--th-surface)', opacity: 0.85 }}>
            Before you explore how others have contextualised this place, pose a question of your own and see what the Context Detective turns up.
          </p>
          <button
            onClick={() => { haptic(10); setGateAskOpen(true); }}
            className="mt-8 inline-flex items-center justify-center gap-2.5 rounded-2xl px-7 py-3.5 font-display font-bold text-[17px]"
            style={{ backgroundColor: 'var(--th-surface)', color: 'var(--th-primary)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
              <path d="M10 9a2.5 2.5 0 0 1 4.8.8c0 1.7-2.3 2.2-2.3 3.4" />
              <line x1="12.4" y1="16" x2="12.41" y2="16" />
            </svg>
            Ask your own question
          </button>
        </div>

        {gateAskOpen && (
          <ContextAskFlow
            tourId={scopeId}
            priorStops={priorStopTitles}
            heading="Ask your own question"
            intro="Try asking your own context question first — then you can explore other contexts."
            onAnswered={() => { sawResponseRef.current = true; setExplored(true); }}
            onAdd={async (draft) => { await persistAdd({ ...draft, placeId: scopeId, origin: 'self' }); setExplored(true); }}
            onClose={() => { setGateAskOpen(false); if (sawResponseRef.current) setAskedOwn(true); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100dvh', backgroundColor: 'var(--th-bg)' }}>
      {/* top bar */}
      <header className="relative shrink-0 flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: 'var(--th-primary)' }}>
        {revisit ? (
          // Revisit overlay: a plain close button returns to the tour.
          <button onClick={onExit} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-warm-white hover:bg-white/15 text-2xl leading-none">
            &times;
          </button>
        ) : inTour ? (
          // No back affordance in the gated in-tour flow: the only way onward is
          // the "Continue" button, so a stray tap can't skip into later phases.
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
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Menu" aria-expanded={menuOpen}
          className="w-9 h-9 rounded-full flex items-center justify-center text-warm-white bg-white/20 hover:bg-white/30 border border-white/40"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
          </svg>
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-3 top-full mt-1 z-50 w-72 max-h-[70vh] overflow-y-auto rounded-2xl shadow-xl bg-warm-white border" style={{ borderColor: 'var(--th-border)' }}>
              <button
                onClick={() => { setMenuOpen(false); setAddOpen(true); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-left font-semibold text-text-primary hover:bg-black/[0.03] border-b"
                style={{ borderColor: 'var(--th-border)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add context
              </button>
              <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-[0.14em] font-semibold text-text-secondary">Your responses</p>
              {responses.length === 0 ? (
                <p className="px-4 pb-3 text-sm italic text-text-muted">Nothing yet — your reflections will show up here.</p>
              ) : (
                <ul className="pb-2">
                  {responses.map((r, i) => (
                    <li key={i} className="border-t" style={{ borderColor: 'var(--th-border)' }}>
                      <button
                        onClick={() => { setMenuOpen(false); setViewResponse(r); }}
                        className="w-full text-left px-4 py-2.5 flex items-start gap-2 hover:bg-black/[0.03]"
                      >
                        <span className="flex-1 min-w-0">
                          {r.actTitle && <span className="block text-[11px] font-semibold" style={{ color: 'var(--th-primary)' }}>{r.actTitle}</span>}
                          {r.promptText && <span className="block text-xs italic text-text-secondary leading-snug mt-0.5 line-clamp-1">{r.promptText}</span>}
                          <span className="block text-sm text-text-primary leading-snug mt-0.5 line-clamp-2">{r.text}</span>
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0 mt-1 text-text-muted"><path d="M9 6l6 6-6 6" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
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
          {guidingQuestion ? (
            <>
              <h2 className="font-serif text-[18px] leading-snug text-text-secondary">Look through the P.A.S.T. to contextualise&hellip;</h2>
              <p className="mt-1.5 font-display font-bold text-[24px] leading-tight" style={{ color: 'var(--th-primary)' }}>{guidingQuestion}</p>
            </>
          ) : (
            <h2 className="font-display text-[26px] leading-tight text-text-primary">Look through the P.A.S.T.</h2>
          )}
          <p className="mt-2 font-serif italic text-[17px] text-text-secondary leading-snug">
            Tap a lens to find a question you want to ask — or ask one of your own!
          </p>
        </div>
        <PastPanel
          entries={displayEntries}
          selectedRange={range}
          savedIds={savedIds}
          focusedId={focused?.id ?? null}
          compact={showMapPanel}
          promptUnopened={!!inTour}
          lockInfoById={lockInfo}
          onFocus={handleFocus}
          onToggleSave={toggleSave}
          onOpenFull={openFull}
        />

        {/* Ask your own question — a bold, distinct *choice*. It floats over the
            scroll pinned near the bottom (an overlay CTA), then un-sticks and
            docks in flow just above the Continue button as you reach the end, so
            the two never overlap. (AI flow lands later; opens the add form.) */}
        <div className="sticky bottom-4 z-30 px-5 pt-3">
          <motion.button
            onClick={() => { haptic(10); setAskOpen(true); }}
            whileTap={{ x: 4, y: 4, boxShadow: `0px 0px 0 ${INK_SHADOW}` }}
            transition={{ type: 'spring', stiffness: 600, damping: 32 }}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl py-3.5 bg-warm-white font-display font-bold text-[17px]"
            style={{ color: 'var(--th-primary)', border: `3px solid ${INK}`, boxShadow: `4px 4px 0 ${INK_SHADOW}` }}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full text-warm-white shrink-0" style={{ backgroundColor: 'var(--th-primary)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
                <path d="M10 9a2.5 2.5 0 0 1 4.8.8c0 1.7-2.3 2.2-2.3 3.4" />
                <line x1="12.4" y1="16" x2="12.41" y2="16" />
              </svg>
            </span>
            Ask your own question
          </motion.button>
        </div>

        {inTour && !revisit ? (
          <div className="px-5 pb-8 pt-4">
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
        ) : (
          <div className="pb-8" />
        )}
      </div>

      {/* Ask the Context Detective (lens → dictate/type → AI answer → add). */}
      {askOpen && (
        <ContextAskFlow
          tourId={scopeId}
          priorStops={priorStopTitles}
          onClose={() => setAskOpen(false)}
          onAdd={async (draft) => { await persistAdd({ ...draft, placeId: scopeId, origin: 'self' }); setExplored(true); }}
        />
      )}

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

      {/* Full reader for a prior response opened from the menu */}
      {viewResponse && (
        <div className="fixed inset-0 z-[1250] flex flex-col" onClick={() => setViewResponse(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative mt-auto w-full max-w-lg mx-auto bg-warm-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="shrink-0 flex items-start gap-3 px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
              <div className="flex-1 min-w-0">
                {viewResponse.actTitle && <p className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--th-primary)' }}>{viewResponse.actTitle}</p>}
                {viewResponse.promptText && <p className="font-serif italic text-text-secondary text-[15px] leading-snug mt-0.5">{viewResponse.promptText}</p>}
              </div>
              <button onClick={() => setViewResponse(null)} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-black/5 text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="font-serif text-[17px] text-text-primary leading-relaxed whitespace-pre-wrap">{viewResponse.text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
