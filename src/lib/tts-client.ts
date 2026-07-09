'use client';

/**
 * Client helpers for OpenAI narration.
 *
 * `fetchTtsObjectUrl` calls /api/tts and returns a playable object URL for the
 * generated MP3, memoised per session by a hash of the (sanitized) text — so a
 * replay or re-mount of the same answer doesn't generate (and bill) twice.
 * Used for AI context answers, which are unique per response and generated on
 * demand. Authored stop narration is cached durably in Firebase Storage instead
 * (see the admin "Generate missing narration" flow), not here.
 *
 * `fetchTtsBlob` returns the raw MP3 blob (used by the admin flow, which uploads
 * it to Storage rather than playing it inline).
 */

import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import { hashText, ttsSanitize } from './tts-text';

const objectUrlCache = new Map<string, string>();

/**
 * Generate (or reuse) a DURABLE, shared narration file for the given text. Keyed
 * by a hash of the spoken text in Firebase Storage, so the first learner to play
 * it generates + uploads once and everyone afterwards streams the same file —
 * used for shared surfaces like "Contexts Explored by Others".
 */
export async function fetchTtsPersistentUrl(rawText: string, opts?: { voice?: string; model?: string }): Promise<string> {
  const clean = ttsSanitize(rawText);
  const key = hashText(`${opts?.model || ''}:${opts?.voice || ''}:${clean}`);
  const fileRef = ref(storage, `context-tts/${key}.mp3`);
  try { return await getDownloadURL(fileRef); } catch { /* not generated yet — make it */ }
  const blob = await fetchTtsBlob(clean, opts);
  await uploadBytes(fileRef, blob, { contentType: 'audio/mpeg' });
  return getDownloadURL(fileRef);
}

export async function fetchTtsBlob(text: string, opts?: { voice?: string; model?: string }): Promise<Blob> {
  const res = await fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice: opts?.voice, model: opts?.model }),
  });
  if (!res.ok) {
    const info = await res.json().catch(() => ({}));
    throw new Error(info?.error || `TTS request failed (${res.status})`);
  }
  return res.blob();
}

/** Generate (or reuse) a playable object URL for the given text. The input is
 *  sanitized here so the cache key matches what's actually spoken. */
export async function fetchTtsObjectUrl(rawText: string, opts?: { voice?: string; model?: string }): Promise<string> {
  const clean = ttsSanitize(rawText);
  const key = hashText(`${opts?.model || ''}:${opts?.voice || ''}:${clean}`);
  const cached = objectUrlCache.get(key);
  if (cached) return cached;
  const blob = await fetchTtsBlob(clean, opts);
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(key, url);
  return url;
}
