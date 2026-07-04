'use client';

/**
 * AddContextFlow — the shared "Add context" form, used by both the learner
 * (Context Journal) and the admin (tour editor). It assembles a ContextDraft
 * (lens / framing question / title / summary / explanation / time range /
 * multiple titled photos+audio / a map pin or region) and hands it to
 * `onSubmit`; the caller decides where it's stored. `initial` pre-fills it for
 * editing (existing media kept by URL, new media uploaded on save).
 */

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LENSES, TIMELINE_BOUNDS, LENS_BY_KEY } from '../constants';
import type { ContextDraft, ContextMedia, ContextSource, DrawTool, MapType, PastCategory } from '../types';
import { uploadContextMedia } from '../store';
import { searchPlaces, type PlaceResult } from '../places';
import ContextMapLoader from './ContextMapLoader';

interface Props {
  onClose: () => void;
  onSubmit: (draft: ContextDraft) => Promise<void>;
  initial?: Partial<ContextDraft>;
  heading?: string;
  /** Label for the primary save button (defaults to "Save context"). */
  submitLabel?: string;
}

type DraftMedia = { id: string; kind: 'photo' | 'audio'; title: string; previewUrl: string; file?: File; existingUrl?: string };
type DraftSource = { id: string; name: string; author: string; date: string; url: string; previewUrl: string; file?: File; existingUrl?: string };

