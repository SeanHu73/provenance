'use client';

/**
 * Essential Question — Final reflection screen.
 * Cognitive slider + follow-up chip sets + perceptual slider.
 *
 * Prompts, slider labels, and chip options come from the tour's
 * essentialQuestion config when set, falling back to the historic
 * defaults so older tours keep working unchanged.
 */

import { useState } from 'react';
import { Tour } from '@/lib/types';
import { useTour } from '@/context/TourContext';
import BackButton from './BackButton';

const DEFAULT_COGNITIVE_PROMPT = 'How much did this tour change your answer to the original question?';
const DEFAULT_COGNITIVE_LEFT = 'Confirmed what we thought';
const DEFAULT_COGNITIVE_RIGHT = 'Shifted our thinking';
const DEFAULT_PERCEPTUAL_PROMPT = 'How much did this change how you see this place?';
const DEFAULT_PERCEPTUAL_LEFT = 'Same as before';
const DEFAULT_PERCEPTUAL_RIGHT = 'I see it completely differently now';
const DEFAULT_WHAT_SHIFTED_PROMPT = 'What changed?';
const DEFAULT_WHAT_SHIFTED_OPTIONS = [
  'We learned something new',
  'We changed our mind',
  'We had part of it',
  'We were surprised',
];
const DEFAULT_REASONING_SOURCE_PROMPT = 'Why did it change or not?';
const DEFAULT_REASONING_SOURCE_OPTIONS = [
  'What we could see here',
  'Something we discussed',
  'Something we already knew',
  'A guess',
];

export const FINAL_REFLECT_DEFAULTS = {
  cognitivePrompt: DEFAULT_COGNITIVE_PROMPT,
  cognitiveLeftLabel: DEFAULT_COGNITIVE_LEFT,
  cognitiveRightLabel: DEFAULT_COGNITIVE_RIGHT,
  perceptualPrompt: DEFAULT_PERCEPTUAL_PROMPT,
  perceptualLeftLabel: DEFAULT_PERCEPTUAL_LEFT,
  perceptualRightLabel: DEFAULT_PERCEPTUAL_RIGHT,
  whatShiftedPrompt: DEFAULT_WHAT_SHIFTED_PROMPT,
  whatShiftedOptions: DEFAULT_WHAT_SHIFTED_OPTIONS,
  reasoningSourcePrompt: DEFAULT_REASONING_SOURCE_PROMPT,
  reasoningSourceOptions: DEFAULT_REASONING_SOURCE_OPTIONS,
};

interface Props {
  onComplete: (
    cognitive: number,
    perceptual: number | null,
    whatShifted: string[] | null,
    reasoningSource: string[] | null
  ) => void;
}

export default function EqFinalReflectCard({ onComplete }: Props) {
  const { tour } = useTour();
  const cfg = (tour as Tour | null)?.essentialQuestion;
  const cognitivePrompt = cfg?.finalCognitivePrompt || DEFAULT_COGNITIVE_PROMPT;
  const cognitiveLeft = cfg?.finalCognitiveLeftLabel || DEFAULT_COGNITIVE_LEFT;
  const cognitiveRight = cfg?.finalCognitiveRightLabel || DEFAULT_COGNITIVE_RIGHT;
  const perceptualPrompt = cfg?.finalPerceptualPrompt || DEFAULT_PERCEPTUAL_PROMPT;
  const perceptualLeft = cfg?.finalPerceptualLeftLabel || DEFAULT_PERCEPTUAL_LEFT;
  const perceptualRight = cfg?.finalPerceptualRightLabel || DEFAULT_PERCEPTUAL_RIGHT;
  const whatShiftedPrompt = cfg?.finalWhatShiftedPrompt || DEFAULT_WHAT_SHIFTED_PROMPT;
  const whatShiftedOpts = cfg?.finalWhatShiftedOptions && cfg.finalWhatShiftedOptions.length > 0
    ? cfg.finalWhatShiftedOptions
    : DEFAULT_WHAT_SHIFTED_OPTIONS;
  const reasoningSourcePrompt = cfg?.finalReasoningSourcePrompt || DEFAULT_REASONING_SOURCE_PROMPT;
  const reasoningSourceOpts = cfg?.finalReasoningSourceOptions && cfg.finalReasoningSourceOptions.length > 0
    ? cfg.finalReasoningSourceOptions
    : DEFAULT_REASONING_SOURCE_OPTIONS;

  const [cognitiveSlider, setCognitiveSlider] = useState(0.5);
  const [cognitiveReleased, setCognitiveReleased] = useState(false);
  const [perceptualSlider, setPerceptualSlider] = useState(0.5);
  const [whatShifted, setWhatShifted] = useState<string[]>([]);
  const [reasoningSource, setReasoningSource] = useState<string[]>([]);

  const toggleChip = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-text-secondary font-semibold">
        Final Reflections
      </p>

      {/* Cognitive slider */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">{cognitivePrompt}</p>
        <input
          type="range"
          min="0" max="1" step="0.01"
          value={cognitiveSlider}
          onChange={(e) => setCognitiveSlider(parseFloat(e.target.value))}
          onMouseUp={() => setCognitiveReleased(true)}
          onTouchEnd={() => setCognitiveReleased(true)}
          className="w-full accent-aged-gold"
        />
        <div className="flex justify-between text-[11px] text-text-secondary">
          <span>{cognitiveLeft}</span>
          <span>{cognitiveRight}</span>
        </div>
      </div>

      {/* Follow-ups — fade in after slider released */}
      {cognitiveReleased && (
        <div className="space-y-6 animate-fade-in">
          {/* What shifted — multi-select */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">{whatShiftedPrompt}</p>
            <div className="flex flex-wrap gap-2">
              {whatShiftedOpts.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setWhatShifted(toggleChip(whatShifted, opt))}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    whatShifted.includes(opt)
                      ? 'bg-aged-gold/20 border-2 border-aged-gold text-text-primary font-semibold'
                      : 'bg-sandstone border-2 border-transparent text-text-secondary hover:border-sandstone-light'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Reasoning source — multi-select */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">{reasoningSourcePrompt}</p>
            <div className="flex flex-wrap gap-2">
              {reasoningSourceOpts.map((opt) => (
                <button
                  key={opt}
                  onClick={() => setReasoningSource(toggleChip(reasoningSource, opt))}
                  className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                    reasoningSource.includes(opt)
                      ? 'bg-aged-gold/20 border-2 border-aged-gold text-text-primary font-semibold'
                      : 'bg-sandstone border-2 border-transparent text-text-secondary hover:border-sandstone-light'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Perceptual slider */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-primary">{perceptualPrompt}</p>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value={perceptualSlider}
              onChange={(e) => setPerceptualSlider(parseFloat(e.target.value))}
              className="w-full accent-aged-gold"
            />
            <div className="flex justify-between text-[11px] text-text-secondary">
              <span>{perceptualLeft}</span>
              <span>{perceptualRight}</span>
            </div>
          </div>

          {/* Continue + Back */}
          <div className="flex gap-2">
            <BackButton />
            <button
              onClick={() => onComplete(
                cognitiveSlider,
                perceptualSlider,
                whatShifted.length > 0 ? whatShifted : null,
                reasoningSource.length > 0 ? reasoningSource : null
              )}
              className="flex-1 py-3 rounded-lg text-base font-semibold bg-text-secondary text-white"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
