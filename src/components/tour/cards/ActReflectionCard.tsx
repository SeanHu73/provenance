'use client';

/**
 * End-of-act reflection — "Share Your Thoughts" (redesigned).
 *
 * The learner picks one of the act's authored prompts (swipeable cards) or the
 * "create your own" card, which flips to a response view: a big record button
 * (dictation is transcribed into the textbox to read/edit), an optional textbox,
 * chips to tag the contexts they referred to, and photos — uploaded or found
 * online (Wikimedia Commons). Saving stores the response and moves on to the
 * community ("see what others think"); sharing happens there, not here.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTour } from '@/context/TourContext';
import { findActOfStop, reflectionPromptsOf, getActContexts } from '@/lib/tour-session';
import { ActReflectionResponse } from '@/lib/types';
import { uploadSharePhoto } from '@/lib/community-store';
import { subscribeGuestContexts } from '@/features/context-journal/guest-contexts';
import FormattedText from './FormattedText';

const CUSTOM_PROMPT = 'What piqued your interest? What else would you want to share?';

/** Mirrors the /api/image-search response item (kept local to avoid importing
 *  from a server route module into the client). */
interface ImageResult { id: string; title: string; thumbUrl: string; fullUrl: string; credit: string }

interface Props {
  onComplete: (response: ActReflectionResponse) => void;
}

type Selected = { id: string | null; text: string; isCustom: boolean };

