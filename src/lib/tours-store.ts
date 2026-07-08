/**
 * Tour data layer — CRUD over `memorial-church-tours` in Firestore.
 *
 * Each document is a Tour record with an ordered stops array, guide
 * metadata, and a connection web layout. Tours are authored by Sean
 * through /admin/tours and played back by learners through the
 * explorer interface.
 *
 * NOTE: Firestore security rules must include a match block for
 * `memorial-church-tours` or reads/writes will fail silently.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { Geometry } from 'geojson';
import { db } from './firebase';
import { geometryToStore, geometryFromStore } from './geo-serialize';
import { Tour, Stop, Detour, TourMode, Act, OpeningFrame } from './types';

const TOURS_COLLECTION = 'memorial-church-tours';

/**
 * `Act.contexts[]` (rich Add-Context items) carry a GeoJSON `geometry`. Firestore
 * rejects nested arrays (Polygon coords), so we serialize geometry to a string on
 * write and parse it back on read — see `geo-serialize`. `map` applies either
 * direction; everything else on the tour passes through untouched.
 */
function mapTourContextGeometry(tour: Tour, map: (g: unknown) => unknown): Tour {
  if (!tour.acts?.length) return tour;
  return {
    ...tour,
    acts: tour.acts.map((act) =>
      act.contexts?.length
        ? { ...act, contexts: act.contexts.map((c) => ({ ...c, geometry: map(c.geometry) as Geometry | null })) }
        : act),
  };
}

export function newTourId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tour_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newStopId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `stop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getTours(): Promise<Tour[]> {
  try {
    const snap = await getDocs(collection(db, TOURS_COLLECTION));
    const tours: Tour[] = [];
    snap.forEach((d) => tours.push(mapTourContextGeometry({ id: d.id, ...d.data() } as Tour, geometryFromStore)));
    // Sort by updatedAt descending so most recent is first
    tours.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return tours;
  } catch (err) {
    console.error('[tours-store] getTours failed:', err);
    return [];
  }
}

export async function getTour(id: string): Promise<Tour | null> {
  try {
    const snap = await getDoc(doc(db, TOURS_COLLECTION, id));
    if (!snap.exists()) return null;
    return mapTourContextGeometry({ id: snap.id, ...snap.data() } as Tour, geometryFromStore);
  } catch (err) {
    console.error('[tours-store] getTour failed:', err);
    return null;
  }
}

export async function saveTour(tour: Tour): Promise<Tour> {
  const now = new Date().toISOString();
  const next: Tour = {
    ...tour,
    createdAt: tour.createdAt || now,
    updatedAt: now,
  };
  // Serialize Add-Context geometry for Firestore (nested-array limitation); the
  // returned `next` keeps the in-memory geometry objects for the caller/editor.
  const forStore = mapTourContextGeometry(next, (g) => geometryToStore(g as Geometry | null));
  const { id, ...data } = forStore;
  // Firestore's setDoc rejects `undefined` field values (no ignoreUndefinedProperties
  // on this instance), which silently failed saves that cleared an optional field —
  // e.g. setting "Unlock after listening to" back to "Available from the start". A
  // JSON round-trip drops undefined so a full-replace setDoc actually clears them.
  await setDoc(doc(db, TOURS_COLLECTION, id), JSON.parse(JSON.stringify(data)));
  return next;
}

export async function deleteTour(id: string): Promise<void> {
  await deleteDoc(doc(db, TOURS_COLLECTION, id));
}

/**
 * Create a blank Stop scaffold with sensible defaults.
 */
export function blankStop(order: number): import('./types').Stop {
  return {
    id: newStopId(),
    order,
    title: '',
    isFinalStop: false,
    backgroundPhotoOverride: null,
    location: null,
    seed: { text: '', photoUrl: null, photoCaption: null, photos: [], ttsText: null, timerSeconds: null, audioUrl: null, audioTitle: null },
    notice: { prompt: '', timerSeconds: 30, photoUrl: null, photoCaption: null, photos: [], audioUrl: null, audioTitle: null },
    wonder: { question: '', questionType: 'discuss' as const, photos: [], audioUrl: null, audioTitle: null },
    reveal: { text: '', photoUrl: null, photoCaption: null, photos: [], bridgeText: '', bridgePhotos: [], audioUrl: null, audioTitle: null },
    extraRounds: [],
    reflect: {
      sliderPrompt: 'How much did that change your thinking?',
      sliderLeftLabel: 'Confirmed what we thought',
      sliderRightLabel: 'Shifted our thinking completely',
      followUps: [],
      followUpOptions: null,
      reasoningSourceOptions: null,
      photos: [],
    },
    detours: [],
    physicalLocationTag: 'general',
    relatedEntryIds: [],
    upcomingTopics: [],
  };
}

export function newDetourId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `detour_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function newActId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Resolves the tour's playback mode. `tourMode` is the source of truth;
 * when absent (legacy tours) we derive it from the older `unstructuredMode`
 * boolean so existing Linear / Unstructured tours behave unchanged.
 */
