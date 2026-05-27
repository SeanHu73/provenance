'use client';

/**
 * "Question for you! Please discuss..." — poses the essential question
 * for verbal discussion before written prompts.
 *
 * Mirrors WonderCard: if the EQ has a `questionBackground`, the card
 * splits into two snap-scroll sections (background → "Discuss" + question).
 * Otherwise the question renders directly as plain styled text.
 */

import { useEffect, useRef, useState } from 'react';
import { Tour } from '@/lib/types';
import BackButton from './BackButton';
import AudioButton from './AudioButton';
import QuestionText from './QuestionText';
import PhotoContent from './PhotoContent';
import SnapScrollHint from './SnapScrollHint';
import { useRoomBarrier } from '@/components/room/useRoomBarrier';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  tour: Tour;
  onContinue: () => void;
}

const REVEAL_DELAY_MS = 400;
const REVEAL_TRANSITION_MS = 400;

export default function EqDiscussCard({ tour, onContinue }: Props) {
  const eq = tour.essentialQuestion!;
  const [autoplayPref] = useAudioAutoplay();
  const background = (eq.questionBackground || '').trim();
  const hasBackground = background.length > 0;
  const bgAutoplay = autoplayPref && !eq.questionBackgroundAudioAutoplayDisabled;
  const barrier = useRoomBarrier('eq:discuss', onContinue);

  const questionRef = useRef<HTMLElement | null>(null);
  const [questionRevealed, setQuestionRevealed] = useState(false);

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

  const titleBlock = (
    <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
      Question for you!
    </p>
  );

  const instruction = (
    <p className="text-[18px] text-text-secondary italic leading-relaxed">
      Talk this over with your group before continuing.
    </p>
  );

  const continueRow = (
    <div className="space-y-2">
      {barrier.indicator}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={barrier.onPress}
          disabled={barrier.disabled}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white disabled:opacity-50"
        >
          {barrier.label ?? "Discussed! What's next?"}
        </button>
      </div>
    </div>
  );

  // Single-section fallback when there's no background.
  if (!hasBackground) {
    return (
      <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
        {titleBlock}
        <QuestionText text={eq.question} />
        {instruction}
        {continueRow}
      </div>
    );
  }

  // Two-section snap layout.
  return (
    <div
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      <section
        className="relative min-h-full flex flex-col justify-center space-y-5 px-5 py-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {titleBlock}
        {eq.questionBackgroundAudioUrl && (
          <AudioButton
            audioUrl={eq.questionBackgroundAudioUrl}
            title={eq.questionBackgroundAudioTitle}
            autoplay={bgAutoplay}
          />
        )}
        <PhotoContent
          text={background}
          photos={eq.questionBackgroundPhotos || []}
          textClass="text-[19px] leading-relaxed font-serif text-text-primary text-left"
        />
        <SnapScrollHint />
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
        <QuestionText text={eq.question} />
        {instruction}
        {continueRow}
      </section>
    </div>
  );
}