export default function ActReflectionCard({ onComplete }: Props) {
  const { tour, currentStop } = useTour();
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  const prompts = reflectionPromptsOf(act);

  // Taggable contexts: the act's authored contexts + the guest's added ones.
  const authored = getActContexts(act).map((c) => ({ id: c.id, title: c.title }));
  const [guest, setGuest] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (!tour) return;
    return subscribeGuestContexts(tour.id, (entries) => setGuest(entries.map((e) => ({ id: e.id, title: e.title }))));
  }, [tour]);
  const taggable = [...authored, ...guest].filter(
    (c, i, arr) => c.title.trim() && arr.findIndex((x) => x.id === c.id) === i,
  );

  const [selected, setSelected] = useState<Selected | null>(null);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [tagged, setTagged] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const canSave = !!text.trim() && !busy;

  const save = () => {
    if (!canSave || !selected) return;
    setBusy(true);
    onComplete({
      text: text.trim(),
      photos,
      taggedContexts: tagged.map((id) => ({ id, title: taggable.find((c) => c.id === id)?.title ?? '' })),
      promptId: selected.isCustom ? null : selected.id,
      promptText: selected.isCustom ? CUSTOM_PROMPT : selected.text,
      isCustom: selected.isCustom,
    });
  };

  // ── Prompt picker ──
  if (!selected) {
    return (
      <div className="animate-fade-in">
        <h2 className="font-display font-bold leading-tight" style={{ fontSize: 34, color: 'var(--th-primary)' }}>Share Your Thoughts</h2>
        <p className="mt-1 font-serif" style={{ fontSize: 18, color: 'var(--th-accent-dark)' }}>Choose a prompt or create your own:</p>

        <div className="mt-5 -mx-4 px-4 flex gap-3 overflow-x-auto cj-hscroll pb-2" style={{ scrollSnapType: 'x mandatory' }}>
          {prompts.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected({ id: p.id, text: p.prompt, isCustom: false })}
              className="shrink-0 w-[78%] rounded-2xl p-5 text-left shadow-md flex flex-col"
              style={{ scrollSnapAlign: 'center', scrollSnapStop: 'always', backgroundColor: 'var(--th-surface)', border: '1px solid var(--th-border)', minHeight: 190 }}
            >
              <span className="text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: 'var(--th-primary)' }}>Prompt</span>
              <p className="mt-3 font-serif leading-snug" style={{ fontSize: 22, color: 'var(--th-accent-dark)' }}><FormattedText text={p.prompt} /></p>
              <span className="mt-auto pt-4 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--th-primary)' }}>
                Respond
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
              </span>
            </button>
          ))}

          {/* create your own — distinct dark card */}
          <button
            onClick={() => setSelected({ id: null, text: CUSTOM_PROMPT, isCustom: true })}
            className="shrink-0 w-[78%] rounded-2xl p-5 text-left shadow-md flex flex-col"
            style={{ scrollSnapAlign: 'center', scrollSnapStop: 'always', backgroundColor: 'var(--th-journal)', minHeight: 190 }}
          >
            <p className="font-serif italic leading-snug" style={{ fontSize: 20, color: 'var(--th-surface)' }}>{CUSTOM_PROMPT}</p>
            <span className="mt-auto pt-4 inline-flex items-center gap-2 font-semibold" style={{ color: 'var(--th-secondary)' }}>
              <span className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--th-secondary)', color: 'var(--th-journal)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              </span>
              Create your own
            </span>
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-text-muted">Swipe to see more →</p>
      </div>
    );
  }

  // ── Response (card flips over) ──
  return (
    <motion.div
      className="animate-fade-in"
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{ transformPerspective: 1000 }}
    >
      <button onClick={() => setSelected(null)} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--th-primary)' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M15 18l-6-6 6-6" /></svg>
        Choose another
      </button>

      <p className="font-serif leading-snug" style={{ fontSize: 22, color: 'var(--th-accent-dark)' }}><FormattedText text={selected.text} /></p>

      <div className="mt-4">
        <RecordButton onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="…or type your response"
        className="mt-3 w-full px-4 py-3 rounded-xl border-2 bg-white text-[18px] font-serif text-text-primary focus:outline-none"
        style={{ borderColor: 'var(--th-border)' }}
      />

      {taggable.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-text-secondary mb-1.5">Contexts you referred to</p>
          <div className="flex flex-wrap gap-2">
            {taggable.map((c) => {
              const on = tagged.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setTagged((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors"
                  style={on
                    ? { backgroundColor: 'var(--th-primary)', color: '#fff', borderColor: 'var(--th-primary)' }
                    : { color: 'var(--th-primary)', borderColor: 'var(--th-border)' }}
                >
                  {c.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <PhotoPicker photos={photos} setPhotos={setPhotos} />

      <button
        onClick={save}
        disabled={!canSave}
        className="mt-5 w-full py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        {busy ? 'Saving…' : 'Save and see what others think'}
      </button>
    </motion.div>
  );
}

/** Big centered record button; transcribes speech and appends it to the response. */
function RecordButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing' | 'error'>('idle');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => { recRef.current?.stream?.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('transcribing');
        try {
          const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' });
          const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
          const data = await res.json();
          if (res.ok && data.transcript) { onTranscript(String(data.transcript).trim()); setState('idle'); }
          else setState('error');
        } catch { setState('error'); }
      };
      rec.start(250);
      setState('recording');
    } catch {
      setState('error');
    }
  };

  const stop = () => { if (recRef.current?.state === 'recording') recRef.current.stop(); };

  if (state === 'transcribing') {
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--th-primary)', borderTopColor: 'transparent' }} />
        <p className="text-sm italic text-text-secondary">Tidying up what you said…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={state === 'recording' ? stop : start}
        className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg text-white"
        style={{ backgroundColor: state === 'recording' ? '#c0392b' : 'var(--th-primary)' }}
        aria-label={state === 'recording' ? 'Stop recording' : 'Record'}
      >
        {state === 'recording' ? (
          <span className="w-6 h-6 rounded bg-white animate-pulse" />
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
        )}
      </button>
      <p className="text-sm text-text-secondary">
        {state === 'recording' ? 'Listening… tap to finish' : state === 'error' ? 'Mic unavailable — type below' : 'Tap to record your thoughts'}
      </p>
    </div>
  );
}

/** Photos on a reflection: uploaded from the device, or found online (Commons). */
function PhotoPicker({ photos, setPhotos }: { photos: string[]; setPhotos: React.Dispatch<React.SetStateAction<string[]>> }) {
  const [uploading, setUploading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadSharePhoto(f));
      setPhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error('[reflection] photo upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-text-secondary mb-1.5">Photos</p>
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {photos.map((url, i) => (
            <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))} aria-label="Remove photo"
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/55 text-white text-xs flex items-center justify-center">×</button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer border-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
          {uploading ? 'Uploading…' : 'Add photos'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </label>
        <button onClick={() => setSearchOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          Find online
        </button>
      </div>
      {searchOpen && <ImageSearchModal onClose={() => setSearchOpen(false)} onPick={(url) => { setPhotos((prev) => [...prev, url]); setSearchOpen(false); }} />}
    </div>
  );
}

/** Search Wikimedia Commons for a photo to attach. */
function ImageSearchModal({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
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
            <p className="text-center text-sm text-text-muted py-8">{searched ? 'No images found — try different words.' : 'Search Wikimedia Commons for a photo to attach.'}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {results.map((r) => (
                <button key={r.id} onClick={() => onPick(r.fullUrl)} className="text-left rounded-lg overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
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
