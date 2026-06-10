'use client';

/**
 * Context-Prototype — the per-act Community Forum, shown at the end of each act
 * (after the act's closing question). Scoped to the current act: lists that
 * act's approved questions as individual post blocks. Each block shows the
 * question with a like button + response count in its footer; tapping a block
 * opens it to reveal the responses and a composer (you have to click INTO a
 * question before you can respond, which keeps the screen calm). An "Add
 * question" composer sits near the bottom, above Continue. This screen also
 * serves as the act's "any remaining questions" prompt — the
 * additional-questions step is merged into it. Always shown. Name + "anything
 * we should know" are collected once and reused on later acts.
 */

import { useEffect, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { ForumQuestion, ForumResponse, ForumIdentity } from '@/lib/types';
import { findActOfStop } from '@/lib/tour-session';
import {
  getApprovedQuestions,
  getApprovedResponses,
  submitForumQuestion,
  submitForumResponse,
  getForumIdentity,
  saveForumIdentity,
  getLikedQuestionIds,
  saveLikedQuestionIds,
  setQuestionLike,
} from '@/lib/community-store';
import BackButton from './BackButton';
import ResponseInput from './ResponseInput';

interface Props {
  onComplete: () => void;
}

export default function CommunityForumCard({ onComplete }: Props) {
  const { tour, currentStop } = useTour();
  const actId = (tour && currentStop ? findActOfStop(tour, currentStop.id)?.id : '') ?? '';
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [responsesByQ, setResponsesByQ] = useState<Record<string, ForumResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [addingQ, setAddingQ] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    (async () => {
      const all = await getApprovedQuestions(tour.id);
      if (cancelled) return;
      // This act's questions only — the forum is per act.
      const qs = all.filter((q) => q.actId === actId);
      setQuestions(qs);
      setLikeCounts(Object.fromEntries(qs.map((q) => [q.id, q.likes || 0])));
      setLikedIds(getLikedQuestionIds());
      const entries = await Promise.all(qs.map(async (q) => [q.id, await getApprovedResponses(q.id)] as const));
      if (cancelled) return;
      setResponsesByQ(Object.fromEntries(entries));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tour, actId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleLike = async (id: string) => {
    const wasLiked = likedIds.has(id);
    // Optimistic — update local state + persisted set immediately.
    const nextLiked = new Set(likedIds);
    if (wasLiked) nextLiked.delete(id); else nextLiked.add(id);
    setLikedIds(nextLiked);
    saveLikedQuestionIds(nextLiked);
    setLikeCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + (wasLiked ? -1 : 1)) }));
    try {
      await setQuestionLike(id, !wasLiked);
    } catch (err) {
      console.error('[CommunityForum] like failed:', err);
    }
  };

  return (
    <div className="animate-fade-in min-h-full py-2 space-y-4">
      <div>
        <p className="uppercase tracking-[0.12em] font-display font-semibold leading-tight" style={{ fontSize: 26, color: 'var(--th-primary)' }}>
          Community Forum
        </p>
        <p className="mt-1 text-[15px] text-text-secondary leading-snug">
          Here are what others have been asking. You can respond or add to the inquiries!
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {questions.length === 0 && (
            <p className="text-[14px] text-text-secondary/80 italic py-2">
              No questions for this act yet — be the first to add one below.
            </p>
          )}

          {questions.map((q) => {
            const isOpen = expanded.has(q.id);
            const responses = responsesByQ[q.id] || [];
            const liked = likedIds.has(q.id);
            const likeCount = likeCounts[q.id] || 0;
            return (
              <div key={q.id} className="rounded-xl bg-white border border-sandstone-light overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(q.id)}
                  className="w-full text-left p-3.5"
                >
                  <p className="font-display font-bold leading-snug text-text-primary" style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}>
                    {q.text}
                  </p>
                  {q.name && <p className="text-[11px] text-text-secondary mt-0.5">— {q.name}</p>}
                </button>

                {isOpen && (
                  <div className="px-3.5 pb-3.5 space-y-2.5">
                    {responses.map((r) => (
                      <div key={r.id} className="pl-3 border-l-2 border-sandstone-light">
                        <p className="text-[14px] font-serif text-text-primary leading-relaxed">{r.text}</p>
                        {r.name && <p className="text-[10px] text-text-secondary mt-0.5">— {r.name}</p>}
                      </div>
                    ))}
                    <ResponseComposer
                      submitLabel="Submit response"
                      placeholder="Add your response…"
                      onSubmit={async (text, identity) => {
                        if (!tour) return;
                        await submitForumResponse(q.id, tour.id, text, sessionIdOf(), identity);
                      }}
                    />
                  </div>
                )}

                {/* Footer: like + response count (the count also toggles the block open). */}
                <div className="flex items-center justify-between px-3.5 py-2 border-t border-sandstone-light/70 bg-sandstone/20">
                  <button
                    type="button"
                    onClick={() => toggleLike(q.id)}
                    aria-pressed={liked}
                    className="flex items-center gap-1.5 text-[13px] font-semibold transition-colors"
                    style={{ color: liked ? 'var(--th-primary)' : 'var(--text-secondary)' }}
                  >
                    <Heart filled={liked} />
                    <span>{likeCount > 0 ? likeCount : 'Like'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleExpand(q.id)}
                    className="flex items-center gap-1 text-[12px] text-text-secondary"
                  >
                    {responses.length} {responses.length === 1 ? 'response' : 'responses'}
                    <span className="text-[10px]">{isOpen ? '▲' : '▾'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add question (about this act) */}
      <div className="rounded-xl bg-sandstone/40 border border-sandstone-light p-3.5">
        {addingQ ? (
          <ResponseComposer
            submitLabel="Submit question"
            placeholder="What are you curious about?"
            onSubmit={async (text, identity) => {
              if (!tour) return;
              await submitForumQuestion(tour.id, actId, text, sessionIdOf(), identity);
            }}
          />
        ) : (
          <button
            onClick={() => setAddingQ(true)}
            className="w-full py-2.5 rounded-lg text-[15px] font-semibold text-white bg-aged-gold hover:bg-aged-gold-light transition-colors"
          >
            + Add question
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <BackButton />
        <button onClick={onComplete} className="flex-1 py-3 rounded-lg text-[15px] font-semibold bg-olive text-white">
          Continue
        </button>
      </div>
    </div>
  );
}

/** Heart glyph — outline when not liked, filled when liked. */
function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/** Reads the active session id from sessionStorage so composers don't each
 *  need it threaded; falls back to a placeholder. */
function sessionIdOf(): string {
  try {
    const raw = sessionStorage.getItem('mc_tour_session_v1');
    if (raw) return (JSON.parse(raw).id as string) || 'unknown';
  } catch { /* ignore */ }
  return 'unknown';
}

/**
 * Composer for a question or response. Collects Name + (on name focus)
 * "anything we should know about you" the first time, then saves that
 * identity and skips the prompt afterwards.
 */
function ResponseComposer({
  submitLabel,
  placeholder,
  onSubmit,
}: {
  submitLabel: string;
  placeholder: string;
  onSubmit: (text: string, identity?: { name?: string; about?: string }) => Promise<void>;
}) {
  const [identity] = useState<ForumIdentity | null>(() => getForumIdentity());
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [aboutShown, setAboutShown] = useState(false);
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const needIdentity = !identity;
  const canSubmit = !!text.trim() && (!needIdentity || !!name.trim());

  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    let id = identity ?? undefined;
    if (needIdentity) {
      id = { name: name.trim(), about: about.trim() };
      saveForumIdentity(id);
    }
    await onSubmit(text.trim(), id);
    setText('');
    setDone(true);
    setBusy(false);
  };

  if (done) return <p className="text-sm text-olive font-semibold">&#10003; Submitted for review.</p>;

  return (
    <div className="space-y-3">
      {needIdentity && (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={() => setAboutShown(true)}
            placeholder="Your name"
            className="w-full px-4 py-2.5 rounded-lg text-[18px] font-serif text-text-primary placeholder:text-text-secondary/40 border-2 border-sandstone-light bg-white focus:outline-none"
          />
          {aboutShown && (
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Anything we should know about you…"
              rows={2}
              className="w-full px-4 py-2.5 rounded-lg text-[17px] font-serif text-text-primary placeholder:text-text-secondary/40 border-2 border-sandstone-light bg-white focus:outline-none animate-fade-in"
            />
          )}
        </div>
      )}
      <ResponseInput value={text} onChange={setText} placeholder={placeholder} />
      <button
        onClick={submit}
        disabled={!canSubmit || busy}
        className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white disabled:opacity-40"
      >
        {submitLabel}
      </button>
    </div>
  );
}
