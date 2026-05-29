'use client';

/**
 * Picker UI for User-Choice discussion questions.
 *
 * Two modes:
 *   - List: each admin-authored question is a tappable button. An
 *     italic "Propose Your Own Question" button at the bottom flips
 *     the panel into custom mode.
 *   - Custom: textbox + submit. The custom question is also banked
 *     to the picker's Inquiries (via TourContext.bankQuestion) so it
 *     persists alongside the explorer's other open questions.
 *
 * Solo: the explorer always sees this panel.
 * Group: only the picker (first non-host) sees this; the host and
 * other non-host members see a "Your friend is choosing…" wait
 * message rendered by WonderCard, not this component.
 */

import { useState } from 'react';
import { useTour } from '@/context/TourContext';
import MicButton from '../MicButton';

interface Props {
  options: string[];
  /** Called when the picker locks in a choice. isCustom=true means the
   *  question was typed by the user rather than picked from `options`. */
  onPick: (question: string, isCustom: boolean) => void;
  /** Stable id to attribute the banked question to the right stop. */
  stopId: string;
}

export default function UserChoicePanel({ options, onPick, stopId }: Props) {
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState('');
  const { tour, session, bankQuestion } = useTour();

  const handlePickAuthored = (question: string) => {
    onPick(question, false);
  };

  const handleSubmitCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    // Bank into the picker's Inquiries so it survives past this screen.
    if (tour && session) {
      bankQuestion({
        id: `bq_${Date.now().toString(36)}`,
        tourId: tour.id,
        sessionId: session.id,
        questionText: trimmed,
        askedAfterStopId: stopId,
        aiResponse: 'banked',
        timestamp: new Date().toISOString(),
      });
    }
    onPick(trimmed, true);
  };

  if (customMode) {
    return (
      <div className="space-y-3">
        <p className="text-[15px] italic text-text-secondary leading-relaxed">
          Pose your own question for the group to discuss.
        </p>
        <div className="flex gap-2 items-start">
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="What are you curious about?"
            rows={3}
            className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[18px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
            autoFocus
          />
          <MicButton onTranscript={(t) => setCustomText((prev) => prev ? prev + ' ' + t : t)} />
        </div>
        <button
          onClick={handleSubmitCustom}
          disabled={!customText.trim()}
          className="w-full py-3 rounded-lg text-base font-semibold text-white transition-colors disabled:opacity-40"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          Use this question
        </button>
        <button
          onClick={() => setCustomMode(false)}
          className="w-full py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          ← Back to options
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {options.map((q, i) => (
        <button
          key={i}
          onClick={() => handlePickAuthored(q)}
          className="block w-full text-left px-4 py-3 rounded-xl border-2 text-[17px] font-serif leading-snug transition-colors"
          style={{
            color: 'var(--th-text-primary)',
            borderColor: 'var(--th-border)',
            backgroundColor: 'color-mix(in srgb, var(--th-surface) 85%, transparent)',
          }}
        >
          {q}
        </button>
      ))}
      <button
        onClick={() => setCustomMode(true)}
        className="block w-full text-center px-4 py-3 rounded-xl text-[16px] font-serif italic hover:underline"
        style={{ color: 'var(--th-primary)' }}
      >
        Propose Your Own Question
      </button>
    </div>
  );
}
