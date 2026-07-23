'use client';

/**
 * Theme question — a single tour-wide question the admin authors on the
 * Opening Frame, posed right after the scene is set. Laid out like the other
 * record-or-type screens (ActReflectionCard): a big centred record button, the
 * typed answer below it. A response is required — "Begin Exploration" stays
 * disabled until they've said or written something, then saves it to the
 * session and drops them into the first act.
 */

import { useState } from 'react';
import BackButton from './BackButton';
import RecordButton from './RecordButton';
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
      <ActionTitle action="SHARE" />
      <div>
        <SectionSubtitle className="mb-2">Before you explore&hellip;</SectionSubtitle>
        <QuestionText text={question} />
      </div>

      <div className="mt-1">
        <RecordButton onTranscript={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="…or type your response"
        className="w-full px-4 py-3 rounded-xl border-2 bg-white text-[18px] font-serif text-text-primary focus:outline-none"
        style={{ borderColor: 'var(--th-border)' }}
      />

      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={() => onComplete(text.trim())}
          disabled={!text.trim()}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white disabled:opacity-40"
        >
          Begin Exploration
        </button>
      </div>
    </div>
  );
}
