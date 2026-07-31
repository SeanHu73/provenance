'use client';

/**
 * "Your Investigation" — the opening question stage, replacing the old SHARE
 * screen that asked the learner to answer the theme question.
 *
 * The change is what's being asked of them. Answering a theme question before
 * seeing anything is guesswork; *asking your own questions* about it is the thing
 * the whole tour then teaches. So the theme question stays, but it frames their
 * questions rather than demanding an answer.
 *
 * Two snap sections, deliberately unalike:
 *   1. Black, with the title in the act screens' amber, the theme question below
 *      it, and five seconds to read both. Nothing to press — it is a title card,
 *      and it looks like the act intros for the same reason.
 *   2. The tour's ordinary surface, because this one is a working screen: they
 *      are reading a prompt, dictating into a box and pressing a button, and
 *      black-on-black made that hard to read. The theme question is centred above
 *      the prompt as the thing they are investigating.
 *
 * On submit the text is parsed into separate questions, the ones a later act
 * covers are held back, and the rest go into a silent queue that runs while they
 * explore Act 1. The learner is told none of this — they press [Let's Explore!]
 * and the answers are simply waiting for them at the end of the act.
 *
 * Portaled to document.body so the fixed overlay escapes the Journal's
 * transformed (framer-motion) ancestor (Build_State §7).
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import RecordButton from './RecordButton';
import { startInvestigation } from '@/lib/investigation-store';
import type { InvestigationQuestion } from '@/lib/types';

/** How long the title card holds before carrying them down. Long enough to read
 *  the theme question under the title, not just the title. */
const HOLD_MS = 5000;

interface Props {
  question: string;
  tourId: string;
  actId?: string;
  /** Hands the parsed questions up so they can be stored on the session. */
  onComplete: (input: { raw: string; questions: InvestigationQuestion[] }) => void;
}

export default function InvestigationCard({ question, tourId, actId, onComplete }: Props) {
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const askRef = useRef<HTMLElement | null>(null);
  const scrolled = useRef(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    // Carries them to the question screen on its own. Guarded so it can't fire
    // twice, and so scrolling down early doesn't get yanked back.
    const t = window.setTimeout(() => {
      if (scrolled.current) return;
      scrolled.current = true;
      askRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, HOLD_MS);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(t); };
  }, []);

  const submit = async () => {
    const raw = text.trim();
    if (!raw || busy) return;
    setBusy(true);
    let questions: InvestigationQuestion[] = [];
    try {
      const res = await fetch('/api/investigation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw, tourId }),
      });
      questions = (await res.json()).questions || [];
    } catch (err) {
      // Losing their questions to a network blip would be the worst outcome
      // here, since they never find out anything went wrong. Keep the raw text
      // on the session even with nothing parsed — the admin can still read it.
      console.error('[investigation] parse request failed:', err);
    }
    if (questions.length) startInvestigation({ tourId, actId, raw, questions });
    onComplete({ raw, questions });
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] select-none overflow-y-auto"
      style={{ backgroundColor: '#000', scrollSnapType: 'y mandatory' }}
    >
      {/* 1 — the title card */}
      <section
        className="relative min-h-[100dvh] flex flex-col items-center justify-center px-8 text-center"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div
          className="font-display leading-[0.95] tracking-tight"
          style={{
            // 11vw, not 15 — INVESTIGATION is thirteen characters and was
            // touching both edges on a narrow phone.
            fontSize: 'clamp(34px, 11vw, 76px)',
            color: '#F59E0B',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 900ms ease-out 200ms, transform 900ms ease-out 200ms',
          }}
        >
          YOUR<br />INVESTIGATION
        </div>
        {question.trim() && (
          <p
            className="font-serif mt-8 leading-snug text-warm-white"
            style={{
              fontSize: 'clamp(19px, 5.2vw, 28px)',
              maxWidth: '26ch',
              opacity: mounted ? 0.92 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 900ms ease-out 1000ms, transform 900ms ease-out 1000ms',
            }}
          >
            {question}
          </p>
        )}
      </section>

      {/* 2 — their questions */}
      <section
        ref={askRef}
        className="relative min-h-[100dvh] flex flex-col justify-center px-6 py-10"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always', backgroundColor: 'var(--th-bg)' }}
      >
        <h2
          className="font-display leading-tight"
          style={{ fontSize: 'clamp(26px, 7vw, 40px)', color: 'var(--text-primary)' }}
        >
          What are a couple questions <em className="not-italic" style={{ color: 'var(--th-primary)' }}>YOU</em> would ask to help you investigate?
        </h2>
        {question.trim() && (
          <p
            className="font-serif italic mt-4 leading-snug text-center mx-auto"
            style={{
              fontSize: 'clamp(17px, 4.6vw, 22px)',
              color: 'var(--ds-cardinal, #A33829)',
              maxWidth: '28ch',
            }}
          >
            {question}
          </p>
        )}

        <div className="mt-6">
          <RecordButton onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Four or five questions is a good benchmark"
          className="ds-textarea mt-3 px-4 py-3 text-[17px] font-serif"
        />

        <button
          onClick={submit}
          disabled={!text.trim() || busy}
          className="mt-5 w-full py-3.5 rounded-full text-[17px] font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          {busy ? 'One moment…' : "Let's Explore!"}
        </button>
      </section>
    </div>,
    document.body,
  );
}
