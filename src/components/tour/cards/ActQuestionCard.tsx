'use client';

/**
 * Context-Prototype — an Act's opening or closing question.
 *
 * Shows the act title + the authored question, then lets the explorer
 * respond by voice (transcribed) or by typing. The textbox is optional:
 * the Continue button always advances, recording whatever was entered.
 */

import { useState } from 'react';
import { Act } from '@/lib/types';
import { useTour } from '@/context/TourContext';
import { logActQuestion } from '@/lib/tour-logger';
import BackButton from './BackButton';
import MicButton from '../MicButton';
import QuestionText from './QuestionText';
import ActionTitle, { SectionSubtitle } from './ActionTitle';

interface Props {
  act: Act;
  kind: 'opening' | 'closing';
  onComplete: (response: string) => void;
}

export default function ActQuestionCard({ act, kind, onComplete }: Props) {
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
        actTitle: act.title,
        kind,
        question,
        response: text,
      });
    }
    onComplete(text);
  };

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center px-1 py-2">
      <ActionTitle action="RESPOND" />

      <div>
        <SectionSubtitle className="mb-2">
          {kind === 'opening' ? 'Before we begin…' : 'Before we move on…'}
        </SectionSubtitle>
        {act.title && (
          <p className="text-[18px] font-semibold text-text-primary">{act.title}</p>
        )}
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
