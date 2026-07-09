/**
 * A tiny durable cache for authored Add-Context embeddings, keyed by a hash of
 * the exact text embedded. Authored contexts barely change, so this stops the
 * retrieval step re-embedding (and re-billing) every one of them on every
 * question — only the (unique) question is embedded per ask. A text edit changes
 * the hash, so a stale vector is never served.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { hashText } from '@/lib/tts-text';

const COLLECTION = 'context-embeddings';

export function embeddingKey(text: string): string {
  return hashText(text);
}

/** Fetch any cached embeddings for these hashes. Returns hash → vector. */
export async function getCachedEmbeddings(hashes: string[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  const unique = [...new Set(hashes)];
  await Promise.all(unique.map(async (h) => {
    try {
      const snap = await getDoc(doc(db, COLLECTION, h));
      if (snap.exists()) {
        const e = snap.data().embedding;
        if (Array.isArray(e)) map.set(h, e as number[]);
      }
    } catch { /* a cache miss is fine — we'll embed it */ }
  }));
  return map;
}

/** Persist a freshly-computed embedding for reuse (fire-and-forget). */
export async function putCachedEmbedding(hash: string, embedding: number[]): Promise<void> {
  try {
    await setDoc(doc(db, COLLECTION, hash), { embedding });
  } catch (err) {
    console.error('[embed-cache] put failed:', err);
  }
}
