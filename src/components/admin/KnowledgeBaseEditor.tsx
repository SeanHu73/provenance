'use client';

/**
 * Admin editor for a tour's Context Detective knowledge base. Reached from the
 * tour's admin view. Each entry: title, short summary, long explanation, trusted
 * source links, and a P.A.S.T. lens tag. On save, the entry's (summary +
 * explanation) is embedded via /api/embed and the vector stored beside it, so
 * the Detective can retrieve it by cosine at ask time.
 */

import { useCallback, useEffect, useState } from 'react';
import { KnowledgeEntry, PastLens } from '@/lib/types';
import { LENS_BY_KEY, LENSES } from '@/features/context-journal/constants';
import {
  getKnowledgeEntries,
  saveKnowledgeEntry,
  deleteKnowledgeEntry,
  fetchEmbedding,
  knowledgeEmbedText,
  knowledgeEmbedHash,
  newKnowledgeId,
} from '@/lib/knowledge-store';

type LinkDraft = { label: string; url: string };

const blankForm = () => ({
  editingId: null as string | null,
  title: '',
  shortSummary: '',
  longExplanation: '',
  lens: 'society' as PastLens,
  links: [] as LinkDraft[],
});

export default function KnowledgeBaseEditor({ tourId }: { tourId: string }) {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(blankForm());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setEntries(await getKnowledgeEntries(tourId));
    setLoading(false);
  }, [tourId]);
  useEffect(() => { reload(); }, [reload]);

  const resetForm = () => { setForm(blankForm()); setStatus(''); };

  const editEntry = (e: KnowledgeEntry) => {
    setForm({
      editingId: e.id,
      title: e.title,
      shortSummary: e.shortSummary,
      longExplanation: e.longExplanation,
      lens: e.lens,
      links: (e.sourceLinks || []).map((l) => ({ label: l.label, url: l.url })),
    });
    setStatus('');
  };

  const canSave = form.title.trim().length > 0
    && form.longExplanation.trim().length > 0
    && (form.links.length === 0 || form.links.every((l) => l.url.trim()))
    && form.links.some((l) => l.url.trim()) // source required — no entry without provenance
    && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setStatus('Embedding…');
    const existing = form.editingId ? entries.find((e) => e.id === form.editingId) : null;
    const links = form.links
      .filter((l) => l.url.trim())
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }));
    const base: KnowledgeEntry = {
      id: form.editingId || newKnowledgeId(),
      title: form.title.trim(),
      shortSummary: form.shortSummary.trim(),
      longExplanation: form.longExplanation.trim(),
      sourceLinks: links,
      lens: form.lens,
      embedding: existing?.embedding,
      embeddingModel: existing?.embeddingModel,
      embeddingHash: existing?.embeddingHash,
      // A manually saved (or edited-then-saved) entry is curator-verified — this
      // also promotes a candidate the admin opened in the form.
      status: 'verified',
      createdAt: existing?.createdAt || '',
      updatedAt: '',
    };
    // Re-embed only when the embedded text changed (or never embedded).
    const hash = knowledgeEmbedHash(base);
    if (base.embeddingHash !== hash || !base.embedding) {
      try {
        const { embedding, model } = await fetchEmbedding(knowledgeEmbedText(base));
        base.embedding = embedding;
        base.embeddingModel = model;
        base.embeddingHash = hash;
      } catch (err) {
        console.error('[knowledge] embed failed:', err);
        setStatus('Embedding failed — saved without a vector (it won’t be retrieved until re-saved). Check OPENAI_API_KEY.');
      }
    }
    try {
      await saveKnowledgeEntry(tourId, base);
    } catch (err) {
      console.error('[knowledge] save failed:', err);
      setStatus('Save failed — see console.');
      setSaving(false);
      return;
    }
    setSaving(false);
    if (!status.startsWith('Embedding failed')) setStatus('Saved.');
    resetForm();
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this knowledge entry?')) return;
    await deleteKnowledgeEntry(tourId, id);
    if (form.editingId === id) resetForm();
    reload();
  };

  // Promote a learner-captured candidate into the verified base as-is (keeps its
  // embedding — no re-embed). Editing first goes through the form + save().
  const promote = async (e: KnowledgeEntry) => {
    await saveKnowledgeEntry(tourId, { ...e, status: 'verified' });
    if (form.editingId === e.id) resetForm();
    reload();
  };
  const dismissCandidate = async (id: string) => {
    if (!confirm('Dismiss this suggested entry? It won’t be added to the base.')) return;
    await deleteKnowledgeEntry(tourId, id);
    if (form.editingId === id) resetForm();
    reload();
  };

  const candidates = entries.filter((e) => e.status === 'candidate');
  const verified = entries.filter((e) => e.status !== 'candidate');

  const addLink = () => setForm((f) => ({ ...f, links: [...f.links, { label: '', url: '' }] }));
  const setLink = (i: number, patch: Partial<LinkDraft>) =>
    setForm((f) => ({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const removeLink = (i: number) => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }));

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-stone-500">
        Curator-authored context the Context Detective treats as verified. Each entry needs at least one
        source link — no entry without provenance. Saving embeds the summary + explanation so the Detective
        can retrieve it.
      </p>

      {/* Editor form */}
      <div className="border border-stone-300 rounded bg-white p-3 space-y-2">
        <p className="text-xs font-semibold text-stone-600">{form.editingId ? 'Edit entry' : 'Add entry'}</p>

        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Title — the conditions this entry holds"
          className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
        />
        <textarea
          value={form.shortSummary}
          onChange={(e) => setForm((f) => ({ ...f, shortSummary: e.target.value }))}
          placeholder="Short summary (1–3 sentences)"
          rows={2}
          className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
        />
        <textarea
          value={form.longExplanation}
          onChange={(e) => setForm((f) => ({ ...f, longExplanation: e.target.value }))}
          placeholder="Long explanation — the full context"
          rows={5}
          className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm"
        />

        {/* Lens */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wide text-stone-400">Lens</span>
          {LENSES.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, lens: l.key as PastLens }))}
              className="px-2.5 py-1 rounded-full text-xs font-semibold border-2 transition-colors"
              style={form.lens === l.key
                ? { backgroundColor: l.colour, color: '#fff', borderColor: l.colour }
                : { color: l.colour, borderColor: `${l.colour}55` }}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Source links */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-stone-400">Source links (at least one required)</span>
            <button type="button" onClick={addLink} className="text-xs text-blue-700 hover:underline">+ Add link</button>
          </div>
          {form.links.length === 0 && <p className="text-[11px] text-stone-400 italic">No links yet.</p>}
          {form.links.map((l, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={l.label}
                onChange={(e) => setLink(i, { label: e.target.value })}
                placeholder="Label (optional)"
                className="w-1/3 px-2 py-1 border border-stone-300 rounded text-xs"
              />
              <input
                value={l.url}
                onChange={(e) => setLink(i, { url: e.target.value })}
                placeholder="https://…"
                className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs"
              />
              <button type="button" onClick={() => removeLink(i)} className="text-red-600 px-1" aria-label="Remove link">×</button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-40"
          >
            {saving ? 'Saving…' : form.editingId ? 'Save changes' : 'Add entry'}
          </button>
          {form.editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-stone-600 hover:underline">Cancel edit</button>
          )}
          {status && <span className="text-xs text-stone-600">{status}</span>}
        </div>
      </div>

      {/* Suggested from learner questions — auto-captured candidates awaiting
          review. Promote adds them to the verified base (then retrievable). */}
      {candidates.length > 0 && (
        <div className="rounded border-2 border-amber-300 bg-amber-50/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 mb-1">
            Suggested from learner questions ({candidates.length})
          </p>
          <p className="text-[11px] text-stone-500 mb-2 leading-snug">
            These were answered from the web when a learner asked. They are NOT used by the Detective yet. Promote the
            good ones to add them to the verified base — future similar questions will then answer from here (faster, no
            web search). Edit first if you want to tidy the wording or sources.
          </p>
          <ul className="space-y-2">
            {candidates.map((e) => {
              const lens = LENS_BY_KEY[e.lens];
              return (
                <li key={e.id} className="rounded border-l-4 border border-amber-200 bg-white p-2.5" style={{ borderLeftColor: lens?.colour ?? '#bbb' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: lens?.colour ?? '#777' }}>{lens?.label ?? e.lens}</span>
                    {!e.embedding && <span className="text-[10px] text-amber-600">⚠ no vector</span>}
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{e.title || <span className="text-stone-400 italic">Untitled</span>}</p>
                  {e.sourceQuestion && <p className="text-[11px] italic text-stone-500">Asked: &ldquo;{e.sourceQuestion}&rdquo;</p>}
                  {e.shortSummary && <p className="text-xs text-stone-500 line-clamp-2 mt-0.5">{e.shortSummary}</p>}
                  <p className="text-[10px] text-stone-400 mt-0.5">{e.sourceLinks?.length || 0} source(s)</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <button type="button" onClick={() => promote(e)} className="px-2.5 py-1 rounded bg-emerald-700 text-white text-xs hover:bg-emerald-800">Promote</button>
                    <button type="button" onClick={() => editEntry(e)} className="text-xs text-blue-700 hover:underline">Edit first</button>
                    <button type="button" onClick={() => dismissCandidate(e.id)} className="text-xs text-red-600 hover:underline">Dismiss</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Existing entries */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-2">
          Entries ({verified.length})
        </p>
        {loading ? (
          <p className="text-xs text-stone-500">Loading…</p>
        ) : verified.length === 0 ? (
          <p className="text-xs text-stone-400 italic">No knowledge entries yet.</p>
        ) : (
          <ul className="space-y-2">
            {verified.map((e) => {
              const lens = LENS_BY_KEY[e.lens];
              return (
                <li key={e.id} className="rounded border-l-4 border border-stone-200 p-2.5 flex items-start gap-2" style={{ borderLeftColor: lens?.colour ?? '#bbb' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: lens?.colour ?? '#777' }}>{lens?.label ?? e.lens}</span>
                      {!e.embedding && <span className="text-[10px] text-amber-600" title="No embedding — re-save to make it retrievable">⚠ no vector</span>}
                    </div>
                    <p className="text-sm font-semibold text-stone-800 truncate">{e.title || <span className="text-stone-400 italic">Untitled</span>}</p>
                    {e.shortSummary && <p className="text-xs text-stone-500 line-clamp-2">{e.shortSummary}</p>}
                    <p className="text-[10px] text-stone-400 mt-0.5">{e.sourceLinks?.length || 0} source(s)</p>
                  </div>
                  <button type="button" onClick={() => editEntry(e)} className="text-xs text-blue-700 hover:underline shrink-0">Edit</button>
                  <button type="button" onClick={() => remove(e.id)} className="text-xs text-red-600 hover:underline shrink-0">Remove</button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
