'use client';

/**
 * Context-Prototype — the Community Forum, shown after each act's "Any
 * Remaining Questions" screen. Lists approved community questions as tabs;
 * tapping one shows others' approved responses and lets the explorer record
 * or type their own (submitted for moderation).
 */

import { useEffect, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { ForumQuestion, ForumResponse } from '@/lib/types';
import { getApprovedQuestions, getApprovedResponses, submitForumResponse } from '@/lib/community-store';
import BackButton from './BackButton';
import ResponseInput from './ResponseInput';
import ActionTitle from './ActionTitle';

interface Props {
  onComplete: () => void;
}

export default function CommunityForumCard({ onComplete }: Props) {
  const { tour, session } = useTour();
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [responses, setResponses] = useState<ForumResponse[]>([]);
  const [respLoading, setRespLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!tour) return;
    getApprovedQuestions(tour.id).then((qs) => { setQuestions(qs); setLoading(false); });
  }, [tour]);

  const openQuestion = async (q: ForumQuestion) => {
    setActiveId(q.id);
    setDraft('');
    setSubmitted(false);
    setRespLoading(true);
    const rs = await getApprovedResponses(q.id);
    setResponses(rs);
    setRespLoading(false);
  };

  const submitResponse = async () => {
    const t = draft.trim();
    if (t && tour && session && activeId) {
      await submitForumResponse(activeId, tour.id, t, session.id);
      setSubmitted(true);
      setDraft('');
    }
  };

  const heading = (
    <div>
      <ActionTitle action="DISCUSS" />
      <p className="mt-2 uppercase tracking-[0.12em] font-display font-semibold leading-tight" style={{ fontSize: 28, color: 'var(--th-primary)' }}>
        Community Forum
      </p>
    </div>
  );

  // ── Detail view ──
  if (activeId) {
    const q = questions.find((x) => x.id === activeId);
    return (
      <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center px-1 py-2">
        <button onClick={() => setActiveId(null)} className="self-start text-sm font-semibold text-text-secondary hover:text-text-primary">
          ← All questions
        </button>
        <p className="font-display font-bold leading-tight text-text-primary" style={{ fontSize: 'clamp(22px, 5.5vw, 30px)' }}>
          {q?.text}
        </p>

        <div className="space-y-2">
          <p className="text-[13px] uppercase tracking-wide font-semibold text-text-secondary">Responses</p>
          {respLoading ? (
            <p className="text-sm text-text-secondary italic">Loading…</p>
          ) : responses.length === 0 ? (
            <p className="text-sm text-text-secondary italic">No responses yet — be the first.</p>
          ) : (
            responses.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-white border border-sandstone-light">
                <p className="text-[16px] font-serif text-text-primary leading-relaxed">{r.text}</p>
              </div>
            ))
          )}
        </div>

        {submitted ? (
          <p className="text-sm text-olive font-semibold">&#10003; Thanks! Your response will appear once it&apos;s reviewed.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-[15px] text-text-secondary">Add your own response — it&apos;ll appear after review.</p>
            <ResponseInput value={draft} onChange={setDraft} placeholder="Share your thoughts…" />
            {draft.trim() && (
              <button onClick={submitResponse} className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white">
                Submit response
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center px-1 py-2">
      {heading}
      <p className="text-[17px] leading-relaxed text-text-secondary">
        Tap a question to see what others have shared and add your own.
      </p>

      {loading ? (
        <p className="text-sm text-text-secondary italic">Loading…</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-text-secondary italic">No community questions have been approved yet — check back later.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => (
            <button
              key={q.id}
              onClick={() => openQuestion(q)}
              className="w-full text-left p-4 rounded-xl bg-white border-2 border-sandstone-light shadow-sm hover:border-aged-gold transition-colors flex items-center justify-between gap-3"
            >
              <span className="text-[16px] font-serif text-text-primary">{q.text}</span>
              <span className="text-aged-gold text-lg shrink-0">›</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <BackButton />
        <button onClick={onComplete} className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white">
          Continue
        </button>
      </div>
    </div>
  );
}
