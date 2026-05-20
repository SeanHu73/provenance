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
import { db } from './firebase';
import { Tour, Detour } from './types';

const TOURS_COLLECTION = 'memorial-church-tours';

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
    snap.forEach((d) => tours.push({ id: d.id, ...d.data() } as Tour));
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
    return { id: snap.id, ...snap.data() } as Tour;
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
  const { id, ...data } = next;
  await setDoc(doc(db, TOURS_COLLECTION, id), data);
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
    wonder: { question: '', photos: [], audioUrl: null, audioTitle: null },
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
