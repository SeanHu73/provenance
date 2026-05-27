'use client';

/**
 * Additional discussion/opinion question after the written prompts,
 * before the first stop. Snap-scroll background → question when the
 * admin authored a question background; otherwise single section.
 */

import { useEffect, useRef, useState } from 'react';
import { Tour } from '@/lib/types';
import BackButton from './BackButton';
import AudioButton from './AudioButton';
import QuestionText from './QuestionText';
import FormattedText from './FormattedText';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

const REVEAL_DELAY_MS = 400;
const REVEAL_TRANSITION_MS = 400;

export default function EqAdditionalCard({ tour, onContinue }: Props) {
  const aq = tour.essentialQuestion?.additionalQuestion;
  const [autoplayPref] = useAudioAutoplay();
  const questionRef = useRef<HTMLElement | null>(null);
  const [questionRevealed, setQuestionRevealed] = useState(false);

  const background = (aq?.questionBackground || '').trim();
  const hasBackground = background.length > 0;

  useEffect(() => {
    if (!hasBackground || questionRevealed) return;
    const el = questionRef.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(10);
            }
            timeoutId = setTimeout(() => setQuestionRevealed(true), REVEAL_DELAY_MS);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [hasBackground, questionRevealed]);

  if (!aq) return null;

  const isOpinion = aq.questionType === 'opinion';
  const bgAutoplay = autoplayPref && !aq.questionBackgroundAudioAutoplayDisabled;

  const titleBlock = (
    <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
      {isOpinion ? "What's your opinion?" : 'Chance to discuss...'}
    </p>
  );

  const instruction = (
    <p className="text-[18px] text-text-secondary italic leading-relaxed">
      {isOpinion
        ? 'Share your thoughts with your group before continuing.'
        : 'Talk this over with your group before continuing.'}
    </p>
  );

  const continueRow = (
    <div className="flex gap-2">
      <BackButton />
      <button
        onClick={onContinue}
        className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white"
      >
        Let&apos;s find the first stop...
      </button>
    </div>
  );

  if (!hasBackground) {
    return (
      <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
        {titleBlock}
        <QuestionText text={aq.question} />
        {instruction}
        {continueRow}
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      <section
        className="min-h-full flex flex-col justify-center space-y-5 px-5 py-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {titleBlock}
        {aq.questionBackgroundAudioUrl && (
          <AudioButton
            audioUrl={aq.questionBackgroundAudioUrl}
            title={aq.questionBackgroundAudioTitle}
            autoplay={bgAutoplay}
          />
        )}
        <p className="text-[19px] leading-relaxed font-serif text-text-primary text-left">
          <FormattedText text={background} />
        </p>
      </section>

      <section
        ref={questionRef}
        className="min-h-full flex flex-col justify-center space-y-6 px-5 py-6"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          opacity: questionRevealed ? 1 : 0,
          transform: questionRevealed ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease-out, transform ${REVEAL_TRANSITION_MS}ms ease-out`,
        }}
      >
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
          Discuss
        </p>
        <QuestionText text={aq.question} />
        {instruction}
        {continueRow}
      </section>
    </div>
  );
}
