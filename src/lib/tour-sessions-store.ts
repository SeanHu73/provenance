/**
 * Tour session persistence — writes to `memorial-church-tour-sessions`.
 *
 * Saves session data (reflection scores, banked questions, completion)
 * to Firestore so Sean can review what groups experienced. The session
 * doc is keyed by session ID and updated on every meaningful change.
 *
 * NOTE: Firestore security rules must include:
 *   match /memorial-church-tour-sessions/{doc} { allow read, write: if true; }
 */

import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { TourSession } from './types';

const COLLECTION = 'memorial-church-tour-sessions';

/** A persisted session carries a `lastUpdated` stamp not on TourSession. */
export type StoredTourSession = TourSession & { lastUpdated?: string };

export async function persistTourSession(session: TourSession): Promise<void> {
  try {
    const { id, ...data } = session;
    await setDoc(doc(db, COLLECTION, id), {
      ...data,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    // Non-fatal — sessionStorage is the primary store.
    // Firestore persistence is for analytics, not reliability.
    console.error('[tour-sessions-store] persist failed:', err);
  }
}

/** Read every backed-up session (newest first). Used by /admin/sessions. */
export async function getAllTourSessions(): Promise<StoredTourSession[]> {
  try {
    const snap = await getDocs(collection(db, COLLECTION));
    const out: StoredTourSession[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as StoredTourSession));
    out.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
    return out;
  } catch (err) {
    console.error('[tour-sessions-store] getAllTourSessions failed:', err);
    return [];
  }
}
