'use client';

/**
 * AddContextFlow — the shared "Add context" form, used by both the learner
 * (Context Journal) and the admin (tour editor). It assembles a ContextDraft
 * (lens / framing question / title / summary / explanation / time range /
 * multiple titled photos+audio / a map pin or region) and hands it to
 * `onSubmit`; the caller decides where it's stored. `initial` pre-fills it for
 * editing (existing media kept by URL, new media uploaded on save).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LENSES, TIMELINE_BOUNDS, LENS_BY_KEY } from '../constants';
import type { ContextDraft, ContextMedia, MapType, PastCategory } from '../types';
import { uploadContextMedia } from '../store';
import ContextMapLoader from './ContextMapLoader';

interface Props {
  onClose: () => void;
  onSubmit: (draft: ContextDraft) => Promise<void>;
  initial?: Partial<ContextDraft>;
  heading?: string;
}

type DraftMedia = { id: string; kind: 'photo' | 'audio'; title: string; previewUrl: string; file?: File; existingUrl?: string };

const mkId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export default function AddContextFlow({ onClose, onSubmit, initial, heading = 'Add context' }: Props) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [shortSummary, setShortSummary] = useState(initial?.shortSummary ?? '');
  const [longExplanation, setLongExplanation] = useState(initial?.longExplanation ?? '');
  const [category, setCategory] = useState<PastCategory>(initial?.pastCategory ?? 'place');
  const [media, setMedia] = useState<DraftMedia[]>(
    (initial?.media ?? []).map((m) => ({ id: m.id, kind: m.kind, title: m.title, previewUrl: m.url, existingUrl: m.url })),
  );
  const [thumbId, setThumbId] = useState<string | null>(initial?.thumbnailMediaId ?? null);
  const [startYear, setStartYear] = useState(initial?.timeRange?.start ?? 1900);
  const [endYear, setEndYear] = useState(initial?.timeRange?.end ?? 1950);
  const [geometry, setGeometry] = useState(initial?.geometry ?? null);
  const [camera, setCamera] = useState(initial?.camera ?? null);
  const [mapType, setMapType] = useState<MapType>(initial?.mapType ?? 'default');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colour = LENS_BY_KEY[category].colour;
  const rangeValid = startYear <= endYear;
  const canSave = title.trim().length > 0 && !!geometry && rangeValid && !saving;

  const addFiles = (kind: 'photo' | 'audio', files: FileList | null) => {
    if (!files) return;
    const next: DraftMedia[] = Array.from(files).map((file) => ({
      id: mkId(), kind, file, title: '', previewUrl: kind === 'photo' ? URL.createObjectURL(file) : '',
    }));
    setMedia((prev) => {
      const merged = [...prev, ...next];
      if (!thumbId) { const firstPhoto = merged.find((m) => m.kind === 'photo'); if (firstPhoto) setThumbId(firstPhoto.id); }
      return merged;
    });
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m?.file && m.previewUrl) URL.revokeObjectURL(m.previewUrl);
      const next = prev.filter((x) => x.id !== id);
      if (thumbId === id) setThumbId(next.find((x) => x.kind === 'photo')?.id ?? null);
      return next;
    });
  };

  const setMediaTitle = (id: string, t: string) =>
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, title: t } : m)));

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const uploaded: ContextMedia[] = await Promise.all(
        media.map(async (m) => ({
          id: m.id, kind: m.kind, title: m.title.trim(),
          url: m.file ? await uploadContextMedia(m.file) : (m.existingUrl ?? ''),
        })),
      );
      const photoIds = uploaded.filter((m) => m.kind === 'photo').map((m) => m.id);
      const thumbnailMediaId = thumbId && photoIds.includes(thumbId) ? thumbId : (photoIds[0] ?? null);
      await onSubmit({
        question: question.trim(),
        title: title.trim(),
        shortSummary: shortSummary.trim(),
        longExplanation: longExplanation.trim(),
        pastCategory: category,
        timeRange: { start: startYear, end: endYear },
        geometry,
        camera,
        mapType,
        media: uploaded,
        thumbnailMediaId,
      });
      onClose();
    } catch (err) {
      console.error('[context-journal] save failed:', err);
      setError('Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[1200] flex flex-col"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        className="relative mt-auto w-full max-w-lg mx-auto bg-warm-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: '94vh' }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      >
        <div className="shrink-0 flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
          <h2 className="font-display text-2xl text-text-primary">{heading}</h2>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:bg-black/5 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* lens */}
          <Field label="Lens">
            <div className="flex flex-wrap gap-2">
              {LENSES.map((l) => (
                <button
                  key={l.key}
                  onClick={() => setCategory(l.key)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors border-2"
                  style={category === l.key
                    ? { backgroundColor: l.colour, color: '#fff', borderColor: l.colour }
                    : { color: l.colour, borderColor: `${l.colour}55` }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </Field>

          {/* framing question */}
          <Field label="Framing question">
            <input
              value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="The question this context helps answer"
              className="w-full px-3 py-2.5 rounded-lg border-2 bg-white text-[16px] font-serif italic text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
          </Field>

          {/* title */}
          <Field label="Title">
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="A short, memorable name"
              className="w-full px-3 py-2.5 rounded-lg border-2 bg-white text-[17px] font-serif text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
          </Field>

          {/* short summary */}
          <Field label="Short summary">
            <textarea
              value={shortSummary} onChange={(e) => setShortSummary(e.target.value)} rows={2}
              placeholder="One or two lines shown on the card"
              className="w-full px-3 py-2.5 rounded-lg border-2 bg-white text-[16px] font-serif text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
          </Field>

          {/* long explanation */}
          <Field label="Full explanation">
            <textarea
              value={longExplanation} onChange={(e) => setLongExplanation(e.target.value)} rows={5}
              placeholder="The full context, shown in the reader (and read aloud)"
              className="w-full px-3 py-2.5 rounded-lg border-2 bg-white text-[16px] font-serif text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
          </Field>

          {/* time range */}
          <Field label="Time range (years)">
            <div className="flex items-center gap-3">
              <YearInput value={startYear} onChange={setStartYear} />
              <span className="text-text-muted">to</span>
              <YearInput value={endYear} onChange={setEndYear} />
            </div>
            <p className="mt-1 text-xs text-text-muted">Use negative years for BC (e.g. −500 = 500 BC).</p>
            {!rangeValid && <p className="mt-1 text-xs" style={{ color: 'var(--th-primary)' }}>Start year must be on or before the end year.</p>}
          </Field>

          {/* media */}
          <Field label="Photos & audio (optional)">
            <div className="flex gap-2 mb-2">
              <UploadButton label="Add photo" accept="image/*" onFiles={(f) => addFiles('photo', f)} colour={colour} />
              <UploadButton label="Add audio" accept="audio/*" onFiles={(f) => addFiles('audio', f)} colour={colour} />
            </div>
            <p className="text-[11px] text-text-muted mb-2">Add more than one — e.g. several photos, an oral account, or a song. Tap a photo&apos;s star to use it as the thumbnail.</p>
            <div className="space-y-2">
              {media.map((m) => (
                <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg border" style={{ borderColor: 'var(--th-border)' }}>
                  {m.kind === 'photo' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.previewUrl} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  ) : (
                    <span className="w-12 h-12 rounded shrink-0 flex items-center justify-center bg-sandstone-light">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="2"><path d="M3 10v4h4l5 5V5L7 10H3z" /><path d="M16 8a5 5 0 010 8" /></svg>
                    </span>
                  )}
                  <input
                    value={m.title} onChange={(e) => setMediaTitle(m.id, e.target.value)}
                    placeholder={m.kind === 'photo' ? 'Photo caption' : 'Audio title'}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded border bg-white text-sm" style={{ borderColor: 'var(--th-border)' }}
                  />
                  {m.kind === 'photo' && (
                    <button onClick={() => setThumbId(m.id)} aria-label="Use as thumbnail" title="Use as thumbnail" className="shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.8" stroke={colour} fill={thumbId === m.id ? colour : 'none'}>
                        <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
                      </svg>
                    </button>
                  )}
                  <button onClick={() => removeMedia(m.id)} aria-label="Remove" className="shrink-0 text-text-muted text-xl leading-none px-1">&times;</button>
                </div>
              ))}
            </div>
          </Field>

          {/* map step */}
          <Field label="Place on the map (required)">
            <div className="h-64 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
              <ContextMapLoader
                key={mapType}
                mode="add"
                mapType={mapType}
                onMapTypeChange={setMapType}
                lensColour={colour}
                initialGeometry={geometry}
                initialCamera={camera}
                onDrawChange={(r) => { setGeometry(r.geometry); setCamera(r.camera); }}
              />
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              {geometry ? '✓ Location captured.' : 'Drop a pin or colour in a region to continue.'}
            </p>
          </Field>

          {error && <p className="text-sm" style={{ color: 'var(--th-primary)' }}>{error}</p>}
        </div>

        <div className="shrink-0 px-5 py-3 border-t flex gap-3" style={{ borderColor: 'var(--th-border)' }}>
          <button onClick={onClose} className="px-4 py-3 rounded-xl text-base font-semibold text-text-secondary border" style={{ borderColor: 'var(--th-border)' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 py-3 rounded-xl text-base font-semibold text-white disabled:opacity-30"
            style={{ backgroundColor: 'var(--th-primary)' }}
          >
            {saving ? 'Saving…' : 'Save context'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function UploadButton({ label, accept, onFiles, colour }: {
  label: string; accept: string; onFiles: (files: FileList | null) => void; colour: string;
}) {
  return (
    <label className="px-3 py-1.5 rounded-full text-sm font-semibold cursor-pointer border-2" style={{ color: colour, borderColor: `${colour}55` }}>
      + {label}
      <input type="file" accept={accept} multiple className="hidden" onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block mb-1.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}

function YearInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={TIMELINE_BOUNDS.start}
      max={TIMELINE_BOUNDS.end}
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n)) onChange(Math.min(TIMELINE_BOUNDS.end, Math.max(TIMELINE_BOUNDS.start, n)));
      }}
      className="w-24 px-3 py-2.5 rounded-lg border-2 bg-white text-[17px] font-serif tabular-nums text-text-primary focus:outline-none"
      style={{ borderColor: 'var(--th-border)' }}
    />
  );
}
