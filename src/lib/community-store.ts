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
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { ForumQuestion, ForumResponse, ForumResource, ForumIdentity, ResourceLink, ModerationStatus } from './types';

const QUESTIONS = 'memorial-church-community-questions';
const RESPONSES = 'memorial-church-community-responses';
const RESOURCES = 'memorial-church-community-resources';
const IDENTITY_KEY = 'provenance-forum-identity';

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
  // Firestore rejects `undefined`; drop those keys.
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ── Forum identity (per-device, localStorage) ──

export function getForumIdentity(): ForumIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ForumIdentity;
    if (!parsed.name) return null;
    return { name: parsed.name, about: parsed.about || '' };
  } catch {
    return null;
  }
}

export function saveForumIdentity(identity: ForumIdentity): void {
  try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity)); } catch { /* ignore */ }
}

// ── Photo upload (resources) ──

export async function uploadCommunityPhoto(file: File): Promise<string> {
  const path = `memorial-church/community/resources/${newId('img')}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ── Submit (explorer) ──

export async function submitForumQuestion(
  tourId: string,
  text: string,
  sessionId: string,
  identity?: { name?: string; about?: string },
): Promise<void> {
  const id = newId('cq');
  const data = cleanUndefined({
    tourId, text, sessionId,
    name: identity?.name,
    about: identity?.about,
    status: 'pending' as ModerationStatus,
    createdAt: new Date().toISOString(),
  });
  await setDoc(doc(db, QUESTIONS, id), data);
}

export async function submitForumResponse(
  questionId: string,
  tourId: string,
  text: string,
  sessionId: string,
  identity?: { name?: string; about?: string },
): Promise<void> {
  const id = newId('cr');
  const data = cleanUndefined({
    questionId, tourId, text, sessionId,
    name: identity?.name,
    about: identity?.about,
    status: 'pending' as ModerationStatus,
    createdAt: new Date().toISOString(),
  });
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

// ── Resources ──

export async function getApprovedResources(tourId: string): Promise<ForumResource[]> {
  try {
    const snap = await getDocs(query(collection(db, RESOURCES), where('tourId', '==', tourId), where('status', '==', 'approved')));
    const out: ForumResource[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as ForumResource));
    // Admin (curated) resources first, then by creation time.
    out.sort((a, b) => (a.source === b.source ? (a.createdAt || '').localeCompare(b.createdAt || '') : a.source === 'admin' ? -1 : 1));
    return out;
  } catch (err) {
    console.error('[community-store] getApprovedResources failed:', err);
    return [];
  }
}

export async function getAllResources(): Promise<ForumResource[]> {
  try {
    const snap = await getDocs(collection(db, RESOURCES));
    const out: ForumResource[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as ForumResource));
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getAllResources failed:', err);
    return [];
  }
}

/** Admin-curated resource (immediately approved). Returns the new id. */
export async function addAdminResource(input: {
  tourId: string;
  title: string;
  description: string;
  photos: string[];
  links: ResourceLink[];
}): Promise<string> {
  const id = newId('res');
  await setDoc(doc(db, RESOURCES, id), {
    tourId: input.tourId,
    title: input.title,
    description: input.description,
    photos: input.photos,
    links: input.links,
    source: 'admin',
    status: 'approved' as ModerationStatus,
    createdAt: new Date().toISOString(),
  });
  return id;
}

/** Explorer-submitted resource (pending moderation). */
export async function submitUserResource(input: {
  tourId: string;
  title: string;
  description: string;
  photos: string[];
  links: ResourceLink[];
  sessionId: string;
  name?: string;
}): Promise<void> {
  const id = newId('res');
  const data = cleanUndefined({
    tourId: input.tourId,
    title: input.title,
    description: input.description,
    photos: input.photos,
    links: input.links,
    source: 'user' as const,
    status: 'pending' as ModerationStatus,
    sessionId: input.sessionId,
    name: input.name,
    createdAt: new Date().toISOString(),
  });
  await setDoc(doc(db, RESOURCES, id), data);
}

export async function setResourceStatus(id: string, status: ModerationStatus): Promise<void> {
  await updateDoc(doc(db, RESOURCES, id), { status });
}

export async function deleteResource(id: string): Promise<void> {
  await deleteDoc(doc(db, RESOURCES, id));
}

/** Admin edit of a resource's content (incl. adding photos / links). */
export async function updateResource(id: string, patch: Partial<Pick<ForumResource, 'title' | 'description' | 'photos' | 'links'>>): Promise<void> {
  await updateDoc(doc(db, RESOURCES, id), patch);
}
