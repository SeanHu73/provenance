'use client';

/**
 * Background Context Detective research jobs.
 *
 * The heavy /api/context-answer pass can take a minute or three. This singleton
 * store owns the in-flight requests so a learner can close the ask sheet, keep
 * exploring other contexts, and be pulled back the moment an answer lands — the
 * fetch lives here, not in the (unmountable) ask modal. Survives in-app
 * navigation; a full page reload drops jobs (acceptable — they'd re-ask).
 */

import { useEffect, useState } from 'react';
import type { PastCategory } from './types';

export interface DetectiveResp {
  status?: 'answered' | 'banked' | 'declined';
  narrative?: string;
  handout?: { cards?: { lens?: PastCategory; title?: string; summary?: string; explanation?: string; imageUrl?: string; imageCredit?: string }[] } | null;
  sources?: { kind?: string; url?: string; name?: string; author?: string; date?: string; verified?: boolean; consulted?: boolean }[];
}

export interface ResearchJob {
  id: string;
  question: string;
  originalQuestion: string;
  lens: PastCategory;
  tourId: string;
  actId?: string;
  priorStops?: string[];
  theory: string;
  /** What made the learner ask this (their reason), captured while it researches. */
  motivation: string;
  status: 'researching' | 'ready' | 'error';
  result: DetectiveResp | null;
  /** True once the learner has opened the finished result (stops the overlay nagging). */
  seen: boolean;
  startedAt: number;
}

let jobs: ResearchJob[] = [];
const controllers = new Map<string, AbortController>();
const subs = new Set<() => void>();
const emit = () => subs.forEach((s) => s());

function patch(id: string, p: Partial<ResearchJob>) {
  jobs = jobs.map((j) => (j.id === id ? { ...j, ...p } : j));
  emit();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function startResearch(input: {
  question: string;
  originalQuestion: string;
  lens: PastCategory;
  tourId: string;
  actId?: string;
  priorStops?: string[];
  theory?: string;
}): string {
  const id = newId();
  const ctrl = new AbortController();
  controllers.set(id, ctrl);
  jobs = [...jobs, {
    id, question: input.question, originalQuestion: input.originalQuestion, lens: input.lens,
    tourId: input.tourId, actId: input.actId, priorStops: input.priorStops,
    theory: input.theory ?? '', motivation: '', status: 'researching', result: null, seen: false, startedAt: Date.now(),
  }];
  emit();

  fetch('/api/context-answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: input.question, originalQuestion: input.originalQuestion,
      tourId: input.tourId, actId: input.actId, lens: input.lens, priorStops: input.priorStops,
    }),
    signal: ctrl.signal,
  })
    .then((r) => (r.ok ? r.json() : { status: 'banked' }))
    .then((data: DetectiveResp) => patch(id, { status: 'ready', result: data }))
    .catch((err) => {
      if (err?.name === 'AbortError') return;
      patch(id, { status: 'error', result: { status: 'banked' } });
    })
    .finally(() => controllers.delete(id));

  return id;
}

/**
 * Seed an already-finished answer as a job, so it can be opened through the
 * ordinary ask flow.
 *
 * The opening investigation researches its questions in its own persistent queue
 * (this store is memory-only, and its answers have to survive a whole act). That
 * left them with nowhere to be *read*: they had a narrative and nothing else — no
 * generated title, no photo, no audio bar, no sources, no Add to Context —
 * because all of that lives in the ask flow, and the ask flow only knows how to
 * read a job. So the stored answer becomes one here.
 *
 * Keyed by the question's own id, so reopening the same question returns the same
 * job rather than stacking duplicates.
 */
export function adoptResearch(input: {
  key: string;
  question: string;
  lens: PastCategory;
  tourId: string;
  actId?: string;
  result: DetectiveResp;
}): string {
  const id = `adopted_${input.key}`;
  if (jobs.some((j) => j.id === id)) {
    patch(id, { result: input.result, status: 'ready' });
    return id;
  }
  jobs = [...jobs, {
    id, question: input.question, originalQuestion: input.question, lens: input.lens,
    tourId: input.tourId, actId: input.actId, priorStops: undefined,
    theory: '', motivation: '', status: 'ready', result: input.result, seen: false, startedAt: Date.now(),
  }];
  emit();
  return id;
}

/** Keep the learner's evolving theory on the job so it survives closing the sheet. */
export function setJobTheory(id: string, theory: string) { patch(id, { theory }); }
/** Same, for their "what made you ask this" reason. */
export function setJobMotivation(id: string, motivation: string) { patch(id, { motivation }); }
/** Mark a finished job opened — the ready overlay stops flagging it. */
export function markSeen(id: string) { patch(id, { seen: true }); }
/** Abort an in-flight job and forget it (learner chose to change the question). */
export function cancelJob(id: string) {
  controllers.get(id)?.abort();
  controllers.delete(id);
  jobs = jobs.filter((j) => j.id !== id);
  emit();
}
/** Drop a finished job from the tray once the learner is done with it. */
export function dismissJob(id: string) {
  jobs = jobs.filter((j) => j.id !== id);
  emit();
}

export function getJob(id: string): ResearchJob | undefined { return jobs.find((j) => j.id === id); }

/** Subscribe to the job list (re-renders on any change). */
export function useResearchJobs(): ResearchJob[] {
  const [, force] = useState(0);
  useEffect(() => {
    const s = () => force((n) => n + 1);
    subs.add(s);
    return () => { subs.delete(s); };
  }, []);
  return jobs;
}

/** Convenience selectors. */
export const isPending = (j: ResearchJob) => j.status === 'researching';
export const isReadyUnseen = (j: ResearchJob) => j.status !== 'researching' && !j.seen;