const mkId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export default function AddContextFlow({ onClose, onSubmit, initial, heading = 'Add context', submitLabel = 'Save context' }: Props) {
  const [question, setQuestion] = useState(initial?.question ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [shortSummary, setShortSummary] = useState(initial?.shortSummary ?? '');
  const [longExplanation, setLongExplanation] = useState(initial?.longExplanation ?? '');
  const [category, setCategory] = useState<PastCategory>(initial?.pastCategory ?? 'place');
  const [media, setMedia] = useState<DraftMedia[]>(
    (initial?.media ?? []).map((m) => ({ id: m.id, kind: m.kind, title: m.title, previewUrl: m.url, existingUrl: m.url })),
  );
  const [thumbId, setThumbId] = useState<string | null>(initial?.thumbnailMediaId ?? null);
  const [sources, setSources] = useState<DraftSource[]>(
    (initial?.sources ?? []).map((s) => ({
      id: s.id, name: s.name, author: s.author, date: s.date, url: s.url ?? '',
      previewUrl: s.imageUrl ?? '', existingUrl: s.imageUrl ?? undefined,
    })),
  );
  const [startYear, setStartYear] = useState(initial?.timeRange?.start ?? 1900);
  const [endYear, setEndYear] = useState(initial?.timeRange?.end ?? 1950);
  const [geometry, setGeometry] = useState(initial?.geometry ?? null);
  const [camera, setCamera] = useState(initial?.camera ?? null);
  const [mapType, setMapType] = useState<MapType>(initial?.mapType ?? 'default');
  // Opt-in to showing place/time on the reader page. Old entries with geometry
  // default to shown; new entries start off.
  const [includePlaceTime, setIncludePlaceTime] = useState(initial?.includePlaceTime ?? !!initial?.geometry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Step 1 asks only for the framing question; step 2 is the full form (with the
  // question shown on top, still editable). Editing an existing context skips to
  // the details.
  const [step, setStep] = useState<'question' | 'details'>(
    (initial?.question?.trim() || initial?.title?.trim()) ? 'details' : 'question',
  );

  // Place tool: the search bar lives here (above the map, not over it). The map
  // reports its active tool and any tapped place name; we resolve boundaries and
  // hand them back down via `boundary`.
  const [mapTool, setMapTool] = useState<DrawTool>('pin');
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeBusy, setPlaceBusy] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<{ geometry: NonNullable<ContextDraft['geometry']>; nonce: number } | null>(null);
  const nonceRef = useRef(0);

  const selectBoundary = (r: PlaceResult) => {
    nonceRef.current += 1;
    setBoundary({ geometry: r.geometry, nonce: nonceRef.current });
    setPlaceResults([]);
    setPlaceError(null);
  };

  const runPlaceSearch = async (query?: string) => {
    const q = (query ?? placeQuery).trim();
    if (!q) return;
    setPlaceBusy(true);
    setPlaceError(null);
    try {
      const results = await searchPlaces(q);
      if (results.length === 1) selectBoundary(results[0]);
      else { setPlaceResults(results); if (results.length === 0) setPlaceError('No matching place found.'); }
    } catch {
      setPlaceError('Search failed — check your connection and try again.');
    } finally {
      setPlaceBusy(false);
    }
  };

  // A place name tapped on the map → resolve it to a boundary and select it.
  const handleTapName = (name: string | null) => {
    if (!name) { setPlaceError('Tap directly on a place name, or use the search box.'); return; }
    setPlaceQuery(name);
    void runPlaceSearch(name);
  };

  // Place + time are optional now — collapsed by default, expanded to edit.
  const [showPlaceTime, setShowPlaceTime] = useState(false);

  const colour = LENS_BY_KEY[category].colour;
  const rangeValid = startYear <= endYear;
  const canSave = title.trim().length > 0 && rangeValid && !saving;

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

  const addSource = () => setSources((prev) => [...prev, { id: mkId(), name: '', author: '', date: '', url: '', previewUrl: '' }]);
  const removeSource = (id: string) => setSources((prev) => {
    const s = prev.find((x) => x.id === id);
    if (s?.file && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
    return prev.filter((x) => x.id !== id);
  });
  const setSourceField = (id: string, field: 'name' | 'author' | 'date' | 'url', val: string) =>
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: val } : s)));
  const setSourceImage = (id: string, files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setSources((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      if (s.file && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return { ...s, file, previewUrl: URL.createObjectURL(file), existingUrl: undefined };
    }));
  };

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
      const uploadedSources: ContextSource[] = await Promise.all(
        sources.filter((s) => s.name.trim()).map(async (s) => ({
          id: s.id, name: s.name.trim(), author: s.author.trim(), date: s.date.trim(),
          url: s.url.trim() || null,
          imageUrl: s.file ? await uploadContextMedia(s.file) : (s.existingUrl ?? null),
        })),
      );
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
        includePlaceTime,
        media: uploaded,
        thumbnailMediaId,
        sources: uploadedSources,
      });
      onClose();
    } catch (err) {
      console.error('[context-journal] save failed:', err);
      // Surface the real Firebase reason (e.g. storage/unauthorized,
      // permission-denied) so save failures are diagnosable, not generic.
      const e = err as { code?: string; message?: string };
      const detail = [e.code, e.message].filter(Boolean).join(' — ');
      setError(detail ? `Could not save: ${detail}` : 'Could not save. Please try again.');
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

        {step === 'question' ? (
          /* Step 1 — the framing question, on its own */
          <div className="flex-1 overflow-y-auto px-5 py-8 flex flex-col">
            <h3 className="font-display text-2xl text-text-primary leading-snug">What question does this context answer?</h3>
            <p className="mt-1.5 font-serif text-text-secondary">Start with the question — you&apos;ll add the answer and details next.</p>
            <input
              value={question} onChange={(e) => setQuestion(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && question.trim()) setStep('details'); }}
              placeholder="e.g. Where did Stanford get the money to build a university?"
              className="mt-5 w-full px-4 py-3 rounded-xl border-2 bg-white text-[17px] font-serif italic text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
            <div className="mt-auto pt-8">
              <button
                onClick={() => setStep('details')} disabled={!question.trim()}
                className="w-full py-3 rounded-xl text-base font-semibold text-white disabled:opacity-30"
                style={{ backgroundColor: 'var(--th-primary)' }}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
        <>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* framing question — on top, still editable */}
          <Field label="Framing question">
            <input
              value={question} onChange={(e) => setQuestion(e.target.value)}
              placeholder="The question this context helps answer"
              className="w-full px-3 py-2.5 rounded-lg border-2 bg-white text-[16px] font-serif italic text-text-primary focus:outline-none"
              style={{ borderColor: 'var(--th-border)' }}
            />
          </Field>

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
            <p className="mt-2 text-xs italic" style={{ color: colour }}>
              <span className="not-italic font-semibold">{LENS_BY_KEY[category].label}:</span> {LENS_BY_KEY[category].definition}
            </p>
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

          {/* sources */}
          <Field label="Sources (optional)">
            <p className="text-[11px] text-text-muted mb-2">Cite where this context comes from — a book, document, archive, oral account… Name is required; author, date, and a picture are optional.</p>
            <div className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="p-2 rounded-lg border space-y-2" style={{ borderColor: 'var(--th-border)' }}>
                  <div className="flex items-center gap-2">
                    <label className="w-12 h-12 rounded shrink-0 flex items-center justify-center cursor-pointer overflow-hidden border" style={{ borderColor: 'var(--th-border)' }} title="Add a picture (optional)">
                      {s.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => { setSourceImage(s.id, e.target.files); e.target.value = ''; }} />
                    </label>
                    <input
                      value={s.name} onChange={(e) => setSourceField(s.id, 'name', e.target.value)}
                      placeholder="Source name (required)"
                      className="flex-1 min-w-0 px-2 py-1.5 rounded border bg-white text-sm" style={{ borderColor: 'var(--th-border)' }}
                    />
                    <button onClick={() => removeSource(s.id)} aria-label="Remove source" className="shrink-0 text-text-muted text-xl leading-none px-1">&times;</button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={s.author} onChange={(e) => setSourceField(s.id, 'author', e.target.value)}
                      placeholder="Author (optional)"
                      className="flex-1 min-w-0 px-2 py-1.5 rounded border bg-white text-sm" style={{ borderColor: 'var(--th-border)' }}
                    />
                    <input
                      value={s.date} onChange={(e) => setSourceField(s.id, 'date', e.target.value)}
                      placeholder="Date (optional)"
                      className="w-32 px-2 py-1.5 rounded border bg-white text-sm" style={{ borderColor: 'var(--th-border)' }}
                    />
                  </div>
                  <input
                    value={s.url} onChange={(e) => setSourceField(s.id, 'url', e.target.value)}
                    placeholder="Link (optional) — https://…  (paste a URL; the source name links to it)"
                    inputMode="url"
                    className="w-full px-2 py-1.5 rounded border bg-white text-sm" style={{ borderColor: 'var(--th-border)' }}
                  />
                </div>
              ))}
            </div>
            <button onClick={addSource} className="mt-2 px-3 py-1.5 rounded-full text-sm font-semibold border-2" style={{ color: colour, borderColor: `${colour}55` }}>
              + Add source
            </button>
          </Field>

          {/* Place & time — optional, collapsed by default. */}
          <div className="rounded-xl border" style={{ borderColor: 'var(--th-border)' }}>
            <button
              type="button"
              onClick={() => setShowPlaceTime((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-text-primary">Place &amp; time <span className="font-normal text-text-muted">(optional)</span></span>
                <span className="block text-[11px] text-text-muted leading-snug">
                  You can pin where and when this context is relevant — a spot or region on the map, and a span on the timeline.
                  {geometry ? ' ✓ Location set.' : ''}
                </span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0 transition-transform" style={{ color: 'var(--text-secondary)', transform: showPlaceTime ? 'rotate(90deg)' : 'none' }}>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {showPlaceTime && (
            <div className="px-3 pb-3 space-y-5 border-t pt-3" style={{ borderColor: 'var(--th-border)' }}>
          {/* opt-in: whether place & time appear on the reader page */}
          <div>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer" style={{ color: 'var(--text-primary)' }}>
              <input type="checkbox" checked={includePlaceTime} onChange={(e) => setIncludePlaceTime(e.target.checked)} />
              <span className="font-semibold">Show the map &amp; timeline on the context page</span>
            </label>
            <p className="mt-1 text-[11px] text-text-muted">If unticked, place &amp; time stay editable here but don&apos;t appear when reading the context.</p>
          </div>
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

          {/* map step */}
          <Field label="Place on the map">
            {/* Place search lives ABOVE the map (it used to cover it). Type a
               name, or tap a place name on the map below. */}
            {mapTool === 'place' && (
              <div className="mb-2 rounded-xl border p-2" style={{ borderColor: 'var(--th-border)', backgroundColor: 'var(--th-surface)' }}>
                <div className="flex gap-1.5">
                  <input
                    value={placeQuery}
                    onChange={(e) => setPlaceQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void runPlaceSearch(); } }}
                    placeholder="Search a city, state, or country…"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border bg-white text-sm"
                    style={{ borderColor: 'var(--th-border)' }}
                  />
                  <button
                    onClick={() => void runPlaceSearch()}
                    disabled={placeBusy || !placeQuery.trim()}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: colour }}
                  >
                    {placeBusy ? '…' : 'Search'}
                  </button>
                </div>
                <p className="mt-1 px-0.5 text-[11px] text-text-muted">…or tap a place name on the map to select it.</p>
                {placeError && <p className="mt-1 px-0.5 text-xs" style={{ color: 'var(--th-primary)' }}>{placeError}</p>}
                {placeResults.length > 0 && (
                  <ul className="mt-1.5 max-h-40 overflow-y-auto divide-y" style={{ borderColor: 'var(--th-border)' }}>
                    {placeResults.map((r, i) => (
                      <li key={i}>
                        <button
                          onClick={() => selectBoundary(r)}
                          className="w-full text-left px-2 py-2 hover:bg-black/5 rounded-md"
                        >
                          <span className="block text-sm text-text-primary leading-snug">{r.name}</span>
                          <span className="block text-[11px] text-text-muted capitalize">{r.kind}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="h-96 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--th-border)' }}>
              <ContextMapLoader
                key={mapType}
                mode="add"
                mapType={mapType}
                onMapTypeChange={setMapType}
                lensColour={colour}
                initialGeometry={geometry}
                initialCamera={camera}
                onDrawChange={(r) => { setGeometry(r.geometry); setCamera(r.camera); }}
                onToolChange={setMapTool}
                onTapName={handleTapName}
                onTapBoundary={selectBoundary}
                boundary={boundary}
              />
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              {geometry ? '✓ Location captured.' : 'Optional — drop a pin, highlight a region, or pick a place.'}
            </p>
          </Field>
            </div>
            )}
          </div>

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
            {saving ? 'Saving…' : submitLabel}
          </button>
        </div>
        </>
        )}
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
