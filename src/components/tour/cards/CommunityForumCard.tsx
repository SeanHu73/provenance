'use client';

/**
 * Context-Prototype — the Community Forum, shown after each act's "Any
 * Remaining Questions" screen (skipped entirely when no questions are
 * approved). One scrollable page: each approved question with its approved
 * responses inline, an "Add a response" composer per question, and an "Add
 * question" composer at the bottom. Name + "anything we should know" are
 * collected once and reused on later stops.
 */

import { useEffect, useRef, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { ForumQuestion, ForumResponse, ForumIdentity } from '@/lib/types';
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
  const { tour } = useTour();
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [responsesByQ, setResponsesByQ] = useState<Record<string, ForumResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [addingQ, setAddingQ] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    (async () => {
      const qs = await getApprovedQuestions(tour.id);
      if (cancelled) return;
      if (qs.length === 0) { onCompleteRef.current(); return; } // skip empty forum
      setQuestions(qs);
      const entries = await Promise.all(qs.map(async (q) => [q.id, await getApprovedResponses(q.id)] as const));
      if (cancelled) return;
      setResponsesByQ(Object.fromEntries(entries));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tour]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-full py-2 space-y-6">
      <p className="uppercase tracking-[0.12em] font-display font-semibold leading-tight" style={{ fontSize: 30, color: 'var(--th-primary)' }}>
        Community Forum
      </p>

      <div className="space-y-5">
        {questions.map((q) => (
          <div key={q.id} className="rounded-xl bg-white border border-sandstone-light p-4 space-y-3">
            <div>
              <p className="font-display font-bold leading-tight text-text-primary" style={{ fontSize: 'clamp(20px, 5vw, 26px)' }}>
                {q.text}
              </p>
              {q.name && <p className="text-xs text-text-secondary mt-1">— {q.name}</p>}
            </div>

            {(responsesByQ[q.id] || []).map((r) => (
              <div key={r.id} className="pl-3 border-l-2 border-sandstone-light">
                <p className="text-[16px] font-serif text-text-primary leading-relaxed">{r.text}</p>
                {r.name && <p className="text-[11px] text-text-secondary mt-0.5">— {r.name}</p>}
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

      {/* Add question */}
      <div className="rounded-xl bg-sandstone/40 border border-sandstone-light p-4">
        {addingQ ? (
          <ResponseComposer
            submitLabel="Submit question"
            placeholder="What are you curious about?"
            onSubmit={async (text, identity) => {
              if (!tour) return;
              await submitForumQuestion(tour.id, text, sessionIdOf(), identity);
            }}
          />
        ) : (
          <button
            onClick={() => setAddingQ(true)}
            className="w-full py-3 rounded-lg text-base font-semibold text-white bg-aged-gold hover:bg-aged-gold-light transition-colors"
          >
            + Add question
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <BackButton />
        <button onClick={onComplete} className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white">
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
