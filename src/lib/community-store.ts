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
  increment,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { ForumQuestion, ForumResponse, ForumResource, ForumIdentity, ResourceLink, ModerationStatus, CommunityShare, CommunityComment } from './types';

const QUESTIONS = 'memorial-church-community-questions';
const RESPONSES = 'memorial-church-community-responses';
const RESOURCES = 'memorial-church-community-resources';
const SHARES = 'memorial-church-community-shares';
const COMMENTS = 'memorial-church-community-comments';
const IDENTITY_KEY = 'provenance-forum-identity';
const LIKED_KEY = 'provenance-forum-liked';
const UPVOTED_KEY = 'provenance-share-upvoted';

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

// ── Question likes (per-device, localStorage tracks which were liked) ──

/** The set of question IDs this device has liked. Drives the filled-heart
 *  state and prevents the like count from double-counting one device. */
export function getLikedQuestionIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LIKED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveLikedQuestionIds(ids: Set<string>): void {
  try { localStorage.setItem(LIKED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

/** Bump a question's like count atomically. `liked` true = +1, false = -1.
 *  The caller owns the per-device liked-set (localStorage); this only writes
 *  the shared count. */
export async function setQuestionLike(id: string, liked: boolean): Promise<void> {
  await updateDoc(doc(db, QUESTIONS, id), { likes: increment(liked ? 1 : -1) });
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
  actId: string,
  text: string,
  sessionId: string,
  identity?: { name?: string; about?: string },
): Promise<void> {
  const id = newId('cq');
  const data = cleanUndefined({
    tourId, actId, text, sessionId,
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

// ─── Community shares + comments ("Hear from the Community") ──────────
// The per-act reflection-sharing surface that replaces the old question forum.
// Shares + comments are created `approved` (they appear immediately); admins
// can still hide/remove them in /admin/community. Collections:
//   memorial-church-community-shares, memorial-church-community-comments
// Both need their own Firestore console rule blocks (allow read, write: if true)
// or reads/writes fail silently.

/** A share photo. Reuses the resources upload path — harmless, same bucket. */
export async function uploadSharePhoto(file: File): Promise<string> {
  const path = `memorial-church/community/shares/${newId('img')}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ── Upvotes (per-device, localStorage tracks which were upvoted) ──

export function getUpvotedShareIds(): Set<string> {
  try {
    const raw = localStorage.getItem(UPVOTED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function saveUpvotedShareIds(ids: Set<string>): void {
  try { localStorage.setItem(UPVOTED_KEY, JSON.stringify([...ids])); } catch { /* ignore */ }
}

/** Bump a share's upvote count atomically. `up` true = +1, false = -1. */
export async function upvoteShare(id: string, up: boolean): Promise<void> {
  await updateDoc(doc(db, SHARES, id), { upvotes: increment(up ? 1 : -1) });
}

// ── Submit (explorer) — created `approved` so they appear immediately ──

/** Share an act reflection. Returns the new share id (stored on the session
 *  so we know not to re-prompt the explorer to share). */
export async function submitShare(input: {
  tourId: string;
  actId: string;
  promptId?: string | null;
  promptText?: string;
  isCustom?: boolean;
  text: string;
  photos: string[];
  pin?: { lat: number; lng: number; title?: string; note?: string } | null;
  sessionId: string;
  name?: string;
  about?: string;
}): Promise<string> {
  const id = newId('cs');
  const data = cleanUndefined({
    tourId: input.tourId,
    actId: input.actId,
    promptId: input.promptId ?? undefined,
    promptText: input.promptText,
    isCustom: input.isCustom,
    text: input.text,
    photos: input.photos,
    pin: input.pin ? cleanUndefined(input.pin) : null,
    sessionId: input.sessionId,
    name: input.name,
    about: input.about,
    upvotes: 0,
    status: 'approved' as ModerationStatus,
    createdAt: new Date().toISOString(),
  });
  await setDoc(doc(db, SHARES, id), data);
  return id;
}

/** Record a reflection to the community as *unshared* — hidden from other
 *  explorers, but kept so the admin can see every response. Anonymous (no name).
 *  Returns the new doc id; if the explorer later shares, `promoteUnsharedShare`
 *  flips this same doc to a normal share. */
export async function recordUnsharedResponse(input: {
  tourId: string;
  actId: string;
  promptId?: string | null;
  promptText?: string;
  isCustom?: boolean;
  text: string;
  photos: string[];
  pin?: { lat: number; lng: number; title?: string; note?: string } | null;
  sessionId: string;
}): Promise<string> {
  const id = newId('cs');
  const data = cleanUndefined({
    tourId: input.tourId,
    actId: input.actId,
    promptId: input.promptId ?? undefined,
    promptText: input.promptText,
    isCustom: input.isCustom,
    text: input.text,
    photos: input.photos,
    pin: input.pin ? cleanUndefined(input.pin) : null,
    sessionId: input.sessionId,
    upvotes: 0,
    status: 'approved' as ModerationStatus,
    unshared: true,
    createdAt: new Date().toISOString(),
  });
  await setDoc(doc(db, SHARES, id), data);
  return id;
}

/** Promote a previously-unshared response to a published share: clear the
 *  `unshared` flag and refresh its content (the reflection may have gained a
 *  name, pin, or photos since it was first recorded). */
export async function promoteUnsharedShare(id: string, patch: {
  text: string;
  photos: string[];
  pin?: { lat: number; lng: number; title?: string; note?: string } | null;
  name?: string;
  about?: string;
}): Promise<void> {
  await updateDoc(doc(db, SHARES, id), cleanUndefined({
    text: patch.text,
    photos: patch.photos,
    pin: patch.pin ? cleanUndefined(patch.pin) : null,
    name: patch.name,
    about: patch.about,
    unshared: false,
  }));
}

export async function submitComment(
  shareId: string,
  tourId: string,
  text: string,
  sessionId: string,
  identity?: { name?: string },
): Promise<void> {
  const id = newId('cc');
  const data = cleanUndefined({
    shareId, tourId, text, sessionId,
    name: identity?.name,
    status: 'approved' as ModerationStatus,
    createdAt: new Date().toISOString(),
  });
  await setDoc(doc(db, COMMENTS, id), data);
}

// ── Read (explorer — approved only) ──

/** Every published share for a tour, across all acts. The community wall is now
 *  the tour's closing screen and groups by question rather than by act, so it
 *  reads the whole tour — including reflections recorded before the prompts were
 *  merged, which carry an act but no prompt. (This replaces the per-act
 *  `getShares`; nothing asks for one act's shares any more.) */
export async function getSharesForTour(tourId: string): Promise<CommunityShare[]> {
  try {
    const snap = await getDocs(query(collection(db, SHARES), where('tourId', '==', tourId), where('status', '==', 'approved')));
    const out: CommunityShare[] = [];
    // Unshared records are recorded for the admin only — never surface them to
    // other explorers.
    snap.forEach((d) => { const s = { id: d.id, ...d.data() } as CommunityShare; if (!s.unshared) out.push(s); });
    // Most upvoted first, then most recent.
    out.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0) || (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getSharesForTour failed:', err);
    return [];
  }
}

export async function getComments(shareId: string): Promise<CommunityComment[]> {
  try {
    const snap = await getDocs(query(collection(db, COMMENTS), where('shareId', '==', shareId), where('status', '==', 'approved')));
    const out: CommunityComment[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as CommunityComment));
    out.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getComments failed:', err);
    return [];
  }
}

// ── Moderation (admin — all statuses) ──

export async function getAllShares(): Promise<CommunityShare[]> {
  try {
    const snap = await getDocs(collection(db, SHARES));
    const out: CommunityShare[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as CommunityShare));
    out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getAllShares failed:', err);
    return [];
  }
}

export async function getAllComments(): Promise<CommunityComment[]> {
  try {
    const snap = await getDocs(collection(db, COMMENTS));
    const out: CommunityComment[] = [];
    snap.forEach((d) => out.push({ id: d.id, ...d.data() } as CommunityComment));
    out.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    return out;
  } catch (err) {
    console.error('[community-store] getAllComments failed:', err);
    return [];
  }
}

export async function setShareStatus(id: string, status: ModerationStatus): Promise<void> {
  await updateDoc(doc(db, SHARES, id), { status });
}

export async function deleteShare(id: string): Promise<void> {
  await deleteDoc(doc(db, SHARES, id));
}

export async function deleteComment(id: string): Promise<void> {
  await deleteDoc(doc(db, COMMENTS, id));
}
