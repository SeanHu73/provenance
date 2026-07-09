'use client';

/**
 * Tour-shared Context Detective data (subcollections under the tour):
 *
 *  - guide-questions:  a learner tapped "Send Question to Tour Guide" on a
 *    question the Detective couldn't answer. The guide/admin sees these.
 *  - explored-contexts: a context a learner researched and added to their
 *    journal. Pooled per act so other learners (once they've asked their own
 *    question for that act) can see "Contexts Explored by Others", grouped by
 *    lens. Auto-shown; an admin can hide one later.
 */

import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, where, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PastCategory } from './types';

const TOURS = 'memorial-church-tours';

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clean<T extends Record<string, any>>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ── Questions sent to the tour guide ──

export interface GuideQuestion {
  id: string;
  actId?: string;
  question: string;
  lens: PastCategory;
  learnerTheory?: string;
  resolved?: boolean;
  createdAt?: unknown;
}

export async function sendQuestionToGuide(tourId: string, input: {
  actId?: string; question: string; lens: PastCategory; learnerTheory?: string;
}): Promise<void> {
  const id = newId('gq');
  await setDoc(doc(db, TOURS, tourId, 'guide-questions', id), clean({
    id, actId: input.actId, question: input.question, lens: input.lens,
    learnerTheory: input.learnerTheory || '', resolved: false,
    createdAt: serverTimestamp(),
  }));
}

export function subscribeGuideQuestions(tourId: string, onChange: (qs: GuideQuestion[]) => void): () => void {
  return onSnapshot(collection(db, TOURS, tourId, 'guide-questions'), (snap) => {
    const out: GuideQuestion[] = [];
    snap.forEach((d) => out.push({ ...(d.data() as GuideQuestion), id: d.id }));
    onChange(out);
  }, (err) => console.error('[shared-store] guide-questions failed:', err));
}

export async function setGuideQuestionResolved(tourId: string, id: string, resolved: boolean): Promise<void> {
  await setDoc(doc(db, TOURS, tourId, 'guide-questions', id), { resolved }, { merge: true });
}
export async function deleteGuideQuestion(tourId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, TOURS, tourId, 'guide-questions', id));
}

// ── Contexts explored by others (the shared per-act pool) ──
//
// A learner-added context lands as `pending`. The admin reviews it (and can
// edit the text), then `approved` — only approved contexts appear to other
// learners under "Contexts Explored by Others".

export interface ExploredContext {
  id: string;
  actId?: string;
  lens: PastCategory;
  question: string;
  title: string;
  shortSummary: string;
  longExplanation: string;
  sources: { label: string; url: string }[];
  /** On-demand narration MP3, once anyone has generated it (shared). */
  audioUrl?: string;
  status: 'pending' | 'approved';
  createdAt?: unknown;
}

export type ExploredContextEdit = Pick<ExploredContext, 'lens' | 'question' | 'title' | 'shortSummary' | 'longExplanation' | 'sources'>;

export async function captureExploredContext(tourId: string, input: Omit<ExploredContext, 'id' | 'status' | 'createdAt'>): Promise<void> {
  if (!input.longExplanation?.trim()) return; // nothing worth pooling (e.g. a banked add)
  const id = newId('ec');
  await setDoc(doc(db, TOURS, tourId, 'explored-contexts', id), clean({
    id, actId: input.actId, lens: input.lens, question: input.question,
    title: input.title, shortSummary: input.shortSummary, longExplanation: input.longExplanation,
    sources: input.sources || [], status: 'pending', createdAt: serverTimestamp(),
  }));
}

/** Learner-facing: approved pool for one act only. */
export function subscribeExploredContexts(tourId: string, actId: string | undefined, onChange: (list: ExploredContext[]) => void): () => void {
  const col = collection(db, TOURS, tourId, 'explored-contexts');
  const q = actId ? query(col, where('actId', '==', actId)) : col;
  return onSnapshot(q, (snap) => {
    const out: ExploredContext[] = [];
    snap.forEach((d) => { const e = { ...(d.data() as ExploredContext), id: d.id }; if (e.status === 'approved') out.push(e); });
    onChange(out);
  }, (err) => console.error('[shared-store] explored-contexts failed:', err));
}

/** Admin: the whole pool (pending + approved) for a tour. */
export function subscribeAllExploredContexts(tourId: string, onChange: (list: ExploredContext[]) => void): () => void {
  return onSnapshot(collection(db, TOURS, tourId, 'explored-contexts'), (snap) => {
    const out: ExploredContext[] = [];
    snap.forEach((d) => out.push({ ...(d.data() as ExploredContext), id: d.id }));
    onChange(out);
  }, (err) => console.error('[shared-store] all explored-contexts failed:', err));
}

export async function setExploredContextStatus(tourId: string, id: string, status: 'pending' | 'approved'): Promise<void> {
  await setDoc(doc(db, TOURS, tourId, 'explored-contexts', id), { status }, { merge: true });
}
export async function updateExploredContext(tourId: string, id: string, patch: Partial<ExploredContextEdit> & { audioUrl?: string }): Promise<void> {
  await setDoc(doc(db, TOURS, tourId, 'explored-contexts', id), clean(patch), { merge: true });
}
export async function deleteExploredContext(tourId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, TOURS, tourId, 'explored-contexts', id));
}
