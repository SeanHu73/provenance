'use client';

import { useState } from 'react';
import { Stop } from '@/lib/types';
import { useTour } from '@/context/TourContext';
import WhatsNext from './WhatsNext';
import FormattedText from './FormattedText';
import FullscreenPhoto from './FullscreenPhoto';
import BackButton from './BackButton';

const DEFAULT_WHAT_SHIFTED = [
  'We learned something new',
  'We changed our mind',
  'We had part of it',
  'It was as we expected',
];

const DEFAULT_REASONING_SOURCE = [
  'Something we saw here',
  'Something we discussed now',
  'Something we just learned on the tour',
  'Something we already knew',
];

interface Props {
  stop: Stop;
  isLastStop: boolean;
  onAskQuestion: () => void;
  onContinue: () => void;
  onAddReflection: (sliderValue: number, followUpResponse: string | null) => void;
}

export default function ReflectCard({
  stop,
  isLastStop,
  onAskQuestion,
  onContinue,
  onAddReflection,
}: Props) {
  const { tour, session } = useTour();
  const [sliderValue, setSliderValue] = useState(0.5);
  const [sliderReleased, setSliderReleased] = useState(false);
  const [whatShiftedChoices, setWhatShiftedChoices] = useState<string[]>([]);
  const [reasoningChoices, setReasoningChoices] = useState<string[]>([]);
  const [stopChoices, setStopChoices] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; caption: string | null } | null>(null);

  const reflect = stop.reflect ?? {
    sliderPrompt: 'How much did that change your thinking?',
    sliderLeftLabel: 'Confirmed what we thought',
    sliderRightLabel: 'Shifted our thinking completely',
    followUps: [],
    followUpOptions: null,
    reasoningSourceOptions: null,
    photos: [],
  };

  // Support both old `followUp` (single) and new `followUps` (array)
  const activeFollowUps: Array<'what_shifted' | 'reasoning_source'> =
    (reflect as { followUps?: Array<'what_shifted' | 'reasoning_source'>; followUp?: string | null }).followUps
      ?? ((reflect as unknown as { followUp?: string | null })?.followUp
        ? [(reflect as unknown as { followUp: 'what_shifted' | 'reasoning_source' }).followUp]
        : []);

  const showWhatShifted = activeFollowUps.includes('what_shifted');
  const showReasoningSource = activeFollowUps.includes('reasoning_source');

  const whatShiftedOptions = reflect.followUpOptions ?? DEFAULT_WHAT_SHIFTED;
  const reasoningOptions = (reflect as { reasoningSourceOptions?: string[] | null }).reasoningSourceOptions ?? DEFAULT_REASONING_SOURCE;

  // Stop titles for "Something we just learned on the tour" drill-down
  const completedStops = tour?.stops
    .filter((s) => session?.completedStops.includes(s.id) || s.id === stop.id)
    .map((s) => s.title || `Stop ${s.order + 1}`) ?? [];

  const showStopDrillDown = reasoningChoices.includes('Something we just learned on the tour');

  const handleSliderRelease = () => {
    if (!sliderReleased) setSliderReleased(true);
  };

  const handleSubmit = () => {
    const parts: string[] = [];
    if (whatShiftedChoices.length > 0) parts.push(`What changed: ${whatShiftedChoices.join(', ')}`);
    if (reasoningChoices.length > 0) parts.push(`Why: ${reasoningChoices.join(', ')}`);
    if (stopChoices.length > 0) parts.push(`From stops: ${stopChoices.join(', ')}`);
    onAddReflection(sliderValue, parts.length > 0 ? parts.join(' | ') : null);
    setSubmitted(true);
  };

  const handleSkip = () => {
    onAddReflection(-1, 'skipped');
    setSubmitted(true);
  };

  const toggleChip = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

  return (
    <div className="animate-fade-in flex flex-col justify-center min-h-full space-y-6">
      {!submitted ? (
        <>
          <p className="text-3xl uppercase tracking-[0.14em] font-display text-text-secondary font-semibold">
            Reflect...
          </p>

          {/* Reflection photos */}
          {(reflect.photos || []).map((photo, i) => (
            photo.url && (
              <button key={i} onClick={() => setFullscreenPhoto(photo)} className="w-full rounded-lg overflow-hidden shadow-md border border-sandstone-light text-left cursor-pointer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption || ''} className="w-full max-h-72 object-contain" />
                {photo.caption && <p className="text-xs text-text-secondary px-3 py-1.5 bg-sandstone/50 italic">{photo.caption}</p>}
              </button>
            )
          ))}

          {/* Slider */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-text-primary">
              {reflect.sliderPrompt}
            </p>
            <input
              type="range"
              min="0" max="1" step="0.01"
              value={sliderValue}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              onMouseUp={handleSliderRelease}
              onTouchEnd={handleSliderRelease}
              className="w-full accent-aged-gold"
            />
            <div className="flex justify-between text-[11px] text-text-secondary">
              <span>{reflect.sliderLeftLabel}</span>
              <span>{reflect.sliderRightLabel}</span>
            </div>
          </div>

          {/* Follow-ups — fade in after slider released */}
          {sliderReleased && (showWhatShifted || showReasoningSource) && (
            <div className="animate-fade-in space-y-5">
              {/* What changed? */}
              {showWhatShifted && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-primary">What changed?</p>
                  <div className="flex flex-wrap gap-2">
                    {whatShiftedOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setWhatShiftedChoices(toggleChip(whatShiftedChoices, opt))}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                          whatShiftedChoices.includes(opt)
                            ? 'bg-aged-gold/20 border-2 border-aged-gold text-text-primary font-semibold'
                            : 'bg-sandstone border-2 border-transparent text-text-secondary hover:border-sandstone-light'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Why did it change or not? */}
              {showReasoningSource && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-text-primary">Why did it change or not?</p>
                  <div className="flex flex-wrap gap-2">
                    {reasoningOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setReasoningChoices(toggleChip(reasoningChoices, opt))}
                        className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                          reasoningChoices.includes(opt)
                            ? 'bg-aged-gold/20 border-2 border-aged-gold text-text-primary font-semibold'
                            : 'bg-sandstone border-2 border-transparent text-text-secondary hover:border-sandstone-light'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>

                  {/* Stop drill-down for "Something we just learned on the tour" */}
                  {showStopDrillDown && completedStops.length > 0 && (
                    <div className="animate-fade-in space-y-2 pl-3 border-l-2 border-aged-gold/30">
                      <p className="text-xs text-text-secondary">Which stop(s)?</p>
                      <div className="flex flex-wrap gap-2">
                        {completedStops.map((title) => (
                          <button
                            key={title}
                            onClick={() => setStopChoices(toggleChip(stopChoices, title))}
                            className={`px-3 py-1.5 rounded-full text-xs transition-all ${
                              stopChoices.includes(title)
                                ? 'bg-aged-gold/20 border-2 border-aged-gold text-text-primary font-semibold'
                                : 'bg-sandstone border-2 border-transparent text-text-secondary hover:border-sandstone-light'
                            }`}
                          >
                            {title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Continue + Back */}
          {sliderReleased && (
            <div className="flex gap-2 animate-fade-in">
              <BackButton />
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 rounded-lg text-base font-semibold bg-text-secondary text-white"
              >
                Continue
              </button>
            </div>
          )}

          {/* Skip */}
          <button
            onClick={handleSkip}
            className="text-xs text-text-secondary/50 hover:text-text-secondary transition-colors"
          >
            Skip reflection
          </button>
        </>
      ) : stop.isFinalStop ? (
        /* Final stop — skip What's Next, go straight to closing flow */
        <div className="space-y-4">
          {stop.reveal.bridgeText && (
            <p className="text-[18px] text-text-secondary italic leading-relaxed">
              <FormattedText text={stop.reveal.bridgeText} />
            </p>
          )}
          <div className="flex gap-2">
            <BackButton />
            <button
              onClick={onContinue}
              className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <WhatsNext
          stop={stop}
          isLastStop={isLastStop}
          onAskQuestion={onAskQuestion}
          onContinue={onContinue}
        />
      )}
      {fullscreenPhoto && (
        <FullscreenPhoto url={fullscreenPhoto.url} caption={fullscreenPhoto.caption} onClose={() => setFullscreenPhoto(null)} />
      )}
    </div>
  );
}
