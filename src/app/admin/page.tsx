'use client';

/**
 * Admin interface for Sean to upload photos and annotate pins.
 *
 * This is a builder-only tool — no auth, no polish, no mobile-first UI.
 * Access via /admin URL. Learners won't stumble on it.
 *
 * Flow:
 *   1. Select an existing pin (or create a new one)
 *   2. See existing photos on that pin, add a new photo
 *   3. Fill in photo metadata, upload file to Firebase Storage
 *   4. Tap on the saved photo to add annotations
 *   5. Each annotation has caption, categories, per-category clues
 *   6. Save writes to memorial-church-pins/<pinId> in Firestore
 */

import { useEffect, useState, useRef } from 'react';
import { Pin, PinPhoto, PhotoAnnotation, QuestionCategory } from '@/lib/types';
import { getPins, savePin } from '@/lib/pins-store';
import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { seedPins } from '@/lib/seed-pins';
import { groupManifestByPin, archivalManifest } from '@/lib/archival-manifest';

const CATEGORIES: QuestionCategory[] = ['who', 'what', 'when', 'where', 'why', 'how'];

const LOCATION_TAGS = [
  'exterior_facade', 'exterior_sides', 'exterior_rear',
  'narthex', 'nave', 'nave_aisles',
  'crossing', 'dome', 'chancel',
  'transepts', 'side_chapel', 'organ_loft',
  'general',
] as const;

// Helper list of known knowledge entry IDs for Sean's reference
const KNOWN_ENTRIES: Array<{ id: string; title: string }> = [
  { id: '1.1', title: 'The Chain of Grief' },
  { id: '1.2', title: 'Jane Stanford: The Woman Who Built the Church' },
  { id: '1.2a', title: 'The University Founding Vision' },
  { id: '1.2b', title: 'The Chinese Railroad Workers' },
  { id: '1.3', title: 'Charles Coolidge: The Young Architect' },
  { id: '1.4', title: 'Camerino and the Salviati Studios' },
  { id: '1.5', title: 'Frederick Stymetz Lamb: Stained Glass' },
  { id: '1.6', title: 'John McGilvray: The Builder' },
  { id: '1.7', title: 'Charles Fisk: Atomic Bombs to Organs' },
  { id: '2.1', title: 'Architecture: Form and Dimensions' },
  { id: '3.1', title: 'The Facade Mosaic' },
  { id: '3.4', title: 'The Pendentive Angels' },
  { id: '3.5', title: 'The Chancel / Last Supper' },
  { id: '3.6', title: 'The Narthex Floor' },
  { id: '6.1', title: 'The 1906 Earthquake' },
];

type View = 'pin-list' | 'photo-form' | 'annotate';

