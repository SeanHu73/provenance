'use client';

/**
 * Context-Prototype — the per-act Community Forum, shown at the end of each act
 * (after the act's closing question). Scoped to the current act: lists that
 * act's approved questions with their approved responses inline (each with an
 * "Add a response" composer), plus an "Add question" composer at the bottom.
 * This screen also serves as the act's "any remaining questions" prompt — the
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

  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    (async () => {
      const all = await getApprovedQuestions(tour.id);
      if (cancelled) return;
      // This act's questions only — the forum is per act.
      const qs = all.filter((q) => q.actId === actId);
      setQuestions(qs);
      const entries = await Promise.all(qs.map(async (q) => [q.id, await getApprovedResponses(q.id)] as const));
      if (cancelled) return;
      setResponsesByQ(Object.fromEntries(entries));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tour, actId]);

  return (
    <div className="animate-fade-in min-h-full py-2 space-y-4">
      <div>
        <p className="uppercase tracking-[0.12em] font-display font-semibold leading-tight" style={{ fontSize: 22, color: 'var(--th-primary)' }}>
          Community Forum
        </p>
        <p className="mt-0.5 text-[13px] text-text-secondary">Before we wrap up this act — anything else you&apos;re curious about? See what others asked, or add your own.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="rounded-xl bg-white border border-sandstone-light p-3.5 space-y-2.5">
              <div>
                <p className="font-display font-bold leading-snug text-text-primary" style={{ fontSize: 'clamp(15px, 4vw, 18px)' }}>
                  {q.text}
                </p>
                {q.name && <p className="text-[11px] text-text-secondary mt-0.5">— {q.name}</p>}
              </div>

              {(responsesByQ[q.id] || []).map((r) => (
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
          ))}
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
