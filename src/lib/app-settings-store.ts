/**
 * App-wide settings — one Firestore document that every instance reads.
 *
 * This is the "switch it once, it's on for everyone" store. A per-device flag
 * (localStorage, like `dev-jump.ts`) only changes the phone it was tapped on;
 * the Detective's research backend has to change for *all* explorers at once,
 * including ones mid-tour on other devices, so the setting lives server-side and
 * the API route reads it per request.
 *
 * NOTE: Firestore security rules are per-collection in this project.
 * `memorial-church-app-settings` needs its own `match` block in the Firebase
 * console (allow read, write: if true;) or reads/writes fail silently — and a
 * silent read failure here means the default backend, not an error.
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import type { ResearchBackend } from './types';

const COLLECTION = 'memorial-church-app-settings';
const DOC_ID = 'global';

/** The Detective's original pipeline. Anything unset or unreadable lands here —
 *  the known-good path is the one to fail towards. */
export const DEFAULT_RESEARCH_BACKEND: ResearchBackend = 'claude';

export interface AppSettings {
  researchBackend: ResearchBackend;
  /** ISO timestamp of the last change, so the admin can see when it flipped. */
  updatedAt: string | null;
}

const settingsDoc = () => doc(db, COLLECTION, DOC_ID);

function normalise(data: Record<string, unknown> | undefined): AppSettings {
  const backend = data?.researchBackend;
  return {
    researchBackend: backend === 'perplexity' ? 'perplexity' : DEFAULT_RESEARCH_BACKEND,
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null,
  };
}

/** Read the global settings. Used by the API route on every Detective ask (one
 *  small read against a pipeline that runs for seconds) and by the admin toggle
 *  for its initial state. Never throws — a failure returns the defaults. */
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const snap = await getDoc(settingsDoc());
    return normalise(snap.exists() ? snap.data() : undefined);
  } catch (err) {
    console.error('[app-settings] read failed, using defaults:', err);
    return { researchBackend: DEFAULT_RESEARCH_BACKEND, updatedAt: null };
  }
}

/** Which research backend the Detective should use right now. */
export async function getResearchBackend(): Promise<ResearchBackend> {
  return (await getAppSettings()).researchBackend;
}

/** Flip the backend for every explorer, everywhere, until it is flipped again. */
export async function setResearchBackend(backend: ResearchBackend): Promise<void> {
  await setDoc(settingsDoc(), { researchBackend: backend, updatedAt: new Date().toISOString() }, { merge: true });
}

/** Live subscription — so a toggle flipped on one device shows as flipped on
 *  another without a reload. Returns the unsubscribe. */
export function subscribeAppSettings(onChange: (settings: AppSettings) => void): () => void {
  try {
    return onSnapshot(
      settingsDoc(),
      (snap) => onChange(normalise(snap.exists() ? snap.data() : undefined)),
      (err) => console.error('[app-settings] subscribe failed:', err),
    );
  } catch (err) {
    console.error('[app-settings] subscribe failed:', err);
    return () => { /* nothing to unsubscribe */ };
  }
}
