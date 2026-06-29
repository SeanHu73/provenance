'use client';

/**
 * /admin/tours/[id] — Tour editor.
 *
 * Full authoring interface for a single tour. Sean edits tour metadata
 * at the top (title, subtitle, guide, cover photo, description) and
 * manages an ordered list of stops below. Each stop expands inline to
 * show all five phase fields: Seed, Notice, Wonder, Reveal, plus metadata
 * (physical location tag, related entries, upcoming topics).
 *
 * "Preview this stop" opens a simple phase-by-phase walkthrough so Sean
 * can see exactly what the learner will experience.
 *
 * Auto-saves to Firestore on every blur / change so work is never lost.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { APIProvider, Map as GoogleMap, AdvancedMarker } from '@vis.gl/react-google-maps';
import { Tour, Stop, Detour, StopPhoto, Act, ActContextItem, TourMode } from '@/lib/types';
import { getTour, saveTour, deleteTour, blankStop, blankDetour, getActiveStops, setActiveStops, duplicateStops, getTourMode, blankAct, blankOpeningFrame } from '@/lib/tours-store';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import RichTextarea from '@/components/admin/RichTextarea';
import AudioUpload from '@/components/admin/AudioUpload';
import PhotoOverlayEditor from '@/components/admin/PhotoOverlayEditor';
import PhotoCueEditor from '@/components/admin/PhotoCueEditor';
import ContextJournalConfig from '@/features/context-journal/admin/ContextJournalConfig';
import AddContextFlow from '@/features/context-journal/components/AddContextFlow';
import type { ContextDraft } from '@/features/context-journal/types';

/** Stable id for a new Add-Context item (module-level: keeps render pure). */
function makeCtxId(): string {
  return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `ctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
import { registerPhotoInLibrary } from '@/lib/photo-sync-tour';

const CHURCH_LOCATION = { lat: 37.42700, lng: -122.17015 };
const MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const DEFAULT_WHAT_SHIFTED_ADMIN = [
  'We learned something new',
  'We changed our mind',
  'We had part of it',
  'It was as we expected',
];

const DEFAULT_REASONING_ADMIN = [
  'Something we saw here',
  'Something we discussed now',
  'Something we just learned on the tour',
  'Something we already knew',
];

const LOCATION_TAGS = [
  'exterior_facade', 'exterior_sides', 'exterior_rear',
  'narthex', 'nave', 'nave_aisles',
  'crossing', 'dome', 'chancel',
  'transepts', 'side_chapel', 'organ_loft',
  'general',
] as const;

const KNOWN_ENTRIES: Array<{ id: string; title: string }> = [
  { id: '1.1', title: 'The Chain of Grief' },
  { id: '1.2', title: 'Jane Stanford: The Woman Who Built the Church' },
  { id: '1.2a', title: 'The University Founding Vision' },
  { id: '1.2b', title: 'The Chinese Railroad Workers' },
  { id: '1.3', title: 'Charles Coolidge: The Young Architect' },
  { id: '1.4', title: 'Camerino and the Salviati Studios' },
  { id: '1.5', title: 'Frederick Stymetz Lamb: Stained Glass' },
  { id: '1.6', title: 'John McGilvray: The Builder' },
  { id: '1.7', title: 'Charles Fisk: Atomic Bombs to Organs' },
  { id: '2.1', title: 'Architecture: Form and Dimensions' },
  { id: '3.1', title: 'The Facade Mosaic' },
  { id: '3.2', title: 'The Narthex and West Entrance' },
  { id: '3.3', title: 'Nave and Crossing' },
  { id: '3.4', title: 'The Pendentive Angels' },
  { id: '3.5', title: 'The Chancel / Last Supper' },
  { id: '3.6', title: 'The Narthex Floor' },
  { id: '4.1', title: 'Original Organ' },
  { id: '4.2', title: 'Fisk Organ' },
  { id: '5.1', title: 'Stained Glass: Nave Windows' },
  { id: '5.2', title: 'Stained Glass: Chancel Windows' },
  { id: '6.1', title: 'The 1906 Earthquake' },
  { id: '6.2', title: 'Reconstruction' },
  { id: '7.1', title: 'The 1989 Loma Prieta Earthquake' },
  { id: '8.1', title: 'Current Use' },
  { id: '9.1', title: 'Inscriptions and Carved Text' },
  { id: '10.1', title: 'Venice / Salviati Connection' },
  { id: '10.2', title: 'Cantor Arts Center Mosaics' },
  { id: '10.3', title: 'Clock Tower' },
];

/**
 * Normalize a tour's Acts so they cover exactly the given stops:
 * drops stop IDs that no longer exist, guarantees at least one act, and
 * appends any unassigned stops (in their array order) to the last act.
 * Enforces the "every stop in exactly one act" rule.
 */
function ensureActsCoverStops(acts: Act[] | undefined, stops: Stop[]): Act[] {
  const validIds = new Set(stops.map((s) => s.id));
  let result: Act[] = (acts && acts.length > 0)
    ? acts.map((a) => ({ ...a, stopIds: (a.stopIds || []).filter((id) => validIds.has(id)) }))
    : [blankAct(0, [])];
  const assigned = new Set(result.flatMap((a) => a.stopIds));
  const unassigned = stops.filter((s) => !assigned.has(s.id)).map((s) => s.id);
  if (unassigned.length > 0) {
    result = result.map((a, i) =>
      i === result.length - 1 ? { ...a, stopIds: [...a.stopIds, ...unassigned] } : a,
    );
  }
  return result;
}

export default function TourEditorPage() {
  const params = useParams();
  const router = useRouter();
  const tourId = params.id as string;

  const [tour, setTour] = useState<Tour | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [previewStopId, setPreviewStopId] = useState<string | null>(null);
  const [previewPhase, setPreviewPhase] = useState(0);
  // Context-Prototype: id of the stop currently being dragged between acts.
  const [dragStopId, setDragStopId] = useState<string | null>(null);
  // Authoring-time textbox size — persisted across sessions so an admin's
  // preference sticks. Applied via the data-admin-text-size attribute on
  // the page root; CSS in globals.css scales every textarea / text input
  // inside that scope.
  const [adminTextSize, setAdminTextSize] = useState<'small' | 'normal' | 'large'>('normal');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin-text-size');
      if (saved === 'small' || saved === 'normal' || saved === 'large') {
        setAdminTextSize(saved);
      }
    } catch { /* ignore */ }
  }, []);
  const changeAdminTextSize = (size: 'small' | 'normal' | 'large') => {
    setAdminTextSize(size);
    try { localStorage.setItem('admin-text-size', size); } catch { /* ignore */ }
  };

  const stopRefs = useRef<Record<string, HTMLLIElement | null>>({});
  useEffect(() => {
    if (!expandedStopId) return;
    const el = stopRefs.current[expandedStopId];
    if (!el) return;
    // Slight delay lets React paint the expanded content before we scroll
    const id = setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    return () => clearTimeout(id);
  }, [expandedStopId]);

  useEffect(() => {
    getTour(tourId).then((t) => {
      setTour(t);
      setLoading(false);
    });
  }, [tourId]);

  // Persist to Firestore. Debounced via the caller — each field calls
  // this on blur or after meaningful edits.
  const persist = useCallback(async (updated: Tour) => {
    setSaving(true);
    try {
      await saveTour(updated);
    } catch (err) {
      console.error('[tour-editor] save failed:', err);
    }
    setSaving(false);
  }, []);

  // Context mode invariant: every stop belongs to exactly one act. Self-heal
  // any tour whose acts don't yet cover all of its context stops (e.g. data
  // authored before this feature, or a stop added elsewhere).
  useEffect(() => {
    if (!tour || getTourMode(tour) !== 'context') return;
    const stops = getActiveStops(tour);
    if (stops.length === 0) return;
    const assigned = new Set((tour.acts || []).flatMap((a) => a.stopIds || []));
    const covered = (tour.acts || []).length > 0 && stops.every((s) => assigned.has(s.id));
    if (!covered) {
      const next = { ...tour, acts: ensureActsCoverStops(tour.acts, stops) };
      setTour(next);
      persist(next);
    }
  }, [tour, persist]);

  // ── Tour metadata helpers ──

  const updateField = <K extends keyof Tour>(key: K, value: Tour[K]) => {
    if (!tour) return;
    const next = { ...tour, [key]: value };
    setTour(next);
    persist(next);
  };

  const updateGuide = (field: keyof Tour['guide'], value: string) => {
    if (!tour) return;
    const next = { ...tour, guide: { ...tour.guide, [field]: value } };
    setTour(next);
    persist(next);
  };

  const updateGuidePartial = (partial: Partial<Tour['guide']>) => {
    if (!tour) return;
    const next = { ...tour, guide: { ...tour.guide, ...partial } };
    setTour(next);
    persist(next);
  };

  // ── Stop helpers ──
  // All stop edits read/write through getActiveStops/setActiveStops so
  // linear and unstructured tours each maintain their own stops array.

  const updateStop = (stopId: string, patch: Partial<Stop>) => {
    if (!tour) return;
    const active = getActiveStops(tour);
    const nextStops = active.map((s) => (s.id === stopId ? { ...s, ...patch } : s));
    const next = setActiveStops(tour, nextStops);
    setTour(next);
    persist(next);
  };

  const addStop = () => {
    if (!tour) return;
    const active = getActiveStops(tour);
    const stop = blankStop(active.length);
    let next = setActiveStops(tour, [...active, stop]);
    // Context mode: new stops join the last act so every stop has a home.
    if (getTourMode(tour) === 'context') {
      const acts = (next.acts && next.acts.length > 0) ? next.acts : [blankAct(0, [])];
      next = {
        ...next,
        acts: acts.map((a, i) => (i === acts.length - 1 ? { ...a, stopIds: [...a.stopIds, stop.id] } : a)),
      };
    }
    setTour(next);
    setExpandedStopId(stop.id);
    persist(next);
  };

  const removeStop = (stopId: string) => {
    if (!tour) return;
    if (!confirm('Delete this stop?')) return;
    const active = getActiveStops(tour);
    const nextStops = active
      .filter((s) => s.id !== stopId)
      .map((s, i) => ({ ...s, order: i }));
    let next = setActiveStops(tour, nextStops);
    if (getTourMode(tour) === 'context' && next.acts) {
      next = { ...next, acts: next.acts.map((a) => ({ ...a, stopIds: a.stopIds.filter((id) => id !== stopId) })) };
    }
    setTour(next);
    if (expandedStopId === stopId) setExpandedStopId(null);
    persist(next);
  };

  // ── Mode + Acts (Context-Prototype) helpers ──

  const setMode = (newMode: TourMode) => {
    if (!tour) return;
    if (getTourMode(tour) === newMode) return;
    let next: Tour = { ...tour, tourMode: newMode, unstructuredMode: newMode === 'unstructured' };
    if (newMode === 'unstructured') {
      if (!tour.unstructuredStops || tour.unstructuredStops.length === 0) {
        next.unstructuredStops = duplicateStops(tour.stops);
      }
    } else if (newMode === 'context') {
      if (!tour.contextStops || tour.contextStops.length === 0) {
        const src = (tour.unstructuredStops && tour.unstructuredStops.length > 0) ? tour.unstructuredStops : tour.stops;
        next.contextStops = duplicateStops(src);
      }
      next.acts = ensureActsCoverStops(next.acts, next.contextStops || []);
      if (!next.openingFrame) {
        const eq = tour.essentialQuestion;
        next.openingFrame = eq
          ? {
              scenePhotoUrl: eq.scenePhotoUrl,
              sceneDescription: eq.sceneDescription,
              sceneAudioUrl: eq.sceneAudioUrl,
              sceneAudioTitle: eq.sceneAudioTitle,
              sceneAudioAutoplayDisabled: eq.sceneAudioAutoplayDisabled,
              openingFraming: eq.openingFraming,
            }
          : blankOpeningFrame();
      }
    }
    setTour(next);
    setExpandedStopId(null);
    persist(next);
  };

  const updateActs = (nextActs: Act[]) => {
    if (!tour) return;
    const next = { ...tour, acts: nextActs };
    setTour(next);
    persist(next);
  };

  const addAct = () => {
    const acts = tour?.acts || [];
    updateActs([...acts, blankAct(acts.length, [])]);
  };

  const removeAct = (actId: string) => {
    const acts = tour?.acts || [];
    if (acts.length <= 1) { alert('A context tour needs at least one act.'); return; }
    const target = acts.find((a) => a.id === actId);
    if (!target) return;
    if (target.stopIds.length > 0 && !confirm('This act has stops. They will move to the previous act. Continue?')) return;
    const idx = acts.findIndex((a) => a.id === actId);
    const fallbackIdx = idx > 0 ? idx - 1 : 1; // move orphaned stops to a neighbour
    const next = acts
      .map((a, i) => (i === fallbackIdx ? { ...a, stopIds: [...a.stopIds, ...target.stopIds] } : a))
      .filter((a) => a.id !== actId);
    updateActs(next);
  };

  const updateAct = (actId: string, patch: Partial<Act>) => {
    const acts = tour?.acts || [];
    updateActs(acts.map((a) => (a.id === actId ? { ...a, ...patch } : a)));
  };

  const setActReflection = (actId: string, prompt: string) => {
    updateAct(actId, { reflectionQuestion: prompt.trim() ? { prompt } : null });
  };

  // ── Rich "Add Context" items (positioned after a stop within an act) ──
  const [ctxEditor, setCtxEditor] = useState<{ actId: string; itemId: string | null } | null>(null);

  const upsertActContextItem = (actId: string, draft: ContextDraft, itemId: string | null) => {
    const act = (tour?.acts || []).find((a) => a.id === actId);
    if (!act) return;
    const items = act.contexts ?? [];
    if (itemId) {
      updateAct(actId, { contexts: items.map((c) => (c.id === itemId ? { ...c, ...draft } : c)) });
    } else {
      const afterStopId = act.stopIds[act.stopIds.length - 1] ?? '';
      const newItem: ActContextItem = { id: makeCtxId(), afterStopId, ...draft };
      updateAct(actId, { contexts: [...items, newItem] });
    }
  };
  const removeActContextItem = (actId: string, itemId: string) => {
    const act = (tour?.acts || []).find((a) => a.id === actId);
    updateAct(actId, { contexts: (act?.contexts ?? []).filter((c) => c.id !== itemId) });
  };
  const setActContextItemAfter = (actId: string, itemId: string, afterStopId: string) => {
    const act = (tour?.acts || []).find((a) => a.id === actId);
    updateAct(actId, { contexts: (act?.contexts ?? []).map((c) => (c.id === itemId ? { ...c, afterStopId } : c)) });
  };

  const moveAct = (actId: string, direction: -1 | 1) => {
    const acts = tour?.acts || [];
    const idx = acts.findIndex((a) => a.id === actId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= acts.length) return;
    const next = [...acts];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    updateActs(next);
  };

  // Move a stop into a target act at a given index (append when undefined).
  const assignStopToAct = (stopId: string, targetActId: string, targetIndex?: number) => {
    const acts = tour?.acts || [];
    const cleaned = acts.map((a) => ({ ...a, stopIds: a.stopIds.filter((id) => id !== stopId) }));
    const next = cleaned.map((a) => {
      if (a.id !== targetActId) return a;
      const ids = [...a.stopIds];
      const i = targetIndex === undefined ? ids.length : Math.max(0, Math.min(targetIndex, ids.length));
      ids.splice(i, 0, stopId);
      return { ...a, stopIds: ids };
    });
    updateActs(next);
    setDragStopId(null);
  };

  // Reorder a stop within its own act by one position.
  const moveStopInAct = (actId: string, stopId: string, direction: -1 | 1) => {
    const acts = tour?.acts || [];
    const act = acts.find((a) => a.id === actId);
    if (!act) return;
    const idx = act.stopIds.indexOf(stopId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= act.stopIds.length) return;
    const ids = [...act.stopIds];
    [ids[idx], ids[newIdx]] = [ids[newIdx], ids[idx]];
    updateAct(actId, { stopIds: ids });
  };

  const moveStop = (stopId: string, direction: -1 | 1) => {
    if (!tour) return;
    const active = getActiveStops(tour);
    const idx = active.findIndex((s) => s.id === stopId);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= active.length) return;
    const reordered = [...active];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    const next = setActiveStops(tour, reordered.map((s, i) => ({ ...s, order: i })));
    setTour(next);
    persist(next);
  };

  // ── Photo upload helper ──

  const uploadPhoto = async (file: File, path: string): Promise<string> => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    // Auto-register image uploads in the photo library (skip audio)
    if (file.type.startsWith('image/')) {
      registerPhotoInLibrary(url, { tourTitle: tour?.title });
    }
    return url;
  };

  // ── Delete tour ──

  const handleDeleteTour = async () => {
    if (!confirm('Delete this entire tour? This cannot be undone.')) return;
    await deleteTour(tourId);
    router.push('/admin/tours');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
        <p className="text-stone-600 text-sm">Loading tour...</p>
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
        <p className="text-red-700 text-sm">Tour not found.</p>
        <Link href="/admin/tours" className="text-blue-700 text-sm hover:underline">&larr; Back to tours</Link>
      </div>
    );
  }

  const activeStops = getActiveStops(tour);
  const previewStop = previewStopId ? activeStops.find((s) => s.id === previewStopId) : null;
  const mode: TourMode = getTourMode(tour);
  const acts: Act[] = tour.acts || [];

  // Shared stop-row renderer — used by both the flat (linear/unstructured)
  // list and the context-mode Acts organizer.
  const renderStopRow = (
    stop: Stop,
    displayNum: number,
    opts: {
      onUp: () => void;
      onDown: () => void;
      upDisabled: boolean;
      downDisabled: boolean;
      actControl?: React.ReactNode;
      draggable?: boolean;
      onDropBefore?: () => void;
    },
  ) => (
    <li
      key={stop.id}
      ref={(el) => { stopRefs.current[stop.id] = el; }}
      draggable={opts.draggable}
      onDragStart={opts.draggable ? (e) => { e.stopPropagation(); setDragStopId(stop.id); } : undefined}
      onDragEnd={opts.draggable ? () => setDragStopId(null) : undefined}
      onDragOver={opts.onDropBefore ? (e) => { e.preventDefault(); } : undefined}
      onDrop={opts.onDropBefore ? (e) => { e.preventDefault(); e.stopPropagation(); opts.onDropBefore!(); } : undefined}
      className={`border rounded bg-white ${dragStopId === stop.id ? 'border-blue-400 opacity-60' : 'border-stone-300'}`}
    >
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-stone-50"
        onClick={() => setExpandedStopId(expandedStopId === stop.id ? null : stop.id)}
      >
        {opts.draggable && <span className="text-stone-300 cursor-grab select-none" title="Drag to reorder or move to another act">&#x2630;</span>}
        <span className="text-xs font-mono text-stone-400 w-6 text-center">{displayNum}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {stop.title || <em className="text-stone-400">Untitled stop</em>}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            {stop.physicalLocationTag}
            {stop.location && <> &middot; <span className="text-amber-700">has map pin</span></>}
            {mode !== 'context' && <>{' '}&middot; {stop.wonder === null ? 'No wonder' : stop.wonder.question ? 'Wonder set' : 'Wonder empty'}</>}
            {' '}&middot; {stop.reveal.text ? 'Reveal set' : 'No reveal'}
          </div>
        </div>
        <div className="flex gap-1 items-center" onClick={(e) => e.stopPropagation()}>
          {opts.actControl}
          <button
            onClick={opts.onUp}
            disabled={opts.upDisabled}
            className="px-1.5 py-0.5 text-xs rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-30"
            title="Move up"
          >&uarr;</button>
          <button
            onClick={opts.onDown}
            disabled={opts.downDisabled}
            className="px-1.5 py-0.5 text-xs rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-30"
            title="Move down"
          >&darr;</button>
          <button
            onClick={() => { setPreviewStopId(stop.id); setPreviewPhase(0); }}
            className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
            title="Preview"
          >Preview</button>
          <button
            onClick={() => removeStop(stop.id)}
            className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
            title="Delete"
          >&times;</button>
        </div>
      </div>

      {expandedStopId === stop.id && (
        <StopEditor
          stop={stop}
          tourId={tourId}
          tourCategories={tour.categories || []}
          onChange={(patch) => updateStop(stop.id, patch)}
          onUploadPhoto={uploadPhoto}
          hideDiscussionAndBridge={mode === 'context'}
        />
      )}
    </li>
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans" data-admin-text-size={adminTextSize}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-6 border-b border-stone-300 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Edit tour</h1>
              <p className="text-xs text-stone-500 mt-0.5 font-mono">{tourId}</p>
            </div>
            <div className="flex gap-3 text-sm items-center">
              {/* Author-side textbox size — scales every textarea and text
                  input within the editor. Doesn't touch labels or buttons. */}
              <div className="flex items-center gap-1 px-2 py-1 rounded border border-stone-300 bg-white">
                <span className="text-[10px] text-stone-500 mr-1">Text size</span>
                {(['small', 'normal', 'large'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeAdminTextSize(s)}
                    className={`px-1.5 py-0.5 rounded transition-colors ${
                      adminTextSize === s
                        ? 'bg-blue-600 text-white'
                        : 'text-stone-600 hover:bg-stone-100'
                    }`}
                    style={{ fontSize: s === 'small' ? 10 : s === 'normal' ? 12 : 14, lineHeight: 1 }}
                    aria-pressed={adminTextSize === s}
                    title={`Text size: ${s}`}
                  >
                    A
                  </button>
                ))}
              </div>
              {saving && <span className="text-xs text-stone-400 italic">Saving...</span>}
              <button
                onClick={handleDeleteTour}
                className="px-3 py-1.5 rounded bg-red-100 text-red-700 hover:bg-red-200 text-xs"
              >
                Delete tour
              </button>
              <Link href="/admin/tours" className="text-blue-700 hover:underline">&larr; Tours</Link>
            </div>
          </div>
        </header>

        {/* Tour mode — the experience this tour delivers. */}
        <section className="mb-8 p-4 rounded border-2 border-blue-300 bg-blue-50/40 space-y-3">
          <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">Tour mode</h2>
          <div className="grid grid-cols-3 gap-2">
            {([
              { id: 'linear' as const, title: 'Linear', blurb: 'Fixed authored sequence of stops.' },
              { id: 'unstructured' as const, title: 'Unstructured', blurb: 'Explorers pick stop order on a map.' },
              { id: 'context' as const, title: 'Context-Prototype', blurb: 'Sequential. No essential question or per-stop discussion — stops grouped into Acts with opening/closing questions.' },
            ]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                aria-pressed={mode === opt.id}
                className={`text-left p-3 rounded border-2 transition-colors ${
                  mode === opt.id
                    ? 'border-blue-600 bg-white shadow-sm'
                    : 'border-stone-200 bg-white/60 hover:border-stone-300'
                }`}
              >
                <div className={`text-sm font-semibold ${mode === opt.id ? 'text-blue-700' : 'text-stone-700'}`}>{opt.title}</div>
                <p className="text-[10px] text-stone-500 mt-0.5 leading-snug">{opt.blurb}</p>
              </button>
            ))}
          </div>
          {mode === 'context' && (
            <p className="text-[10px] text-amber-700">
              Context-Prototype keeps its own stops set (cloned when you first switch). The Essential Question and per-stop discussion/bridge are hidden in this mode.
            </p>
          )}
        </section>

        {/* Tour metadata */}
        <section className="mb-8 p-4 rounded border border-stone-300 bg-white space-y-4">
          <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">Tour metadata</h2>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs text-stone-600">Title</span>
              <input
                value={tour.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-stone-600">Subtitle</span>
              <input
                value={tour.subtitle}
                onChange={(e) => updateField('subtitle', e.target.value)}
                className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs text-stone-600">Guide name</span>
              <input
                value={tour.guide.name}
                onChange={(e) => updateGuide('name', e.target.value)}
                className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-stone-600">Guide role</span>
              <input
                value={tour.guide.role}
                onChange={(e) => updateGuide('role', e.target.value)}
                className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-stone-600">Guide initials</span>
              <input
                value={tour.guide.initials}
                onChange={(e) => updateGuide('initials', e.target.value)}
                className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
                maxLength={3}
              />
            </label>
          </div>

          {/* "Meet Your Guide" screen — photo, intro, audio */}
          <div className="space-y-3 rounded border border-stone-200 bg-stone-50 p-3">
            <p className="text-xs font-semibold text-stone-600">&ldquo;Meet Your Guide&rdquo; screen</p>
            <div>
              <span className="text-xs text-stone-600">Guide photo URL</span>
              <div className="flex gap-2 mt-1">
                <input
                  value={tour.guide.photoUrl ?? ''}
                  onChange={(e) => updateGuidePartial({ photoUrl: e.target.value })}
                  className="flex-1 px-3 py-1.5 border border-stone-300 rounded text-sm"
                  placeholder="/photos/... or upload"
                />
                <label className="px-3 py-1.5 rounded bg-stone-200 text-stone-700 text-sm cursor-pointer hover:bg-stone-300">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = await uploadPhoto(file, `memorial-church/photos/tours/${tourId}/guide_${file.name}`);
                      updateGuidePartial({ photoUrl: url });
                    }}
                  />
                </label>
              </div>
              <span className="text-[11px] text-stone-400 block mt-1">
                Round photo shown on the guide screen and the journal peek.
              </span>
            </div>

            {/* Round-photo framing — focal point + zoom */}
            {tour.guide.photoUrl && (() => {
              const fp = tour.guide.photoFocalPoint;
              const zoom = tour.guide.photoZoom ?? 1;
              const objPos = fp ? `${fp.x}% ${fp.y}%` : '50% 50%';
              const origin = fp ? `${fp.x}% ${fp.y}%` : 'center';
              return (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-stone-400">
                    Click the photo to set the focal point — it is shown in a circle on the tour.
                  </p>
                  <div className="flex gap-3 items-start">
                    <div
                      className="relative rounded-full border border-stone-300 cursor-crosshair shrink-0 bg-stone-200 overflow-hidden"
                      style={{ width: 132, height: 132 }}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                        updateGuidePartial({ photoFocalPoint: { x, y } });
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          transform: zoom > 1 ? `scale(${zoom})` : undefined,
                          transformOrigin: zoom > 1 ? origin : undefined,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tour.guide.photoUrl}
                          alt="guide"
                          className="w-full h-full object-cover select-none"
                          style={{ objectPosition: objPos }}
                          draggable={false}
                        />
                      </div>
                      {fp && (
                        <div
                          className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
                          style={{ left: `${fp.x}%`, top: `${fp.y}%`, transform: 'translate(-50%,-50%)', background: '#F59E0B' }}
                        />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400 shrink-0">Zoom:</span>
                        <input
                          type="range" min={1} max={3} step={0.05} value={zoom}
                          onChange={(e) => updateGuidePartial({ photoZoom: parseFloat(e.target.value) })}
                          className="flex-1 h-1 accent-amber-500"
                        />
                        <span className="text-[10px] text-stone-500 w-9 text-right">{zoom.toFixed(2)}×</span>
                      </div>
                      <p className="text-[10px] text-stone-400">
                        {fp ? `Focal point: ${fp.x}%, ${fp.y}%` : 'No focal point — defaults to centre'}
                      </p>
                      {(fp || zoom !== 1) && (
                        <button
                          type="button"
                          onClick={() => updateGuidePartial({ photoFocalPoint: undefined, photoZoom: 1 })}
                          className="text-[10px] text-blue-600 hover:underline"
                        >
                          Reset framing
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            <label className="block">
              <span className="text-xs text-stone-600">Guide intro text</span>
              <textarea
                value={tour.guide.intro ?? ''}
                onChange={(e) => updateGuidePartial({ intro: e.target.value })}
                rows={3}
                className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
                placeholder="A brief introduction from the guide…"
              />
            </label>
            <AudioUpload
              audioUrl={tour.guide.introAudioUrl ?? null}
              audioTitle={tour.guide.introAudioTitle ?? null}
              onChange={(url) => updateGuidePartial({ introAudioUrl: url })}
              onTitleChange={(title) => updateGuidePartial({ introAudioTitle: title })}
              uploadPath={`memorial-church/audio/tours/${tourId}/guide`}
              onUploadFile={uploadPhoto}
              autoplayDisabled={tour.guide.introAudioAutoplayDisabled}
              onAutoplayDisabledChange={(v) => updateGuidePartial({ introAudioAutoplayDisabled: v })}
            />
            <label className="block">
              <span className="text-xs text-stone-600">
                Closing &ldquo;Last words&rdquo; message (optional)
              </span>
              <textarea
                value={tour.guide.thankYouMessage ?? ''}
                onChange={(e) => updateGuidePartial({ thankYouMessage: e.target.value })}
                rows={3}
                className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
                placeholder="A closing thank-you from the guide, shown near the end of the tour…"
              />
              <span className="text-[11px] text-stone-400 block mt-1">
                Shown as &ldquo;Last words from {tour.guide.name || 'the guide'}&rdquo; before the end screen.
              </span>
            </label>
            <AudioUpload
              audioUrl={tour.guide.thankYouAudioUrl ?? null}
              audioTitle={tour.guide.thankYouAudioTitle ?? null}
              onChange={(url) => updateGuidePartial({ thankYouAudioUrl: url })}
              onTitleChange={(title) => updateGuidePartial({ thankYouAudioTitle: title })}
              uploadPath={`memorial-church/audio/tours/${tourId}/guide-outro`}
              onUploadFile={uploadPhoto}
              autoplayDisabled={tour.guide.thankYouAudioAutoplayDisabled}
              onAutoplayDisabledChange={(v) => updateGuidePartial({ thankYouAudioAutoplayDisabled: v })}
            />
          </div>

          <label className="block">
            <span className="text-xs text-stone-600">Description (shown on journal peek)</span>
            <textarea
              value={tour.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
            />
          </label>

          <label className="block">
            <span className="text-xs text-stone-600">Cover photo URL</span>
            <div className="flex gap-2 mt-1">
              <input
                value={tour.coverPhotoUrl}
                onChange={(e) => updateField('coverPhotoUrl', e.target.value)}
                className="flex-1 px-3 py-1.5 border border-stone-300 rounded text-sm"
                placeholder="/photos/archival/..."
              />
              <label className="px-3 py-1.5 rounded bg-stone-200 text-stone-700 text-sm cursor-pointer hover:bg-stone-300">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadPhoto(file, `memorial-church/photos/tours/${tourId}/cover_${file.name}`);
                    updateField('coverPhotoUrl', url);
                  }}
                />
              </label>
            </div>
            {tour.coverPhotoUrl && (() => {
              const fp = tour.coverPhotoFocalPoint;
              const zoom = tour.coverPhotoZoom ?? 1;
              const objPos = fp ? `${fp.x}% ${fp.y}%` : '50% 50%';
              const origin = fp ? `${fp.x}% ${fp.y}%` : 'center';
              return (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] text-stone-400">
                    Click the photo to set the focal point. Preview matches what learners see on the journal peek (same crop, opacity, and gradient).
                  </p>
                  <div
                    className="relative w-full max-w-md h-36 cursor-crosshair overflow-hidden rounded bg-stone-200 border border-stone-300"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                      const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                      updateField('coverPhotoFocalPoint', { x, y });
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tour.coverPhotoUrl}
                      alt="cover"
                      className="w-full h-full object-cover opacity-60 select-none"
                      style={{
                        objectPosition: objPos,
                        transform: zoom > 1 ? `scale(${zoom})` : undefined,
                        transformOrigin: zoom > 1 ? origin : undefined,
                      }}
                      draggable={false}
                    />
                    {/* Same top-down gradient the learner sees, using the dark journal surface */}
                    <div
                      className="absolute inset-x-0 top-0 h-36 pointer-events-none"
                      style={{ background: 'linear-gradient(to bottom, transparent, var(--th-journal))' }}
                    />
                    {fp && (
                      <div
                        className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
                        style={{ left: `${fp.x}%`, top: `${fp.y}%`, transform: 'translate(-50%,-50%)', background: '#F59E0B' }}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 max-w-md">
                    <span className="text-[10px] text-stone-400 shrink-0">Zoom:</span>
                    <input
                      type="range" min={1} max={3} step={0.05} value={zoom}
                      onChange={(e) => updateField('coverPhotoZoom', parseFloat(e.target.value))}
                      className="flex-1 h-1 accent-amber-500"
                    />
                    <span className="text-[10px] text-stone-500 w-9 text-right">{zoom.toFixed(2)}×</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-[10px] text-stone-400">
                      {fp ? `Focal point: ${fp.x}%, ${fp.y}%` : 'No focal point — defaults to centre'}
                    </p>
                    {(fp || zoom !== 1) && (
                      <button
                        type="button"
                        onClick={() => {
                          updateField('coverPhotoFocalPoint', undefined);
                          updateField('coverPhotoZoom', 1);
                        }}
                        className="text-[10px] text-blue-600 hover:underline"
                      >
                        Reset framing
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </label>

          <AudioUpload
            audioUrl={tour.peekAudioUrl ?? null}
            audioTitle={tour.peekAudioTitle ?? null}
            onChange={(url) => updateField('peekAudioUrl', url)}
            onTitleChange={(title) => updateField('peekAudioTitle', title)}
            uploadPath={`memorial-church/audio/tours/${tourId}/peek`}
            onUploadFile={uploadPhoto}
            autoplayDisabled={tour.peekAudioAutoplayDisabled}
            onAutoplayDisabledChange={(v) => updateField('peekAudioAutoplayDisabled', v)}
          />

          {/* Tour-level map pin */}
          <div>
            <span className="text-xs text-stone-600">Tour pin on map (the single marker learners tap to start this tour)</span>
            <div className="mt-1 rounded border border-stone-300 overflow-hidden" style={{ height: 180 }}>
              {MAPS_API_KEY ? (
                <APIProvider apiKey={MAPS_API_KEY}>
                  <StopMapPicker
                    location={tour.location ?? null}
                    onLocationChange={(loc) => updateField('location', loc)}
                  />
                </APIProvider>
              ) : (
                <div className="h-full flex items-center justify-center bg-stone-100 text-xs text-stone-400">
                  Maps API key not configured
                </div>
              )}
            </div>
            {tour.location && (
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] text-stone-500 font-mono">
                  {tour.location.lat.toFixed(6)}, {tour.location.lng.toFixed(6)}
                </span>
                <button
                  onClick={() => updateField('location', null)}
                  className="text-[10px] text-red-600 hover:underline"
                >
                  Remove pin
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Context Journal — per-tour settings (timeline domain + default map view) */}
        <section className="mb-8 p-4 rounded border border-stone-300 bg-white space-y-3">
          <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">Context Journal</h2>
          <ContextJournalConfig tourId={tour.id} />
        </section>

        {/* Background photo */}
        <section className="mb-8 p-4 rounded border border-stone-300 bg-white space-y-3">
          <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">Background Photo</h2>
          <p className="text-[10px] text-stone-400">Shown behind all screens throughout the tour. Stops can override this with their own photo.</p>
          <div className="flex gap-2 items-center">
            <input
              value={tour.backgroundPhotoUrl || ''}
              onChange={(e) => updateField('backgroundPhotoUrl', e.target.value || null)}
              className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
              placeholder="Upload or paste a URL..."
            />
            <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300">
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadPhoto(file, `memorial-church/photos/tours/${tourId}/tour_bg_${file.name}`);
                  updateField('backgroundPhotoUrl', url);
                }}
              />
            </label>
            {tour.backgroundPhotoUrl && (
              <button onClick={() => updateField('backgroundPhotoUrl', null)} className="text-xs text-red-600 hover:underline">Remove</button>
            )}
          </div>
          {tour.backgroundPhotoUrl && (
            <div className="w-full rounded overflow-hidden border border-stone-200 bg-stone-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tour.backgroundPhotoUrl}
                alt="background"
                className="w-full h-auto max-h-72 object-contain"
                style={{ filter: `contrast(${tour.backgroundPhotoContrast ?? 100}%)` }}
              />
            </div>
          )}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs text-stone-600">Contrast</label>
              <span className="text-xs text-stone-400">{tour.backgroundPhotoContrast ?? 100}%</span>
            </div>
            <input
              type="range" min={50} max={200} step={5}
              value={tour.backgroundPhotoContrast ?? 100}
              onChange={(e) => updateField('backgroundPhotoContrast', Number(e.target.value))}
              className="w-full accent-stone-600"
            />
          </div>
        </section>

        {/* Opening Frame — Context-Prototype only (replaces the Essential Question) */}
        {mode === 'context' && (
          <OpeningFrameEditor
            frame={tour.openingFrame ?? blankOpeningFrame()}
            tourId={tourId}
            onChange={(frame) => updateField('openingFrame', frame)}
            onUploadPhoto={uploadPhoto}
          />
        )}

        {/* Essential question — hidden in Context-Prototype mode */}
        <section className="mb-8 p-4 rounded border border-stone-300 bg-white space-y-4" hidden={mode === 'context'}>
          <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">Essential Question</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tour.essentialQuestion !== null && tour.essentialQuestion !== undefined}
              onChange={(e) => {
                if (e.target.checked) {
                  updateField('essentialQuestion', {
                    question: 'What is this place for?',
                    scenePhotoUrl: null,
                    sceneDescription: '',
                    sceneAudioUrl: null,
                    sceneAudioTitle: null,
                    openingFraming: 'Before we begin, take a moment. Based on what you see and what you already know — what would you say?',
                    closingFraming: 'You answered this question before the tour began. Now that we have explored this place, how would you respond?',
                    theoryPrompt: 'What might your theory be?',
                    theoryPlaceholder: 'Based on what you\'re thinking now...',
                    reasoningPrompt: 'What makes you think that?',
                    reasoningPlaceholder: 'What are you drawing on — something you see, something you know, a hunch?',
                    additionalQuestion: null,
                    closingAudioUrl: null,
                    closingAudioTitle: null,
                    finalReflectionPrompt: 'Your interpretation now...',
                    finalReflectionPlaceholder: 'What is your interpretation now? Has anything changed? Or has it stayed mostly the same?',
                    finalReasoningPrompt: 'What did you discuss or see to reach this interpretation?',
                    finalReasoningPlaceholder: 'What observations, conversations, or revelations shaped your thinking?',
                  });
                } else {
                  updateField('essentialQuestion', null);
                }
              }}
              className="rounded"
            />
            <span className="text-xs text-stone-600">Include an essential question for this tour</span>
          </label>
          {tour.essentialQuestion && (
            <div className="space-y-3">
              <div className="block">
                <RichTextarea
                  label="Question background (optional — shown on its own snap-scroll section above the question)"
                  value={tour.essentialQuestion.questionBackground || ''}
                  onChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, questionBackground: v })}
                  rows={3}
                  placeholder="Contextualising text the explorer reads before they see the question. Leave empty to skip and show the question alone."
                />
              </div>
              <AudioUpload
                audioUrl={tour.essentialQuestion.questionBackgroundAudioUrl ?? null}
                audioTitle={tour.essentialQuestion.questionBackgroundAudioTitle ?? null}
                onChange={(url) => updateField('essentialQuestion', { ...tour.essentialQuestion!, questionBackgroundAudioUrl: url })}
                onTitleChange={(title) => updateField('essentialQuestion', { ...tour.essentialQuestion!, questionBackgroundAudioTitle: title })}
                uploadPath={`memorial-church/audio/tours/${tourId}/eq_question_background`}
                onUploadFile={uploadPhoto}
                autoplayDisabled={tour.essentialQuestion.questionBackgroundAudioAutoplayDisabled}
                onAutoplayDisabledChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, questionBackgroundAudioAutoplayDisabled: v })}
              />
              <PhotoListEditor
                photos={tour.essentialQuestion.questionBackgroundPhotos || []}
                onChange={(photos) => updateField('essentialQuestion', { ...tour.essentialQuestion!, questionBackgroundPhotos: photos })}
                uploadPath={`memorial-church/photos/tours/${tourId}/eq_question_background`}
                onUploadPhoto={uploadPhoto}
              />
              <label className="flex items-center gap-2 text-xs text-stone-700">
                <input
                  type="checkbox"
                  checked={!!tour.essentialQuestion.questionBackgroundAsInstructions}
                  onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, questionBackgroundAsInstructions: e.target.checked })}
                  className="rounded"
                />
                <span>Show this as <em>Instructions</em> (italic title, no LEARN label)</span>
              </label>
              <div className="block">
                <RichTextarea
                  label="The question"
                  value={tour.essentialQuestion.question}
                  onChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, question: v })}
                  rows={2}
                />
              </div>

              <p className="text-xs text-stone-700 font-semibold mt-2">Scene-setting screen</p>
              <label className="block">
                <span className="text-xs text-stone-500">Scene photo (where to find the starting point)</span>
                <div className="flex gap-2 mt-1">
                  <input
                    value={tour.essentialQuestion.scenePhotoUrl || ''}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, scenePhotoUrl: e.target.value || null })}
                    className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
                    placeholder="Upload or paste URL..."
                  />
                  <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300">
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const url = await uploadPhoto(file, `memorial-church/photos/tours/${tourId}/eq_scene_${file.name}`);
                        updateField('essentialQuestion', { ...tour.essentialQuestion!, scenePhotoUrl: url });
                      }}
                    />
                  </label>
                </div>
              </label>
              <div className="block">
                <RichTextarea
                  label="Scene description (directions to find it)"
                  value={tour.essentialQuestion.sceneDescription || ''}
                  onChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, sceneDescription: v })}
                  rows={2}
                  placeholder="Find the stone plaque on the north wall..."
                />
              </div>
              <AudioUpload
                audioUrl={tour.essentialQuestion.sceneAudioUrl ?? null}
                audioTitle={tour.essentialQuestion.sceneAudioTitle ?? null}
                onChange={(url) => updateField('essentialQuestion', { ...tour.essentialQuestion!, sceneAudioUrl: url })}
                onTitleChange={(title) => updateField('essentialQuestion', { ...tour.essentialQuestion!, sceneAudioTitle: title })}
                uploadPath={`memorial-church/audio/tours/${tourId}/eq_scene`}
                onUploadFile={uploadPhoto}
                autoplayDisabled={tour.essentialQuestion.sceneAudioAutoplayDisabled}
                onAutoplayDisabledChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, sceneAudioAutoplayDisabled: v })}
              />

              <div className="block">
                <RichTextarea
                  label="Opening framing (toggle text on scene screen)"
                  value={tour.essentialQuestion.openingFraming}
                  onChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, openingFraming: v })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-stone-500">Theory prompt</span>
                  <input
                    value={tour.essentialQuestion.theoryPrompt}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, theoryPrompt: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">Theory placeholder</span>
                  <input
                    value={tour.essentialQuestion.theoryPlaceholder}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, theoryPlaceholder: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">Reasoning prompt</span>
                  <input
                    value={tour.essentialQuestion.reasoningPrompt}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, reasoningPrompt: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">Reasoning placeholder</span>
                  <input
                    value={tour.essentialQuestion.reasoningPlaceholder}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, reasoningPlaceholder: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
              </div>
              {/* Additional question */}
              <div className="border-t border-stone-200 pt-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!tour.essentialQuestion.additionalQuestion}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { question: '', questionType: 'discuss' } });
                      } else {
                        updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: null });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-xs text-stone-600">Add a follow-up question (shown after written prompts, before first stop)</span>
                </label>
                {tour.essentialQuestion.additionalQuestion && (
                  <div className="space-y-2 pl-2 border-l-2 border-stone-200">
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={tour.essentialQuestion.additionalQuestion.questionType === 'discuss'} onChange={() => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionType: 'discuss' } })} />
                        <span className="text-xs text-stone-600">Discussion Question</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="radio" checked={tour.essentialQuestion.additionalQuestion.questionType === 'opinion'} onChange={() => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionType: 'opinion' } })} />
                        <span className="text-xs text-stone-600">Discuss Opinion</span>
                      </label>
                    </div>
                    <RichTextarea
                      label="Question background (optional)"
                      value={tour.essentialQuestion.additionalQuestion.questionBackground || ''}
                      onChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionBackground: v } })}
                      rows={3}
                      placeholder="Contextualising text shown above the question. Leave empty to show only the question."
                    />
                    <AudioUpload
                      audioUrl={tour.essentialQuestion.additionalQuestion.questionBackgroundAudioUrl ?? null}
                      audioTitle={tour.essentialQuestion.additionalQuestion.questionBackgroundAudioTitle ?? null}
                      onChange={(url) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionBackgroundAudioUrl: url } })}
                      onTitleChange={(title) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionBackgroundAudioTitle: title } })}
                      uploadPath={`memorial-church/audio/tours/${tourId}/eq_additional_question_background`}
                      onUploadFile={uploadPhoto}
                      autoplayDisabled={tour.essentialQuestion.additionalQuestion.questionBackgroundAudioAutoplayDisabled}
                      onAutoplayDisabledChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionBackgroundAudioAutoplayDisabled: v } })}
                    />
                    <PhotoListEditor
                      photos={tour.essentialQuestion.additionalQuestion.questionBackgroundPhotos || []}
                      onChange={(photos) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionBackgroundPhotos: photos } })}
                      uploadPath={`memorial-church/photos/tours/${tourId}/eq_additional_question_background`}
                      onUploadPhoto={uploadPhoto}
                    />
                    <label className="flex items-center gap-2 text-xs text-stone-700">
                      <input
                        type="checkbox"
                        checked={!!tour.essentialQuestion.additionalQuestion.questionBackgroundAsInstructions}
                        onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, questionBackgroundAsInstructions: e.target.checked } })}
                        className="rounded"
                      />
                      <span>Show this as <em>Instructions</em> (italic title, no LEARN label)</span>
                    </label>
                    <RichTextarea
                      label="The question"
                      value={tour.essentialQuestion.additionalQuestion.question}
                      onChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, question: v } })}
                      rows={2}
                      placeholder="The follow-up question..."
                    />
                    {tour.essentialQuestion.additionalQuestion.questionType === 'opinion' && (
                      <div className="space-y-1 p-2 rounded border border-stone-200 bg-stone-50">
                        <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
                          Opinion spectrum (shown as a dial in group tours)
                        </p>
                        <input
                          type="text"
                          value={tour.essentialQuestion.additionalQuestion.opinionSpectrumLeft || ''}
                          onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, opinionSpectrumLeft: e.target.value } })}
                          placeholder="Left side of the spectrum"
                          className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                        />
                        <input
                          type="text"
                          value={tour.essentialQuestion.additionalQuestion.opinionSpectrumRight || ''}
                          onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalQuestion: { ...tour.essentialQuestion!.additionalQuestion!, opinionSpectrumRight: e.target.value } })}
                          placeholder="Right side of the spectrum"
                          className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="block">
                <RichTextarea
                  label="Closing framing (after tour ends)"
                  value={tour.essentialQuestion.closingFraming}
                  onChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, closingFraming: v })}
                  rows={2}
                />
              </div>
              <AudioUpload
                audioUrl={tour.essentialQuestion.closingAudioUrl ?? null}
                audioTitle={tour.essentialQuestion.closingAudioTitle ?? null}
                onChange={(url) => updateField('essentialQuestion', { ...tour.essentialQuestion!, closingAudioUrl: url })}
                onTitleChange={(title) => updateField('essentialQuestion', { ...tour.essentialQuestion!, closingAudioTitle: title })}
                uploadPath={`memorial-church/audio/tours/${tourId}/eq_closing`}
                onUploadFile={uploadPhoto}
                autoplayDisabled={tour.essentialQuestion.closingAudioAutoplayDisabled}
                onAutoplayDisabledChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, closingAudioAutoplayDisabled: v })}
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-stone-500">Final reflection prompt</span>
                  <input
                    value={tour.essentialQuestion.finalReflectionPrompt}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalReflectionPrompt: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">Final reflection placeholder</span>
                  <input
                    value={tour.essentialQuestion.finalReflectionPlaceholder}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalReflectionPlaceholder: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">Final reasoning prompt</span>
                  <input
                    value={tour.essentialQuestion.finalReasoningPrompt}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalReasoningPrompt: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-stone-500">Final reasoning placeholder</span>
                  <input
                    value={tour.essentialQuestion.finalReasoningPlaceholder}
                    onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalReasoningPlaceholder: e.target.value })}
                    className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                  />
                </label>
              </div>

              {/* Additional closing discussion questions — array. Lives
                  after the final reflection / reasoning prompts so the
                  closing block reads top-to-bottom in the order the
                  explorer encounters it. */}
              <div className="border-t border-stone-200 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs text-stone-700 font-medium">Additional closing discussion questions</span>
                    <p className="text-[10px] text-stone-400 mt-0.5">Listed under the main closing question on the explorer&apos;s closing screen; each gets its own response textbox.</p>
                  </div>
                  <button
                    onClick={() => {
                      const list = tour.essentialQuestion!.additionalClosingQuestions || [];
                      updateField('essentialQuestion', {
                        ...tour.essentialQuestion!,
                        additionalClosingQuestions: [...list, { question: '', questionType: 'discuss' as const }],
                      });
                    }}
                    className="text-xs text-stone-700 hover:underline"
                  >+ Add</button>
                </div>
                {(tour.essentialQuestion.additionalClosingQuestions || []).length === 0 ? (
                  <p className="text-[10px] text-stone-400 italic">None. Add one to ask another discussion question on the closing screen.</p>
                ) : (
                  <ul className="space-y-3">
                    {(tour.essentialQuestion.additionalClosingQuestions || []).map((item, i) => (
                      <li key={i} className="border border-stone-300 rounded bg-stone-50 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-stone-600">Closing question {i + 1}</span>
                          <button
                            onClick={() => {
                              const next = (tour.essentialQuestion!.additionalClosingQuestions || []).filter((_, j) => j !== i);
                              updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                            }}
                            className="text-xs text-red-600 hover:underline"
                          >&times; Remove</button>
                        </div>
                        <div className="flex gap-3">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              checked={(item.questionType || 'discuss') === 'discuss'}
                              onChange={() => {
                                const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                                next[i] = { ...next[i], questionType: 'discuss' };
                                updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                              }}
                            />
                            <span className="text-xs text-stone-600">Discussion Question</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              checked={item.questionType === 'opinion'}
                              onChange={() => {
                                const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                                next[i] = { ...next[i], questionType: 'opinion' };
                                updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                              }}
                            />
                            <span className="text-xs text-stone-600">Discuss Opinion</span>
                          </label>
                        </div>
                        <RichTextarea
                          label="Question background (optional)"
                          value={item.questionBackground || ''}
                          onChange={(v) => {
                            const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                            next[i] = { ...next[i], questionBackground: v };
                            updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                          }}
                          rows={3}
                          placeholder="Contextualising text shown above the question."
                        />
                        <AudioUpload
                          audioUrl={item.questionBackgroundAudioUrl ?? null}
                          audioTitle={item.questionBackgroundAudioTitle ?? null}
                          onChange={(url) => {
                            const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                            next[i] = { ...next[i], questionBackgroundAudioUrl: url };
                            updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                          }}
                          onTitleChange={(title) => {
                            const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                            next[i] = { ...next[i], questionBackgroundAudioTitle: title };
                            updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                          }}
                          uploadPath={`memorial-church/audio/tours/${tourId}/eq_closing_additional_${i}_background`}
                          onUploadFile={uploadPhoto}
                          autoplayDisabled={item.questionBackgroundAudioAutoplayDisabled}
                          onAutoplayDisabledChange={(v) => {
                            const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                            next[i] = { ...next[i], questionBackgroundAudioAutoplayDisabled: v };
                            updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                          }}
                        />
                        <PhotoListEditor
                          photos={item.questionBackgroundPhotos || []}
                          onChange={(photos) => {
                            const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                            next[i] = { ...next[i], questionBackgroundPhotos: photos };
                            updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                          }}
                          uploadPath={`memorial-church/photos/tours/${tourId}/eq_closing_additional_${i}_background`}
                          onUploadPhoto={uploadPhoto}
                        />
                        <label className="flex items-center gap-2 text-xs text-stone-700">
                          <input
                            type="checkbox"
                            checked={!!item.questionBackgroundAsInstructions}
                            onChange={(e) => {
                              const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                              next[i] = { ...next[i], questionBackgroundAsInstructions: e.target.checked };
                              updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                            }}
                            className="rounded"
                          />
                          <span>Show this as <em>Instructions</em> (italic title, no LEARN label)</span>
                        </label>
                        <RichTextarea
                          label="The question"
                          value={item.question}
                          onChange={(v) => {
                            const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                            next[i] = { ...next[i], question: v };
                            updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                          }}
                          rows={2}
                          placeholder="A question to discuss now that the tour is wrapping up..."
                        />
                        {item.questionType === 'opinion' && (
                          <div className="space-y-1 p-2 rounded border border-stone-200 bg-stone-50">
                            <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
                              Opinion spectrum (shown as a dial in group tours)
                            </p>
                            <input
                              type="text"
                              value={item.opinionSpectrumLeft || ''}
                              onChange={(e) => {
                                const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                                next[i] = { ...next[i], opinionSpectrumLeft: e.target.value };
                                updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                              }}
                              placeholder="Left side of the spectrum"
                              className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                            />
                            <input
                              type="text"
                              value={item.opinionSpectrumRight || ''}
                              onChange={(e) => {
                                const next = [...(tour.essentialQuestion!.additionalClosingQuestions || [])];
                                next[i] = { ...next[i], opinionSpectrumRight: e.target.value };
                                updateField('essentialQuestion', { ...tour.essentialQuestion!, additionalClosingQuestions: next });
                              }}
                              placeholder="Right side of the spectrum"
                              className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                            />
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Final-reflect sliders & chip sets — the eq_final_reflect
                  screen that runs after the closing card. Defaults shown
                  in placeholder; an empty string keeps the default. */}
              <div className="border-t border-stone-200 pt-3 space-y-3">
                <div>
                  <span className="text-xs text-stone-700 font-medium">Final reflection — slider &amp; chip options</span>
                  <p className="text-[10px] text-stone-400 mt-0.5">Customise the cognitive / perceptual sliders and the two follow-up chip sets. Leave any field blank to keep the default shown as placeholder text.</p>
                </div>

                <fieldset className="border border-stone-200 rounded p-3 space-y-2">
                  <legend className="text-[11px] text-stone-600 font-semibold px-1">Cognitive slider</legend>
                  <label className="block">
                    <span className="text-[10px] text-stone-500">Prompt</span>
                    <input
                      value={tour.essentialQuestion.finalCognitivePrompt ?? ''}
                      placeholder="How much did this tour change your answer to the original question?"
                      onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalCognitivePrompt: e.target.value })}
                      className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10px] text-stone-500">Left label</span>
                      <input
                        value={tour.essentialQuestion.finalCognitiveLeftLabel ?? ''}
                        placeholder="Confirmed what we thought"
                        onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalCognitiveLeftLabel: e.target.value })}
                        className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-stone-500">Right label</span>
                      <input
                        value={tour.essentialQuestion.finalCognitiveRightLabel ?? ''}
                        placeholder="Shifted our thinking"
                        onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalCognitiveRightLabel: e.target.value })}
                        className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </label>
                  </div>
                </fieldset>

                <fieldset className="border border-stone-200 rounded p-3 space-y-2">
                  <legend className="text-[11px] text-stone-600 font-semibold px-1">Perceptual slider</legend>
                  <label className="block">
                    <span className="text-[10px] text-stone-500">Prompt</span>
                    <input
                      value={tour.essentialQuestion.finalPerceptualPrompt ?? ''}
                      placeholder="How much did this change how you see this place?"
                      onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalPerceptualPrompt: e.target.value })}
                      className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10px] text-stone-500">Left label</span>
                      <input
                        value={tour.essentialQuestion.finalPerceptualLeftLabel ?? ''}
                        placeholder="Same as before"
                        onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalPerceptualLeftLabel: e.target.value })}
                        className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-stone-500">Right label</span>
                      <input
                        value={tour.essentialQuestion.finalPerceptualRightLabel ?? ''}
                        placeholder="I see it completely differently now"
                        onChange={(e) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalPerceptualRightLabel: e.target.value })}
                        className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                      />
                    </label>
                  </div>
                </fieldset>

                <ChipOptionsEditor
                  label="What changed (multi-select chips)"
                  prompt={tour.essentialQuestion.finalWhatShiftedPrompt ?? ''}
                  promptPlaceholder="What changed?"
                  options={tour.essentialQuestion.finalWhatShiftedOptions ?? null}
                  defaultOptions={['We learned something new', 'We changed our mind', 'We had part of it', 'We were surprised']}
                  onPromptChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalWhatShiftedPrompt: v })}
                  onOptionsChange={(opts) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalWhatShiftedOptions: opts })}
                />

                <ChipOptionsEditor
                  label="Why it changed or not (multi-select chips)"
                  prompt={tour.essentialQuestion.finalReasoningSourcePrompt ?? ''}
                  promptPlaceholder="Why did it change or not?"
                  options={tour.essentialQuestion.finalReasoningSourceOptions ?? null}
                  defaultOptions={['What we could see here', 'Something we discussed', 'Something we already knew', 'A guess']}
                  onPromptChange={(v) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalReasoningSourcePrompt: v })}
                  onOptionsChange={(opts) => updateField('essentialQuestion', { ...tour.essentialQuestion!, finalReasoningSourceOptions: opts })}
                />
              </div>
            </div>
          )}
        </section>

        {/* Unstructured exploration settings — only relevant in Unstructured mode */}
        <section className="mb-8 p-4 rounded border border-stone-300 bg-white space-y-4" hidden={mode !== 'unstructured'}>
          <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">Unstructured Exploration</h2>
          <p className="text-[10px] text-stone-400">Explorers choose which stops to visit in any order. The Essential Question and Closing Framing remain as fixed bookends. (Switch modes from the Tour mode selector at the top.)</p>

          {/* Default map zoom */}
          <div className="border-t border-stone-200 pt-3">
            <label className="block">
              <span className="text-xs text-stone-700 font-medium">Default map zoom</span>
              <p className="text-[10px] text-stone-400 mt-0.5 mb-1.5">Starting zoom when the map opens. Higher = closer. 17 is a good default for a building; 15 shows a wider area.</p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={13}
                  max={20}
                  step={1}
                  value={tour.defaultZoom ?? 17}
                  onChange={(e) => updateField('defaultZoom', Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-xs text-stone-600 font-mono w-6 text-center">{tour.defaultZoom ?? 17}</span>
              </div>
            </label>
          </div>

          {/* Categories */}
          <div className="border-t border-stone-200 pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-600 font-medium">Categories</span>
              <button
                onClick={() => {
                  const cats = [...(tour.categories || []), 'New Category'];
                  updateField('categories', cats);
                }}
                className="text-[10px] text-blue-700 hover:underline"
              >
                + Add category
              </button>
            </div>
            <p className="text-[10px] text-stone-400">Create categories to organise stops in the gallery view (e.g. &ldquo;Architecture&rdquo;, &ldquo;People&rdquo;, &ldquo;Symbolism&rdquo;).</p>
            {(tour.categories || []).length === 0 ? (
              <p className="text-[10px] text-stone-400 italic">No categories yet.</p>
            ) : (
              <ul className="space-y-1">
                {(tour.categories || []).map((cat, i) => (
                  <li key={i} className="flex gap-2 items-center">
                    <button
                      onClick={() => {
                        const next = [...(tour.categories || [])];
                        if (i > 0) { [next[i - 1], next[i]] = [next[i], next[i - 1]]; updateField('categories', next); }
                      }}
                      disabled={i === 0}
                      className="text-[10px] text-stone-400 hover:text-stone-600 disabled:opacity-30"
                    >&#8593;</button>
                    <button
                      onClick={() => {
                        const next = [...(tour.categories || [])];
                        if (i < next.length - 1) { [next[i], next[i + 1]] = [next[i + 1], next[i]]; updateField('categories', next); }
                      }}
                      disabled={i === (tour.categories || []).length - 1}
                      className="text-[10px] text-stone-400 hover:text-stone-600 disabled:opacity-30"
                    >&#8595;</button>
                    <input
                      value={cat}
                      onChange={(e) => {
                        const next = [...(tour.categories || [])];
                        next[i] = e.target.value;
                        updateField('categories', next);
                      }}
                      className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
                    />
                    <button
                      onClick={() => {
                        const next = (tour.categories || []).filter((_, j) => j !== i);
                        updateField('categories', next);
                      }}
                      className="text-[10px] text-red-600 hover:underline"
                    >Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Midway check-in */}
          <div className="border-t border-stone-200 pt-3 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={tour.midwayEnabled ?? false}
                onChange={(e) => updateField('midwayEnabled', e.target.checked)}
                className="rounded mt-0.5"
              />
              <div>
                <span className="text-xs text-stone-700 font-medium">Include midway check-in</span>
                <p className="text-[10px] text-stone-400 mt-0.5">If enabled, this question is shown to explorers once they&apos;ve completed half the stops. Use it to prompt reflection on what they&apos;ve seen so far.</p>
              </div>
            </label>
            {tour.midwayEnabled && (
              <div className="block pl-5 space-y-3">
                <RichTextarea
                  label="Question background (optional)"
                  value={tour.midwayQuestionBackground || ''}
                  onChange={(v) => updateField('midwayQuestionBackground', v)}
                  rows={3}
                  placeholder="Contextualising text shown on its own section above the midway question."
                />
                <AudioUpload
                  audioUrl={tour.midwayQuestionBackgroundAudioUrl ?? null}
                  audioTitle={tour.midwayQuestionBackgroundAudioTitle ?? null}
                  onChange={(url) => updateField('midwayQuestionBackgroundAudioUrl', url)}
                  onTitleChange={(title) => updateField('midwayQuestionBackgroundAudioTitle', title)}
                  uploadPath={`memorial-church/audio/tours/${tourId}/midway_question_background`}
                  onUploadFile={uploadPhoto}
                  autoplayDisabled={tour.midwayQuestionBackgroundAudioAutoplayDisabled}
                  onAutoplayDisabledChange={(v) => updateField('midwayQuestionBackgroundAudioAutoplayDisabled', v)}
                />
                <PhotoListEditor
                  photos={tour.midwayQuestionBackgroundPhotos || []}
                  onChange={(photos) => updateField('midwayQuestionBackgroundPhotos', photos)}
                  uploadPath={`memorial-church/photos/tours/${tourId}/midway_question_background`}
                  onUploadPhoto={uploadPhoto}
                />
                <label className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={!!tour.midwayQuestionBackgroundAsInstructions}
                    onChange={(e) => updateField('midwayQuestionBackgroundAsInstructions', e.target.checked)}
                    className="rounded"
                  />
                  <span>Show this as <em>Instructions</em> (italic title, no LEARN label)</span>
                </label>
                <RichTextarea
                  label="Midway check-in question"
                  value={tour.midwayQuestion || ''}
                  onChange={(v) => updateField('midwayQuestion', v || null)}
                  rows={2}
                  placeholder="e.g. What themes are you noticing across these stops?"
                />
              </div>
            )}
          </div>
        </section>

        {/* Stops list */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">
              Stops ({activeStops.length})
              {mode === 'unstructured' ? ' — Unstructured set' : mode === 'context' ? ' — grouped into Acts' : ''}
            </h2>
            <div className="flex gap-2">
              {mode === 'context' && (
                <button
                  onClick={addAct}
                  className="px-3 py-1.5 rounded bg-amber-600 text-white text-sm hover:bg-amber-700"
                >
                  + Add act
                </button>
              )}
              <button
                onClick={addStop}
                className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm hover:bg-blue-800"
              >
                + Add stop
              </button>
            </div>
          </div>

          {mode === 'context' ? (
            /* ── Acts organizer — drag stops between acts ── */
            <div className="space-y-4">
              {activeStops.length === 0 ? (
                <p className="text-stone-500 text-sm italic">No stops yet. Add one to start building the tour.</p>
              ) : acts.map((act, ai) => {
                const startNum = acts.slice(0, ai).reduce((n, a) => n + a.stopIds.length, 0);
                return (
                  <div
                    key={act.id}
                    className="border-2 border-amber-300 rounded bg-amber-50/30 p-3 space-y-3"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragStopId) assignStopToAct(dragStopId, act.id); }}
                  >
                    {/* Act header */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-amber-700 uppercase tracking-wide">Act {ai + 1}</span>
                      <input
                        value={act.title}
                        onChange={(e) => updateAct(act.id, { title: e.target.value })}
                        placeholder="Act title"
                        className="flex-1 px-2 py-1 border border-amber-300 rounded text-sm font-semibold bg-white"
                      />
                      <button onClick={() => moveAct(act.id, -1)} disabled={ai === 0} className="px-1.5 py-0.5 text-xs rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-30" title="Move act up">&uarr;</button>
                      <button onClick={() => moveAct(act.id, 1)} disabled={ai === acts.length - 1} className="px-1.5 py-0.5 text-xs rounded bg-stone-100 hover:bg-stone-200 disabled:opacity-30" title="Move act down">&darr;</button>
                      <button onClick={() => removeAct(act.id)} className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200" title="Remove act">&times;</button>
                    </div>

                    {/* Stops in this act */}
                    {act.stopIds.length === 0 ? (
                      <p className="text-[11px] text-stone-400 italic border border-dashed border-stone-300 rounded p-3 text-center">
                        Drag a stop here, or use the act dropdown on a stop to move it in.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {act.stopIds.map((sid, si) => {
                          const stop = activeStops.find((s) => s.id === sid);
                          if (!stop) return null;
                          return renderStopRow(stop, startNum + si + 1, {
                            onUp: () => moveStopInAct(act.id, sid, -1),
                            onDown: () => moveStopInAct(act.id, sid, 1),
                            upDisabled: si === 0,
                            downDisabled: si === act.stopIds.length - 1,
                            draggable: true,
                            onDropBefore: () => { if (dragStopId && dragStopId !== sid) assignStopToAct(dragStopId, act.id, si); },
                            actControl: (
                              <select
                                value={act.id}
                                onChange={(e) => assignStopToAct(sid, e.target.value)}
                                className="text-[10px] border border-stone-300 rounded px-1 py-0.5 bg-white max-w-[90px]"
                                title="Move to act"
                              >
                                {acts.map((a, i) => (
                                  <option key={a.id} value={a.id}>{a.title || `Act ${i + 1}`}</option>
                                ))}
                              </select>
                            ),
                          });
                        })}
                      </ul>
                    )}

                    {/* Add Context — rich items (lens, question, media, map) positioned after stops */}
                    <div className="rounded border border-stone-300 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">Add Context</p>
                        <button onClick={() => setCtxEditor({ actId: act.id, itemId: null })} className="px-2.5 py-1 rounded bg-blue-700 text-white text-xs hover:bg-blue-800">+ Add context</button>
                      </div>
                      <p className="text-[10px] text-stone-400">Rich contexts shown to the learner after a stop (question posed → title + explanation read aloud → &ldquo;Add to Context Journal&rdquo;). Set which stop each plays after.</p>
                      {(act.contexts ?? []).length === 0 ? (
                        <p className="text-xs text-stone-400 italic">No contexts yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(act.contexts ?? []).map((item) => (
                            <li key={item.id} className="rounded border border-stone-200 p-2 flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-stone-800 truncate">{item.title || <span className="text-stone-400 italic">Untitled</span>}</div>
                                {item.question && <div className="text-xs italic text-stone-500 truncate">{item.question}</div>}
                                <label className="mt-1 flex items-center gap-1 text-[11px] text-stone-500">
                                  Plays after:
                                  <select value={item.afterStopId} onChange={(e) => setActContextItemAfter(act.id, item.id, e.target.value)} className="border border-stone-300 rounded px-1 py-0.5 text-[11px]">
                                    {act.stopIds.map((sid, i) => {
                                      const s = activeStops.find((x) => x.id === sid);
                                      return <option key={sid} value={sid}>{i + 1}. {s?.title || sid}</option>;
                                    })}
                                  </select>
                                </label>
                              </div>
                              <button onClick={() => setCtxEditor({ actId: act.id, itemId: item.id })} className="text-xs text-blue-700 hover:underline shrink-0">Edit</button>
                              <button onClick={() => removeActContextItem(act.id, item.id)} className="text-xs text-red-600 hover:underline shrink-0">Remove</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* End-of-act: Reflection question ("Share What You Think") */}
                    <RichTextarea
                      label={'Reflection question — "Share What You Think" (optional)'}
                      value={act.reflectionQuestion?.prompt ?? act.closingQuestion?.prompt ?? ''}
                      onChange={(v) => setActReflection(act.id, v)}
                      rows={2}
                      placeholder="Asked after the Context step. The explorer responds (with photos + a map pin) and can share to the community. Leave blank to skip."
                    />
                  </div>
                );
              })}
            </div>
          ) : activeStops.length === 0 ? (
            <p className="text-stone-500 text-sm italic">No stops yet. Add one to start building the tour.</p>
          ) : (
            <ul className="space-y-2">
              {activeStops.map((stop, idx) => renderStopRow(stop, idx + 1, {
                onUp: () => moveStop(stop.id, -1),
                onDown: () => moveStop(stop.id, 1),
                upDisabled: idx === 0,
                downDisabled: idx === activeStops.length - 1,
              }))}
            </ul>
          )}
        </section>

        {/* Preview modal */}
        {previewStop && (
          <StopPreview
            stop={previewStop}
            phase={previewPhase}
            onNext={() => setPreviewPhase((p) => Math.min(p + 1, 4))}
            onPrev={() => setPreviewPhase((p) => Math.max(p - 1, 0))}
            onClose={() => { setPreviewStopId(null); setPreviewPhase(0); }}
          />
        )}

        {/* Add Context authoring modal (shared learner-style flow) */}
        {ctxEditor && (() => {
          const a = (tour?.acts || []).find((x) => x.id === ctxEditor.actId);
          const editing = ctxEditor.itemId ? (a?.contexts?.find((c) => c.id === ctxEditor.itemId) ?? null) : null;
          return (
            <AddContextFlow
              heading={ctxEditor.itemId ? 'Edit context' : 'Add Context'}
              initial={editing ?? undefined}
              onClose={() => setCtxEditor(null)}
              onSubmit={async (draft) => { upsertActContextItem(ctxEditor.actId, draft, ctxEditor.itemId); }}
            />
          );
        })()}
      </div>
    </div>
  );
}

// ─── Opening Frame Editor (Context-Prototype) ───────────────────────

function OpeningFrameEditor({
  frame,
  tourId,
  onChange,
  onUploadPhoto,
}: {
  frame: import('@/lib/types').OpeningFrame;
  tourId: string;
  onChange: (frame: import('@/lib/types').OpeningFrame) => void;
  onUploadPhoto: (file: File, path: string) => Promise<string>;
}) {
  return (
    <section className="mb-8 p-4 rounded border border-stone-300 bg-white space-y-4">
      <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide">Opening Frame</h2>
      <p className="text-[10px] text-stone-400">The &ldquo;Setting the Scene&rdquo; screen shown at the start of the tour (no essential question in this mode).</p>

      <label className="block">
        <span className="text-xs text-stone-500">Scene photo (where to find the starting point)</span>
        <div className="flex gap-2 mt-1">
          <input
            value={frame.scenePhotoUrl || ''}
            onChange={(e) => onChange({ ...frame, scenePhotoUrl: e.target.value || null })}
            className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
            placeholder="Upload or paste URL..."
          />
          <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300">
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await onUploadPhoto(file, `memorial-church/photos/tours/${tourId}/opening_frame_${file.name}`);
                onChange({ ...frame, scenePhotoUrl: url });
              }}
            />
          </label>
        </div>
      </label>

      <RichTextarea
        label="Scene description (directions to find it)"
        value={frame.sceneDescription || ''}
        onChange={(v) => onChange({ ...frame, sceneDescription: v })}
        rows={2}
        placeholder="Find the stone plaque on the north wall..."
      />

      <AudioUpload
        audioUrl={frame.sceneAudioUrl ?? null}
        audioTitle={frame.sceneAudioTitle ?? null}
        onChange={(url) => onChange({ ...frame, sceneAudioUrl: url })}
        onTitleChange={(title) => onChange({ ...frame, sceneAudioTitle: title })}
        uploadPath={`memorial-church/audio/tours/${tourId}/opening_frame`}
        onUploadFile={onUploadPhoto}
        autoplayDisabled={frame.sceneAudioAutoplayDisabled}
        onAutoplayDisabledChange={(v) => onChange({ ...frame, sceneAudioAutoplayDisabled: v })}
      />

      <RichTextarea
        label="Opening framing (toggle text on scene screen)"
        value={frame.openingFraming || ''}
        onChange={(v) => onChange({ ...frame, openingFraming: v })}
        rows={3}
        placeholder="Before we begin, take a moment..."
      />
    </section>
  );
}

// ─── Stop Editor ────────────────────────────────────────────────────

interface StopEditorProps {
  stop: Stop;
  tourId: string;
  tourCategories?: string[];
  onChange: (patch: Partial<Stop>) => void;
  onUploadPhoto: (file: File, path: string) => Promise<string>;
  /** Context-Prototype mode hides the discussion question, extra rounds, and
   *  bridge fieldsets — those phases are stripped from that experience. */
  hideDiscussionAndBridge?: boolean;
}

function StopEditor({ stop: rawStop, tourId, tourCategories, onChange, onUploadPhoto, hideDiscussionAndBridge = false }: StopEditorProps) {
  // Defensive defaults for older stop data that may be missing newer fields
  const stop: Stop = {
    ...rawStop,
    title: rawStop.title ?? '',
    isFinalStop: rawStop.isFinalStop ?? false,
    backgroundPhotoOverride: rawStop.backgroundPhotoOverride !== undefined
      ? rawStop.backgroundPhotoOverride
      : (rawStop as unknown as Record<string, unknown>).backgroundPhotoUrl as string | null ?? null,
    seed: rawStop.seed ?? { text: '', photoUrl: null, photoCaption: null, photos: [], ttsText: null },
    notice: rawStop.notice ?? { prompt: '', timerSeconds: 30, photoUrl: null, photoCaption: null, photos: [] },
    wonder: rawStop.wonder === undefined ? { question: '', questionType: 'discuss', photos: [], audioUrl: null, audioTitle: null } : rawStop.wonder ? { ...rawStop.wonder, questionType: rawStop.wonder.questionType || 'discuss', photos: rawStop.wonder.photos || [], audioUrl: rawStop.wonder.audioUrl ?? null, audioTitle: rawStop.wonder.audioTitle ?? null } : null,
    reveal: rawStop.reveal ?? { text: '', photoUrl: null, photoCaption: null, photos: [], bridgeText: '' },
    reflect: rawStop.reflect === undefined ? null : rawStop.reflect,
    detours: rawStop.detours ?? [],
    extraRounds: rawStop.extraRounds ?? [],
  };
  // Normalize stop data on first render — ensures all newer fields exist
  // and migrates legacy single photos into the photos array.
  useEffect(() => {
    try {
      const patch: Partial<Stop> = {};
      let changed = false;

      // Ensure title exists
      if (stop.title === undefined) { patch.title = ''; changed = true; }

      // Ensure photos arrays exist + migrate legacy photoUrl
      const seed = stop.seed || { text: '', photoUrl: null, photoCaption: null, photos: [], ttsText: null };
      const seedPhotos = seed.photos || [];
      if (seed.photoUrl && !seedPhotos.some((p) => p.url === seed.photoUrl)) {
        patch.seed = { ...seed, photos: [{ url: seed.photoUrl, caption: seed.photoCaption ?? null }, ...seedPhotos], photoUrl: null, photoCaption: null };
        changed = true;
      } else if (!seed.photos) {
        patch.seed = { ...seed, photos: [] };
        changed = true;
      }

      const notice = stop.notice || { prompt: '', timerSeconds: 30, photoUrl: null, photoCaption: null, photos: [] };
      const noticePhotos = notice.photos || [];
      if (notice.photoUrl && !noticePhotos.some((p) => p.url === notice.photoUrl)) {
        patch.notice = { ...notice, photos: [{ url: notice.photoUrl, caption: notice.photoCaption ?? null }, ...noticePhotos], photoUrl: null, photoCaption: null };
        changed = true;
      } else if (!notice.photos) {
        patch.notice = { ...notice, photos: [] };
        changed = true;
      }

      const reveal = stop.reveal || { text: '', photoUrl: null, photoCaption: null, photos: [], bridgeText: '' };
      const revealPhotos = reveal.photos || [];
      if (reveal.photoUrl && !revealPhotos.some((p) => p.url === reveal.photoUrl)) {
        patch.reveal = { ...reveal, photos: [{ url: reveal.photoUrl, caption: reveal.photoCaption ?? null }, ...revealPhotos], photoUrl: null, photoCaption: null };
        changed = true;
      } else if (!reveal.photos) {
        patch.reveal = { ...reveal, photos: [] };
        changed = true;
      }

      // Ensure arrays exist
      if (!stop.detours) { patch.detours = []; changed = true; }
      if (!stop.extraRounds) { patch.extraRounds = []; changed = true; }

      if (changed) onChange(patch);
    } catch (err) {
      console.error('[StopEditor] normalization failed:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop.id]);

  return (
    <div className="border-t border-stone-200 p-4 space-y-5">
      {/* ── Stop title + final stop ── */}
      <div className="flex gap-4 items-end">
        <label className="flex-1 block">
          <span className="text-xs text-stone-600 font-semibold">Stop title</span>
          <input
            value={stop.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="mt-1 w-full px-3 py-1.5 border border-stone-300 rounded text-sm"
            placeholder="e.g., The Facade Mosaic"
          />
        </label>
        <label className="flex items-center gap-2 cursor-pointer pb-2">
          <input
            type="checkbox"
            checked={stop.isFinalStop ?? false}
            onChange={(e) => onChange({ isFinalStop: e.target.checked })}
            className="rounded"
          />
          <span className="text-xs text-stone-600">Final stop</span>
        </label>
      </div>
      {stop.isFinalStop && (
        <p className="text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
          This stop ends the tour. After reflection, learners go to the closing guiding question and final questions — no &ldquo;What&apos;s next&rdquo; screen.
        </p>
      )}

      {/* ── Unstructured mode fields ── */}
      <div className="flex gap-4">
        {tourCategories && tourCategories.length > 0 && (
          <label className="block flex-1">
            <span className="text-xs text-stone-600">Category (unstructured mode)</span>
            <select
              value={stop.category || ''}
              onChange={(e) => onChange({ category: e.target.value || null })}
              className="mt-1 w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
            >
              <option value="">No category</option>
              {tourCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block flex-1">
          <span className="text-xs text-stone-600">Merge group (unstructured mode)</span>
          <input
            value={stop.mergeGroup || ''}
            onChange={(e) => onChange({ mergeGroup: e.target.value || null })}
            className="mt-1 w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
            placeholder="e.g. group-1 (shared string = sequence)"
          />
        </label>
      </div>

      {/* ── Background photo override ── */}
      <BgPhotoOverride stop={stop} tourId={tourId} onChange={onChange} onUploadPhoto={onUploadPhoto} />

      {/* ── Seed ── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#7A7A5E] inline-block" />
          Background (seed &mdash; context card)
        </legend>
        <RichTextarea
          label="Text (2-3 sentences of context) — use [photo:1] etc. to place photos inline"
          value={stop.seed.text}
          onChange={(text) => onChange({ seed: { ...stop.seed, text } })}
          rows={3}
          wordCount
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(stop.seed.timerSeconds ?? null) !== null}
              onChange={(e) => onChange({ seed: { ...stop.seed, timerSeconds: e.target.checked ? 15 : null } })}
              className="rounded"
            />
            <span className="text-xs text-stone-600">Reading timer</span>
          </label>
          {stop.seed.timerSeconds != null && (
            <input
              type="number"
              value={stop.seed.timerSeconds}
              onChange={(e) => onChange({ seed: { ...stop.seed, timerSeconds: parseInt(e.target.value) || 15 } })}
              className="w-14 px-2 py-0.5 border border-stone-300 rounded text-xs"
              min={5} max={120}
            />
          )}
          {stop.seed.timerSeconds != null && <span className="text-[10px] text-stone-400">seconds</span>}
        </div>
        <PhotoListEditor
          photos={stop.seed.photos || []}
          onChange={(photos) => onChange({ seed: { ...stop.seed, photos } })}
          uploadPath={`memorial-church/photos/tours/${tourId}/seed_${stop.id}`}
          onUploadPhoto={onUploadPhoto}
          showThumbnailCrop
        />
        <AudioUpload
          audioUrl={stop.seed.audioUrl ?? null}
          audioTitle={stop.seed.audioTitle ?? null}
          onChange={(audioUrl) => onChange({ seed: { ...stop.seed, audioUrl } })}
          onTitleChange={(audioTitle) => onChange({ seed: { ...stop.seed, audioTitle } })}
          uploadPath={`memorial-church/audio/tours/${tourId}/seed_${stop.id}`}
          onUploadFile={onUploadPhoto}
          autoplayDisabled={stop.seed.audioAutoplayDisabled}
          onAutoplayDisabledChange={(v) => onChange({ seed: { ...stop.seed, audioAutoplayDisabled: v } })}
        />
        {stop.seed.audioUrl && (
          <PhotoCueEditor
            cues={stop.seed.photoCues}
            photos={stop.seed.photos || []}
            onChange={(photoCues) => onChange({ seed: { ...stop.seed, photoCues } })}
            holdLast={stop.seed.photoCuesHoldLast}
            onHoldLastChange={(v) => onChange({ seed: { ...stop.seed, photoCuesHoldLast: v } })}
          />
        )}
      </fieldset>

      {/* ── Notice ── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2B4C5E] inline-block" />
          Notice (observation prompt)
        </legend>
        <RichTextarea
          label="Prompt (what to look at) — use [photo:1] etc. to place photos inline"
          value={stop.notice.prompt}
          onChange={(prompt) => onChange({ notice: { ...stop.notice, prompt } })}
          rows={2}
        />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stop.notice.timerSeconds > 0}
              onChange={(e) => onChange({ notice: { ...stop.notice, timerSeconds: e.target.checked ? 30 : 0 } })}
              className="rounded"
            />
            <span className="text-xs text-stone-600">Include timer</span>
          </label>
          {stop.notice.timerSeconds > 0 && (
            <input
              type="number"
              value={stop.notice.timerSeconds}
              onChange={(e) => onChange({ notice: { ...stop.notice, timerSeconds: parseInt(e.target.value) || 30 } })}
              className="w-16 px-2 py-1 border border-stone-300 rounded text-sm"
              min={5}
              max={120}
            />
          )}
          {stop.notice.timerSeconds > 0 && <span className="text-[10px] text-stone-400">seconds</span>}
        </div>
        <PhotoListEditor
          photos={stop.notice.photos || []}
          onChange={(photos) => onChange({ notice: { ...stop.notice, photos } })}
          uploadPath={`memorial-church/photos/tours/${tourId}/notice_${stop.id}`}
          onUploadPhoto={onUploadPhoto}
          showThumbnailCrop
        />
        <AudioUpload
          audioUrl={stop.notice.audioUrl ?? null}
          audioTitle={stop.notice.audioTitle ?? null}
          onChange={(audioUrl) => onChange({ notice: { ...stop.notice, audioUrl } })}
          onTitleChange={(audioTitle) => onChange({ notice: { ...stop.notice, audioTitle } })}
          uploadPath={`memorial-church/audio/tours/${tourId}/notice_${stop.id}`}
          onUploadFile={onUploadPhoto}
          autoplayDisabled={stop.notice.audioAutoplayDisabled}
          onAutoplayDisabledChange={(v) => onChange({ notice: { ...stop.notice, audioAutoplayDisabled: v } })}
        />
        {stop.notice.audioUrl && (
          <PhotoCueEditor
            cues={stop.notice.photoCues}
            photos={stop.notice.photos || []}
            onChange={(photoCues) => onChange({ notice: { ...stop.notice, photoCues } })}
            holdLast={stop.notice.photoCuesHoldLast}
            onHoldLastChange={(v) => onChange({ notice: { ...stop.notice, photoCuesHoldLast: v } })}
          />
        )}

        {/* ── Indoor "where to go" map ── */}
        <NoticeMapEditor
          map={stop.notice.noticeMap ?? null}
          uploadPath={`memorial-church/photos/tours/${tourId}/notice_map_${stop.id}`}
          onUploadPhoto={onUploadPhoto}
          onChange={(noticeMap) => onChange({ notice: { ...stop.notice, noticeMap } })}
        />
      </fieldset>

      {/* ── Wonder ── */}
      <fieldset className="space-y-2" hidden={hideDiscussionAndBridge}>
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C4923A] inline-block" />
          Discussion Question
        </legend>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={stop.wonder !== null}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ wonder: { question: '', questionType: 'discuss', photos: [], audioUrl: null, audioTitle: null } });
              } else {
                onChange({ wonder: null });
              }
            }}
            className="rounded"
          />
          <span className="text-xs text-stone-600">Include a discussion question for this stop</span>
        </label>
        {stop.wonder !== null && (
          <>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name={`wtype-${stop.id}`} checked={(stop.wonder.questionType || 'discuss') === 'discuss'} onChange={() => onChange({ wonder: { ...stop.wonder!, questionType: 'discuss' } })} />
                <span className="text-xs text-stone-600">Discussion Question</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" name={`wtype-${stop.id}`} checked={stop.wonder.questionType === 'opinion'} onChange={() => onChange({ wonder: { ...stop.wonder!, questionType: 'opinion' } })} />
                <span className="text-xs text-stone-600">Discuss Opinion</span>
              </label>
            </div>
            <RichTextarea
              label="Question background (optional — shown on its own snap-scroll section above the question)"
              value={stop.wonder.questionBackground || ''}
              onChange={(v) => onChange({ wonder: { ...stop.wonder!, questionBackground: v } })}
              rows={3}
              placeholder="Contextualising text the group reads before they see the question. Leave empty to skip and show the question alone."
            />
            <AudioUpload
              audioUrl={stop.wonder!.questionBackgroundAudioUrl ?? null}
              audioTitle={stop.wonder!.questionBackgroundAudioTitle ?? null}
              onChange={(url) => onChange({ wonder: { ...stop.wonder!, questionBackgroundAudioUrl: url } })}
              onTitleChange={(title) => onChange({ wonder: { ...stop.wonder!, questionBackgroundAudioTitle: title } })}
              uploadPath={`memorial-church/audio/tours/${tourId}/wonder_${stop.id}_background`}
              onUploadFile={onUploadPhoto}
              autoplayDisabled={stop.wonder!.questionBackgroundAudioAutoplayDisabled}
              onAutoplayDisabledChange={(v) => onChange({ wonder: { ...stop.wonder!, questionBackgroundAudioAutoplayDisabled: v } })}
            />
            <PhotoListEditor
              photos={stop.wonder!.questionBackgroundPhotos || []}
              onChange={(photos) => onChange({ wonder: { ...stop.wonder!, questionBackgroundPhotos: photos } })}
              uploadPath={`memorial-church/photos/tours/${tourId}/wonder_${stop.id}_background`}
              onUploadPhoto={onUploadPhoto}
            />
            <label className="flex items-center gap-2 text-xs text-stone-700">
              <input
                type="checkbox"
                checked={!!stop.wonder!.questionBackgroundAsInstructions}
                onChange={(e) => onChange({ wonder: { ...stop.wonder!, questionBackgroundAsInstructions: e.target.checked } })}
                className="rounded"
              />
              <span>Show this as <em>Instructions</em> (italic title, no LEARN label)</span>
            </label>
            <RichTextarea
              label="Question (prompts group conversation)"
              value={stop.wonder.question}
              onChange={(question) => onChange({ wonder: { ...stop.wonder!, question } })}
              rows={3}
            />
            {stop.wonder.questionType === 'opinion' && (
              <div className="space-y-1 p-2 rounded border border-stone-200 bg-stone-50">
                <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
                  Opinion spectrum (shown as a dial in group tours)
                </p>
                <input
                  type="text"
                  value={stop.wonder.opinionSpectrumLeft || ''}
                  onChange={(e) => onChange({ wonder: { ...stop.wonder!, opinionSpectrumLeft: e.target.value } })}
                  placeholder="Left side of the spectrum"
                  className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                />
                <input
                  type="text"
                  value={stop.wonder.opinionSpectrumRight || ''}
                  onChange={(e) => onChange({ wonder: { ...stop.wonder!, opinionSpectrumRight: e.target.value } })}
                  placeholder="Right side of the spectrum"
                  className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                />
              </div>
            )}
            <p className="text-[10px] text-stone-400 italic">
              Write a question that prompts group conversation. There are no right or wrong answers &mdash;
              the reveal will complicate their thinking.
            </p>
            <UserChoiceEditor
              enabled={!!stop.wonder!.userChoiceEnabled}
              questions={stop.wonder!.userChoiceQuestions ?? []}
              onChange={(next) => onChange({ wonder: { ...stop.wonder!, ...next } })}
            />
            <PhotoListEditor
              photos={stop.wonder.photos || []}
              onChange={(photos) => onChange({ wonder: { ...stop.wonder!, photos } })}
              uploadPath={`memorial-church/photos/tours/${tourId}/wonder_${stop.id}`}
              onUploadPhoto={onUploadPhoto}
            />
            <AudioUpload
              audioUrl={stop.wonder!.audioUrl ?? null}
              audioTitle={stop.wonder!.audioTitle ?? null}
              onChange={(audioUrl) => onChange({ wonder: { ...stop.wonder!, audioUrl } })}
              onTitleChange={(audioTitle) => onChange({ wonder: { ...stop.wonder!, audioTitle } })}
              uploadPath={`memorial-church/audio/tours/${tourId}/wonder_${stop.id}`}
              onUploadFile={onUploadPhoto}
              autoplayDisabled={stop.wonder!.audioAutoplayDisabled}
              onAutoplayDisabledChange={(v) => onChange({ wonder: { ...stop.wonder!, audioAutoplayDisabled: v } })}
            />
          </>
        )}
        {stop.wonder === null && (
          <p className="text-[10px] text-stone-400 italic">
            Wonder skipped &mdash; learners will go directly from Notice to Reveal.
          </p>
        )}
      </fieldset>

      {/* ── Reveal ── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C4923A] inline-block" />
          Context (reveal)
        </legend>
        <RichTextarea
          label="Text (the authored insight) — use [photo:1], [photo:2] etc. to place photos within the text"
          value={stop.reveal.text}
          onChange={(text) => onChange({ reveal: { ...stop.reveal, text } })}
          rows={5}
          wordCount
        />
        <PhotoListEditor
          photos={stop.reveal.photos || []}
          onChange={(photos) => onChange({ reveal: { ...stop.reveal, photos } })}
          uploadPath={`memorial-church/photos/tours/${tourId}/reveal_${stop.id}`}
          onUploadPhoto={onUploadPhoto}
        />
        <AudioUpload
          audioUrl={stop.reveal.audioUrl ?? null}
          audioTitle={stop.reveal.audioTitle ?? null}
          onChange={(audioUrl) => onChange({ reveal: { ...stop.reveal, audioUrl } })}
          onTitleChange={(audioTitle) => onChange({ reveal: { ...stop.reveal, audioTitle } })}
          uploadPath={`memorial-church/audio/tours/${tourId}/reveal_${stop.id}`}
          onUploadFile={onUploadPhoto}
          autoplayDisabled={stop.reveal.audioAutoplayDisabled}
          onAutoplayDisabledChange={(v) => onChange({ reveal: { ...stop.reveal, audioAutoplayDisabled: v } })}
        />

        {/* Audio-synced photo highlights */}
        {stop.reveal.audioUrl && (
          <PhotoCueEditor
            cues={stop.reveal.photoCues}
            photos={stop.reveal.photos || []}
            onChange={(photoCues) => onChange({ reveal: { ...stop.reveal, photoCues } })}
            holdLast={stop.reveal.photoCuesHoldLast}
            onHoldLastChange={(v) => onChange({ reveal: { ...stop.reveal, photoCuesHoldLast: v } })}
          />
        )}
      </fieldset>

      {/* ── Extra Wonder + Context Rounds ── */}
      <fieldset className="space-y-2" hidden={hideDiscussionAndBridge}>
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C4923A] inline-block" />
          Additional Discussion Questions + Context
        </legend>
        {(stop.extraRounds || []).length === 0 ? (
          <p className="text-[10px] text-stone-400 italic">No extra rounds. Add one to continue the discussion → context cycle within this stop.</p>
        ) : (
          <ul className="space-y-3">
            {(stop.extraRounds || []).map((round, i) => (
              <li key={i} className="border border-stone-300 rounded bg-stone-50 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-600">Round {i + 2}</span>
                  <button
                    onClick={() => {
                      const next = (stop.extraRounds || []).filter((_, j) => j !== i);
                      onChange({ extraRounds: next });
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >&times; Remove</button>
                </div>

                {/* Wonder toggle */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={round.wonder !== null}
                      onChange={(e) => {
                        const next = [...(stop.extraRounds || [])];
                        next[i] = { ...next[i], wonder: e.target.checked ? { question: '', questionType: 'discuss', photos: [], audioUrl: null, audioTitle: null } : null };
                        onChange({ extraRounds: next });
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-stone-600">Include discussion question</span>
                  </label>
                  {round.wonder !== null && (
                    <>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={(round.wonder.questionType || 'discuss') === 'discuss'} onChange={() => {
                            const next = [...(stop.extraRounds || [])];
                            next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionType: 'discuss' } };
                            onChange({ extraRounds: next });
                          }} />
                          <span className="text-xs text-stone-600">Discussion Question</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={round.wonder.questionType === 'opinion'} onChange={() => {
                            const next = [...(stop.extraRounds || [])];
                            next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionType: 'opinion' } };
                            onChange({ extraRounds: next });
                          }} />
                          <span className="text-xs text-stone-600">Discuss Opinion</span>
                        </label>
                      </div>
                      <RichTextarea
                        label="Question background (optional)"
                        value={round.wonder.questionBackground || ''}
                        onChange={(v) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionBackground: v } };
                          onChange({ extraRounds: next });
                        }}
                        rows={3}
                        placeholder="Contextualising text shown above the question. Leave empty to show only the question."
                      />
                      <AudioUpload
                        audioUrl={round.wonder.questionBackgroundAudioUrl ?? null}
                        audioTitle={round.wonder.questionBackgroundAudioTitle ?? null}
                        onChange={(url) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionBackgroundAudioUrl: url } };
                          onChange({ extraRounds: next });
                        }}
                        onTitleChange={(title) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionBackgroundAudioTitle: title } };
                          onChange({ extraRounds: next });
                        }}
                        uploadPath={`memorial-church/audio/tours/${tourId}/extra_wonder_${stop.id}_${i}_background`}
                        onUploadFile={onUploadPhoto}
                        autoplayDisabled={round.wonder.questionBackgroundAudioAutoplayDisabled}
                        onAutoplayDisabledChange={(v) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionBackgroundAudioAutoplayDisabled: v } };
                          onChange({ extraRounds: next });
                        }}
                      />
                      <PhotoListEditor
                        photos={round.wonder.questionBackgroundPhotos || []}
                        onChange={(photos) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionBackgroundPhotos: photos } };
                          onChange({ extraRounds: next });
                        }}
                        uploadPath={`memorial-church/photos/tours/${tourId}/extra_wonder_${stop.id}_${i}_background`}
                        onUploadPhoto={onUploadPhoto}
                      />
                      <label className="flex items-center gap-2 text-xs text-stone-700">
                        <input
                          type="checkbox"
                          checked={!!round.wonder.questionBackgroundAsInstructions}
                          onChange={(e) => {
                            const next = [...(stop.extraRounds || [])];
                            next[i] = { ...next[i], wonder: { ...next[i].wonder!, questionBackgroundAsInstructions: e.target.checked } };
                            onChange({ extraRounds: next });
                          }}
                          className="rounded"
                        />
                        <span>Show this as <em>Instructions</em> (italic title, no LEARN label)</span>
                      </label>
                      <RichTextarea
                        label="Discussion question"
                        value={round.wonder.question}
                        onChange={(question) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, question } };
                          onChange({ extraRounds: next });
                        }}
                        rows={2}
                      />
                      {round.wonder.questionType === 'opinion' && (
                        <div className="space-y-1 p-2 rounded border border-stone-200 bg-stone-50">
                          <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
                            Opinion spectrum (shown as a dial in group tours)
                          </p>
                          <input
                            type="text"
                            value={round.wonder.opinionSpectrumLeft || ''}
                            onChange={(e) => {
                              const next = [...(stop.extraRounds || [])];
                              next[i] = { ...next[i], wonder: { ...next[i].wonder!, opinionSpectrumLeft: e.target.value } };
                              onChange({ extraRounds: next });
                            }}
                            placeholder="Left side of the spectrum"
                            className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                          />
                          <input
                            type="text"
                            value={round.wonder.opinionSpectrumRight || ''}
                            onChange={(e) => {
                              const next = [...(stop.extraRounds || [])];
                              next[i] = { ...next[i], wonder: { ...next[i].wonder!, opinionSpectrumRight: e.target.value } };
                              onChange({ extraRounds: next });
                            }}
                            placeholder="Right side of the spectrum"
                            className="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
                          />
                        </div>
                      )}
                      <UserChoiceEditor
                        enabled={!!round.wonder.userChoiceEnabled}
                        questions={round.wonder.userChoiceQuestions ?? []}
                        onChange={(updates) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, ...updates } };
                          onChange({ extraRounds: next });
                        }}
                      />
                      <PhotoListEditor
                        photos={round.wonder.photos || []}
                        onChange={(photos) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, photos } };
                          onChange({ extraRounds: next });
                        }}
                        uploadPath={`memorial-church/photos/tours/${tourId}/extra_wonder_${stop.id}_${i}`}
                        onUploadPhoto={onUploadPhoto}
                      />
                      <AudioUpload
                        audioUrl={round.wonder?.audioUrl ?? null}
                        onChange={(audioUrl) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, audioUrl } };
                          onChange({ extraRounds: next });
                        }}
                        uploadPath={`memorial-church/audio/tours/${tourId}/extra_wonder_${stop.id}_${i}`}
                        onUploadFile={onUploadPhoto}
                        autoplayDisabled={round.wonder?.audioAutoplayDisabled}
                        onAutoplayDisabledChange={(v) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], wonder: { ...next[i].wonder!, audioAutoplayDisabled: v } };
                          onChange({ extraRounds: next });
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Context toggle */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={round.reveal !== null}
                      onChange={(e) => {
                        const next = [...(stop.extraRounds || [])];
                        next[i] = { ...next[i], reveal: e.target.checked ? { text: '', photos: [], audioUrl: null, audioTitle: null } : null };
                        onChange({ extraRounds: next });
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-stone-600">Include context (reveal)</span>
                  </label>
                  {round.reveal !== null && (
                    <>
                      <RichTextarea
                        label="Context (reveal) text"
                        value={round.reveal.text}
                        onChange={(text) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], reveal: { ...next[i].reveal!, text } };
                          onChange({ extraRounds: next });
                        }}
                        rows={4}
                        wordCount
                      />
                      <PhotoListEditor
                        photos={round.reveal.photos || []}
                        onChange={(photos) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], reveal: { ...next[i].reveal!, photos } };
                          onChange({ extraRounds: next });
                        }}
                        uploadPath={`memorial-church/photos/tours/${tourId}/extra_${stop.id}_${i}`}
                        onUploadPhoto={onUploadPhoto}
                      />
                      <AudioUpload
                        audioUrl={round.reveal?.audioUrl ?? null}
                        onChange={(audioUrl) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], reveal: { ...next[i].reveal!, audioUrl } };
                          onChange({ extraRounds: next });
                        }}
                        uploadPath={`memorial-church/audio/tours/${tourId}/extra_reveal_${stop.id}_${i}`}
                        onUploadFile={onUploadPhoto}
                        autoplayDisabled={round.reveal?.audioAutoplayDisabled}
                        onAutoplayDisabledChange={(v) => {
                          const next = [...(stop.extraRounds || [])];
                          next[i] = { ...next[i], reveal: { ...next[i].reveal!, audioAutoplayDisabled: v } };
                          onChange({ extraRounds: next });
                        }}
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => onChange({
            extraRounds: [...(stop.extraRounds || []), {
              wonder: { question: '', questionType: 'discuss' as const, photos: [], audioUrl: null, audioTitle: null },
              reveal: { text: '', photos: [], audioUrl: null, audioTitle: null },
            }],
          })}
          className="text-xs text-blue-700 hover:underline"
        >
          + Add another discussion + context round
        </button>
      </fieldset>

      {/* ── Bridge (optional) ── */}
      <fieldset className="space-y-2" hidden={hideDiscussionAndBridge}>
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#6B5D4F] inline-block" />
          Bridge
        </legend>
        <BridgeToggle
          stop={stop}
          tourId={tourId}
          onChange={onChange}
          onUploadPhoto={onUploadPhoto}
        />
      </fieldset>

      {/* ── Reflection ── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#6B5D4F] inline-block" />
          Reflection
        </legend>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={stop.reflect !== null}
            onChange={(e) => {
              if (e.target.checked) {
                onChange({ reflect: {
                  sliderPrompt: 'How much did that change your thinking?',
                  sliderLeftLabel: 'Confirmed what we thought',
                  sliderRightLabel: 'Shifted our thinking completely',
                  followUps: [],
                  followUpOptions: null,
                  reasoningSourceOptions: null,
                  photos: [],
                }});
              } else {
                onChange({ reflect: null });
              }
            }}
            className="rounded"
          />
          <span className="text-xs text-stone-600">Include a reflection phase for this stop</span>
        </label>
        {stop.reflect !== null && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="text-xs text-stone-500">Slider prompt</span>
                <input
                  value={stop.reflect.sliderPrompt}
                  onChange={(e) => onChange({ reflect: { ...stop.reflect!, sliderPrompt: e.target.value } })}
                  className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">Left label</span>
                <input
                  value={stop.reflect.sliderLeftLabel}
                  onChange={(e) => onChange({ reflect: { ...stop.reflect!, sliderLeftLabel: e.target.value } })}
                  className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                />
              </label>
              <label className="block">
                <span className="text-xs text-stone-500">Right label</span>
                <input
                  value={stop.reflect.sliderRightLabel}
                  onChange={(e) => onChange({ reflect: { ...stop.reflect!, sliderRightLabel: e.target.value } })}
                  className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
                />
              </label>
            </div>
            <div>
              <span className="text-xs text-stone-500">Follow-up reflections (select any that apply)</span>
              <div className="mt-1 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(stop.reflect as { followUps?: string[] }).followUps?.includes('what_shifted') ?? (stop.reflect as unknown as { followUp?: string | null })?.followUp === 'what_shifted'}
                    onChange={(e) => {
                      const current: string[] = (stop.reflect as { followUps?: string[] }).followUps ?? ((stop.reflect as unknown as { followUp?: string | null })?.followUp ? [(stop.reflect as unknown as { followUp: string }).followUp] : []);
                      const next = e.target.checked ? [...current, 'what_shifted'] : current.filter((x) => x !== 'what_shifted');
                      onChange({ reflect: { ...stop.reflect!, followUps: next as ('what_shifted' | 'reasoning_source')[] } });
                    }}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <span className="text-xs font-medium text-stone-700">&ldquo;What changed?&rdquo;</span>
                    <p className="text-[10px] text-stone-400">Ask the group to categorise how the reveal changed their thinking.</p>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(stop.reflect as { followUps?: string[] }).followUps?.includes('reasoning_source') ?? (stop.reflect as unknown as { followUp?: string | null })?.followUp === 'reasoning_source'}
                    onChange={(e) => {
                      const current: string[] = (stop.reflect as { followUps?: string[] }).followUps ?? ((stop.reflect as unknown as { followUp?: string | null })?.followUp ? [(stop.reflect as unknown as { followUp: string }).followUp] : []);
                      const next = e.target.checked ? [...current, 'reasoning_source'] : current.filter((x) => x !== 'reasoning_source');
                      onChange({ reflect: { ...stop.reflect!, followUps: next as ('what_shifted' | 'reasoning_source')[] } });
                    }}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <span className="text-xs font-medium text-stone-700">&ldquo;Why did it change or not?&rdquo;</span>
                    <p className="text-[10px] text-stone-400">Ask the group what they based their discussion on.</p>
                  </div>
                </label>
              </div>
            </div>
            {(stop.reflect as { followUps?: string[] }).followUps?.includes('what_shifted') && (
              <label className="block">
                <span className="text-xs text-stone-500">&ldquo;What changed?&rdquo; options (one per line)</span>
                <textarea
                  value={(stop.reflect!.followUpOptions ?? DEFAULT_WHAT_SHIFTED_ADMIN).join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                    onChange({ reflect: { ...stop.reflect!, followUpOptions: lines.length > 0 ? lines : null } });
                  }}
                  rows={4}
                  className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs font-mono"
                />
              </label>
            )}
            {(stop.reflect as { followUps?: string[] }).followUps?.includes('reasoning_source') && (
              <label className="block">
                <span className="text-xs text-stone-500">&ldquo;Why did it change or not?&rdquo; options (one per line)</span>
                <textarea
                  value={((stop.reflect as { reasoningSourceOptions?: string[] | null }).reasoningSourceOptions ?? DEFAULT_REASONING_ADMIN).join('\n')}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').map((s) => s.trim()).filter(Boolean);
                    onChange({ reflect: { ...stop.reflect!, reasoningSourceOptions: lines.length > 0 ? lines : null } });
                  }}
                  rows={4}
                  className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs font-mono"
                />
              </label>
            )}
            <PhotoListEditor
              photos={stop.reflect!.photos || []}
              onChange={(photos) => onChange({ reflect: { ...stop.reflect!, photos } })}
              uploadPath={`memorial-church/photos/tours/${tourId}/reflect_${stop.id}`}
              onUploadPhoto={onUploadPhoto}
            />
          </>
        )}
        {stop.reflect === null && (
          <p className="text-[10px] text-stone-400 italic">
            Reflection skipped &mdash; learners will go from the reveal directly to the next stop or question prompt.
          </p>
        )}
      </fieldset>

      {/* ── Related Artefacts (Detours) ── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#C4923A] inline-block" />
          Related artefacts
        </legend>
        {(stop.detours || []).length === 0 ? (
          <p className="text-[10px] text-stone-400 italic">No artefacts yet. Add one for optional side-path content.</p>
        ) : (
          <ul className="space-y-2">
            {(stop.detours || []).map((detour, i) => (
              <li key={detour.id} className="border border-stone-300 rounded bg-stone-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">
                    {detour.title || <em className="text-stone-400">Untitled artefact</em>}
                  </span>
                  <button
                    onClick={() => {
                      const next = (stop.detours || []).filter((_, j) => j !== i);
                      onChange({ detours: next });
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >&times; Remove</button>
                </div>
                <DetourEditor
                  detour={detour}
                  tourId={tourId}
                  onChange={(patch) => {
                    const next = [...(stop.detours || [])];
                    next[i] = { ...next[i], ...patch };
                    onChange({ detours: next });
                  }}
                  onUploadPhoto={onUploadPhoto}
                />
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => onChange({ detours: [...(stop.detours || []), blankDetour()] })}
          className="text-xs text-blue-700 hover:underline"
        >
          + Add artefact
        </button>
      </fieldset>

      {/* ── Location ── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#B8694A] inline-block" />
          Map pin (optional)
        </legend>
        <p className="text-[10px] text-stone-400 italic">Only needed if this stop is at a different location (e.g., walking to the rear). Most stops inside the church don&apos;t need their own pin.</p>
        <div className="rounded border border-stone-300 overflow-hidden" style={{ height: 220 }}>
          {MAPS_API_KEY ? (
            <APIProvider apiKey={MAPS_API_KEY}>
              <StopMapPicker
                location={stop.location}
                onLocationChange={(loc) => onChange({ location: loc })}
              />
            </APIProvider>
          ) : (
            <div className="h-full flex items-center justify-center bg-stone-100 text-xs text-stone-400">
              Maps API key not configured
            </div>
          )}
        </div>
        {stop.location && (
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-stone-500 font-mono">
              {stop.location.lat.toFixed(6)}, {stop.location.lng.toFixed(6)}
            </span>
            <button
              onClick={() => onChange({ location: null })}
              className="text-[10px] text-red-600 hover:underline"
            >
              Remove pin
            </button>
          </div>
        )}
      </fieldset>

      {/* ── Metadata ── */}
      <fieldset className="space-y-2">
        <legend className="text-xs font-semibold text-stone-700 uppercase tracking-wide">Metadata</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs text-stone-500">Physical location tag</span>
            <select
              value={stop.physicalLocationTag}
              onChange={(e) => onChange({ physicalLocationTag: e.target.value })}
              className="mt-1 w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
            >
              {LOCATION_TAGS.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-stone-500">Upcoming topics (comma-separated keywords)</span>
            <input
              value={stop.upcomingTopics.join(', ')}
              onChange={(e) => onChange({
                upcomingTopics: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })}
              className="mt-1 w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
              placeholder="mosaic, facade, earthquake..."
            />
          </label>
        </div>
        <div>
          <span className="text-xs text-stone-500">Related knowledge entries</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {KNOWN_ENTRIES.map((entry) => {
              const selected = stop.relatedEntryIds.includes(entry.id);
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    const next = selected
                      ? stop.relatedEntryIds.filter((e) => e !== entry.id)
                      : [...stop.relatedEntryIds, entry.id];
                    onChange({ relatedEntryIds: next });
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] border ${
                    selected
                      ? 'bg-blue-100 border-blue-400 text-blue-800'
                      : 'bg-stone-50 border-stone-300 text-stone-600 hover:bg-stone-100'
                  }`}
                  title={entry.title}
                >
                  {entry.id}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>
    </div>
  );
}

