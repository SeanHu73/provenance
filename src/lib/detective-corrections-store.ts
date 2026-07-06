'use client';

/**
 * Admin store for Detective-answer corrections — one doc per reviewed context
 * entry at `memorial-church-detective-corrections/{contextId}`. Kept separate from
 * the learner's session doc so an admin's verdict/note/edit can never be clobbered
 * by the learner's client re-persisting their contexts.
 *
 * NOTE: Firestore rules need a match block for the collection:
 *   match /memorial-church-detective-corrections/{doc} { allow read, write: if true; }
 */

import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DetectiveCorrection } from './types';

const COL = 'memorial-church-detective-corrections';

/** All corrections, keyed by context id for O(1) lookup on the sessions page. */
export async function getAllCorrections(): Promise<Record<string, DetectiveCorrection>> {
  try {
    const snap = await getDocs(collection(db, COL));
    const out: Record<string, DetectiveCorrection> = {};
    snap.forEach((d) => { out[d.id] = { id: d.id, ...d.data() } as DetectiveCorrection; });
    return out;
  } catch (err) {
    console.error('[corrections] getAllCorrections failed:', err);
    return {};
  }
}

export async function saveCorrection(correction: DetectiveCorrection): Promise<void> {
  const { id, ...data } = correction;
  // Firestore rejects `undefined` — round-trip to drop them.
  await setDoc(doc(db, COL, id), JSON.parse(JSON.stringify({ ...data, updatedAt: new Date().toISOString() })));
}