export default function AdminPage() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [view, setView] = useState<View>('pin-list');
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ps = await getPins();
      setPins(ps);
      setLoading(false);
    })();
  }, []);

  const selectedPin = pins.find((p) => p.id === selectedPinId) || null;

  const refreshPins = async () => {
    const ps = await getPins();
    setPins(ps);
  };

  const handlePhotoSaved = async (pin: Pin) => {
    await savePin(pin);
    await refreshPins();
    setStatus('Photo saved to Firestore.');
    setTimeout(() => setStatus(null), 4000);
  };

  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<string | null>(null);

  /**
   * Bulk-import every entry in `src/lib/archival-manifest.ts` into Firestore.
   * Idempotent: skips photos whose URL is already present on the target pin,
   * so re-running after editing the manifest is safe.
   */
  const runBulkImport = async () => {
    if (importing) return;
    if (!confirm(
      `Import ${archivalManifest.length} archival photos from the manifest into Firestore? ` +
      `This merges photos into each target pin. Safe to re-run — duplicates are skipped.`
    )) return;

    setImporting(true);
    setImportReport(null);

    const grouped = groupManifestByPin();
    const currentPins = await getPins();
    const byId = new Map<string, Pin>();
    for (const p of currentPins) byId.set(p.id, p);
    // Also seed any pinIds from the manifest that don't exist yet with their
    // seed-pin baseline, so we don't accidentally create empty shells.
    for (const p of seedPins) if (!byId.has(p.id)) byId.set(p.id, p);

    let pinsWritten = 0;
    let photosAdded = 0;
    let photosSkipped = 0;
    const missingPins: string[] = [];

    for (const [pinId, manifestPhotos] of Object.entries(grouped)) {
      const pin = byId.get(pinId);
      if (!pin) {
        missingPins.push(pinId);
        continue;
      }

      const existingUrls = new Set(pin.photos.map((p) => p.url));
      const newPhotos = manifestPhotos.filter((p) => {
        if (existingUrls.has(p.url)) {
          photosSkipped += 1;
          return false;
        }
        return true;
      });

      if (newPhotos.length === 0) continue;

      const updated: Pin = { ...pin, photos: [...pin.photos, ...newPhotos] };
      await savePin(updated);
      pinsWritten += 1;
      photosAdded += newPhotos.length;
    }

    await refreshPins();
    setImporting(false);
    setImportReport(
      `Import complete. ${photosAdded} photo(s) added to ${pinsWritten} pin(s). ` +
      `${photosSkipped} already present (skipped). ` +
      (missingPins.length ? `Missing pins (not imported): ${missingPins.join(', ')}.` : '')
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 border-b border-stone-300 pb-3">
          <h1 className="text-2xl font-bold">Provenance Admin</h1>
          <p className="text-sm text-stone-600 mt-1">
            Upload photos and annotations. Writes to <code className="bg-stone-200 px-1 rounded">memorial-church-pins</code> in Firestore.
            Not linked from the main app — accessed by URL only.
          </p>
          <nav className="mt-3 text-sm flex gap-4">
            <button onClick={() => { setSelectedPinId(null); setView('pin-list'); setEditingPhotoIndex(null); }} className="text-blue-700 hover:underline">← All pins</button>
            <a href="/admin/photos" className="text-blue-700 hover:underline font-semibold">📷 Photo library →</a>
            <a href="/admin/tours" className="text-blue-700 hover:underline font-semibold">🗺️ Tours →</a>
            <a href="/" className="text-blue-700 hover:underline">Back to main app</a>
          </nav>
        </header>

        {status && (
          <div className="mb-4 p-3 rounded border border-green-300 bg-green-50 text-green-900 text-sm">{status}</div>
        )}

        {/* Bulk archival import — one-shot ingest of /public/photos/archival/
            manifest into Firestore. Safe to re-run (deduped by URL). */}
        <div className="mb-5 p-4 rounded border border-amber-300 bg-amber-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-sm text-amber-900">Bulk import archival photos</h2>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Reads <code className="bg-amber-100 px-1 rounded">src/lib/archival-manifest.ts</code>
                {' '}({archivalManifest.length} entries) and writes each photo into its target pin.
                Photos are served from <code className="bg-amber-100 px-1 rounded">/public/photos/archival/</code>
                {' '}— no Firebase Storage upload. Deduped by URL, safe to re-run.
              </p>
            </div>
            <button
              onClick={runBulkImport}
              disabled={importing}
              className="shrink-0 px-3 py-1.5 rounded bg-amber-700 text-white text-sm hover:bg-amber-800 disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Run import'}
            </button>
          </div>
          {importReport && (
            <p className="mt-3 text-xs text-amber-900 font-mono bg-amber-100 p-2 rounded">{importReport}</p>
          )}
        </div>


        {loading ? (
          <p className="text-stone-600">Loading pins...</p>
        ) : !selectedPinId ? (
          <PinListView
            pins={pins}
            onSelect={(id) => { setSelectedPinId(id); setView('pin-list'); }}
            onCreate={async (newPin) => {
              await savePin(newPin);
              await refreshPins();
              setSelectedPinId(newPin.id);
              setView('pin-list');
            }}
          />
        ) : selectedPin ? (
          <PinDetailView
            pin={selectedPin}
            view={view}
            editingPhotoIndex={editingPhotoIndex}
            onAddPhoto={() => { setEditingPhotoIndex(null); setView('photo-form'); }}
            onEditAnnotations={(idx) => { setEditingPhotoIndex(idx); setView('annotate'); }}
            onSavePhoto={async (photo) => {
              const updated: Pin = { ...selectedPin, photos: [...selectedPin.photos, photo] };
              await handlePhotoSaved(updated);
              setEditingPhotoIndex(updated.photos.length - 1);
              setView('annotate');
            }}
            onUpdateAnnotations={async (annotations) => {
              if (editingPhotoIndex === null) return;
              const photos = [...selectedPin.photos];
              photos[editingPhotoIndex] = { ...photos[editingPhotoIndex], annotations };
              const updated: Pin = { ...selectedPin, photos };
              await handlePhotoSaved(updated);
            }}
            onBack={() => { setView('pin-list'); setEditingPhotoIndex(null); }}
          />
        ) : (
          <p className="text-stone-600">Pin not found.</p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Pin list view — select or create a pin
// ══════════════════════════════════════════════════════════

function PinListView({
  pins, onSelect, onCreate,
}: {
  pins: Pin[];
  onSelect: (id: string) => void;
  onCreate: (pin: Pin) => void | Promise<void>;
}) {
  const [creatingNew, setCreatingNew] = useState(false);
  const [newId, setNewId] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newLat, setNewLat] = useState('37.42700');
  const [newLng, setNewLng] = useState('-122.17020');
  const [newArea, setNewArea] = useState<string>('general');

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim() || !newTitle.trim()) return;
    const pin: Pin = {
      id: newId.trim(),
      title: newTitle.trim(),
      location: {
        lat: parseFloat(newLat) || 37.42700,
        lng: parseFloat(newLng) || -122.17020,
        physicalArea: newArea,
      },
      photos: [],
      inquiry: {
        question: '',
        answer: '',
        suggestedNext: null,
      },
      observationHints: {},
      tags: [],
      era: '',
      databaseEntryIds: [],
    };
    await onCreate(pin);
    setCreatingNew(false);
    setNewId(''); setNewTitle('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Pins ({pins.length})</h2>
        <button
          onClick={() => setCreatingNew(!creatingNew)}
          className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm hover:bg-blue-800"
        >
          {creatingNew ? 'Cancel' : '+ Create new pin'}
        </button>
      </div>

      {creatingNew && (
        <form onSubmit={submitNew} className="mb-6 p-4 border border-stone-300 rounded bg-white space-y-3">
          <h3 className="font-semibold">New pin</h3>
          <div>
            <label className="block text-xs font-medium mb-1">Pin ID (slug, e.g. "west-transept-window")</label>
            <input value={newId} onChange={(e) => setNewId(e.target.value)} required className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Title</label>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Latitude</label>
              <input value={newLat} onChange={(e) => setNewLat(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Longitude</label>
              <input value={newLng} onChange={(e) => setNewLng(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Physical area</label>
              <select value={newArea} onChange={(e) => setNewArea(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm">
                {LOCATION_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm hover:bg-blue-800">Create</button>
        </form>
      )}

      <ul className="space-y-2">
        {pins.map((p) => (
          <li key={p.id}>
            <button
              onClick={() => onSelect(p.id)}
              className="w-full text-left p-3 border border-stone-300 rounded bg-white hover:bg-stone-100 transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-stone-500">{p.id} • {p.location.physicalArea}</div>
                </div>
                <div className="text-xs text-stone-500">
                  {p.photos.length} photo{p.photos.length === 1 ? '' : 's'}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Pin detail view — manage photos for a specific pin
// ══════════════════════════════════════════════════════════

function PinDetailView({
  pin, view, editingPhotoIndex,
  onAddPhoto, onEditAnnotations, onSavePhoto, onUpdateAnnotations, onBack,
}: {
  pin: Pin;
  view: View;
  editingPhotoIndex: number | null;
  onAddPhoto: () => void;
  onEditAnnotations: (idx: number) => void;
  onSavePhoto: (photo: PinPhoto) => void | Promise<void>;
  onUpdateAnnotations: (annotations: PhotoAnnotation[]) => void | Promise<void>;
  onBack: () => void;
}) {
  return (
    <div>
      <header className="mb-4">
        <h2 className="text-xl font-semibold">{pin.title}</h2>
        <p className="text-sm text-stone-600">
          {pin.id} • {pin.location.physicalArea} • {pin.photos.length} photo{pin.photos.length === 1 ? '' : 's'}
        </p>
      </header>

      {view === 'pin-list' && (
        <>
          <div className="mb-4">
            <button
              onClick={onAddPhoto}
              className="px-4 py-2 rounded bg-blue-700 text-white text-sm hover:bg-blue-800"
            >
              + Add photo
            </button>
          </div>
          {pin.photos.length === 0 ? (
            <p className="text-stone-600 text-sm italic">No photos yet. Add one above.</p>
          ) : (
            <ul className="space-y-3">
              {pin.photos.map((photo, idx) => (
                <li key={idx} className="border border-stone-300 rounded bg-white p-3">
                  <div className="flex gap-4">
                    <img src={photo.url} alt={photo.caption} className="w-32 h-32 object-cover rounded border border-stone-200" />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{photo.caption}</div>
                      <div className="text-xs text-stone-500 mt-1">
                        Type: {photo.type} • Credit: {photo.credit}
                        {photo.year ? ` • ${photo.year}` : ''}
                      </div>
                      <div className="text-xs text-stone-500 mt-1">
                        Location: {photo.physicalLocationTag} • Entries: {photo.databaseEntries.join(', ') || '(none)'}
                      </div>
                      <div className="text-xs text-stone-500 mt-1">
                        Categories: {photo.categories.join(', ') || '(none)'} • Annotations: {photo.annotations.length}
                      </div>
                      <button
                        onClick={() => onEditAnnotations(idx)}
                        className="mt-2 text-xs text-blue-700 hover:underline"
                      >
                        {photo.annotations.length === 0 ? 'Add annotations' : 'Edit annotations'}
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === 'photo-form' && (
        <PhotoForm pin={pin} onCancel={onBack} onSave={onSavePhoto} />
      )}

      {view === 'annotate' && editingPhotoIndex !== null && pin.photos[editingPhotoIndex] && (
        <AnnotationEditor
          photo={pin.photos[editingPhotoIndex]}
          onCancel={onBack}
          onSave={onUpdateAnnotations}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Photo form — upload file + metadata
// ══════════════════════════════════════════════════════════

function PhotoForm({
  pin, onCancel, onSave,
}: {
  pin: Pin;
  onCancel: () => void;
  onSave: (photo: PinPhoto) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = String(new Date().getFullYear());

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [type, setType] = useState<'onsite' | 'archival' | 'contributor'>('onsite');
  const [caption, setCaption] = useState('');
  const [credit, setCredit] = useState(`Sean Hu, ${today}`);
  const [source, setSource] = useState('');
  const [year, setYear] = useState(thisYear);
  const [license, setLicense] = useState('All rights reserved — creator\'s work');
  const [physicalLocationTag, setPhysicalLocationTag] = useState(pin.location.physicalArea || 'general');
  const [databaseEntries, setDatabaseEntries] = useState('');
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Adjust credit/license defaults when type changes
  useEffect(() => {
    if (type === 'onsite') {
      setCredit((c) => c.startsWith('Sean Hu') || !c ? `Sean Hu, ${today}` : c);
      setLicense((l) => l || 'All rights reserved — creator\'s work');
    } else if (type === 'archival') {
      setCredit((c) => c === `Sean Hu, ${today}` ? '' : c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const uploadFile = async () => {
    if (!file) {
      setError('Select a file first.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '_');
      const path = `memorial-church/photos/${type}/${Date.now()}_${safeName}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      setUploadedUrl(url);
    } catch (err) {
      console.error(err);
      setError('Upload failed. Check Firebase Storage rules and try again.');
    }
    setUploading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!uploadedUrl) {
      setError('Upload the file before saving.');
      return;
    }
    if (!caption.trim()) {
      setError('Caption is required.');
      return;
    }
    if (type === 'archival' && !source.trim()) {
      setError('Source URL is required for archival photos.');
      return;
    }
    if (type === 'archival' && !license.trim()) {
      setError('License is required for archival photos.');
      return;
    }

    const photo: PinPhoto = {
      url: uploadedUrl,
      type,
      caption: caption.trim(),
      credit: credit.trim(),
      source: source.trim() || null,
      year: year.trim() || null,
      license: license.trim() || null,
      physicalLocationTag,
      databaseEntries: databaseEntries.split(',').map((s) => s.trim()).filter(Boolean),
      categories,
      annotations: [],
    };
    await onSave(photo);
  };

  return (
    <form onSubmit={submit} className="border border-stone-300 rounded bg-white p-4 space-y-4">
      <h3 className="font-semibold">Add photo to {pin.title}</h3>

      {error && (
        <div className="p-2 rounded border border-red-300 bg-red-50 text-red-900 text-sm">{error}</div>
      )}

      {/* File upload */}
      <div>
        <label className="block text-xs font-medium mb-1">Photo file</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="text-sm"
        />
        {file && !uploadedUrl && (
          <button
            type="button"
            onClick={uploadFile}
            disabled={uploading}
            className="ml-3 px-3 py-1 rounded bg-blue-700 text-white text-xs hover:bg-blue-800 disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        )}
        {uploadedUrl && (
          <div className="mt-2">
            <img src={uploadedUrl} alt="uploaded" className="max-h-48 border border-stone-300 rounded" />
            <p className="text-xs text-green-700 mt-1">Uploaded. URL saved.</p>
          </div>
        )}
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-medium mb-1">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="px-2 py-1.5 border border-stone-300 rounded text-sm">
          <option value="onsite">onsite</option>
          <option value="archival">archival</option>
          <option value="contributor">contributor</option>
        </select>
      </div>

      {/* Caption */}
      <div>
        <label className="block text-xs font-medium mb-1">Caption (what the learner reads) <span className="text-red-600">*</span></label>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} required className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
      </div>

      {/* Credit */}
      <div>
        <label className="block text-xs font-medium mb-1">Credit</label>
        <input value={credit} onChange={(e) => setCredit(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
      </div>

      {/* Source / Year / License */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Source URL {type === 'archival' && <span className="text-red-600">*</span>}</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="https://..." className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Year</label>
          <input value={year} onChange={(e) => setYear(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">License {type === 'archival' && <span className="text-red-600">*</span>}</label>
          <input value={license} onChange={(e) => setLicense(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
        </div>
      </div>

      {/* Physical location */}
      <div>
        <label className="block text-xs font-medium mb-1">Physical location tag</label>
        <select value={physicalLocationTag} onChange={(e) => setPhysicalLocationTag(e.target.value)} className="px-2 py-1.5 border border-stone-300 rounded text-sm">
          {LOCATION_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Database entries */}
      <div>
        <label className="block text-xs font-medium mb-1">Database entries (comma-separated IDs, e.g. 3.1, 6.1)</label>
        <input value={databaseEntries} onChange={(e) => setDatabaseEntries(e.target.value)} placeholder="3.1, 6.1" className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
        <details className="mt-2">
          <summary className="text-xs text-stone-500 cursor-pointer">Known entry IDs</summary>
          <ul className="text-xs text-stone-600 mt-1 space-y-0.5 max-h-40 overflow-y-auto">
            {KNOWN_ENTRIES.map((e) => <li key={e.id}><code>{e.id}</code> — {e.title}</li>)}
          </ul>
        </details>
      </div>

      {/* Categories */}
      <div>
        <label className="block text-xs font-medium mb-1">Inquiry categories this photo primarily serves</label>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={categories.includes(cat)}
                onChange={() => setCategories((cs) => cs.includes(cat) ? cs.filter((c) => c !== cat) : [...cs, cat])}
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button type="submit" className="px-4 py-2 rounded bg-blue-700 text-white text-sm hover:bg-blue-800">Save photo</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded border border-stone-300 text-sm hover:bg-stone-100">Cancel</button>
      </div>
    </form>
  );
}

// ══════════════════════════════════════════════════════════
// Annotation editor — tap on image to add dots with per-category clues
// ══════════════════════════════════════════════════════════

function AnnotationEditor({
  photo, onCancel, onSave,
}: {
  photo: PinPhoto;
  onCancel: () => void;
  onSave: (annotations: PhotoAnnotation[]) => void | Promise<void>;
}) {
  const [annotations, setAnnotations] = useState<PhotoAnnotation[]>(photo.annotations);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const newAnn: PhotoAnnotation = {
      x, y,
      caption: '',
      categories: [],
      clues: {},
    };
    setAnnotations((ans) => [...ans, newAnn]);
    setEditingIdx(annotations.length);
  };

  const updateAnnotation = (idx: number, patch: Partial<PhotoAnnotation>) => {
    setAnnotations((ans) => ans.map((a, i) => i === idx ? { ...a, ...patch } : a));
  };

  const deleteAnnotation = (idx: number) => {
    setAnnotations((ans) => ans.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const toggleCategory = (idx: number, cat: QuestionCategory) => {
    const ann = annotations[idx];
    const next = ann.categories.includes(cat)
      ? ann.categories.filter((c) => c !== cat)
      : [...ann.categories, cat];
    // Drop clue for unchecked category
    const nextClues = { ...ann.clues };
    if (!next.includes(cat)) delete nextClues[cat];
    updateAnnotation(idx, { categories: next, clues: nextClues });
  };

  const updateClue = (idx: number, cat: QuestionCategory, value: string) => {
    const ann = annotations[idx];
    updateAnnotation(idx, { clues: { ...ann.clues, [cat]: value } });
  };

  return (
    <div className="border border-stone-300 rounded bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Annotate photo</h3>
          <p className="text-xs text-stone-600">Tap the image to place a dot. Then fill in the caption, categories, and per-category clues.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onSave(annotations)}
            className="px-4 py-2 rounded bg-blue-700 text-white text-sm hover:bg-blue-800"
          >
            Save all annotations
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border border-stone-300 text-sm hover:bg-stone-100"
          >
            Close
          </button>
        </div>
      </div>

      <div className="relative inline-block">
        <img
          ref={imgRef}
          src={photo.url}
          alt={photo.caption}
          onClick={handleImageClick}
          className="max-h-[500px] max-w-full border border-stone-300 cursor-crosshair block"
        />
        {annotations.map((a, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setEditingIdx(i); }}
            className={`absolute w-5 h-5 rounded-full border-2 border-white shadow-md -translate-x-1/2 -translate-y-1/2 ${editingIdx === i ? 'bg-red-500' : 'bg-blue-600'}`}
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            title={a.caption || `annotation ${i + 1}`}
          >
            <span className="text-white text-[10px] font-bold">{i + 1}</span>
          </button>
        ))}
      </div>

      {annotations.length === 0 && (
        <p className="text-sm text-stone-500 italic">No annotations yet. Click anywhere on the image to add one.</p>
      )}

      {editingIdx !== null && annotations[editingIdx] && (
        <AnnotationForm
          annotation={annotations[editingIdx]}
          index={editingIdx}
          onCaptionChange={(v) => updateAnnotation(editingIdx, { caption: v })}
          onToggleCategory={(cat) => toggleCategory(editingIdx, cat)}
          onClueChange={(cat, v) => updateClue(editingIdx, cat, v)}
          onDelete={() => deleteAnnotation(editingIdx)}
          onClose={() => setEditingIdx(null)}
        />
      )}

      {/* List of all annotations */}
      {annotations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-stone-200">
          <h4 className="text-sm font-semibold mb-2">All annotations</h4>
          <ul className="space-y-1 text-sm">
            {annotations.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <button
                  onClick={() => setEditingIdx(i)}
                  className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center hover:bg-blue-700"
                >
                  {i + 1}
                </button>
                <span className="flex-1 truncate">{a.caption || <em className="text-stone-400">(no caption yet)</em>}</span>
                <span className="text-xs text-stone-500">{a.categories.join(', ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnnotationForm({
  annotation, index, onCaptionChange, onToggleCategory, onClueChange, onDelete, onClose,
}: {
  annotation: PhotoAnnotation;
  index: number;
  onCaptionChange: (v: string) => void;
  onToggleCategory: (cat: QuestionCategory) => void;
  onClueChange: (cat: QuestionCategory, v: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="border border-blue-300 bg-blue-50 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Annotation #{index + 1} — at ({annotation.x.toFixed(1)}%, {annotation.y.toFixed(1)}%)</h4>
        <button onClick={onClose} className="text-xs text-stone-600 hover:underline">Close</button>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Caption (what the learner would see)</label>
        <textarea
          value={annotation.caption}
          onChange={(e) => onCaptionChange(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
          placeholder="e.g. This gold tile looks newer than the surrounding area — restored after 1906."
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Categories this annotation helps answer</label>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={annotation.categories.includes(cat)}
                onChange={() => onToggleCategory(cat)}
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      {annotation.categories.length > 0 && (
        <div className="space-y-2">
          <label className="block text-xs font-medium">Per-category clues (what clue does this annotation offer for each category?)</label>
          {annotation.categories.map((cat) => (
            <div key={cat}>
              <label className="block text-xs text-stone-600 mb-0.5 capitalize">{cat}</label>
              <textarea
                value={annotation.clues[cat] || ''}
                onChange={(e) => onClueChange(cat, e.target.value)}
                rows={2}
                className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
                placeholder={`Clue for "${cat}"...`}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button onClick={onDelete} className="px-3 py-1.5 rounded bg-red-700 text-white text-xs hover:bg-red-800">Delete this annotation</button>
        <button onClick={onClose} className="px-3 py-1.5 rounded bg-stone-600 text-white text-xs hover:bg-stone-700">Done</button>
      </div>
    </div>
  );
}