export function getTourMode(tour: Tour): TourMode {
  if (tour.tourMode) return tour.tourMode;
  return tour.unstructuredMode ? 'unstructured' : 'linear';
}

/**
 * Returns the stops array the tour is currently operating on.
 *
 * Unstructured and Context modes each use a parallel stops array
 * (`unstructuredStops` / `contextStops`) so their writing can diverge from
 * the linear set. When the relevant parallel array is missing/empty (legacy
 * tours, or context cloned from unstructured), we fall back so the tour
 * still plays.
 */
export function getActiveStops(tour: Tour): Stop[] {
  const mode = getTourMode(tour);
  if (mode === 'context') {
    if (tour.contextStops && tour.contextStops.length > 0) return tour.contextStops;
    if (tour.unstructuredStops && tour.unstructuredStops.length > 0) return tour.unstructuredStops;
    return tour.stops;
  }
  if (mode === 'unstructured' && tour.unstructuredStops && tour.unstructuredStops.length > 0) {
    return tour.unstructuredStops;
  }
  return tour.stops;
}

/**
 * The stops that make up the *guided* tour — active stops minus any moved into the
 * post-tour "additional" pool (context mode). Learners only meet additional stops
 * after the guided tour, so overviews, numbering, and progress use this, not
 * `getActiveStops`. For non-context tours (no additional pool) this equals
 * `getActiveStops`.
 */
export function getGuidedStops(tour: Tour): Stop[] {
  const additional = new Set((tour.additionalStops || []).map((a) => a.stopId));
  if (additional.size === 0) return getActiveStops(tour);
  return getActiveStops(tour).filter((s) => !additional.has(s.id));
}

/**
 * Returns a new Tour with the active stops array replaced. Writes to the
 * array matching the current mode (`contextStops` / `unstructuredStops` /
 * `stops`).
 */
export function setActiveStops(tour: Tour, stops: Stop[]): Tour {
  const mode = getTourMode(tour);
  if (mode === 'context') return { ...tour, contextStops: stops };
  if (mode === 'unstructured') return { ...tour, unstructuredStops: stops };
  return { ...tour, stops };
}

/**
 * Deep-clone a stops array for use as a parallel mode-specific set.
 * All stop and detour IDs are re-minted so the arrays never share IDs —
 * keeps session references unambiguous.
 */
export function duplicateStops(stops: Stop[]): Stop[] {
  const cloned = JSON.parse(JSON.stringify(stops)) as Stop[];
  return cloned.map((s) => ({
    ...s,
    id: newStopId(),
    detours: (s.detours || []).map((d) => ({ ...d, id: newDetourId() })),
  }));
}

/** @deprecated Use {@link duplicateStops}. Kept as an alias for callers. */
export const duplicateStopsForUnstructured = duplicateStops;

/** A blank Opening Frame for context mode. */
export function blankOpeningFrame(): OpeningFrame {
  return {
    scenePhotoUrl: null,
    sceneDescription: '',
    sceneAudioUrl: null,
    sceneAudioTitle: null,
    openingFraming: '',
  };
}

/** A blank Act containing the given stop IDs. */
export function blankAct(index: number, stopIds: string[] = []): Act {
  return {
    id: newActId(),
    title: `Act ${index + 1}`,
    stopIds,
    openingQuestion: null,
    closingQuestion: null,
  };
}

export function blankDetour(): Detour {
  return {
    id: newDetourId(),
    title: '',
    coverPhoto: { url: '', caption: '' },
    physicalLocationTag: 'general',
    relatedEntryIds: [],
    notice: null,
    wonder: null,
    reveal: { text: '', photos: [] },
    bridge: null,
  };
}
