'use client';

/**
 * The tour's closing reflection — "Share Your Thoughts".
 *
 * One page for the whole tour, after the last act's Context step: every act's
 * authored prompts are merged into a single swipeable set (allReflectionPrompts),
 * plus the "create your own" card. Picking one flips to a response view: a big
 * record button (dictation is transcribed into the textbox to read/edit), an
 * optional textbox, chips to tag the contexts they referred to, and photos —
 * uploaded or found online (Wikimedia Commons).
 *
 * Saving files the response and returns to the picker, so the explorer can answer
 * as many prompts as they like — the acts' reflections merged into one page, not
 * into one response. "See what others think" moves on to the community once at
 * least one response is in; sharing happens there, not here.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTour } from '@/context/TourContext';
import { findActOfStop, allReflectionPrompts, actReflectionsOf } from '@/lib/tour-session';
import { ActReflectionResponse } from '@/lib/types';
import { uploadSharePhoto, recordUnsharedResponse } from '@/lib/community-store';
import { subscribeGuestContexts } from '@/features/context-journal/guest-contexts';
import FormattedText from './FormattedText';
import RecordButton from './RecordButton';
import ReflectionPinPicker, { type PinLoc } from './ReflectionPinPicker';
import { ChevronLeftIcon } from '@/components/icons';

const CUSTOM_PROMPT = 'What piqued your interest? What else would you want to share?';

/** Mirrors the /api/image-search response item (kept local to avoid importing
 *  from a server route module into the client). */
interface ImageResult { id: string; title: string; thumbUrl: string; fullUrl: string; credit: string }

interface Props {
  /** File one response — the explorer stays here and may answer more. */
  onSave: (response: ActReflectionResponse) => void;
  /** Done responding → the community. */
  onDone: () => void;
}

type Selected = { id: string | null; text: string; isCustom: boolean; actId?: string; kind?: 'evidence' };

