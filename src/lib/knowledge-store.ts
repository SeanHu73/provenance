'use client';

/**
 * Context Detective knowledge base — one `knowledge-entries` subcollection under
 * each tour document (`memorial-church-tours/{tourId}/knowledge-entries/{id}`),
 * so entries are attached to the tour, never global, and don't bloat or churn
 * the tour doc itself.
 *
 * NOTE: Firestore rules must include a match block for the subcollection:
 *   match /memorial-church-tours/{tourId}/knowledge-entries/{doc} {
 *     allow read, write: if true;
 *   }
 * or reads/writes fail silently.
 */

import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { KnowledgeEntry } from './types';
import { hashText } from './tts-text';

const TOURS = 'memorial-church-tours';
const SUB = 'knowledge-entries';

const entriesRef = (tourId: string) => collection(db, TOURS, tourId, SUB);

export function newKnowledgeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `kb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** The text an entry's embedding is generated from (summary + explanation). */
export function knowledgeEmbedText(e: Pick<KnowledgeEntry, 'shortSummary' | 'longExplanation'>): string {
  return `${e.shortSummary}\n\n${e.longExplanation}`.trim();
}

export function knowledgeEmbedHash(e: Pick<KnowledgeEntry, 'shortSummary' | 'longExplanation'>): string {
  return hashText(knowledgeEmbedText(e));
}

/** Read every knowledge entry for a tour (newest first). */
export async function getKnowledgeEntries(tourId: string): Promise<KnowledgeEntry[]> {
  try {
    const snap = await getDocs(entriesRef(tourId));
    const out: KnowledgeEntry[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as KnowledgeEntry));
    out.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return out;
  } catch (err) {
    console.error('[knowledge-store] getKnowledgeEntries failed:', err);
    return [];
  }
}

/** Create or update an entry. `createdAt`/`updatedAt` are stamped here. */
export async function saveKnowledgeEntry(tourId: string, entry: KnowledgeEntry): Promise<KnowledgeEntry> {
  const now = new Date().toISOString();
  const next: KnowledgeEntry = { ...entry, createdAt: entry.createdAt || now, updatedAt: now };
  const { id, ...data } = next;
  await setDoc(doc(db, TOURS, tourId, SUB, id), data);
  return next;
}

export async function deleteKnowledgeEntry(tourId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, TOURS, tourId, SUB, id));
}

/** Embed text via /api/embed (OpenAI, server-side key). Throws on failure. */
export async function fetchEmbedding(text: string): Promise<{ embedding: number[]; model: string }> {
  const res = await fetch('/api/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const info = await res.json().catch(() => ({}));
    throw new Error(info?.error || `Embedding failed (${res.status})`);
  }
  return res.json();
}

/** Cosine similarity of two equal-length vectors (retrieval lives in code). */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}
