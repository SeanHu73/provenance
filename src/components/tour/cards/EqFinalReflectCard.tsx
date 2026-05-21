'use client';

/**
 * Essential Question — Final reflection screen.
 * Cognitive slider + all follow-up reflections + perceptual slider.
 */

import { useState } from 'react';
import BackButton from './BackButton';

const WHAT_SHIFTED_OPTIONS = [
  'We learned something new',
  'We changed our mind',
  'We had part of it',
  'We were surprised',
];

const REASONING_SOURCE_OPTIONS = [
  'What we could see here',
  'Something we discussed',
  'Something we already knew',
  'A guess',
];

interface Props {
  onComplete: (
    cognitive: number,
    perceptual: number | null,
    whatShifted: string[] | null,
    reasoningSource: string[] | null
  ) => void;
}

export default function EqFinalReflectCard({ onComplete }: Props) {
  const [cognitiveSlider, setCognitiveSlider] = useState(0.5);
  const [cognitiveReleased, setCognitiveReleased] = useState(false);
  const [perceptualSlider, setPerceptualSlider] = useState(0.5);
  const [whatShifted, setWhatShifted] = useState<string[]>([]);
  const [reasoningSource, setReasoningSource] = useState<string[]>([]);

  const toggleChip = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      <p className="text-2xl uppercase tracking-[0.14em] text-text-secondary font-semibold">
        Final Reflections
      </p>

      {/* Cognitive slider */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-text-primary">
          How much did this tour change your answer to the original question?
        </p>
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
          <span>Confirmed what we thought</span>
          <span>Shifted our thinking</span>
        </div>
      </div>

      {/* Follow-ups — fade in after slider released */}
      {cognitiveReleased && (
        <div className="space-y-6 animate-fade-in">
          {/* What shifted — multi-select */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-primary">What changed?</p>
            <div className="flex flex-wrap gap-2">
              {WHAT_SHIFTED_OPTIONS.map((opt) => (
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
            <p className="text-sm font-semibold text-text-primary">Why did it change or not?</p>
            <div className="flex flex-wrap gap-2">
              {REASONING_SOURCE_OPTIONS.map((opt) => (
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
            <p className="text-sm font-semibold text-text-primary">
              How much did this change how you see this place?
            </p>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value={perceptualSlider}
              onChange={(e) => setPerceptualSlider(parseFloat(e.target.value))}
              className="w-full accent-aged-gold"
            />
            <div className="flex justify-between text-[11px] text-text-secondary">
              <span>Same as before</span>
              <span>I see it completely differently now</span>
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
