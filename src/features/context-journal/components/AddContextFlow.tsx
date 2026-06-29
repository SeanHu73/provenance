'use client';

/**
 * AddContextFlow — the single shared "Add context" form.
 *
 * Collects title / summary / explanation / lens / optional photo / a dedicated
 * time-range (separate from the browse timeline) and a map step (pin OR
 * highlight, required). On save it writes a ContextEntry to `context-entries`;
 * because the journal subscribes live, the new context appears in its lens the
 * moment its range overlaps the current timeline selection.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { LENSES, TIMELINE_DOMAIN, LENS_BY_KEY } from '../constants';
import type { DrawResult, PastCategory } from '../types';
import { addContextEntry, uploadContextPhoto } from '../store';
import ContextMapLoader from './ContextMapLoader';

interface Props {
  placeId: string;
  onClose: () => void;
  onSaved?: () => void;
}

export default function AddContextFlow({ placeId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [shortSummary, setShortSummary] = useState('');
  const [longExplanation, setLongExplanation] = useState('');
  const [category, setCategory] = useState<PastCategory>('place');
  const [file, setFile] = useState<File | null>(null);
  const [startYear, setStartYear] = useState(1900);
  const [endYear, setEndYear] = useState(1950);
  const [draw, setDraw] = useState<DrawResult>({ geometry: null, camera: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colour = LENS_BY_KEY[category].colour;
  const rangeValid = startYear <= endYear;
  const canSave = title.trim().length > 0 && !!draw.geometry && rangeValid && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const photoUrl = file ? await uploadContextPhoto(file) : null;
      await addContextEntry({
        title: title.trim(),
        shortSummary: shortSummary.trim(),
        longExplanation: longExplanation.trim(),
        pastCategory: category,
        timeRange: { start: startYear, end: endYear },
        geometry: draw.geometry,
        camera: draw.camera,
        photoUrl,
        placeId,
      });
      onSaved?.();
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
          <h2 className="font-display text-2xl text-text-primary">Add context</h2>
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
              placeholder="The full context, shown in the reader"
              className="w-full px-3 py-2.5 rounded-lg border-2 bg-white text-[16px] font-serif text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
          </Field>

          {/* time range — dedicated control */}
          <Field label="Time range (years)">
            <div className="flex items-center gap-3">
              <YearInput value={startYear} onChange={setStartYear} />
              <span className="text-text-muted">to</span>
              <YearInput value={endYear} onChange={setEndYear} />
            </div>
            {!rangeValid && <p className="mt-1 text-xs" style={{ color: 'var(--th-primary)' }}>Start year must be on or before the end year.</p>}
          </Field>

          {/* photo */}
          <Field label="Photo (optional)">
            <input
              type="file" accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sandstone-light file:text-text-primary"
            />
          </Field>

          {/* map step */}
          <Field label="Place on the map (required)">
            <div className="h-64 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
              <ContextMapLoader mode="add" lensColour={colour} onDrawChange={setDraw} />
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              {draw.geometry ? '✓ Location captured.' : 'Drop a pin or colour in a region to continue.'}
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
      min={TIMELINE_DOMAIN.start}
      max={TIMELINE_DOMAIN.end}
      value={value}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (!Number.isNaN(n)) onChange(Math.min(TIMELINE_DOMAIN.end, Math.max(TIMELINE_DOMAIN.start, n)));
      }}
      className="w-24 px-3 py-2.5 rounded-lg border-2 bg-white text-[17px] font-serif tabular-nums text-text-primary focus:outline-none"
      style={{ borderColor: 'var(--th-border)' }}
    />
  );
}
