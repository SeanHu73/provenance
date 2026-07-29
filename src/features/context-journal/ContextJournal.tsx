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
import { DEFAULT_PLACE_ID, DEFAULT_DOMAIN, defaultRange, clampRange, LENS_BY_KEY, LENSES } from './constants';
import type { ContextDraft, ContextEntry, MapType, NewContextEntry, PastCategory, TimeRange } from './types';
import { getViewerId, saveContext, unsaveContext, subscribeContextEntries, subscribeSavedIds, getPlaceConfig, addContextEntry, updateContextEntry, deleteContextEntry } from './store';
import { subscribeGuestContexts, addGuestContext, updateGuestContext, deleteGuestContext } from './guest-contexts';
import ContextMapLoader from './components/ContextMapLoader';
import ContextTimeline from './components/ContextTimeline';
import PastPanel from './components/PastPanel';
import PastPanelMagnifier from './components/PastPanelMagnifier';
import PastPanelSlider from './components/PastPanelSlider';
import { useLensVariant } from './lens-variant';
import JourneyBar, { BarButton } from './components/JourneyBar';
import { ChevronLeftIcon, CloseIcon, MenuIcon } from '@/components/icons';
import ContextOverlay from './components/ContextOverlay';
import AddContextFlow from './components/AddContextFlow';
import ContextAskFlow from './components/ContextAskFlow';
import ResearchReadyBar from './components/ResearchReadyBar';
import { captureExploredContext, subscribeExploredContexts, updateExploredContext, type ExploredContext } from './shared-store';
import OpenAiSpeechBar from '@/components/tour/cards/OpenAiSpeechBar';
import { contextNarrationText } from '@/lib/tts-narration';
import { AutoPlayMenuItem, DevJumpMenuItem } from '@/components/tour/TourMenu';
import { useDevJumpOn } from '@/lib/dev-jump';

/** Comic ink shared with the P.A.S.T. lens buttons, for the "Ask" CTA's border
 *  + hard offset shadow (see PastLens). */
const INK = '#241f1b';
const INK_SHADOW = 'rgba(26,20,14,0.9)';

/** The collapsible Map & timeline panel is hidden for now (it distracted from the
 *  lenses). Flip to re-enable — the panel and its wiring are otherwise intact. */
const SHOW_MAP_TIMELINE = false;

/** Optional light haptic tick (matches the repo pattern). */
function haptic(ms = 8) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

interface Props {
  /** When opened from a tour, the journal scopes its config + contexts to it.
   *  (Per-stop scoping drops in here later.) */
  tourId?: string;
  /** The current act's id — scopes "Send to Tour Guide" and the shared
   *  "Contexts Explored by Others" pool to this act. */
  actId?: string;
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
  /** First act: don't gate entry, but require the learner to pose their *own*
   *  question before they can continue past the context phase — so they practise
   *  contextualising at least once early on. */
  requireAskToContinue?: boolean;
  /** Called when the learner asks their own question and sees a response — hands up
   *  a full snapshot of the Detective answer so the admin Sessions view can
   *  review / correct / promote it. */
  onContextQuestion?: (info: {
    question: string;
    title: string;
    shortSummary: string;
    answer: string | null;
    lens: PastCategory;
    sources: { label: string; url: string }[];
    learnerPrediction?: string;
    motivation?: string;
    originalQuestion?: string;
    status: 'answered' | 'banked';
  }) => void;
  /** Progress count ("2 of 5"). Still accepted from the tour, but the redesigned
   *  journey bar shows the phase breadcrumb rather than a count, so it is
   *  currently unused here. */
  exploreLabel?: string;
  /** In-tour: shows the Explore→Contextualise→Reflect breadcrumb in the journey
   *  bar (Contextualise active), with "Open journey" opening the stops list. */
  onOpenStops?: () => void;
  /** In-tour back — steps the tour back a phase (shown as a header arrow). */
  onBack?: () => void;
  /** The learner has already asked/explored for this act (from a persisted
   *  signal) → seed the gates unlocked so back-nav doesn't re-lock them. */
  alreadyAsked?: boolean;
}

