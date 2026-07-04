'use client';

/**
 * Context-Prototype — after the Context section, ask the explorer if they have
 * any other context questions. They type or record→edit a question and submit;
 * a (future) AI looks for the answer. The AI is currently stubbed: /api/context-
 * answer banks the question, so we show a friendly "saved" state. They can ask
 * more, or continue.
 */

import { useState } from 'react';
import { useTour } from '@/context/TourContext';
import { findActOfStop } from '@/lib/tour-session';
import { ContextQuestionEntry } from '@/lib/types';
import { logContextQuestion } from '@/lib/tour-logger';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import ResponseInput from './ResponseInput';
import OpenAiSpeechBar from './OpenAiSpeechBar';
import BackButton from './BackButton';

interface Props {
  onComplete: (asked: ContextQuestionEntry[]) => void;
}

export default function ContextQuestionsCard({ onComplete }: Props) {
  const { tour, session, currentStop } = useTour();
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  const [autoplayPref] = useAudioAutoplay();

  const [entries, setEntries] = useState<ContextQuestionEntry[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    const question = draft.trim();
    if (!question || busy) return;
    setBusy(true);
    let entry: ContextQuestionEntry = { question, answer: null, status: 'banked' };
    try {
      const res = await fetch('/api/context-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, tourId: tour?.id, actId: act?.id }),
      });
      if (res.ok) {
        const data = (await res.json()) as { answer?: string | null; status?: 'answered' | 'banked' };
        entry = {
          question,
          answer: data.answer ?? null,
          status: data.status === 'answered' && data.answer ? 'answered' : 'banked',
        };
      }
    } catch {
      /* keep the banked fallback */
    }
    setEntries((prev) => [...prev, entry]);
    setDraft('');
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
                  {/* OpenAI narration of the answer, generated on demand — reads
                      on its own once ready when Autoplay is on (also for AI
                      answers); falls back to the free browser voice on failure. */}
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

      {/* Composer */}
      {busy ? (
        <div className="flex items-center justify-center gap-2 py-3" style={{ color: 'var(--text-secondary)' }}>
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Looking…</span>
        </div>
      ) : (
        <ResponseInput value={draft} onChange={setDraft} placeholder="Type your question…" />
      )}

      {!busy && draft.trim() && (
        <button
          onClick={ask}
          className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
        >
          Ask this question
        </button>
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