function newResponseId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `refl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function ActReflectionCard({ onSave, onDone }: Props) {
  const { tour, session, currentStop } = useTour();
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  // The prompts read as one closing set, not as a round-up of the acts — no card
  // says which act it came from. (A legacy tour's prompts still carry their act
  // internally, so a response is filed where it belongs.)
  const prompts = allReflectionPrompts(tour);

  // Responses already filed this session, across every act — drives the ✓ on a
  // prompt they've answered and unlocks the way on.
  const saved = Object.values(session?.actResponses ?? {}).flatMap((entry) => actReflectionsOf(entry));
  const answeredIds = new Set(saved.map((r) => r.promptId).filter(Boolean) as string[]);
  const customCount = saved.filter((r) => r.isCustom).length;

  // Taggable contexts: only the contexts the learner has *added* (their own /
  // Detective answers) — not the act's authored ones.
  const [guest, setGuest] = useState<{ id: string; title: string }[]>([]);
  useEffect(() => {
    if (!tour) return;
    return subscribeGuestContexts(tour.id, (entries) => setGuest(entries.map((e) => ({ id: e.id, title: e.title }))));
  }, [tour]);
  const taggable = guest.filter(
    (c, i, arr) => c.title.trim() && arr.findIndex((x) => x.id === c.id) === i,
  );

  const [selected, setSelected] = useState<Selected | null>(null);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [tagged, setTagged] = useState<string[]>([]);
  const [pin, setPin] = useState<PinLoc | null>(null);
  const [busy, setBusy] = useState(false);

  // The evidence prompt asks for a photograph of a real thing in a real place, so
  // a description on its own does not answer it. All three, or it is not saved.
  const isEvidence = selected?.kind === 'evidence';
  const canSave = isEvidence
    ? !!text.trim() && photos.length > 0 && !!pin && !busy
    : !!text.trim() && !busy;

  const save = async () => {
    if (!canSave || !selected) return;
    setBusy(true);
    // A response belongs to the act its prompt was authored on; one they wrote
    // themselves belongs to the act they are standing in (the last one).
    const actId = selected.actId || act?.id || '';
    const response: ActReflectionResponse = {
      id: newResponseId(),
      actId,
      text: text.trim(),
      photos,
      pin: pin ? { lat: pin.lat, lng: pin.lng } : null,
      taggedContexts: tagged.map((id) => ({ id, title: taggable.find((c) => c.id === id)?.title ?? '' })),
      promptId: selected.isCustom ? null : selected.id,
      promptText: selected.isCustom ? CUSTOM_PROMPT : selected.text,
      isCustom: selected.isCustom,
    };
    // Record every response to the community as "unshared" (hidden from other
    // explorers; visible to the admin). If they later choose to share, this
    // same record is promoted rather than duplicated. Best-effort — a failure
    // here must not block the reflection from saving.
    if (tour && actId) {
      try {
        response.unsharedRecordId = await recordUnsharedResponse({
          tourId: tour.id, actId,
          promptId: response.promptId, promptText: response.promptText, isCustom: response.isCustom,
          text: response.text,
          photos: response.photos || [], pin: response.pin ?? null,
          sessionId: session?.id || 'unknown',
        });
      } catch (err) {
        console.error('[reflection] recording response failed:', err);
      }
    }
    onSave(response);
    // Back to the picker so the next prompt is one tap away.
    setSelected(null);
    setText('');
    setPhotos([]);
    setTagged([]);
    setPin(null);
    setBusy(false);
  };

  // Picker and response are two faces of a flip: selecting a prompt rotates the
  // picker out and the response in (AnimatePresence, mode="wait").
  return (
    <div style={{ perspective: 1400 }}>
      <AnimatePresence mode="wait" initial={false}>
        {!selected ? (
          <motion.div
            key="picker"
            className="animate-fade-in"
            initial={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeIn' }}
            style={{ transformOrigin: 'center' }}
          >
            <h2 className="font-display font-bold leading-tight" style={{ fontSize: 34, color: 'var(--th-primary)' }}>Share Your Thoughts</h2>
            <p className="mt-1 font-serif italic" style={{ fontSize: 16, color: 'var(--text-secondary)' }}>Choose a prompt or create your own:</p>

            <div className="mt-5 -mx-4 px-4 flex gap-3 overflow-x-auto cj-hscroll pb-2" style={{ scrollSnapType: 'x mandatory' }}>
              {prompts.map((p) => {
                const done = answeredIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected({ id: p.id, text: p.prompt, isCustom: false, actId: p.actId, kind: p.kind })}
                    className="shrink-0 w-[85%] rounded-2xl px-6 py-8 text-center shadow-md flex flex-col items-center justify-center"
                    style={{ scrollSnapAlign: 'center', scrollSnapStop: 'always', backgroundColor: 'var(--th-surface)', border: '1px solid var(--th-border)', minHeight: '54vh' }}
                  >
                    {/* This one asks for something different from the others — a
                        photograph of a real thing, not a written thought — so the
                        card says so before they commit to it. */}
                    {p.kind === 'evidence' && (
                      <span
                        className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold uppercase tracking-[0.12em]"
                        style={{ backgroundColor: 'color-mix(in srgb, var(--th-primary) 12%, transparent)', color: 'var(--th-primary)' }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                        </svg>
                        Photo &amp; place
                      </span>
                    )}
                    {p.photoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photoUrl} alt="" className="w-full max-h-44 object-cover rounded-xl mb-6" />
                    )}
                    <p className="font-serif leading-relaxed" style={{ fontSize: 26, color: 'var(--text-primary)' }}><FormattedText text={p.prompt} /></p>
                    {done ? (
                      <span className="mt-8 inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-base font-semibold border-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
                        ✓ Answered — add another
                      </span>
                    ) : (
                      <span className="mt-8 inline-flex items-center gap-1.5 px-6 py-3 rounded-full text-base font-semibold text-white" style={{ backgroundColor: 'var(--th-primary)' }}>
                        Respond
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M9 6l6 6-6 6" /></svg>
                      </span>
                    )}
                  </button>
                );
              })}

              {/* create your own — distinct dark card */}
              <button
                onClick={() => setSelected({ id: null, text: CUSTOM_PROMPT, isCustom: true })}
                className="shrink-0 w-[85%] rounded-2xl px-6 py-8 text-center shadow-md flex flex-col items-center justify-center"
                style={{ scrollSnapAlign: 'center', scrollSnapStop: 'always', backgroundColor: 'var(--th-journal)', minHeight: '54vh' }}
              >
                <p className="font-serif italic leading-relaxed" style={{ fontSize: 23, color: 'var(--th-surface)' }}>{CUSTOM_PROMPT}</p>
                <span className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold" style={{ backgroundColor: 'var(--th-secondary)', color: 'var(--th-journal)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  {customCount > 0 ? 'Write another' : 'Create your own'}
                </span>
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-text-muted">Swipe to see more →</p>

            {/* The way on, once they've answered at least one. Answering more is
                always optional — the button sits under the cards, not over them. */}
            {saved.length > 0 && (
              <button
                onClick={onDone}
                className="mt-4 w-full flex items-center justify-center text-white"
                style={{
                  minHeight: 'var(--ds-btn-s-height)',
                  borderRadius: 'var(--ds-radius-pill)',
                  backgroundColor: 'var(--ds-cardinal)',
                  fontFamily: 'var(--ds-button-s-family)',
                  fontSize: 'var(--ds-button-s-size)',
                  fontWeight: 'var(--ds-button-s-weight)',
                }}
              >
                See what others think
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="respond"
            className="animate-fade-in"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{ transformOrigin: 'center' }}
          >
      {/* The whole header is centred on the prompt, per the reflection sequence:
          the way back, the eyebrow, then the question the learner is answering. */}
      <div className="flex justify-center">
        <button
          onClick={() => setSelected(null)}
          className="mb-3 inline-flex items-center gap-1"
          style={{
            fontFamily: 'var(--ds-body-l-family)',
            fontSize: 'var(--ds-body-l-size)',
            color: 'var(--ds-cardinal)',
          }}
        >
          <ChevronLeftIcon width={16} height={16} />
          Choose another
        </button>
      </div>

      <p
        className="text-center uppercase mb-2"
        style={{
          fontFamily: 'var(--ds-body-s-family)',
          fontSize: 'var(--ds-body-s-size)',
          fontWeight: 700,
          letterSpacing: '0.16em',
          color: 'var(--ds-cardinal)',
        }}
      >
        Responding to
      </p>
      <p
        className="text-center"
        style={{
          fontFamily: 'var(--ds-h2-family)',
          fontSize: 'var(--ds-h2-size)',
          lineHeight: 'var(--ds-h2-line)',
          fontWeight: 'var(--ds-h2-weight)',
          color: 'var(--ds-ink)',
        }}
      >
        <FormattedText text={selected.text} />
      </p>

      {/* The evidence prompt is answered in the order it is done: take the
          photograph, say where it was, then say what it shows. Each step appears
          as the one before it is finished, so the screen never opens as a form. */}
      {isEvidence ? (
        <div className="mt-5 space-y-5">
          <EvidenceStep n={1} label="Photograph it" done={photos.length > 0}>
            <PhotoPicker photos={photos} setPhotos={setPhotos} camera />
          </EvidenceStep>

          {photos.length > 0 && (
            <EvidenceStep n={2} label="Where is it?" done={!!pin}>
              <ReflectionPinPicker
                value={pin}
                onChange={setPin}
                centre={currentStop?.location ?? null}
              />
            </EvidenceStep>
          )}

          {photos.length > 0 && pin && (
            <EvidenceStep n={3} label="What does it show?" done={!!text.trim()}>
              <RecordButton
                halo={!text.trim()}
                onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="…or type it"
                className="ds-textarea mt-3 px-4 py-3 text-[18px] font-serif"
              />
            </EvidenceStep>
          )}
        </div>
      ) : (
      <>
      <div className="mt-4">
        <RecordButton
          halo={!text.trim()}
          onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))}
        />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="…or type your response"
        className="ds-textarea mt-3 px-4 py-3 text-[18px] font-serif"
      />

      {/* Contexts + photos appear once they've written their response — respond first, then add. */}
      {text.trim() && (
        <div className="animate-fade-in">
          {taggable.length > 0 && (
            <div className="mt-5">
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
        </div>
      )}
      </>
      )}

      <button
        onClick={save}
        disabled={!canSave}
        className="mt-5 w-full py-3.5 rounded-xl text-base font-semibold text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        {busy ? 'Saving…' : 'Save response'}
      </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** One step of the evidence answer. Numbered, and ticked once it is done — three
 *  separate actions in a row need to look like a sequence rather than a form. */
function EvidenceStep({ n, label, done, children }: {
  n: number; label: string; done: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-bold"
          style={done
            ? { backgroundColor: 'var(--th-primary)', color: '#fff' }
            : { border: '2px solid var(--th-border)', color: 'var(--text-secondary)' }}
        >
          {done ? '✓' : n}
        </span>
        <span className="font-semibold text-[15px]" style={{ color: 'var(--text-primary)' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

/** Photos on a reflection: uploaded from the device, or found online (Commons). */
function PhotoPicker({ photos, setPhotos, camera = false }: {
  photos: string[];
  setPhotos: React.Dispatch<React.SetStateAction<string[]>>;
  /** Offer the camera first. `capture` opens it directly instead of the photo
   *  library — the point of the evidence prompt is the thing in front of them,
   *  not something already on the phone. Choosing from the library stays
   *  available beside it, since they may have photographed it earlier. */
  camera?: boolean;
}) {
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
      <div className="flex gap-2 flex-wrap">
        {camera && (
          <label
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer text-white"
            style={{ backgroundColor: 'var(--th-primary)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
            {uploading ? 'Uploading…' : 'Take a photo'}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { upload(e.target.files); e.target.value = ''; }}
            />
          </label>
        )}
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold cursor-pointer border-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
          {camera ? 'Choose from photos' : (uploading ? 'Uploading…' : 'Add photos')}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        </label>
        {!camera && (
        <button onClick={() => setSearchOpen(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-semibold border-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          Find online
        </button>
        )}
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
