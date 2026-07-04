'use client';

/**
 * Context-Prototype — after the Context section, ask the explorer if they have
 * their own context question. Flow: tap "Ask your own question" → pick the
 * P.A.S.T. lens they're asking through → type or dictate the question → the
 * Context Detective (/api/context-answer) researches and answers. The chosen
 * lens is the stamped entry lens the pipeline never generates itself.
 */

import { useState } from 'react';
import { useTour } from '@/context/TourContext';
import { findActOfStop } from '@/lib/tour-session';
import { ContextQuestionEntry, PastLens } from '@/lib/types';
import { LENSES, LENS_BY_KEY } from '@/features/context-journal/constants';
import { logContextQuestion } from '@/lib/tour-logger';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import ResponseInput from './ResponseInput';
import OpenAiSpeechBar from './OpenAiSpeechBar';
import ContextAskLoading from './ContextAskLoading';
import BackButton from './BackButton';

interface Props {
  onComplete: (asked: ContextQuestionEntry[]) => void;
}

type Phase = 'idle' | 'lens' | 'compose';

export default function ContextQuestionsCard({ onComplete }: Props) {
  const { tour, session, currentStop } = useTour();
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  const [autoplayPref] = useAudioAutoplay();

  const [entries, setEntries] = useState<ContextQuestionEntry[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [lens, setLens] = useState<PastLens | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const resetComposer = () => { setPhase('idle'); setLens(null); setDraft(''); };

  const ask = async () => {
    const question = draft.trim();
    if (!question || busy) return;
    setBusy(true);
    let entry: ContextQuestionEntry = { question, answer: null, status: 'banked' };
    try {
      const res = await fetch('/api/context-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, tourId: tour?.id, actId: act?.id, lens }),
      });
      if (res.ok) {
        // The Context Detective returns the full payload; for this card we show
        // the voiced narrative. (Handout/sources are logged + surfaced in the
        // admin review console; richer in-tour rendering comes later.)
        const data = (await res.json()) as { narrative?: string; status?: 'answered' | 'banked' | 'declined' };
        const narrative = (data.narrative || '').trim();
        entry = { question, answer: narrative || null, status: narrative ? 'answered' : 'banked' };
      }
    } catch {
      /* keep the banked fallback */
    }
    setEntries((prev) => [...prev, entry]);
    resetComposer();
    setBusy(false);
    if (tour && act) {
      logContextQuestion({
        tourId: tour.id, sessionId: session?.id || 'unknown', tourTitle: tour.title,
        actTitle: act.title, question: entry.question, answer: entry.answer || `(${entry.status})`,
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-5">
      <h2
        className="uppercase tracking-[0.12em] font-display font-bold leading-none"
        style={{ fontSize: 40, color: 'var(--th-accent-dark)' }}
      >
        Have a question?
      </h2>
      <p className="text-[17px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Curious about anything here? Ask and I&apos;ll help you look it up.
      </p>

      {/* Already-asked questions + their answers */}
      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <div key={i} className="rounded-xl p-3" style={{ backgroundColor: 'var(--th-surface-alt)' }}>
              <p className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                &ldquo;{e.question}&rdquo;
              </p>
              {e.status === 'answered' && e.answer ? (
                <>
                  <p className="text-[16px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-primary)' }}>{e.answer}</p>
                  <div className="mt-2">
                    <OpenAiSpeechBar text={e.answer} title="Answer" autoplay={autoplayPref} />
                  </div>
                </>
              ) : (
                <p className="text-[14px] mt-1.5 italic" style={{ color: 'var(--text-secondary)' }}>
                  Saved — I&apos;ll help you find this.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Composer state machine */}
      {busy ? (
        <ContextAskLoading />
      ) : phase === 'idle' ? (
        <button
          onClick={() => setPhase('lens')}
          className="w-full py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-2.5 text-white bg-aged-gold"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
            <path d="M10 9a2.5 2.5 0 0 1 4.8.8c0 1.7-2.3 2.2-2.3 3.4" />
            <line x1="12.4" y1="16" x2="12.41" y2="16" />
          </svg>
          Ask your own question
        </button>
      ) : phase === 'lens' ? (
        <div className="space-y-3">
          <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Which lens are you asking through?
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {LENSES.map((l) => (
              <button
                key={l.key}
                onClick={() => { setLens(l.key as PastLens); setPhase('compose'); }}
                className="py-3.5 px-3 rounded-xl text-white text-[15px] font-semibold text-left leading-tight"
                style={{ backgroundColor: l.colour }}
              >
                {l.label}
              </button>
            ))}
          </div>
          <button onClick={resetComposer} className="text-sm underline" style={{ color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {lens && (
            <div className="flex items-center gap-2 text-[13px]">
              <span>Asking through</span>
              <span className="px-2.5 py-1 rounded-full text-white font-semibold" style={{ backgroundColor: LENS_BY_KEY[lens]?.colour }}>
                {LENS_BY_KEY[lens]?.label}
              </span>
              <button onClick={() => setPhase('lens')} className="underline" style={{ color: 'var(--text-secondary)' }}>change</button>
            </div>
          )}
          <ResponseInput value={draft} onChange={setDraft} placeholder="Type or record your question…" />
          {draft.trim() && (
            <button
              onClick={ask}
              className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
            >
              Ask this question
            </button>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <BackButton />
        <button
          onClick={() => onComplete(entries)}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-accent-dark text-white"
        >
          {entries.length > 0 ? 'No more questions — continue' : "I'm good — continue"}
        </button>
      </div>
    </div>
  );
}
