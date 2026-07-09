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
  collection, doc, setDoc, onSnapshot, query, where, serverTimestamp,
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

// ── Contexts explored by others (the shared per-act pool) ──

export interface ExploredContext {
  id: string;
  actId?: string;
  lens: PastCategory;
  question: string;
  title: string;
  shortSummary: string;
  longExplanation: string;
  sources: { label: string; url: string }[];
  hidden?: boolean;
  createdAt?: unknown;
}

export async function captureExploredContext(tourId: string, input: Omit<ExploredContext, 'id' | 'hidden' | 'createdAt'>): Promise<void> {
  if (!input.longExplanation?.trim()) return; // nothing worth pooling (e.g. a banked add)
  const id = newId('ec');
  await setDoc(doc(db, TOURS, tourId, 'explored-contexts', id), clean({
    id, actId: input.actId, lens: input.lens, question: input.question,
    title: input.title, shortSummary: input.shortSummary, longExplanation: input.longExplanation,
    sources: input.sources || [], hidden: false, createdAt: serverTimestamp(),
  }));
}

/** Live pool for one act (client filters `hidden`). Pass no actId to get all. */
export function subscribeExploredContexts(tourId: string, actId: string | undefined, onChange: (list: ExploredContext[]) => void): () => void {
  const col = collection(db, TOURS, tourId, 'explored-contexts');
  const q = actId ? query(col, where('actId', '==', actId)) : col;
  return onSnapshot(q, (snap) => {
    const out: ExploredContext[] = [];
    snap.forEach((d) => { const e = { ...(d.data() as ExploredContext), id: d.id }; if (!e.hidden) out.push(e); });
    onChange(out);
  }, (err) => console.error('[shared-store] explored-contexts failed:', err));
}

export async function setExploredContextHidden(tourId: string, id: string, hidden: boolean): Promise<void> {
  await setDoc(doc(db, TOURS, tourId, 'explored-contexts', id), { hidden }, { merge: true });
}
