import { ref, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Delete a Firebase Storage object given its download URL. Safe to call with
 * anything: it no-ops for empty values, for non-Firebase URLs (e.g. an
 * external/pasted link), and for files that are already gone. Never throws —
 * cleanup should never block the user action that triggered it.
 */
export async function deleteStorageFileByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  // Only touch our own Storage bucket; leave external/pasted links alone.
  if (!/firebasestorage\.googleapis\.com|storage\.googleapis\.com/.test(url)) return;
  try {
    await deleteObject(ref(storage, url));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    // "already gone" is a success for our purposes.
    if (code !== 'storage/object-not-found') {
      console.error('[storage] delete failed for', url, err);
    }
  }
}
