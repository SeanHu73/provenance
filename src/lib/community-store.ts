/**
 * Community Forum data layer.
 *
 * Explorer-submitted questions (`memorial-church-community-questions`) and
 * their responses (`memorial-church-community-responses`), both moderated.
 * Submissions start as `pending`; only `approved` items surface in the
 * explorer Community Forum. Moderation happens in /admin/community.
 *
 * NOTE: Firestore security rules are per-collection in this project. Both
 * collections need their own `match` blocks added in the Firebase console
 * (allow read, write: if true;) or reads/writes fail silently.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { ForumQuestion, ForumResponse, ModerationStatus } from './types';

const QUESTIONS = 'memorial-church-community-questions';
const RESPONSES = 'memorial-church-community-responses';

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Submit (explorer) ──

export async function submitForumQuestion(tourId: string, text: string, sessionId: string): Promise<void> {
  const id = newId('cq');
  const q: ForumQuestion = { id, tourId, text, sessionId, status: 'pending', createdAt: new Date().toISOString() };
  const { id: _omit, ...data } = q;
  void _omit;
  await setDoc(doc(db, QUESTIONS, id), data);
}

export async function submitForumResponse(questionId: string, tourId: string, text: string, sessionId: string): Promise<void> {
  const id = newId('cr');
  const r: ForumResponse = { id, questionId, tourId, text, sessionId, status: 'pending', createdAt: new Date().toISOString() };
  const { id: _omit, ...data } = r;
  void _omit;
  await setDoc(doc(db, RESPONSES, id), data);
}

// ── Read (explorer — approved only) ──

export async function getApprovedQuestions(tourId: string): Promise<ForumQuestion[]> {
  try {
    const snap = await getDocs(query(collection(db, QUESTIONS), where('tourId', '==', tourId), where('status', '==', 'approved')));
    const out: ForumQuestion[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as ForumQuestion));
    out.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getApprovedQuestions failed:', err);
    return [];
  }
}

export async function getApprovedResponses(questionId: string): Promise<ForumResponse[]> {
  try {
    const snap = await getDocs(query(collection(db, RESPONSES), where('questionId', '==', questionId), where('status', '==', 'approved')));
    const out: ForumResponse[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as ForumResponse));
    out.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getApprovedResponses failed:', err);
    return [];
  }
}

// ── Moderation (admin — all statuses) ──

export async function getAllQuestions(): Promise<ForumQuestion[]> {
  try {
    const snap = await getDocs(collection(db, QUESTIONS));
    const out: ForumQuestion[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as ForumQuestion));
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getAllQuestions failed:', err);
    return [];
  }
}

export async function getAllResponses(): Promise<ForumResponse[]> {
  try {
    const snap = await getDocs(collection(db, RESPONSES));
    const out: ForumResponse[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as ForumResponse));
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getAllResponses failed:', err);
    return [];
  }
}

export async function setQuestionStatus(id: string, status: ModerationStatus): Promise<void> {
  await updateDoc(doc(db, QUESTIONS, id), { status });
}

export async function deleteQuestion(id: string): Promise<void> {
  await deleteDoc(doc(db, QUESTIONS, id));
}

export async function setResponseStatus(id: string, status: ModerationStatus): Promise<void> {
  await updateDoc(doc(db, RESPONSES, id), { status });
}

export async function deleteResponse(id: string): Promise<void> {
  await deleteDoc(doc(db, RESPONSES, id));
}
