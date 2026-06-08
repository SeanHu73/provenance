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
import { ForumQuestion, ForumResponse } from '@/lib/types';
import {
  getAllQuestions,
  getAllResponses,
  setQuestionStatus,
  deleteQuestion,
  setResponseStatus,
  deleteResponse,
} from '@/lib/community-store';

export default function CommunityModerationPage() {
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
              {q.status} · {new Date(q.createdAt).toLocaleString()} · tour {q.tourId.slice(0, 8)}
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
            <h1 className="text-2xl font-bold">Community Forum</h1>
            <p className="text-xs text-stone-500 mt-0.5">Moderate explorer questions &amp; responses.</p>
          </div>
          <div className="flex gap-3 text-sm items-center">
            <button onClick={reload} className="text-blue-700 hover:underline">Refresh</button>
            <Link href="/admin" className="text-blue-700 hover:underline">← Admin</Link>
          </div>
        </header>

        {loading ? (
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