// ─── Detour Editor ──────────────────────────────────────────────────

interface DetourEditorProps {
  detour: Detour;
  tourId: string;
  onChange: (patch: Partial<Detour>) => void;
  onUploadPhoto: (file: File, path: string) => Promise<string>;
}

function UserChoiceEditor({
  enabled,
  questions,
  onChange,
}: {
  enabled: boolean;
  questions: string[];
  onChange: (updates: { userChoiceEnabled?: boolean; userChoiceQuestions?: string[] }) => void;
}) {
  return (
    <div className="space-y-1 p-2 rounded border border-stone-200 bg-stone-50">
      <label className="flex items-center gap-2 text-xs text-stone-700">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange({ userChoiceEnabled: e.target.checked })}
          className="rounded"
        />
        <span>
          <strong>User Choice Question</strong> &mdash; let the explorer pick from a list or propose their own
        </span>
      </label>
      {enabled && (
        <div className="space-y-1 pt-1">
          <p className="text-[10px] uppercase tracking-wide text-stone-500 font-semibold">
            Question options
          </p>
          {questions.length === 0 && (
            <p className="text-[11px] text-stone-400 italic">No options yet &mdash; add at least one.</p>
          )}
          {questions.map((q, i) => (
            <div key={i} className="flex gap-1">
              <input
                type="text"
                value={q}
                onChange={(e) => {
                  const next = [...questions];
                  next[i] = e.target.value;
                  onChange({ userChoiceQuestions: next });
                }}
                placeholder={`Question option ${i + 1}`}
                className="flex-1 px-2 py-1.5 text-xs rounded border border-stone-300 bg-white"
              />
              <button
                type="button"
                onClick={() => {
                  const next = questions.filter((_, j) => j !== i);
                  onChange({ userChoiceQuestions: next });
                }}
                className="px-2 text-xs text-stone-500 hover:text-red-600"
                title="Remove option"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ userChoiceQuestions: [...questions, ''] })}
            className="text-[11px] text-stone-600 hover:text-stone-900 underline"
          >
            + Add another option
          </button>
        </div>
      )}
    </div>
  );
}

