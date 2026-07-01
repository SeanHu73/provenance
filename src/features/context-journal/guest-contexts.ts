'use client';

/**
 * Guest-local store for a learner's added contexts (no accounts yet).
 *
 * In a tour, the contexts a learner adds are NOT persisted to Firestore — they
 * are **session-local to the guest**: kept in `sessionStorage` keyed by the tour
 * (scope) so they survive navigation across acts and the whole tour, and are
 * **reset at tour end** (`resetGuestContexts`) so a repeat run neither shows nor
 * duplicates them. With accounts later, this swaps to a per-account store.
 *
 * Entries are the same `ContextEntry` shape as the Firestore path, so the journal
 * treats both identically. Geometry stays a plain GeoJSON object here (JSON
 * handles the nested coordinate arrays that Firestore rejects — no geo-serialize).
 */

import type { ContextEntry, NewContextEntry } from './types';

const keyFor = (scopeId: string) => `provenance-guest-contexts:${scopeId}`;

type Listener = (entries: ContextEntry[]) => void;
const listeners = new Map<string, Set<Listener>>();

function read(scopeId: string): ContextEntry[] {
  try {
    const raw = sessionStorage.getItem(keyFor(scopeId));
    return raw ? (JSON.parse(raw) as ContextEntry[]) : [];
  } catch {
    return [];
  }
}

function write(scopeId: string, entries: ContextEntry[]): void {
  try {
    sessionStorage.setItem(keyFor(scopeId), JSON.stringify(entries));
  } catch {
    /* ignore quota / unavailable storage */
  }
  listeners.get(scopeId)?.forEach((l) => l(entries));
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `gctx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Subscribe to a scope's guest contexts; emits the current set immediately. */
export function subscribeGuestContexts(scopeId: string, onChange: Listener): () => void {
  let set = listeners.get(scopeId);
  if (!set) { set = new Set(); listeners.set(scopeId, set); }
  set.add(onChange);
  onChange(read(scopeId));
  return () => { set.delete(onChange); };
}

/** Add a guest context; returns its new id. Appears immediately via subscribe. */
export function addGuestContext(scopeId: string, entry: NewContextEntry): string {
  const id = newId();
  const full = { ...entry, id, createdAt: null, updatedAt: null } as ContextEntry;
  write(scopeId, [...read(scopeId), full]);
  return id;
}

/** Patch a guest context (e.g. the learner edits their added copy). */
export function updateGuestContext(scopeId: string, id: string, patch: Partial<NewContextEntry>): void {
  write(scopeId, read(scopeId).map((e) => (e.id === id ? ({ ...e, ...patch } as ContextEntry) : e)));
}

/** Remove a guest context. */
export function deleteGuestContext(scopeId: string, id: string): void {
  write(scopeId, read(scopeId).filter((e) => e.id !== id));
}

/** Clear all guest contexts for a scope — called at tour end. */
export function resetGuestContexts(scopeId: string): void {
  try {
    sessionStorage.removeItem(keyFor(scopeId));
  } catch {
    /* ignore */
  }
  listeners.get(scopeId)?.forEach((l) => l([]));
}
