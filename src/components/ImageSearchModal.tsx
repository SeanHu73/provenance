'use client';

/**
 * Shared "find a photo online" picker — searches the app's `/api/image-search`
 * endpoint (Wikimedia Commons) and hands back the chosen full-size image URL.
 * Used by the reflection card and the Context Journal's "Ask your own question"
 * flow so both offer the same picker.
 */

import { useState } from 'react';

/** Mirrors the /api/image-search response item (kept local to avoid importing a
 *  server route module into the client). */
interface ImageResult { id: string; title: string; thumbUrl: string; fullUrl: string; credit: string }

interface Props {
  onClose: () => void;
  /** `credit` is the Commons attribution, for callers that store it. */
  onPick: (url: string, credit?: string) => void;
}

export default function ImageSearchModal({ onClose, onPick }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ImageResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    setBusy(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/image-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(Array.isArray(data.results) ? data.results : []);
    } catch {
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1300] flex flex-col" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative mt-auto w-full max-w-lg mx-auto bg-warm-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '88vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <input
            value={q} onChange={(e) => setQ(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void run(); } }}
            placeholder="Search for a photo…"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-white text-sm" style={{ borderColor: 'var(--th-border)' }}
          />
          <button onClick={() => void run()} disabled={busy || !q.trim()} className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: 'var(--th-primary)' }}>
            {busy ? '…' : 'Search'}
          </button>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-black/5 text-2xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {busy ? (
            <p className="text-center text-sm text-text-muted py-8">Searching…</p>
          ) : results.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-8">{searched ? 'No images found — try different words.' : 'Search for a photo to attach.'}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {results.map((r) => (
                <button key={r.id} onClick={() => onPick(r.fullUrl, r.credit)} className="text-left rounded-lg overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbUrl} alt={r.title} className="w-full h-28 object-cover" />
                  <p className="px-2 py-1 text-[10px] text-text-muted truncate">{r.credit}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
