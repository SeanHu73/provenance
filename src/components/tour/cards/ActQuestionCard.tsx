'use client';

/**
 * Context-Prototype — an Act's opening or closing question.
 *
 * Opening: a single screen — "Share what you think" header + the question +
 * the response input (choose Type or Record).
 *
 * Closing: a two-section snap-scroll — first a "Thank you for completing
 * Act N…" panel that cues a scroll down to the "Share what you think"
 * question + response input.
 *
 * The response is optional: Continue always advances, recording whatever was
 * entered.
 */

import { useEffect, useRef, useState } from 'react';
import { Act } from '@/lib/types';
import { useTour } from '@/context/TourContext';
import { logActQuestion } from '@/lib/tour-logger';
import BackButton from './BackButton';
import QuestionText from './QuestionText';
import ResponseInput from './ResponseInput';
import SnapScrollHint from './SnapScrollHint';

interface Props {
  act: Act;
  actNumber: number;
  kind: 'opening' | 'closing';
  onComplete: (response: string) => void;
}

const REVEAL_DELAY_MS = 200;
const REVEAL_TRANSITION_MS = 250;

export default function ActQuestionCard({ act, actNumber, kind, onComplete }: Props) {
  const { tour, session } = useTour();
  const question = (kind === 'opening' ? act.openingQuestion : act.closingQuestion)?.prompt || '';
  const initial = session?.actResponses?.[act.id]?.[kind] ?? '';
  const [response, setResponse] = useState(initial);

  const submit = () => {
    const text = response.trim();
    if (tour && session) {
      logActQuestion({
        tourId: tour.id,
        sessionId: session.id,
        tourTitle: tour.title,
        actTitle: act.title || `Act ${actNumber}`,
        kind,
        question,
        response: text,
      });
    }
    onComplete(text);
  };

  const header = (
    <div className="flex items-end justify-between gap-3 pr-1" style={{ color: 'var(--th-accent-dark)' }}>
      <h2 className="uppercase tracking-[0.1em] font-display font-bold leading-none" style={{ fontSize: 30 }}>
        Share what<br />you think
      </h2>
      <TalkingPersonIcon size={60} />
    </div>
  );

  const questionAndResponse = (
    <>
      {header}
      <QuestionText text={question} />
      <ResponseInput value={response} onChange={setResponse} placeholder="Record your answer, or type it here…" />
      <div className="flex gap-2">
        <BackButton />
        <button onClick={submit} className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white">
          Continue
        </button>
      </div>
    </>
  );

  // ── Opening: single section ──
  if (kind === 'opening') {
    return (
      <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center px-1 py-2">
        {questionAndResponse}
      </div>
    );
  }

  // ── Closing: thank-you intro → snap → question ──
  return <ClosingSnap actNumber={actNumber}>{questionAndResponse}</ClosingSnap>;
}

function ClosingSnap({ actNumber, children }: { actNumber: number; children: React.ReactNode }) {
  const formSectionRef = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) return;
    const el = formSectionRef.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
            timeoutId = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); if (timeoutId) clearTimeout(timeoutId); };
  }, [revealed]);

  return (
    <div className="animate-fade-in absolute inset-0 overflow-y-auto" style={{ scrollSnapType: 'y mandatory' }}>
      <section
        className="relative min-h-full flex flex-col justify-center space-y-4 px-5 pt-10 pb-6 text-center"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p className="font-display font-bold leading-tight text-text-primary" style={{ fontSize: 'clamp(26px, 6.5vw, 38px)' }}>
          Thank you for completing Act {actNumber}.
        </p>
        <p className="text-[20px] italic text-text-secondary leading-relaxed">
          Let&apos;s see what you learned…
        </p>
        <SnapScrollHint />
      </section>
      <section
        ref={formSectionRef}
        className="min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease-out, transform ${REVEAL_TRANSITION_MS}ms ease-out`,
        }}
      >
        {children}
      </section>
    </div>
  );
}

function TalkingPersonIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Person */}
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20.5v-1a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5v1" />
      {/* Speech bubble */}
      <path d="M16 3h4a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1l-1.8 2v-2H16a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    </svg>
  );
}
