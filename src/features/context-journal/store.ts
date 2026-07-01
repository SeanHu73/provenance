/**
 * Context Journal — Firestore data layer.
 *
 * Owns two collections, scoped by `placeId`:
 *   - `context-entries`  — the contexts shown in the P.A.S.T. panel.
 *   - `saved-contexts`   — per-viewer bookmarks (anonymous id for now).
 *
 * NOTE: Firestore security rules are per-collection in this project. Both
 * collections need their own `match` blocks in the Firebase console
 * (allow read, write: if true;) or reads/writes fail silently.
 *
 * Timestamps use Firestore `serverTimestamp()` so ordering is server-authoritative.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { geometryToStore, geometryFromStore } from '@/lib/geo-serialize';
import { CONTEXT_ENTRIES, SAVED_CONTEXTS, PLACE_CONFIG } from './constants';
import type { ContextEntry, NewContextEntry, SavedContext, PlaceConfig } from './types';

const VIEWER_KEY = 'provenance-context-viewer-id';

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
  // Firestore rejects `undefined`; drop those keys.
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

/**
 * A stable anonymous viewer id (per-device, localStorage). Structured so a real
 * user id can drop in later — callers only ever see an opaque string.
 */
export function getViewerId(): string {
  try {
    let id = localStorage.getItem(VIEWER_KEY);
    if (!id) {
      id = newId('viewer');
      localStorage.setItem(VIEWER_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

// ── Place config (admin-set timeline domain + default view) ──

export async function getPlaceConfig(placeId: string): Promise<PlaceConfig | null> {
  try {
    const snap = await getDoc(doc(db, PLACE_CONFIG, placeId));
    return snap.exists() ? ({ ...(snap.data() as PlaceConfig), placeId }) : null;
  } catch (err) {
    console.error('[context-journal] getPlaceConfig failed:', err);
    return null;
  }
}

export async function savePlaceConfig(config: Omit<PlaceConfig, 'updatedAt'>): Promise<void> {
  await setDoc(doc(db, PLACE_CONFIG, config.placeId), cleanUndefined({
    ...config,
    updatedAt: serverTimestamp(),
  }));
}

// ── Media upload (photos + audio) ──

export async function uploadContextMedia(file: File): Promise<string> {
  const path = `context-journal/media/${newId('m')}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ── Context entries ──

/** Create a context. Returns the new id; it appears immediately via subscribe. */
export async function addContextEntry(entry: NewContextEntry): Promise<string> {
  const id = newId('ctx');
  const data = cleanUndefined({
    ...entry,
    // Firestore rejects nested arrays (Polygon coords) — store geometry as a string.
    geometry: geometryToStore(entry.geometry),
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, CONTEXT_ENTRIES, id), data);
  return id;
}

/** Patch an existing context entry (e.g. a learner editing their added copy on
 *  the standalone route). Geometry is re-serialized like on create. */
export async function updateContextEntry(id: string, patch: Partial<NewContextEntry>): Promise<void> {
  const data: Record<string, unknown> = cleanUndefined({ ...patch, updatedAt: serverTimestamp() });
  if ('geometry' in patch) data.geometry = geometryToStore(patch.geometry ?? null);
  await setDoc(doc(db, CONTEXT_ENTRIES, id), data, { merge: true });
}

/** Permanently delete a context entry (admin moderation). It disappears
 *  immediately for everyone via the live subscription. */
export async function deleteContextEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, CONTEXT_ENTRIES, id));
}

/**
 * Live subscription to all contexts for a place. Range filtering happens
 * client-side (the selected timeline range is the single source of truth),
 * so we fetch the whole place set and let the panel filter by overlap.
 */
export function subscribeContextEntries(
  placeId: string,
  onChange: (entries: ContextEntry[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(collection(db, CONTEXT_ENTRIES), where('placeId', '==', placeId));
  return onSnapshot(
    q,
    (snap) => {
      const out: ContextEntry[] = [];
      snap.forEach((d) => {
        const data = d.data();
        out.push({ ...data, id: d.id, geometry: geometryFromStore(data.geometry) } as ContextEntry);
      });
      onChange(out);
    },
    (err) => {
      console.error('[context-journal] subscribeContextEntries failed:', err);
      onError?.(err);
    },
  );
}

/** One-shot read (used where a live subscription is overkill). */
export async function getContextEntries(placeId: string): Promise<ContextEntry[]> {
  try {
    const snap = await getDocs(query(collection(db, CONTEXT_ENTRIES), where('placeId', '==', placeId)));
    const out: ContextEntry[] = [];
    snap.forEach((d) => {
      const data = d.data();
      out.push({ ...data, id: d.id, geometry: geometryFromStore(data.geometry) } as ContextEntry);
    });
    return out;
  } catch (err) {
    console.error('[context-journal] getContextEntries failed:', err);
    return [];
  }
}

// ── Saved contexts (bookmarks) ──

const savedDocId = (viewerId: string, contextId: string) => `${viewerId}__${contextId}`;

/** Bookmark a context for the current viewer. */
export async function saveContext(viewerId: string, contextId: string, placeId: string): Promise<void> {
  const id = savedDocId(viewerId, contextId);
  const data: Omit<SavedContext, 'createdAt'> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    id, viewerId, contextId, placeId, createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, SAVED_CONTEXTS, id), data);
}

/** Remove a bookmark. */
export async function unsaveContext(viewerId: string, contextId: string): Promise<void> {
  await deleteDoc(doc(db, SAVED_CONTEXTS, savedDocId(viewerId, contextId)));
}

/** Live set of context ids this viewer has saved (for the filled-bookmark state). */
export function subscribeSavedIds(
  viewerId: string,
  onChange: (ids: Set<string>) => void,
): () => void {
  const q = query(collection(db, SAVED_CONTEXTS), where('viewerId', '==', viewerId));
  return onSnapshot(
    q,
    (snap) => {
      const ids = new Set<string>();
      snap.forEach((d) => ids.add((d.data() as SavedContext).contextId));
      onChange(ids);
    },
    (err) => console.error('[context-journal] subscribeSavedIds failed:', err),
  );
}
