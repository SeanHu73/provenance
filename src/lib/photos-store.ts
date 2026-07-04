/**
 * Photo data layer — CRUD over `memorial-church-photos` in Firestore.
 *
 * Introduced by the photo_extraction_v1 migration. Each document in the
 * collection is a `Photo` record (see src/lib/types.ts). Doc keys are the
 * Photo.id (a UUID minted when the photo is created).
 *
 * The learner-facing app does NOT read this collection yet — it still reads
 * `pin.photos` for backward compatibility. /admin/photos is responsible for
 * writing back to both places until retrieval is cut over in a later change.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { deleteStorageFileByUrl } from './storage-utils';
import { Photo } from './types';

const PHOTOS_COLLECTION = 'memorial-church-photos';

/**
 * Mint a reasonably unique id for a new Photo. Uses crypto.randomUUID when
 * available, falling back to a timestamp + random string. Doc keys need to
 * be URL-safe and unique across the admin session; they don't need the
 * strong guarantees of a v4 UUID.
 */
export function newPhotoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `photo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getPhotos(): Promise<Photo[]> {
  try {
    const snap = await getDocs(collection(db, PHOTOS_COLLECTION));
    const photos: Photo[] = [];
    snap.forEach((d) => photos.push({ id: d.id, ...d.data() } as Photo));
    return photos;
  } catch (err) {
    console.error('[photos-store] getPhotos failed:', err);
    return [];
  }
}

export async function getPhoto(id: string): Promise<Photo | null> {
  const snap = await getDoc(doc(db, PHOTOS_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Photo;
}

/**
 * Write a photo. Stamps updatedAt automatically. If createdAt is missing
 * (e.g., first save of a freshly-minted record), it's initialised to now.
 */
export async function savePhoto(photo: Photo): Promise<Photo> {
  const now = new Date().toISOString();
  const next: Photo = {
    ...photo,
    createdAt: photo.createdAt || now,
    updatedAt: now,
  };
  // Strip id from the payload — id is the doc key.
  const { id, ...data } = next;
  await setDoc(doc(db, PHOTOS_COLLECTION, id), data);
  return next;
}

export async function deletePhoto(id: string): Promise<void> {
  // The photo library is the source of truth for photos, so deleting here also
  // removes the underlying Storage blob (best-effort; external URLs are left).
  // NOTE: this frees the file for good — any tour still referencing it will show
  // a broken image, which is the intended meaning of deleting from the library.
  try {
    const snap = await getDoc(doc(db, PHOTOS_COLLECTION, id));
    if (snap.exists()) await deleteStorageFileByUrl((snap.data() as Photo).url);
  } catch (err) {
    console.error('[photos-store] blob delete failed:', err);
  }
  await deleteDoc(doc(db, PHOTOS_COLLECTION, id));
}
