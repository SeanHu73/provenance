'use client';

/**
 * /admin/tours — Tour list and creation.
 *
 * Shows all authored tours in a simple list. Each tour links to its
 * editor at /admin/tours/[id]. "Create new tour" mints a fresh ID
 * and redirects.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tour } from '@/lib/types';
import { getTours, newTourId, saveTour } from '@/lib/tours-store';

export default function ToursListPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getTours().then((t) => {
      setTours(t);
      setLoading(false);
    });
  }, []);

  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const createTour = async () => {
    setCreating(true);
    setError(null);
    try {
      const id = newTourId();
      const now = new Date().toISOString();
      const tour: Tour = {
        id,
        title: 'Untitled Tour',
        subtitle: '',
        guide: { name: '', role: '', initials: '' },
        description: '',
        coverPhotoUrl: '',
        peekAudioUrl: null,
        peekAudioTitle: null,
        location: null,
        stops: [],
        connectionWeb: [],
        backgroundPhotoUrl: null,
        essentialQuestion: null,
        createdAt: now,
        updatedAt: now,
      };
      await saveTour(tour);
      router.push(`/admin/tours/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 border-b border-stone-300 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Tours</h1>
              <p className="text-sm text-stone-600 mt-1">
                Authored stop-by-stop experiences. Each tour follows the
                Seed &rarr; Notice &rarr; Wonder &rarr; Reveal &rarr; Reflect rhythm.
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button
                onClick={createTour}
                disabled={creating}
                className="px-3 py-1.5 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {creating ? 'Creating...' : '+ New tour'}
              </button>
              <Link href="/admin" className="text-blue-700 hover:underline self-center">&larr; Admin</Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 text-red-800 text-sm">
            <strong>Error:</strong> {error}
            {error.includes('permissions') && (
              <p className="mt-1 text-xs">
                Add this Firestore rule: <code className="bg-red-100 px-1 rounded">
                {'match /memorial-church-tours/{doc} { allow read, write: if true; }'}
                </code>
              </p>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-stone-600 text-sm">Loading tours...</p>
        ) : tours.length === 0 ? (
          <p className="text-stone-600 text-sm italic">
            No tours yet. Create one to start authoring stops.
          </p>
        ) : (
          <ul className="space-y-3">
            {tours.map((tour) => (
              <li key={tour.id}>
                <Link
                  href={`/admin/tours/${tour.id}`}
                  className="block p-4 rounded border border-stone-300 bg-white hover:border-blue-500 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-lg">{tour.title || <em className="text-stone-400">Untitled</em>}</h2>
                      {tour.subtitle && (
                        <p className="text-sm text-stone-500">{tour.subtitle}</p>
                      )}
                    </div>
                    <div className="text-right text-xs text-stone-500">
                      <div>{tour.stops.length} stop{tour.stops.length !== 1 ? 's' : ''}</div>
                      {tour.guide.name && <div className="mt-0.5">Guide: {tour.guide.name}</div>}
                      <div className="mt-0.5">
                        Updated {new Date(tour.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