function ChipOptionsEditor({
  label,
  prompt,
  promptPlaceholder,
  options,
  defaultOptions,
  onPromptChange,
  onOptionsChange,
}: {
  label: string;
  prompt: string;
  promptPlaceholder: string;
  options: string[] | null;
  defaultOptions: string[];
  onPromptChange: (v: string) => void;
  onOptionsChange: (opts: string[]) => void;
}) {
  const effective = (options ?? defaultOptions) ?? [];
  const usingDefaults = !options;
  return (
    <fieldset className="border border-stone-200 rounded p-3 space-y-2">
      <legend className="text-[11px] text-stone-600 font-semibold px-1">{label}</legend>
      <label className="block">
        <span className="text-[10px] text-stone-500">Prompt</span>
        <input
          value={prompt}
          placeholder={promptPlaceholder}
          onChange={(e) => onPromptChange(e.target.value)}
          className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
        />
      </label>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-stone-500">Chip options{usingDefaults && ' (defaults — edit to customise)'}</span>
          <button
            onClick={() => {
              const next = options ? [...options, ''] : [...defaultOptions, ''];
              onOptionsChange(next);
            }}
            className="text-[10px] text-stone-700 hover:underline"
          >+ Add chip</button>
        </div>
        <ul className="space-y-1">
          {effective.map((opt, i) => (
            <li key={i} className="flex items-center gap-2">
              <input
                value={opt}
                onChange={(e) => {
                  const next = options ? [...options] : [...defaultOptions];
                  next[i] = e.target.value;
                  onOptionsChange(next);
                }}
                className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
              />
              <button
                onClick={() => {
                  const base = options ? [...options] : [...defaultOptions];
                  base.splice(i, 1);
                  onOptionsChange(base);
                }}
                className="text-xs text-red-600 hover:underline shrink-0"
                title="Remove"
              >&times;</button>
            </li>
          ))}
        </ul>
        {!usingDefaults && (
          <button
            onClick={() => onOptionsChange(defaultOptions)}
            className="text-[10px] text-stone-500 hover:underline"
          >Reset to defaults</button>
        )}
      </div>
    </fieldset>
  );
}

