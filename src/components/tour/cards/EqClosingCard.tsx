'use client';

/**
 * Essential Question — Combined closing screen.
 *
 * Single scrollable page that walks the explorer through their own arc:
 *   1. "TOUR COMPLETE" header + admin-authored closing framing + audio.
 *   2. The essential question, restated.
 *   3. "This is where you started" — read-only echo of their opening
 *      initialTheory and initialReasoning.
 *   4. "This is what you thought during the tour" — read-only echo of
 *      the midway check-in response (only if they wrote one).
 *   5. "Where are you now?" — the closing prompts with textboxes + mic
 *      so they can answer in light of what they just re-read.
 *
 * Kept on one page deliberately so the explorer can scroll back to
 * revisit any of their earlier answers while drafting the final one.
 */

import { useState } from 'react';
import { Tour, TourSession } from '@/lib/types';
import BackButton from './BackButton';
import MicButton from '../MicButton';
import FormattedText from './FormattedText';
import AudioButton from './AudioButton';
import QuestionText from './QuestionText';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  tour: Tour;
  session: TourSession;
  onComplete: (finalReflection: string, finalReasoning: string) => void;
}

export default function EqClosingCard({ tour, session, onComplete }: Props) {
  const eq = tour.essentialQuestion!;
  const [autoplayPref] = useAudioAutoplay();
  const shouldAutoplay = autoplayPref && !eq.closingAudioAutoplayDisabled;
  const [reflection, setReflection] = useState('');
  const [reasoning, setReasoning] = useState('');

  const eqr = session.essentialQuestionResponses;
  const initialTheory = eqr?.initialTheory?.trim() || '';
  const initialReasoning = eqr?.initialReasoning?.trim() || '';
  const midwayResponse = session.midwayResponseText?.trim() || '';

  return (
    <div className="animate-fade-in space-y-7 min-h-full">
      {/* Tour-complete header + closing framing/audio */}
      <div className="space-y-3">
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-accent-dark font-semibold">
          Tour complete
        </p>
        {eq.closingFraming && (
          <p className="text-[18px] text-text-secondary italic leading-relaxed">
            <FormattedText text={eq.closingFraming} />
          </p>
        )}
        {eq.closingAudioUrl && <AudioButton audioUrl={eq.closingAudioUrl} title={eq.closingAudioTitle} autoplay={shouldAutoplay} />}
      </div>

      {/* The essential question — restated. Left-aligned, themed, no
          red overlay box (matches the styling used across all
          discussion-question surfaces). */}
      <QuestionText text={eq.question} />

      {/* Where you started — echo of opening answers */}
      {(initialTheory || initialReasoning) && (
        <PriorAnswerSection label="This is where you started">
          {initialTheory && (
            <PriorAnswerBlock prompt={eq.theoryPrompt} text={initialTheory} />
          )}
          {initialReasoning && (
            <PriorAnswerBlock prompt={eq.reasoningPrompt} text={initialReasoning} />
          )}
        </PriorAnswerSection>
      )}

      {/* Midway response — only shown if the explorer wrote one */}
      {midwayResponse && (
        <PriorAnswerSection label="This is what you thought during the tour…">
          <PriorAnswerBlock prompt={tour.midwayQuestion || ''} text={midwayResponse} />
        </PriorAnswerSection>
      )}

      {/* Where are you now — the actual closing prompts */}
      <div className="space-y-5">
        <p className="text-[22px] uppercase tracking-[0.12em] font-display font-semibold text-accent-dark">
          Where are you now?
        </p>

        <div className="space-y-2">
          <p className="text-[18px] font-semibold text-text-primary">
            {eq.finalReflectionPrompt}
          </p>
          <div className="flex gap-2">
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder={eq.finalReflectionPlaceholder}
              rows={4}
              className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
            />
            <MicButton onTranscript={(t) => setReflection((prev) => prev ? prev + ' ' + t : t)} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[18px] font-semibold text-text-primary">
            {eq.finalReasoningPrompt}
          </p>
          <div className="flex gap-2">
            <textarea
              value={reasoning}
              onChange={(e) => setReasoning(e.target.value)}
              placeholder={eq.finalReasoningPlaceholder}
              rows={4}
              className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
            />
            <MicButton onTranscript={(t) => setReasoning((prev) => prev ? prev + ' ' + t : t)} />
          </div>
        </div>
      </div>

      {/* Submit + Back */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={() => onComplete(reflection.trim(), reasoning.trim())}
          disabled={!reflection.trim()}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white disabled:opacity-30"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function PriorAnswerSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--th-text-secondary)' }}>
          {label}
        </span>
        <span className="flex-1 h-px" style={{ backgroundColor: 'var(--th-border)' }} />
      </div>
      <div className="space-y-3 pl-1">{children}</div>
    </div>
  );
}

function PriorAnswerBlock({ prompt, text }: { prompt: string; text: string }) {
  return (
    <div
      className="px-4 py-3 rounded-lg border"
      style={{ borderColor: 'var(--th-border)', backgroundColor: 'color-mix(in srgb, var(--th-surface-alt) 40%, transparent)' }}
    >
      {prompt && (
        <p className="text-[12px] uppercase tracking-wide font-semibold mb-1" style={{ color: 'var(--th-text-secondary)' }}>
          {prompt}
        </p>
      )}
      <p className="text-[17px] font-serif leading-relaxed" style={{ color: 'var(--th-text-primary)' }}>
        {text}
      </p>
    </div>
  );
}
