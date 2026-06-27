'use client';

/**
 * /admin/community — Community Forum moderation.
 *
 * Lists explorer-submitted questions (pending first) and their responses.
 * Approve to surface them in the explorer Community Forum; remove deletes
 * them entirely (works even after approval).
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ForumQuestion, ForumResponse, ForumResource, ResourceLink, Tour, CommunityShare, CommunityComment } from '@/lib/types';
import {
  getAllQuestions,
  getAllResponses,
  setQuestionStatus,
  deleteQuestion,
  setResponseStatus,
  deleteResponse,
  getAllResources,
  addAdminResource,
  setResourceStatus,
  deleteResource,
  updateResource,
  uploadCommunityPhoto,
  getAllShares,
  getAllComments,
  setShareStatus,
  deleteShare,
  deleteComment,
} from '@/lib/community-store';
import { getTours } from '@/lib/tours-store';

export default function CommunityModerationPage() {
  const [tab, setTab] = useState<'shares' | 'questions' | 'resources'>('shares');
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [responses, setResponses] = useState<ForumResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [qs, rs] = await Promise.all([getAllQuestions(), getAllResponses()]);
    setQuestions(qs);
    setResponses(rs);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const pending = questions.filter((q) => q.status === 'pending');
  const approved = questions.filter((q) => q.status === 'approved');

  const approveQ = async (id: string) => { await setQuestionStatus(id, 'approved'); reload(); };
  const unapproveQ = async (id: string) => { await setQuestionStatus(id, 'pending'); reload(); };
  const removeQ = async (id: string) => { if (confirm('Remove this question and its responses?')) { await deleteQuestion(id); reload(); } };
  const approveR = async (id: string) => { await setResponseStatus(id, 'approved'); reload(); };
  const unapproveR = async (id: string) => { await setResponseStatus(id, 'pending'); reload(); };
  const removeR = async (id: string) => { if (confirm('Remove this response?')) { await deleteResponse(id); reload(); } };

  const renderQuestion = (q: ForumQuestion) => {
    const qResponses = responses.filter((r) => r.questionId === q.id);
    return (
      <div key={q.id} className="border border-stone-300 rounded bg-white p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-stone-900">{q.text}</p>
            <p className="text-[10px] text-stone-400 mt-1 font-mono">
              {q.status} · ♥ {q.likes || 0} · {new Date(q.createdAt).toLocaleString()} · tour {q.tourId.slice(0, 8)}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {q.status === 'pending' ? (
              <button onClick={() => approveQ(q.id)} className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">Approve</button>
            ) : (
              <button onClick={() => unapproveQ(q.id)} className="px-2 py-1 text-xs rounded bg-stone-200 text-stone-700 hover:bg-stone-300">Unapprove</button>
            )}
            <button onClick={() => removeQ(q.id)} className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200">Remove</button>
          </div>
        </div>

        {/* Responses */}
        {qResponses.length > 0 && (
          <div className="pl-3 border-l-2 border-stone-200 space-y-2">
            {qResponses.map((r) => (
              <div key={r.id} className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-stone-700">{r.text}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-mono">{r.status} · {new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {r.status === 'pending' ? (
                    <button onClick={() => approveR(r.id)} className="px-2 py-0.5 text-[11px] rounded bg-green-600 text-white hover:bg-green-700">Approve</button>
                  ) : (
                    <button onClick={() => unapproveR(r.id)} className="px-2 py-0.5 text-[11px] rounded bg-stone-200 text-stone-700 hover:bg-stone-300">Unapprove</button>
                  )}
                  <button onClick={() => removeR(r.id)} className="px-2 py-0.5 text-[11px] rounded bg-red-100 text-red-700 hover:bg-red-200">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 border-b border-stone-300 pb-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Community</h1>
            <p className="text-xs text-stone-500 mt-0.5">Shared reflections, suggested resources, and legacy forum questions.</p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <button onClick={reload} className="text-blue-700 hover:underline">Refresh</button>
            <Link href="/admin" className="text-blue-700 hover:underline">← Admin</Link>
          </div>
        </header>

        <div className="flex gap-2 mb-5">
          {(['shares', 'questions', 'resources'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded text-sm font-semibold capitalize ${tab === t ? 'bg-blue-700 text-white' : 'bg-stone-200 text-stone-700 hover:bg-stone-300'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'shares' ? (
          <SharesSection />
        ) : tab === 'resources' ? (
          <ResourcesSection />
        ) : loading ? (
          <p className="text-stone-600 text-sm">Loading…</p>
        ) : questions.length === 0 ? (
          <p className="text-stone-500 text-sm italic">No questions submitted yet.</p>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide mb-3">
                Pending ({pending.length})
              </h2>
              {pending.length === 0 ? (
                <p className="text-stone-400 text-xs italic">Nothing awaiting review.</p>
              ) : (
                <div className="space-y-3">{pending.map(renderQuestion)}</div>
              )}
            </section>

            <section>
              <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide mb-3">
                Approved ({approved.length})
              </h2>
              {approved.length === 0 ? (
                <p className="text-stone-400 text-xs italic">None approved yet.</p>
              ) : (
                <div className="space-y-3">{approved.map(renderQuestion)}</div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shares ("Hear from the Community") ─────────────────────────────

function SharesSection() {
  const [shares, setShares] = useState<CommunityShare[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [ss, cs] = await Promise.all([getAllShares(), getAllComments()]);
    setShares(ss);
    setComments(cs);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const removeShare = async (id: string) => { if (confirm('Remove this shared reflection and its comments?')) { await deleteShare(id); reload(); } };
  const hideShare = async (id: string, hidden: boolean) => { await setShareStatus(id, hidden ? 'pending' : 'approved'); reload(); };
  const removeComment = async (id: string) => { if (confirm('Remove this comment?')) { await deleteComment(id); reload(); } };

  if (loading) return <p className="text-stone-600 text-sm">Loading…</p>;
  if (shares.length === 0) return <p className="text-stone-500 text-sm italic">No reflections shared yet.</p>;

  return (
    <div className="space-y-3">
      {shares.map((s) => {
        const sComments = comments.filter((c) => c.shareId === s.id);
        const hidden = s.status !== 'approved';
        return (
          <div key={s.id} className={`border rounded bg-white p-4 space-y-2 ${hidden ? 'border-amber-300 opacity-70' : 'border-stone-300'}`}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {s.name && <p className="text-xs font-semibold text-stone-700">{s.name}</p>}
                <p className="text-sm text-stone-900">{s.text}</p>
                <p className="text-[10px] text-stone-400 mt-1 font-mono">
                  {s.status} · ▲ {s.upvotes || 0} · {s.photos?.length || 0} photo(s){s.pin ? ' · 📍 pin' : ''} · {new Date(s.createdAt).toLocaleString()} · tour {s.tourId.slice(0, 8)}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => hideShare(s.id, !hidden)} className="px-2 py-1 text-xs rounded bg-stone-200 text-stone-700 hover:bg-stone-300">{hidden ? 'Unhide' : 'Hide'}</button>
                <button onClick={() => removeShare(s.id)} className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200">Remove</button>
              </div>
            </div>

            {s.photos && s.photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {s.photos.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded border border-stone-200" />
                ))}
              </div>
            )}

            {s.pin && (
              <p className="text-xs text-stone-600">📍 <span className="font-semibold">{s.pin.title || 'Their spot'}</span>{s.pin.note ? ` — ${s.pin.note}` : ''}</p>
            )}

            {sComments.length > 0 && (
              <div className="pl-3 border-l-2 border-stone-200 space-y-1.5">
                {sComments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3">
                    <p className="flex-1 text-xs text-stone-700">{c.name ? <span className="font-semibold">{c.name}: </span> : null}{c.text}</p>
                    <button onClick={() => removeComment(c.id)} className="px-2 py-0.5 text-[11px] rounded bg-red-100 text-red-700 hover:bg-red-200 shrink-0">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Resources ──────────────────────────────────────────────────────

function ResourcesSection() {
  const [resources, setResources] = useState<ForumResource[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [rs, ts] = await Promise.all([getAllResources(), getTours()]);
    setResources(rs);
    setTours(ts);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const tourTitle = (id: string) => tours.find((t) => t.id === id)?.title || id.slice(0, 8);

  return (
    <div className="space-y-8">
      {/* Add curated resource */}
      <section>
        <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide mb-3">Add a suggested resource</h2>
        <div className="border border-stone-300 rounded bg-white p-4">
          <ResourceForm
            withTourPicker
            tours={tours}
            submitLabel="Add resource"
            resetOnSave
            onSave={async (v) => { await addAdminResource(v); reload(); }}
          />
        </div>
      </section>

      {/* All resources */}
      <section>
        <h2 className="font-semibold text-sm text-stone-700 uppercase tracking-wide mb-3">All resources ({resources.length})</h2>
        {loading ? (
          <p className="text-stone-600 text-sm">Loading…</p>
        ) : resources.length === 0 ? (
          <p className="text-stone-400 text-xs italic">No resources yet.</p>
        ) : (
          <div className="space-y-3">
            {resources.map((r) => (
              <div key={r.id} className="border border-stone-300 rounded bg-white p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{r.title}</p>
                    {r.description && <p className="text-xs text-stone-600 mt-0.5">{r.description}</p>}
                    <p className="text-[10px] text-stone-400 mt-1 font-mono">{r.source} · {r.status} · {tourTitle(r.tourId)} · {r.photos.length} photo(s) · {r.links.length} link(s){r.name ? ` · ${r.name}` : ''}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {r.status === 'pending' ? (
                      <button onClick={async () => { await setResourceStatus(r.id, 'approved'); reload(); }} className="px-2 py-1 text-xs rounded bg-green-600 text-white hover:bg-green-700">Approve</button>
                    ) : (
                      <button onClick={async () => { await setResourceStatus(r.id, 'pending'); reload(); }} className="px-2 py-1 text-xs rounded bg-stone-200 text-stone-700 hover:bg-stone-300">Unapprove</button>
                    )}
                    <button onClick={() => setEditingId(editingId === r.id ? null : r.id)} className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200">{editingId === r.id ? 'Close' : 'Edit'}</button>
                    <button onClick={async () => { if (confirm('Remove this resource?')) { await deleteResource(r.id); reload(); } }} className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200">Remove</button>
                  </div>
                </div>

                {r.photos.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {r.photos.map((url, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={url} alt="" className="w-16 h-16 object-cover rounded border border-stone-200" />
                    ))}
                  </div>
                )}

                {editingId === r.id && (
                  <div className="border-t border-stone-200 pt-3">
                    <ResourceForm
                      tours={tours}
                      initial={r}
                      submitLabel="Save changes"
                      onSave={async (v) => { await updateResource(r.id, { title: v.title, description: v.description, photos: v.photos, links: v.links }); setEditingId(null); reload(); }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResourceForm({
  withTourPicker = false,
  tours,
  initial,
  submitLabel,
  resetOnSave = false,
  onSave,
}: {
  withTourPicker?: boolean;
  tours: Tour[];
  initial?: ForumResource;
  submitLabel: string;
  resetOnSave?: boolean;
  onSave: (v: { tourId: string; title: string; description: string; photos: string[]; links: ResourceLink[] }) => Promise<void>;
}) {
  const [tourId, setTourId] = useState(initial?.tourId ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [links, setLinks] = useState<ResourceLink[]>(initial?.links ?? []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try { const url = await uploadCommunityPhoto(file); setPhotos((p) => [...p, url]); } catch { /* ignore */ }
    setUploading(false);
  };

  const save = async () => {
    if (!title.trim() || busy) return;
    const tid = withTourPicker ? tourId : (initial?.tourId ?? tourId);
    if (withTourPicker && !tid) { alert('Pick a tour.'); return; }
    setBusy(true);
    await onSave({ tourId: tid, title: title.trim(), description: description.trim(), photos, links: links.filter((l) => l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })) });
    setBusy(false);
    if (resetOnSave) { setTitle(''); setDescription(''); setPhotos([]); setLinks([]); }
  };

  return (
    <div className="space-y-2">
      {withTourPicker && (
        <select value={tourId} onChange={(e) => setTourId(e.target.value)} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm">
          <option value="">Select a tour…</option>
          {tours.map((t) => <option key={t.id} value={t.id}>{t.title || t.id.slice(0, 8)}</option>)}
        </select>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-2 py-1.5 border border-stone-300 rounded text-sm" />

      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-stone-200" />
              <button onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs">×</button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-block px-2 py-1 rounded bg-stone-200 text-stone-700 text-xs cursor-pointer hover:bg-stone-300">
        {uploading ? 'Uploading…' : '+ Add photo'}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
      </label>

      {links.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input value={l.label} onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Label" className="w-1/3 px-2 py-1 border border-stone-300 rounded text-xs" />
          <input value={l.url} onChange={(e) => setLinks((ls) => ls.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} placeholder="https://…" className="flex-1 px-2 py-1 border border-stone-300 rounded text-xs" />
          <button onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))} className="text-red-600 px-1">×</button>
        </div>
      ))}
      <button onClick={() => setLinks((ls) => [...ls, { label: '', url: '' }])} className="text-xs text-blue-700 hover:underline">+ Add link</button>

      <div>
        <button onClick={save} disabled={!title.trim() || busy} className="px-3 py-1.5 rounded bg-blue-700 text-white text-sm hover:bg-blue-800 disabled:opacity-40">{submitLabel}</button>
      </div>
    </div>
  );
}
