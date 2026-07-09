'use client';

/**
 * Per-tour Context Detective admin.
 *
 *  - Questions sent to the tour guide (learner hit a no-answer and forwarded it).
 *  - Contexts explored by learners: a review queue. Edit the text, then approve
 *    to surface it to other learners under "Contexts Explored by Others" (in its
 *    act). Only approved contexts are shown to learners.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getTour } from '@/lib/tours-store';
import type { Tour } from '@/lib/types';
import { LENSES, LENS_BY_KEY } from '@/features/context-journal/constants';
import type { PastCategory } from '@/features/context-journal/types';
import {
  subscribeGuideQuestions, setGuideQuestionResolved, deleteGuideQuestion, type GuideQuestion,
  subscribeAllExploredContexts, setExploredContextStatus, updateExploredContext, deleteExploredContext,
  type ExploredContext,
} from '@/features/context-journal/shared-store';

function LensChip({ lens }: { lens: PastCategory }) {
  const l = LENS_BY_KEY[lens];
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: l?.colour ?? '#666' }}>{l?.label ?? lens}</span>;
}

export default function DetectiveAdminPage() {
  const params = useParams();
  const tourId = String(params?.id ?? '');
  const [tour, setTour] = useState<Tour | null>(null);
  const [guideQs, setGuideQs] = useState<GuideQuestion[]>([]);
  const [pool, setPool] = useState<ExploredContext[]>([]);

  useEffect(() => { getTour(tourId).then(setTour).catch(() => {}); }, [tourId]);
  useEffect(() => (tourId ? subscribeGuideQuestions(tourId, setGuideQs) : undefined), [tourId]);
  useEffect(() => (tourId ? subscribeAllExploredContexts(tourId, setPool) : undefined), [tourId]);

  const actTitle = useMemo(() => {
    const m = new Map((tour?.acts ?? []).map((a) => [a.id, a.title || 'Untitled act']));
    return (actId?: string) => (actId ? m.get(actId) ?? 'Unknown act' : 'No act');
  }, [tour]);

  const pending = pool.filter((c) => c.status === 'pending');
  const approved = pool.filter((c) => c.status === 'approved');
  const openGuideQs = guideQs.filter((q) => !q.resolved);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-10 text-stone-800">
      <div>
        <Link href={`/admin/tours/${tourId}`} className="text-sm text-stone-500 hover:underline">← {tour?.title ?? 'Tour'}</Link>
        <h1 className="text-2xl font-bold mt-1">Context Detective</h1>
      </div>

      {/* Questions sent to the tour guide */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Questions sent to the tour guide {openGuideQs.length > 0 && <span className="text-sm font-normal text-stone-500">· {openGuideQs.length} open</span>}</h2>
        {guideQs.length === 0 ? (
          <p className="text-sm italic text-stone-400">No questions forwarded yet.</p>
        ) : (
          <ul className="space-y-2">
            {[...guideQs].reverse().map((q) => (
              <li key={q.id} className={`rounded-lg border p-3 ${q.resolved ? 'border-stone-200 bg-stone-50 opacity-70' : 'border-stone-300 bg-white'}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><LensChip lens={q.lens} /><span className="text-[11px] text-stone-400">{actTitle(q.actId)}</span></div>
                    <p className="font-serif text-[15px]">&ldquo;{q.question}&rdquo;</p>
                    {q.learnerTheory && <p className="text-[12px] text-stone-500 mt-1"><span className="font-semibold">Their theory:</span> {q.learnerTheory}</p>}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => setGuideQuestionResolved(tourId, q.id, !q.resolved)} className="text-[11px] px-2 py-1 rounded border border-stone-300 hover:bg-stone-100">{q.resolved ? 'Reopen' : 'Mark done'}</button>
                    <button onClick={() => { if (confirm('Delete this question?')) deleteGuideQuestion(tourId, q.id); }} className="text-[11px] px-2 py-1 rounded text-red-700 hover:bg-red-50">Delete</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Explored contexts review queue */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Contexts explored by learners</h2>
          <p className="text-sm text-stone-500">Approve one to show it to other learners under &ldquo;Contexts Explored by Others&rdquo; in its act. Edit the text first if it needs cleaning up.</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-stone-600 mb-2">Pending review · {pending.length}</h3>
          {pending.length === 0 ? <p className="text-sm italic text-stone-400">Nothing waiting.</p> : (
            <div className="space-y-3">{[...pending].reverse().map((c) => <ContextRow key={c.id} tourId={tourId} ctx={c} actTitle={actTitle(c.actId)} />)}</div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-stone-600 mb-2">Approved (shown to learners) · {approved.length}</h3>
          {approved.length === 0 ? <p className="text-sm italic text-stone-400">None approved yet.</p> : (
            <div className="space-y-3">{[...approved].reverse().map((c) => <ContextRow key={c.id} tourId={tourId} ctx={c} actTitle={actTitle(c.actId)} />)}</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ContextRow({ tourId, ctx, actTitle }: { tourId: string; ctx: ExploredContext; actTitle: string }) {
  const [editing, setEditing] = useState(false);
  const [lens, setLens] = useState<PastCategory>(ctx.lens);
  const [title, setTitle] = useState(ctx.title);
  const [summary, setSummary] = useState(ctx.shortSummary);
  const [explanation, setExplanation] = useState(ctx.longExplanation);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try { await updateExploredContext(tourId, ctx.id, { lens, title, shortSummary: summary, longExplanation: explanation }); setEditing(false); }
    catch (err) { console.error(err); alert('Save failed — see console.'); }
    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-stone-300 bg-white p-3">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <LensChip lens={ctx.lens} />
        <span className="text-[11px] text-stone-400">{actTitle}</span>
        {ctx.status === 'approved' && <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">approved</span>}
      </div>

      {!editing ? (
        <>
          {ctx.question && <p className="text-[12px] italic text-stone-500 mb-1">&ldquo;{ctx.question}&rdquo;</p>}
          <p className="font-semibold text-[15px]">{ctx.title}</p>
          {ctx.shortSummary && <p className="text-[13px] text-stone-600 mt-0.5">{ctx.shortSummary}</p>}
          <p className="text-[13px] text-stone-700 mt-1.5 whitespace-pre-line">{ctx.longExplanation}</p>
          {ctx.sources?.length > 0 && (
            <ul className="text-[11px] text-stone-500 mt-1.5 list-disc pl-4">
              {ctx.sources.map((s, i) => <li key={i}>{s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.label || s.url}</a> : s.label}</li>)}
            </ul>
          )}
          <div className="flex gap-2 mt-3">
            {ctx.status === 'pending'
              ? <button onClick={() => setExploredContextStatus(tourId, ctx.id, 'approved')} className="text-[12px] font-semibold px-3 py-1.5 rounded bg-emerald-700 text-white hover:bg-emerald-800">Approve</button>
              : <button onClick={() => setExploredContextStatus(tourId, ctx.id, 'pending')} className="text-[12px] font-semibold px-3 py-1.5 rounded border border-stone-300 hover:bg-stone-100">Unapprove</button>}
            <button onClick={() => setEditing(true)} className="text-[12px] font-semibold px-3 py-1.5 rounded border border-stone-300 hover:bg-stone-100">Edit</button>
            <button onClick={() => { if (confirm('Delete this context?')) deleteExploredContext(tourId, ctx.id); }} className="text-[12px] font-semibold px-3 py-1.5 rounded text-red-700 hover:bg-red-50 ml-auto">Delete</button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <select value={lens} onChange={(e) => setLens(e.target.value as PastCategory)} className="text-[13px] border border-stone-300 rounded px-2 py-1">
            {LENSES.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full text-[15px] font-semibold border border-stone-300 rounded px-2 py-1" />
          <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="Short summary" className="w-full text-[13px] border border-stone-300 rounded px-2 py-1" />
          <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={5} placeholder="Full explanation" className="w-full text-[13px] border border-stone-300 rounded px-2 py-1" />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="text-[12px] font-semibold px-3 py-1.5 rounded bg-stone-800 text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setLens(ctx.lens); setTitle(ctx.title); setSummary(ctx.shortSummary); setExplanation(ctx.longExplanation); setEditing(false); }} className="text-[12px] px-3 py-1.5 rounded border border-stone-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