function BgPhotoOverride({ stop, tourId, onChange, onUploadPhoto }: { stop: Stop; tourId: string; onChange: (patch: Partial<Stop>) => void; onUploadPhoto: (file: File, path: string) => Promise<string> }) {
  const [enabled, setEnabled] = useState(!!stop.backgroundPhotoOverride);

  return (
    <div className="space-y-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) {
              onChange({ backgroundPhotoOverride: null });
            }
          }}
          className="rounded"
        />
        <span className="text-xs text-stone-600">Change background photo from this stop onward</span>
      </label>
      {enabled && (
        <div className="flex gap-2">
          <input
            value={stop.backgroundPhotoOverride || ''}
            onChange={(e) => onChange({ backgroundPhotoOverride: e.target.value || '' })}
            className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
            placeholder="New background photo URL..."
          />
          <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300">
            Upload
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await onUploadPhoto(file, `memorial-church/photos/tours/${tourId}/bg_${stop.id}_${file.name}`);
                onChange({ backgroundPhotoOverride: url });
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function BridgeToggle({ stop, tourId, onChange, onUploadPhoto }: { stop: Stop; tourId: string; onChange: (patch: Partial<Stop>) => void; onUploadPhoto: (file: File, path: string) => Promise<string> }) {
  const hasContent = !!(stop.reveal.bridgeText || (stop.reveal.bridgePhotos || []).length > 0);
  const [enabled, setEnabled] = useState(hasContent);

  return (
    <>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) {
              onChange({ reveal: { ...stop.reveal, bridgeText: '', bridgePhotos: [] } });
            }
          }}
          className="rounded"
        />
        <span className="text-xs text-stone-600">Include a bridge for this stop</span>
      </label>
      {enabled ? (
        <>
          <RichTextarea
            label="Bridge text (forward-pointing sentence to next stop)"
            value={stop.reveal.bridgeText}
            onChange={(bridgeText) => onChange({ reveal: { ...stop.reveal, bridgeText } })}
            rows={2}
            hideItalic
          />
          <PhotoListEditor
            photos={stop.reveal.bridgePhotos || []}
            onChange={(bridgePhotos) => onChange({ reveal: { ...stop.reveal, bridgePhotos } })}
            uploadPath={`memorial-church/photos/tours/${tourId}/bridge_${stop.id}`}
            onUploadPhoto={onUploadPhoto}
          />
          <AudioUpload
            audioUrl={stop.reveal.bridgeAudioUrl ?? null}
            audioTitle={stop.reveal.bridgeAudioTitle ?? null}
            onChange={(url) => onChange({ reveal: { ...stop.reveal, bridgeAudioUrl: url } })}
            onTitleChange={(title) => onChange({ reveal: { ...stop.reveal, bridgeAudioTitle: title } })}
            uploadPath={`memorial-church/audio/tours/${tourId}/bridge_${stop.id}`}
            onUploadFile={onUploadPhoto}
            autoplayDisabled={stop.reveal.bridgeAudioAutoplayDisabled}
            onAutoplayDisabledChange={(v) => onChange({ reveal: { ...stop.reveal, bridgeAudioAutoplayDisabled: v } })}
          />
        </>
      ) : (
        <p className="text-[10px] text-stone-400 italic">No bridge &mdash; learners will go directly to the next phase.</p>
      )}
    </>
  );
}

