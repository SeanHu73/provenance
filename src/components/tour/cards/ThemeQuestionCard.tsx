'use client';

/**
 * Theme question — a single tour-wide question the admin authors on the
 * Opening Frame, posed right after the scene is set. The explorer records
 * (voice → transcript) or types one response; "Begin Exploration" saves it
 * to the session and drops them into the first act. The response is optional
 * — a "Skip for now" path leaves it blank.
 */

import { useState } from 'react';
import BackButton from './BackButton';
import MicButton from '../MicButton';
import QuestionText from './QuestionText';
import ActionTitle, { SectionSubtitle } from './ActionTitle';

interface Props {
  question: string;
  onComplete: (response: string) => void;
}

export default function ThemeQuestionCard({ question, onComplete }: Props) {
  const [text, setText] = useState('');

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center px-1">
      <ActionTitle action="RESPOND" />
      <div>
        <SectionSubtitle className="mb-2">Before you explore&hellip;</SectionSubtitle>
        <QuestionText text={question} />
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Record or type your response…"
          rows={4}
          className="flex-1 px-4 py-3 rounded-lg text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all border-2 border-sandstone-light bg-white"
        />
        <MicButton onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
      </div>

      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={() => onComplete(text.trim())}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white disabled:opacity-40"
          disabled={!text.trim()}
        >
          Begin Exploration
        </button>
      </div>

      <button
        onClick={() => onComplete('')}
        className="w-full py-3 rounded-lg text-base font-semibold text-text-secondary border-2 border-sandstone-light bg-sandstone/50 hover:bg-sandstone-light/30 transition-colors"
      >
        Skip for now
      </button>
    </div>
  );
}
