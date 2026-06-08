'use client';

/**
 * Context-Prototype — an Act's opening or closing question.
 *
 * Shows the act title on a bar at the top, a "Share what you think" header
 * with a talking-person icon, then the authored question. The explorer
 * responds by voice (transcribed) or by typing. The textbox is optional:
 * Continue always advances, recording whatever was entered.
 */

import { useState } from 'react';
import { Act } from '@/lib/types';
import { useTour } from '@/context/TourContext';
import { logActQuestion } from '@/lib/tour-logger';
import BackButton from './BackButton';
import MicButton from '../MicButton';
import QuestionText from './QuestionText';
import { SectionSubtitle } from './ActionTitle';

interface Props {
  act: Act;
  actNumber: number;
  kind: 'opening' | 'closing';
  onComplete: (response: string) => void;
}

export default function ActQuestionCard({ act, actNumber, kind, onComplete }: Props) {
  const { tour, session } = useTour();
  const question = (kind === 'opening' ? act.openingQuestion : act.closingQuestion)?.prompt || '';
  const initial = session?.actResponses?.[act.id]?.[kind] ?? '';
  const [response, setResponse] = useState(initial);

  const actLabel = act.title.trim() ? `Act ${actNumber}: ${act.title}` : `Act ${actNumber}`;

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

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center px-1 py-2">
      {/* Act title bar */}
      <div
        className="rounded-lg px-3 py-2 text-center"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        <span className="font-display font-semibold tracking-wide" style={{ color: 'var(--cream, #FFF8EE)', fontSize: 18 }}>
          {actLabel}
        </span>
      </div>

      {/* "Share what you think" header — talking-person icon on the right */}
      <div className="flex items-end justify-between gap-3 pr-1" style={{ color: 'var(--th-accent-dark)' }}>
        <h2 className="uppercase tracking-[0.1em] font-display font-bold leading-none" style={{ fontSize: 30 }}>
          Share what<br />you think
        </h2>
        <TalkingPersonIcon size={60} />
      </div>

      <div>
        <SectionSubtitle className="mb-2">
          {kind === 'opening' ? 'Before we begin…' : 'Before we move on…'}
        </SectionSubtitle>
      </div>

      <QuestionText text={question} />

      {/* Voice + text response */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Record your answer, or type it here…"
            rows={3}
            className="flex-1 px-4 py-3 rounded-lg text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all border-2 border-sandstone-light bg-white"
          />
          <MicButton onTranscript={(t) => setResponse((prev) => (prev ? prev + ' ' + t : t))} />
        </div>
      </div>

      {/* Continue — always available (response optional) */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={submit}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white"
        >
          Continue
        </button>
      </div>
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