export default function ContextJournal({ tourId, actId, authored, inTour, revisit, onExit, continueLabel = 'Continue tour', responses = [], guidingQuestion, viewedContextIds = [], onContextViewed, priorStopTitles = [], askFirst = false, requireAskToContinue = false, onContextQuestion, onOpenStops, onBack, alreadyAsked = false }: Props) {
  const scopeId = tourId ?? DEFAULT_PLACE_ID;
  // Dev Jump (admin, off by default) unlocks this screen's three gates — ask-first,
  // continue, and the shared-contexts pool. They are the pedagogy, not plumbing, so
  // this is only for inspecting a stage without playing the tour to reach it.
  const devJump = useDevJumpOn();
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
  // A finished background job the learner tapped "reveal" on — reopens the ask
  // sheet straight at its result.
  const [reopenJobId, setReopenJobId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // A/B lens UI variant + the magnifier variant's open/ask coordination.
  const [lensVariant, setLensVariant] = useLensVariant();
  const [anyLensOpen, setAnyLensOpen] = useState(false);
  const [askLens, setAskLens] = useState<PastCategory | undefined>(undefined);
  // Act-1 gate: a blocked Continue tap buzzes, nudges, and pulses the ask CTA.
  const [continueNudge, setContinueNudge] = useState(false);
  useEffect(() => {
    if (!continueNudge) return;
    const t = window.setTimeout(() => setContinueNudge(false), 2600);
    return () => window.clearTimeout(t);
  }, [continueNudge]);
  // "Contexts Explored by Others" — the shared per-act pool, unlocked once the
  // learner has posed their own question for this act.
  const [othersContexts, setOthersContexts] = useState<ExploredContext[]>([]);
  const [exploredPanelOpen, setExploredPanelOpen] = useState(false);
  // Seed the unlock state from a persisted per-act signal so returning to this
  // act (via back-nav) doesn't re-lock the gates once they've engaged.
  const [askedOwnActId, setAskedOwnActId] = useState<string | null>(alreadyAsked ? (actId ?? null) : null);
  const [lockNudge, setLockNudge] = useState(false);
  const exploredUnlocked = devJump || (!!actId && askedOwnActId === actId);
  // A prior response opened full-screen from the menu (previews are clamped, so
  // long reflections don't blow out the dropdown).
  const [viewResponse, setViewResponse] = useState<{ actTitle: string; promptText: string; text: string } | null>(null);
  // The learner's own added copy being edited (authored originals stay read-only).
  const [editEntry, setEditEntry] = useState<ContextEntry | null>(null);
  const [fullEntry, setFullEntry] = useState<ContextEntry | null>(null);
  // In-tour gate: the learner must open at least one context before continuing.
  const [explored, setExplored] = useState(!!alreadyAsked);
  // Slider variant: every P.A.S.T. lens has been swiped to. Seeded true for a
  // returning learner (back-nav) so the swipe gate doesn't re-lock.
  const [allLensesSeen, setAllLensesSeen] = useState(!!alreadyAsked);
  // The floating "Ask your own question" CTA is hidden in the gated in-tour flow
  // until a premature Continue reveals it — then it stays.
  const [askCtaRevealed, setAskCtaRevealed] = useState(false);
  // Why a locked Continue was blocked on the last tap: swipe the lenses, or ask
  // your own first (drives the button label / hint).
  const [continueBlock, setContinueBlock] = useState<null | 'swipe' | 'ask'>(null);
  // After adding a context, a one-off tooltip tells the learner it now lives in
  // the lenses for next time.
  const [showAddedTip, setShowAddedTip] = useState(false);
  useEffect(() => {
    if (!showAddedTip) return;
    const t = window.setTimeout(() => setShowAddedTip(false), 7000);
    return () => window.clearTimeout(t);
  }, [showAddedTip]);
  // Ask-first gate (act 2+, not additional stops): the journal stays closed until
  // the learner poses their own question and sees a response. The ask flow is the
  // gate screen itself; `sawResponseRef` records that they reached a response, so
  // closing the ask flow (Done or after adding) unlocks the journal.
  const [askedOwn, setAskedOwn] = useState(!!alreadyAsked);
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

  // Adding a context the learner *researched themselves* (the Ask flow): save it
  // to their journal AND pool it to this act's shared "Contexts Explored by
  // Others" so peers (once they've asked their own) can see it.
  const askAdd = async (draft: ContextDraft) => {
    await persistAdd({ ...draft, placeId: scopeId, origin: 'self' });
    if (tourId) {
      void captureExploredContext(tourId, {
        actId, lens: draft.pastCategory, question: draft.question || '',
        title: draft.title, shortSummary: draft.shortSummary || '', longExplanation: draft.longExplanation || '',
        sources: (draft.sources || []).filter((s) => s.url || s.name).map((s) => ({ label: s.name || s.url || 'Source', url: s.url || '' })),
      });
    }
    setExplored(true);
    setShowAddedTip(true);
  };
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

  // Live pool of contexts other learners explored in this act.
  useEffect(() => {
    if (!tourId || !actId) return;
    return subscribeExploredContexts(tourId, actId, setOthersContexts);
  }, [tourId, actId]);

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
      setShowAddedTip(true);
    } catch (err) {
      console.error('[context-journal] add failed:', err);
    }
  };

  // keep the full-screen entry in sync with live data (e.g. after edits)
  const liveFull = fullEntry
    ? entries.find((e) => e.id === fullEntry.id) ?? (authored ?? []).find((a) => a.id === fullEntry.id) ?? fullEntry
    : null;

  // Ask-first gate — from the second act onward the learner must pose their own
  // context question and see a response before the journal opens. The ask flow
  // *is* the whole screen here (pick a lens → submit a question); no separate
  // framing page. Closing without a response is a no-op, so the gate can't be
  // dismissed until they've asked. Additional stops and act 1 skip this.
  if (askFirst && !askedOwn && !devJump) {
    return (
      <ContextAskFlow
        tourId={scopeId}
        actId={actId}
        priorStops={priorStopTitles}
        heading="Ask your own question"
        onAnswered={(info) => { sawResponseRef.current = true; setExplored(true); setAskedOwnActId(actId ?? null); onContextQuestion?.(info); }}
        onAdd={askAdd}
        onClose={() => { if (sawResponseRef.current) setAskedOwn(true); }}
      />
    );
  }

  // Continue gate. "Engaged" = the learner has worked through the lenses: on the
  // swipe deck that means every lens has been swiped to; on the other variants it
  // keeps the old "opened/asked a context" rule. Act 1 (requireAskToContinue) also
  // requires posing your own question.
  const engaged = lensVariant === 'slider' ? allLensesSeen : explored;
  const canContinue = devJump || (requireAskToContinue ? engaged && exploredUnlocked : engaged);
  // The floating "Ask your own" CTA is suppressed in the gated in-tour flow until
  // a premature Continue reveals it (then it stays). Standalone / revisit keep it.
  const gatedFlow = !!inTour && !revisit;
  // The slider redesign carries its own ask-your-own on every lens card, so the
  // floating global ask is redundant there and stays hidden.
  const floatingAskHidden = lensVariant === 'slider' || (gatedFlow && !askCtaRevealed) || (anyLensOpen && !continueNudge);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', backgroundColor: 'var(--th-bg)' }}>
      {/* top bar — the redesign's black journey bar (style guide: Navigation) */}
      <JourneyBar
        active="contextualise"
        onOpenJourney={onOpenStops && !revisit ? onOpenStops : undefined}
        leading={
          revisit ? (
            // Revisit overlay: a plain close button returns to the tour.
            <BarButton label="Close" onClick={onExit}>
              <CloseIcon width={18} height={18} />
            </BarButton>
          ) : inTour && onBack ? (
            // In-tour: step the tour back a phase (returning is safe — gates are
            // seeded from a persisted signal so they don't re-lock).
            <BarButton label="Go back" onClick={onBack}>
              <ChevronLeftIcon width={18} height={18} />
            </BarButton>
          ) : inTour ? undefined : (
            <Link
              href="/"
              aria-label="Back"
              className="shrink-0 flex items-center justify-center rounded-full text-white"
              style={{
                width: 'var(--ds-nav-button-size)',
                height: 'var(--ds-nav-button-size)',
                backgroundColor: 'var(--ds-nav-button-bg)',
              }}
            >
              <ChevronLeftIcon width={18} height={18} />
            </Link>
          )
        }
        menu={
          <>
            <BarButton label="Menu" expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              <MenuIcon width={18} height={18} />
            </BarButton>
            {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-3 top-full mt-1 z-50 w-72 max-h-[70vh] overflow-y-auto rounded-2xl shadow-xl bg-warm-white border" style={{ borderColor: 'var(--th-border)' }}>
              <div className="border-b" style={{ borderColor: 'var(--th-border)' }}>
                <AutoPlayMenuItem />
              </div>
              {/* Dev Jump lives here too: this screen portals over the tour chrome
                  (Journal.tsx:407, z-55), taking the tour's own menu with it — so
                  without this row an admin can't jump back out. Renders nothing
                  when there's no tour session (the standalone journal route). */}
              <DevJumpMenuItem />
              {/* A/B: swap the P.A.S.T. lens UI (magnifier vs classic buttons). */}
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
                <span className="font-semibold text-text-primary text-sm">Lens style</span>
                <div className="flex rounded-full overflow-hidden text-[12px] font-semibold border" style={{ borderColor: 'var(--th-border)' }}>
                  {(['slider', 'classic', 'magnifier'] as const).map((v) => (
                    <button key={v} onClick={() => setLensVariant(v)} className="px-3 py-1 capitalize"
                      style={{ backgroundColor: lensVariant === v ? 'var(--th-primary)' : 'transparent', color: lensVariant === v ? 'var(--th-surface)' : 'var(--text-secondary)' }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); setAddOpen(true); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-left font-semibold text-text-primary hover:bg-black/[0.03] border-b"
                style={{ borderColor: 'var(--th-border)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                Add context
              </button>

              {/* Contexts Explored by Others — locked until the learner has posed
                  their own question for this act. */}
              <button
                onClick={() => {
                  if (!exploredUnlocked) { setLockNudge(true); return; }
                  setMenuOpen(false); setLockNudge(false); setExploredPanelOpen(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-left font-semibold hover:bg-black/[0.03] border-b"
                style={{ borderColor: 'var(--th-border)', color: exploredUnlocked ? 'var(--text-primary)' : 'var(--text-muted)' }}
                aria-disabled={!exploredUnlocked}
              >
                {exploredUnlocked ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                )}
                <span className="flex-1">Contexts Explored by Others</span>
                {exploredUnlocked && othersContexts.length > 0 && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--th-primary)' }}>{othersContexts.length}</span>
                )}
              </button>
              {lockNudge && !exploredUnlocked && (
                <p className="px-4 py-2 text-[12px] italic leading-snug border-b" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-border)' }}>
                  Ask your own question for this act first — then you can see what others explored.
                </p>
              )}

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
          </>
        }
      />

      {/* 1 — collapsible map + timeline (collapsed by default) — hidden for now */}
      {SHOW_MAP_TIMELINE && (
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
      )}

      {/* 2 — P.A.S.T. framework (the main space). Three A/B variants of the lens UI. */}
      <div className="flex-1 overflow-y-auto">
        {lensVariant === 'slider' ? (
          <PastPanelSlider
            entries={displayEntries}
            selectedRange={range}
            savedIds={savedIds}
            focusedId={focused?.id ?? null}
            guidingQuestion={guidingQuestion}
            lockInfoById={lockInfo}
            onFocus={handleFocus}
            onToggleSave={toggleSave}
            onOpenFull={openFull}
            onAskLens={(lens) => { setAskLens(lens); setAskOpen(true); }}
            onAllSeenChange={setAllLensesSeen}
            initiallyAllSeen={!!alreadyAsked}
          />
        ) : lensVariant === 'magnifier' ? (
          <PastPanelMagnifier
            entries={displayEntries}
            selectedRange={range}
            savedIds={savedIds}
            focusedId={focused?.id ?? null}
            guidingQuestion={guidingQuestion}
            lockInfoById={lockInfo}
            onFocus={handleFocus}
            onToggleSave={toggleSave}
            onOpenFull={openFull}
            onAskLens={(lens) => { setAskLens(lens); setAskOpen(true); }}
            onAnyOpenChange={setAnyLensOpen}
          />
        ) : (
          <>
            <div className="px-5 pt-6 pb-4">
              {guidingQuestion ? (
                <>
                  <h2 className="font-serif text-[18px] leading-snug text-text-secondary">Look through the P.A.S.T. to contextualise&hellip;</h2>
                  <p className="mt-3 mb-1 font-display font-bold text-[30px] leading-tight text-center" style={{ color: 'var(--th-primary)' }}>{guidingQuestion}</p>
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
              onAskLens={(lens) => { setAskLens(lens); setAskOpen(true); }}
              onAnyOpenChange={setAnyLensOpen}
            />
          </>
        )}

        {/* Ask your own question — a bold, distinct *choice*. It floats over the
            scroll pinned near the bottom (an overlay CTA), then un-sticks and
            docks in flow just above the Continue button as you reach the end, so
            the two never overlap. (AI flow lands later; opens the add form.) */}
        <div className={`sticky bottom-4 z-30 px-5 pt-3 ${floatingAskHidden ? 'hidden' : ''}`}>
          <motion.button
            onClick={() => { haptic(10); setContinueNudge(false); setAskLens(undefined); setAskOpen(true); }}
            whileTap={{ x: 4, y: 4, boxShadow: `0px 0px 0 ${INK_SHADOW}` }}
            variants={{ rest: { scale: 1 }, nudge: { scale: [1, 1.1, 1, 1.1, 1], transition: { duration: 1.2, ease: 'easeInOut' } } }}
            animate={continueNudge ? 'nudge' : 'rest'}
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
            {requireAskToContinue && !canContinue ? (
              // First act: Continue stays locked until they've swiped through
              // every lens AND posed their own question. Tapping it either nudges
              // toward swiping, or (once swiped) reveals the ask CTA and relabels
              // the button to spell out what's left.
              <>
                <button
                  onClick={() => {
                    haptic(30);
                    if (!engaged) setContinueBlock('swipe');
                    else if (!exploredUnlocked) { setContinueBlock('ask'); setAskCtaRevealed(true); setContinueNudge(true); }
                  }}
                  className="w-full py-3.5 rounded-2xl text-[15px] font-semibold border-2 border-dashed bg-transparent flex items-center justify-center gap-2"
                  style={{ color: 'color-mix(in srgb, var(--th-primary) 62%, transparent)', borderColor: 'color-mix(in srgb, var(--th-primary) 38%, transparent)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  {continueBlock === 'ask' ? 'Try asking your own question before continuing' : continueLabel}
                </button>
                {continueBlock === 'swipe' && !engaged && (
                  <p className="mt-2 text-center text-xs text-text-muted">Swipe through all the lenses first.</p>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={onExit}
                  disabled={!canContinue}
                  className="w-full flex items-center justify-center text-white disabled:cursor-not-allowed"
                  style={{
                    height: 'var(--ds-btn-height)',
                    paddingInline: 'var(--ds-btn-padding-x)',
                    borderRadius: 'var(--ds-radius-pill)',
                    backgroundColor: 'var(--ds-cardinal)',
                    fontFamily: 'var(--ds-button-family)',
                    fontSize: 'var(--ds-button-size)',
                    lineHeight: 'var(--ds-button-line)',
                    fontWeight: 'var(--ds-button-weight)',
                    // the guide's disabled state is the whole button dimmed
                    opacity: canContinue ? 1 : 'var(--ds-btn-disabled-opacity)',
                  }}
                >
                  {continueLabel}
                </button>
                {!canContinue && (
                  <p className="mt-2 text-center text-xs text-text-muted">
                    {lensVariant === 'slider' ? 'Swipe through all the lenses to continue.' : 'Ask a question — or tap one to explore — before continuing.'}
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="pb-8" />
        )}
      </div>

      {/* Added-context tooltip — a one-off nudge that a context the learner just
          added now lives in the P.A.S.T. lenses for next time. */}
      <AnimatePresence>
        {showAddedTip && (
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="fixed left-1/2 -translate-x-1/2 z-[70] px-4"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 92px)' }}
          >
            <div className="relative flex items-start gap-2.5 rounded-2xl px-4 py-3 shadow-xl text-warm-white" style={{ backgroundColor: 'var(--th-primary)', maxWidth: 320 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" />
              </svg>
              <p className="flex-1 font-serif text-[13.5px] leading-snug">
                Nice — your context now lives in the P·A·S·T lenses. You&apos;ll spot it here whenever you look through them.
              </p>
              <button onClick={() => setShowAddedTip(false)} aria-label="Dismiss" className="shrink-0 -mr-1 -mt-1 w-6 h-6 flex items-center justify-center text-warm-white/85 text-xl leading-none">&times;</button>
              {/* little pointer toward the lenses above */}
              <span aria-hidden className="absolute left-1/2 -translate-x-1/2" style={{ top: -7, width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid var(--th-primary)' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Answer ready" overlay — pulls the learner back to a background job that
          finished while they explored something else. Hidden while a sheet is open. */}
      <ResearchReadyBar tourId={scopeId} hidden={askOpen || !!reopenJobId} onReveal={(id) => setReopenJobId(id)} />

      {/* Ask the Context Detective (lens → dictate/type → AI answer → add). Also
          reopened straight at a finished job's result via the ready overlay. */}
      {(askOpen || reopenJobId) && (
        <ContextAskFlow
          tourId={scopeId}
          actId={actId}
          priorStops={priorStopTitles}
          existingJobId={reopenJobId ?? undefined}
          presetLens={askLens}
          onAnswered={(info) => { setExplored(true); setAskedOwnActId(actId ?? null); onContextQuestion?.(info); }}
          onClose={() => { setAskOpen(false); setReopenJobId(null); setAskLens(undefined); }}
          onAdd={askAdd}
        />
      )}

      {/* Contexts Explored by Others — the shared per-act pool, grouped by lens
          and kept distinct from the pre-authored questions. */}
      {exploredPanelOpen && (
        <div className="fixed inset-0 z-[68] flex flex-col" style={{ backgroundColor: 'var(--th-surface)' }}>
          <header className="shrink-0 flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--th-border)' }}>
            <div>
              <h3 className="font-display font-bold text-[20px]" style={{ color: 'var(--th-primary)' }}>Explored by others</h3>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>Contexts other learners looked into for this act — including your own.</p>
            </div>
            <button onClick={() => setExploredPanelOpen(false)} aria-label="Close" className="w-9 h-9 flex items-center justify-center rounded-full" style={{ color: 'var(--text-secondary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {othersContexts.length === 0 ? (
              <p className="text-[15px] italic text-center py-10" style={{ color: 'var(--text-secondary)' }}>No one&apos;s explored a context here yet — yours will be the first others see.</p>
            ) : (
              LENSES.map((l) => {
                const items = othersContexts.filter((c) => c.lens === l.key);
                if (!items.length) return null;
                return (
                  <section key={l.key}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.colour }} />
                      <h4 className="font-semibold text-[15px]" style={{ color: l.colour }}>{l.label}</h4>
                      <span className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>· by others</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((c) => <ExploredCard key={c.id} ctx={c} colour={l.colour} tourId={tourId} />)}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {addOpen && (
          <AddContextFlow
            key="add"
            onClose={() => setAddOpen(false)}
            onSubmit={async (draft) => { await persistAdd({ ...draft, placeId: scopeId, origin: 'self' }); setExplored(true); setShowAddedTip(true); }}
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

/* A single "explored by others" context: title + question + summary, expanding
   to the full explanation and its sources. */
function ExploredCard({ ctx, colour, tourId }: { ctx: ExploredContext; colour: string; tourId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--th-border)', borderLeftColor: colour, borderLeftWidth: 4 }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left px-3.5 py-3">
        <p className="font-serif font-semibold text-[15px] leading-snug" style={{ color: 'var(--text-primary)' }}>{ctx.title}</p>
        {ctx.question && <p className="text-[12px] italic mt-0.5" style={{ color: 'var(--text-secondary)' }}>&ldquo;{ctx.question}&rdquo;</p>}
        {ctx.shortSummary && <p className="text-[13px] mt-1 leading-snug" style={{ color: 'var(--text-secondary)' }}>{ctx.shortSummary}</p>}
      </button>
      {open && (
        <div className="px-3.5 pb-3 space-y-2">
          {/* Narration is generated once and saved (shared), so the next learner
              streams it instead of regenerating. */}
          <OpenAiSpeechBar
            text={contextNarrationText({ title: ctx.title, longExplanation: ctx.longExplanation })}
            title={ctx.title}
            durable
            cachedUrl={ctx.audioUrl ?? null}
            onGenerated={(url) => { if (tourId && !ctx.audioUrl) void updateExploredContext(tourId, ctx.id, { audioUrl: url }); }}
          />
          <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: 'var(--text-primary)' }}>{ctx.longExplanation}</p>
          {ctx.sources?.length > 0 && (
            <ul className="text-[11px] space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
              {ctx.sources.map((s, i) => (
                <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.label || s.url}</a> : s.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