function DetourEditor({ detour, tourId, onChange, onUploadPhoto }: DetourEditorProps) {
  return (
    <div className="space-y-3 text-xs">
      {/* Title */}
      <label className="block">
        <span className="text-stone-500">Title</span>
        <input
          value={detour.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
          placeholder="e.g., The Pendentive Angels"
        />
      </label>

      {/* Cover photo */}
      <div className="flex gap-2 items-end">
        <label className="flex-1 block">
          <span className="text-stone-500">Cover photo URL</span>
          <div className="flex gap-2 mt-1">
            <input
              value={detour.coverPhoto.url}
              onChange={(e) => onChange({ coverPhoto: { ...detour.coverPhoto, url: e.target.value } })}
              className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
              placeholder="/photos/archival/..."
            />
            <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300">
              Upload
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await onUploadPhoto(file, `memorial-church/photos/tours/${tourId}/detour_${detour.id}_cover_${file.name}`);
                  onChange({ coverPhoto: { ...detour.coverPhoto, url } });
                }}
              />
            </label>
          </div>
        </label>
        <label className="w-32 block">
          <span className="text-stone-500">Caption</span>
          <input
            value={detour.coverPhoto.caption}
            onChange={(e) => onChange({ coverPhoto: { ...detour.coverPhoto, caption: e.target.value } })}
            className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
          />
        </label>
      </div>

      {/* Notice — toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={detour.notice !== null}
            onChange={(e) => onChange({ notice: e.target.checked ? { prompt: '', timerSeconds: 30 } : null })}
            className="rounded"
          />
          <span className="text-stone-600">Include notice (observation prompt)</span>
        </label>
        {detour.notice && (
          <div className="mt-1 flex gap-2">
            <input
              value={detour.notice.prompt}
              onChange={(e) => onChange({ notice: { ...detour.notice!, prompt: e.target.value } })}
              className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
              placeholder="Look up at the four corners..."
            />
            <input
              type="number"
              value={detour.notice.timerSeconds}
              onChange={(e) => onChange({ notice: { ...detour.notice!, timerSeconds: parseInt(e.target.value) || 30 } })}
              className="w-14 px-2 py-1 border border-stone-300 rounded text-xs"
              min={5} max={120}
            />
            <span className="text-stone-400 self-center">sec</span>
          </div>
        )}
      </div>

      {/* Wonder — toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={detour.wonder !== null}
            onChange={(e) => onChange({ wonder: e.target.checked ? { question: '' } : null })}
            className="rounded"
          />
          <span className="text-stone-600">Include wonder (discussion prompt)</span>
        </label>
        {detour.wonder && (
          <input
            value={detour.wonder.question}
            onChange={(e) => onChange({ wonder: { question: e.target.value } })}
            className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
            placeholder="Why might the designers have placed..."
          />
        )}
      </div>

      {/* Reveal — always present */}
      <label className="block">
        <span className="text-stone-500">Reveal text (required)</span>
        <textarea
          value={detour.reveal.text}
          onChange={(e) => onChange({ reveal: { ...detour.reveal, text: e.target.value } })}
          rows={3}
          className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
          placeholder="The context about this artefact..."
        />
      </label>
      <PhotoListEditor
        photos={detour.reveal.photos || []}
        onChange={(photos) => onChange({ reveal: { ...detour.reveal, photos } })}
        uploadPath={`memorial-church/photos/tours/${tourId}/detour_${detour.id}_reveal`}
        onUploadPhoto={onUploadPhoto}
      />

      {/* Bridge — toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={detour.bridge !== null}
            onChange={(e) => onChange({ bridge: e.target.checked ? '' : null })}
            className="rounded"
          />
          <span className="text-stone-600">Include bridge text</span>
        </label>
        {detour.bridge !== null && (
          <input
            value={detour.bridge}
            onChange={(e) => onChange({ bridge: e.target.value })}
            className="mt-1 w-full px-2 py-1 border border-stone-300 rounded text-xs"
            placeholder="This connects to what you'll see next..."
          />
        )}
      </div>
    </div>
  );
}

// ─── Reusable Photo List Editor ──────────────────────────────────────

interface PhotoListEditorProps {
  photos: StopPhoto[];
  onChange: (photos: StopPhoto[]) => void;
  uploadPath: string;
  onUploadPhoto: (file: File, path: string) => Promise<string>;
  showThumbnailCrop?: boolean;
}

function PhotoListEditor({ photos, onChange, uploadPath, onUploadPhoto, showThumbnailCrop = false }: PhotoListEditorProps) {
  const [overlayEditorIndex, setOverlayEditorIndex] = useState<number | null>(null);
  const editingPhoto = overlayEditorIndex !== null ? photos[overlayEditorIndex] : null;
  return (
    <div className="space-y-2">
      <span className="text-xs text-stone-500">
        Photos (optional) &mdash; use <code className="bg-stone-200 px-1 rounded">[photo:1]</code>, <code className="bg-stone-200 px-1 rounded">[photo:2]</code> in the text above to place them inline
      </span>
      {photos.map((photo, i) => (
        <div key={i} className="border border-stone-200 rounded-lg p-2 space-y-2">
          {/* URL + caption + upload + remove */}
          <div className="flex gap-2 items-start">
            <span className="text-[10px] text-stone-400 font-mono mt-1.5 w-4 shrink-0">{i + 1}.</span>
            <div className="flex-1 flex gap-2">
              <input
                value={photo.url}
                onChange={(e) => {
                  const next = [...photos];
                  next[i] = { ...next[i], url: e.target.value };
                  onChange(next);
                }}
                className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
                placeholder="/photos/archival/..."
              />
              <input
                value={photo.caption || ''}
                onChange={(e) => {
                  const next = [...photos];
                  next[i] = { ...next[i], caption: e.target.value || null };
                  onChange(next);
                }}
                className="w-36 px-2 py-1 border border-stone-300 rounded text-xs"
                placeholder="Caption"
              />
              <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300 shrink-0">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await onUploadPhoto(file, `${uploadPath}_${i}_${file.name}`);
                    const next = [...photos];
                    next[i] = { ...next[i], url };
                    onChange(next);
                  }}
                />
              </label>
            </div>
            {photo.url && (
              <button
                onClick={() => setOverlayEditorIndex(i)}
                className="px-2 py-1 text-[11px] font-semibold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 shrink-0"
                title="Annotate this photo"
              >
                Annotate{photo.overlays && photo.overlays.length > 0 ? ` (${photo.overlays.length})` : ''}
              </button>
            )}
            <button
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              className="px-1.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
            >&times;</button>
          </div>

          {photo.url && (
            <div className="pl-5 space-y-3">
              {/* ── Content display mode ── */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-stone-500">Content display:</span>
                  {(['auto', 'cover', 'contain'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        const next = [...photos];
                        next[i] = { ...next[i], displayMode: mode === 'auto' ? undefined : mode };
                        onChange(next);
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        (photo.displayMode ?? 'auto') === mode
                          ? 'bg-blue-600 text-white'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {mode === 'auto' ? 'Auto (fit)' : mode === 'cover' ? 'Crop (fill)' : 'Full (black bars)'}
                    </button>
                  ))}
                </div>

                {/* Content preview — always visible, style reflects display mode */}
                {(() => {
                  const isCover = photo.displayMode === 'cover';
                  const isContain = photo.displayMode === 'contain';
                  const fp = photo.focalPoint;
                  const zoom = photo.zoom ?? 1;
                  const objPos = fp ? `${fp.x}% ${fp.y}%` : '50% 50%';
                  const origin = fp ? `${fp.x}% ${fp.y}%` : 'center';
                  return (
                    <div className="space-y-1.5">
                      {isCover && (
                        <p className="text-[10px] text-stone-400">Click image to set focal point. Preview is 4:3 (content area on phone).</p>
                      )}
                      {isCover ? (
                        /* Crop preview: 4:3, click-to-focal-point, zoom-wrapper */
                        <div
                          className="relative w-full rounded border border-stone-300 cursor-crosshair bg-black"
                          style={{ aspectRatio: '4/3', overflow: 'clip' }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                            const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                            const next = [...photos];
                            next[i] = { ...next[i], focalPoint: { x, y } };
                            onChange(next);
                          }}
                        >
                          <div
                            style={{
                              position: 'absolute', inset: 0,
                              transform: zoom > 1 ? `scale(${zoom})` : undefined,
                              transformOrigin: zoom > 1 ? origin : undefined,
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.url} alt="" className="w-full h-full object-cover select-none" style={{ objectPosition: objPos }} draggable={false} />
                          </div>
                          {fp && (
                            <div className="absolute w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none" style={{ left: `${fp.x}%`, top: `${fp.y}%`, transform: 'translate(-50%,-50%)', background: '#F59E0B', zIndex: 1 }} />
                          )}
                        </div>
                      ) : isContain ? (
                        /* Letterbox preview */
                        <div className="w-full bg-black rounded border border-stone-300 flex items-center justify-center" style={{ maxHeight: 200 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt="" className="max-w-full select-none" style={{ maxHeight: 200, objectFit: 'contain' }} draggable={false} />
                        </div>
                      ) : (
                        /* Auto preview: natural aspect ratio */
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={photo.url} alt="" className="w-full rounded border border-stone-300 select-none" style={{ maxHeight: 200, objectFit: 'contain' }} draggable={false} />
                      )}

                      {/* Zoom slider — only in crop mode */}
                      {isCover && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400 shrink-0">Zoom:</span>
                          <input
                            type="range" min={1} max={3} step={0.05} value={zoom}
                            onChange={(e) => {
                              const next = [...photos];
                              next[i] = { ...next[i], zoom: parseFloat(e.target.value) };
                              onChange(next);
                            }}
                            className="flex-1 h-1 accent-amber-500"
                          />
                          <span className="text-[10px] text-stone-500 w-8 text-right">{zoom.toFixed(2)}×</span>
                          {zoom !== 1 && (
                            <button type="button" onClick={() => { const next = [...photos]; next[i] = { ...next[i], zoom: 1 }; onChange(next); }} className="text-[10px] text-blue-600 hover:underline">reset</button>
                          )}
                        </div>
                      )}
                      {isCover && (
                        <p className="text-[10px] text-stone-400">
                          {fp ? `Focal point: ${fp.x}%, ${fp.y}%` : 'No focal point — defaults to centre'}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── Thumbnail crop — only for seed/notice photos that drive thumbnails ── */}
              {showThumbnailCrop && <div className="space-y-1.5 border-t border-stone-100 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-stone-500">Thumbnail crop:</span>
                  <span className="text-[10px] text-stone-400">(map overlay card, gallery, journal)</span>
                  {photo.thumbnailFocalPoint && (
                    <button
                      type="button"
                      onClick={() => { const next = [...photos]; next[i] = { ...next[i], thumbnailFocalPoint: undefined }; onChange(next); }}
                      className="text-[10px] text-red-500 hover:underline ml-auto"
                    >clear</button>
                  )}
                </div>
                <p className="text-[10px] text-stone-400">
                  Preview matches the wide rectangular thumbnail shown when tapping a stop pin. Click to set focal point.
                </p>
                {/* ~3.5:1 wide rectangle — matches h-28 full-width map overlay card on a typical phone */}
                <div
                  className="relative w-full rounded border border-stone-300 cursor-crosshair"
                  style={{ aspectRatio: '7/2', overflow: 'clip' }}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                    const next = [...photos];
                    next[i] = { ...next[i], thumbnailFocalPoint: { x, y } };
                    onChange(next);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    className="w-full h-full object-cover select-none"
                    style={{
                      objectPosition: photo.thumbnailFocalPoint
                        ? `${photo.thumbnailFocalPoint.x}% ${photo.thumbnailFocalPoint.y}%`
                        : '50% 50%',
                    }}
                    draggable={false}
                  />
                  {photo.thumbnailFocalPoint && (
                    <div
                      className="absolute w-3 h-3 rounded-full border-2 border-white shadow pointer-events-none"
                      style={{
                        left: `${photo.thumbnailFocalPoint.x}%`,
                        top: `${photo.thumbnailFocalPoint.y}%`,
                        transform: 'translate(-50%,-50%)',
                        background: '#F59E0B',
                      }}
                    />
                  )}
                </div>
                <p className="text-[10px] text-stone-400">
                  {photo.thumbnailFocalPoint
                    ? `Focal point: ${photo.thumbnailFocalPoint.x}%, ${photo.thumbnailFocalPoint.y}%`
                    : 'Defaults to centre'}
                </p>
              </div>}
            </div>
          )}
        </div>
      ))}
      <button
        onClick={() => onChange([...photos, { url: '', caption: null }])}
        className="text-xs text-blue-700 hover:underline"
      >
        + Add photo
      </button>

      {editingPhoto && overlayEditorIndex !== null && (
        <PhotoOverlayEditor
          photoUrl={editingPhoto.url}
          initial={editingPhoto.overlays}
          onCancel={() => setOverlayEditorIndex(null)}
          onSave={(overlays) => {
            const next = [...photos];
            next[overlayEditorIndex] = { ...next[overlayEditorIndex], overlays };
            onChange(next);
            setOverlayEditorIndex(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Notice Map Editor ──────────────────────────────────────────────

interface NoticeMapEditorProps {
  map: import('@/lib/types').NoticeMap | null;
  uploadPath: string;
  onUploadPhoto: (file: File, path: string) => Promise<string>;
  onChange: (next: import('@/lib/types').NoticeMap | null) => void;
}

function NoticeMapEditor({ map, uploadPath, onUploadPhoto, onChange }: NoticeMapEditorProps) {
  return (
    <div className="border-t border-stone-200 pt-2 space-y-2">
      <div className="flex items-baseline gap-2">
        <p className="text-xs font-semibold text-stone-700">Indoor &ldquo;where to go&rdquo; map (optional)</p>
        <p className="text-[10px] text-stone-400">
          Shown above the prompt. Use for indoor stops where the outdoor GPS pin isn&apos;t enough.
        </p>
      </div>

      {/* Upload row */}
      <div className="flex gap-2 items-center">
        <input
          value={map?.url ?? ''}
          onChange={(e) =>
            onChange(
              e.target.value
                ? { url: e.target.value, caption: map?.caption ?? null, markers: map?.markers ?? [] }
                : null,
            )
          }
          className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
          placeholder="Map image URL or upload..."
        />
        <label className="px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300 shrink-0">
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const url = await onUploadPhoto(file, `${uploadPath}_${file.name}`);
              onChange({ url, caption: map?.caption ?? null, markers: map?.markers ?? [] });
            }}
          />
        </label>
        {map?.url && (
          <button
            onClick={() => onChange(null)}
            className="text-xs text-red-600 hover:underline shrink-0"
          >
            Remove
          </button>
        )}
      </div>

      {map?.url && (
        <>
          <input
            value={map.caption ?? ''}
            onChange={(e) => onChange({ ...map, caption: e.target.value || null })}
            className="w-full px-2 py-1 border border-stone-300 rounded text-xs"
            placeholder="Caption (e.g. “North aisle, near the second column”)"
          />

          {/* Hint toggle — hides the map behind a "Tap for hint" button on
              the explorer side so the group has to actively reveal it. */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!map.isHint}
              onChange={(e) => onChange({ ...map, isHint: e.target.checked })}
              className="w-3.5 h-3.5 accent-amber-500"
            />
            <span className="text-xs text-stone-700">
              Treat as a hint &mdash; explorers must tap &ldquo;Tap for hint&rdquo; to reveal the map.
            </span>
          </label>

          <p className="text-[10px] text-stone-500">
            Click on the map to drop a &ldquo;you go here&rdquo; marker. Click an existing marker to edit or remove.
          </p>

          {/* Preview with markers — click to add new. The click target is
              an inline-block sized exactly to the image so (x%, y%) maps
              to the image bounds, matching the explorer-side renderer. */}
          <div className="w-full max-w-xl border border-stone-300 rounded overflow-hidden bg-black/5 flex justify-center">
            <div
              className="relative cursor-crosshair select-none"
              style={{ display: 'inline-block', maxWidth: '100%' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;
                const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                const id = `mk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
                onChange({ ...map, markers: [...map.markers, { id, x, y }] });
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={map.url} alt="" className="block" style={{ maxWidth: '100%', maxHeight: 320 }} draggable={false} />
              {map.markers.map((m) => (
                <div
                  key={m.id}
                  className="absolute pointer-events-none"
                  style={{ left: `${m.x}%`, top: `${m.y}%`, width: 0, height: 0 }}
                >
                  <svg
                    width="26"
                    height="32"
                    viewBox="0 0 24 30"
                    fill="none"
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: 0,
                      transform: 'translateX(-50%)',
                      filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
                    }}
                  >
                    <path d="M12 0 a 9 9 0 0 1 9 9 c 0 7 -9 21 -9 21 s -9 -14 -9 -21 a 9 9 0 0 1 9 -9 z" fill="#C4923A" stroke="#fff" strokeWidth="1.5" />
                    <circle cx="12" cy="9" r="3.2" fill="#fff" />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Marker list — labels + delete */}
          {map.markers.length > 0 && (
            <ul className="space-y-1.5">
              {map.markers.map((m, i) => (
                <li key={m.id} className="flex gap-2 items-center text-xs">
                  <span className="w-5 text-stone-400">{i + 1}.</span>
                  <input
                    value={m.label ?? ''}
                    onChange={(e) => {
                      const next = [...map.markers];
                      next[i] = { ...next[i], label: e.target.value || undefined };
                      onChange({ ...map, markers: next });
                    }}
                    placeholder="Optional label (e.g. “You are here”)"
                    className="flex-1 px-2 py-1 border border-stone-300 rounded"
                  />
                  <span className="text-[10px] text-stone-400 font-mono">{Math.round(m.x)}, {Math.round(m.y)}</span>
                  <button
                    onClick={() => onChange({ ...map, markers: map.markers.filter((_, j) => j !== i) })}
                    className="px-1.5 py-0.5 text-red-600 hover:bg-red-50 rounded"
                  >&times;</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ─── Stop Preview ───────────────────────────────────────────────────

type PhaseName = 'Seed' | 'Notice' | 'Wonder' | 'Reveal' | 'Reflect';

const PHASE_COLOR: Record<PhaseName, string> = {
  Seed: '#7A7A5E',
  Notice: '#2B4C5E',
  Wonder: '#C4923A',
  Reveal: '#C4923A',
  Reflect: '#6B5D4F',
};

/** Build the phase sequence for a stop, skipping Wonder if null. */
function phasesForStop(stop: Stop): PhaseName[] {
  const phases: PhaseName[] = ['Seed', 'Notice'];
  if (stop.wonder !== null) phases.push('Wonder');
  phases.push('Reveal', 'Reflect');
  return phases;
}

interface StopPreviewProps {
  stop: Stop;
  phase: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function StopPreview({ stop, phase, onNext, onPrev, onClose }: StopPreviewProps) {
  const phases = phasesForStop(stop);
  const maxPhase = phases.length - 1;
  const currentPhase = phases[Math.min(phase, maxPhase)];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[#F0E0C8] rounded-lg shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Phase indicator */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#D4BFA0]">
          <div className="flex gap-1">
            {phases.map((name, i) => (
              <span
                key={name}
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: i <= phase ? PHASE_COLOR[name] : '#D4BFA0',
                }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold" style={{ color: PHASE_COLOR[currentPhase] }}>
            {currentPhase}
          </span>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800 text-sm">&times;</button>
        </div>

        {/* Phase content */}
        <div className="p-5 min-h-[280px] flex flex-col justify-between">
          {currentPhase === 'Seed' && (
            <div className="space-y-3">
              {stop.seed.photoUrl && (
                <div className="rounded overflow-hidden border border-[#D4BFA0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stop.seed.photoUrl} alt="" className="w-full h-40 object-cover" />
                  {stop.seed.photoCaption && (
                    <p className="text-[10px] text-stone-600 px-2 py-1 bg-[#EBE3D6]">{stop.seed.photoCaption}</p>
                  )}
                </div>
              )}
              <p className="text-[17px] leading-relaxed font-serif text-[#2C2418]">
                {stop.seed.text || <em className="text-stone-400">No seed text</em>}
              </p>
            </div>
          )}

          {currentPhase === 'Notice' && (
            <div className="space-y-4">
              <p className="text-[19px] leading-relaxed font-serif text-[#2C2418]">
                {stop.notice.prompt || <em className="text-stone-400">No notice prompt</em>}
              </p>
              <div className="flex items-center gap-2 text-sm text-[#2B4C5E]">
                <span className="w-6 h-6 rounded-full border-2 border-[#2B4C5E] flex items-center justify-center text-[10px] font-bold">
                  {stop.notice.timerSeconds}
                </span>
                <span>seconds to look</span>
              </div>
            </div>
          )}

          {currentPhase === 'Wonder' && stop.wonder && (
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-widest text-[#C4923A] font-semibold">Wonder together</p>
              <p className="text-[19px] leading-relaxed font-serif text-[#2C2418]">
                {stop.wonder.question || <em className="text-stone-400">No wonder question</em>}
              </p>
              <p className="text-xs text-stone-500 italic">Talk together about this before continuing.</p>
            </div>
          )}

          {currentPhase === 'Reveal' && (
            <div className="space-y-3">
              <p className="text-[17px] leading-relaxed font-serif text-[#2C2418] border-l-4 border-[#C4923A] pl-3">
                {stop.reveal.text || <em className="text-stone-400">No reveal text</em>}
              </p>
              {stop.reveal.photoUrl && (
                <div className="rounded overflow-hidden border border-[#D4BFA0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={stop.reveal.photoUrl} alt="" className="w-full h-32 object-cover" />
                  {stop.reveal.photoCaption && (
                    <p className="text-[10px] text-stone-600 px-2 py-1 bg-[#EBE3D6]">{stop.reveal.photoCaption}</p>
                  )}
                </div>
              )}
              {stop.reveal.bridgeText && (
                <p className="text-sm text-stone-600 italic">{stop.reveal.bridgeText}</p>
              )}
            </div>
          )}

          {currentPhase === 'Reflect' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-stone-700">How close was your theory?</p>
              <div className="h-2 bg-[#D4BFA0] rounded-full relative">
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#C4923A] border-2 border-white shadow" />
              </div>
              <div className="flex justify-between text-[10px] text-stone-500">
                <span>Not what we expected</span>
                <span>Exactly what we thought</span>
              </div>
              {stop.reveal.bridgeText && (
                <p className="text-sm text-stone-600 italic mt-4">{stop.reveal.bridgeText}</p>
              )}
              <div className="flex gap-2 mt-2">
                <span className="flex-1 text-center px-2 py-1.5 rounded bg-[#C4923A]/20 text-[#C4923A] text-xs font-semibold">
                  Ask our own question
                </span>
                <span className="flex-1 text-center px-2 py-1.5 rounded bg-[#7A7A5E]/20 text-[#7A7A5E] text-xs font-semibold">
                  Continue the tour
                </span>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-4 pt-3 border-t border-[#D4BFA0]">
            <button
              onClick={onPrev}
              disabled={phase === 0}
              className="text-xs text-stone-500 hover:text-stone-800 disabled:opacity-30"
            >&larr; Previous</button>
            <button
              onClick={phase >= maxPhase ? onClose : onNext}
              className="text-xs font-semibold"
              style={{ color: PHASE_COLOR[phases[Math.min(phase + 1, maxPhase)]] }}
            >
              {phase >= maxPhase ? 'Close preview' : `Next: ${phases[phase + 1]} \u2192`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Map Picker for Stop Location ───────────────────────────────────

interface StopMapPickerProps {
  location: { lat: number; lng: number } | null;
  onLocationChange: (loc: { lat: number; lng: number }) => void;
}

function StopMapPicker({ location, onLocationChange }: StopMapPickerProps) {
  const center = location || CHURCH_LOCATION;

  return (
    <GoogleMap
      defaultCenter={center}
      defaultZoom={18}
      mapId="tour-stop-picker"
      gestureHandling="greedy"
      disableDefaultUI={true}
      zoomControl={true}
      onClick={(e) => {
        if (e.detail.latLng) {
          onLocationChange({
            lat: e.detail.latLng.lat,
            lng: e.detail.latLng.lng,
          });
        }
      }}
      style={{ width: '100%', height: '100%' }}
    >
      {location && (
        <AdvancedMarker position={location}>
          <div
            className="flex items-center justify-center rounded-full shadow-md"
            style={{
              width: 28,
              height: 28,
              background: '#B8694A',
              border: '3px solid #F0E0C8',
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#F0E0C8]" />
          </div>
        </AdvancedMarker>
      )}
    </GoogleMap>
  );
}
