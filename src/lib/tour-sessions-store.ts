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
import { TourSession, ContextEntrySnapshot } from './types';

const COLLECTION = 'memorial-church-tour-sessions';

/** A persisted session carries a `lastUpdated` stamp not on TourSession, and an
 *  admin-only `starred` flag for marking the real explorer runs worth keeping
 *  apart from the sessions Sean creates just by opening the app to test. */
export type StoredTourSession = TourSession & { lastUpdated?: string; starred?: boolean };

/** Recursively drop `undefined` values — Firestore rejects them (the client isn't
 *  configured with `ignoreUndefinedProperties`), and a single nested `undefined`
 *  (e.g. an unanswered `learnerPrediction` on a Detective-answer snapshot) would
 *  otherwise fail the whole session write and silently stop live syncing. `null`
 *  is preserved (Firestore accepts it). */
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripUndefined(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v);
    }
    return out as T;
  }
  return value;
}

export async function persistTourSession(session: TourSession): Promise<void> {
  try {
    const { id, ...data } = session;
    // Merge (not replace) so this composes with `persistSessionContextEntries`,
    // which writes the `contextEntries` field on the same doc out-of-band. The
    // session only ever accumulates fields, so merge loses nothing.
    await setDoc(doc(db, COLLECTION, id), stripUndefined({
      ...data,
      lastUpdated: new Date().toISOString(),
    }), { merge: true });
  } catch (err) {
    // Non-fatal — sessionStorage is the primary store.
    // Firestore persistence is for analytics, not reliability.
    console.error('[tour-sessions-store] persist failed:', err);
  }
}

/** Mirror the explorer's Context-Journal snapshots onto their session doc.
 *  Merged (not overwritten) so it composes with the full-session persist, and
 *  keyed by session id. Called as the guest contexts change during a tour. */
export async function persistSessionContextEntries(sessionId: string, contextEntries: ContextEntrySnapshot[]): Promise<void> {
  try {
    await setDoc(
      doc(db, COLLECTION, sessionId),
      stripUndefined({ contextEntries, lastUpdated: new Date().toISOString() }),
      { merge: true },
    );
  } catch (err) {
    console.error('[tour-sessions-store] persist context entries failed:', err);
  }
}

/** Admin: star / unstar a session (marks the real explorer runs). Merged onto
 *  the existing doc so it composes with the live session persistence. */
export async function setSessionStarred(sessionId: string, starred: boolean): Promise<void> {
  try {
    await setDoc(
      doc(db, COLLECTION, sessionId),
      { starred, lastUpdated: new Date().toISOString() },
      { merge: true },
    );
  } catch (err) {
    console.error('[tour-sessions-store] setSessionStarred failed:', err);
    throw err;
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
