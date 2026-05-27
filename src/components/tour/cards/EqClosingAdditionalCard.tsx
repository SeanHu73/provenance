'use client';

/**
 * Additional discussion / opinion question shown after the main
 * eq_closing card and before the final-reflect sliders. The admin can
 * author 0..N of these; the explorer pages through them one at a time
 * via the session's currentRound counter.
 *
 * Mirrors EqAdditionalCard's layout: snap-scroll background → "Discuss"
 * + question when a background is set, otherwise a single section.
 */

import { useEffect, useRef, useState } from 'react';
import { Tour, TourSession } from '@/lib/types';
import BackButton from './BackButton';
import AudioButton from './AudioButton';
import QuestionText from './QuestionText';
import FormattedText from './FormattedText';
import PhotoContent from './PhotoContent';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useRoomBarrier } from '@/components/room/useRoomBarrier';

interface Props {
  tour: Tour;
  session: TourSession;
  onContinue: () => void;
}

const REVEAL_DELAY_MS = 400;
const REVEAL_TRANSITION_MS = 400;

export default function EqClosingAdditionalCard({ tour, session, onContinue }: Props) {
  const list = tour.essentialQuestion?.additionalClosingQuestions ?? [];
  const idx = session.currentRound;
  const item = list[idx];
  const [autoplayPref] = useAudioAutoplay();

  // Hooks must run unconditionally — declare before the early return.
  const background = (item?.questionBackground || '').trim();
  const hasBackground = background.length > 0;
  const barrier = useRoomBarrier(`eq:closing_additional:${idx}`, onContinue);

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

  // Reset reveal state whenever we move to a new closing question so
  // each one fades in on first scroll into view.
  useEffect(() => {
    setQuestionRevealed(false);
  }, [idx]);

  if (!item) return null;

  const isLast = idx >= list.length - 1;
  const isOpinion = item.questionType === 'opinion';
  const bgAutoplay = autoplayPref && !item.questionBackgroundAudioAutoplayDisabled;

  const titleBlock = (
    <p className="text-[26px] uppercase tracking-[0.14em] font-display text-accent-dark font-semibold">
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

  const continueLabel = isLast ? 'Continue to reflection' : 'Discussed — next question';

  const continueRow = (
    <div className="space-y-2">
      {barrier.indicator}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={barrier.onPress}
          disabled={barrier.disabled}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white disabled:opacity-50"
        >
          {barrier.label ?? continueLabel}
        </button>
      </div>
    </div>
  );

  if (!hasBackground) {
    return (
      <div key={`closing-add-${idx}`} className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
        {titleBlock}
        <QuestionText text={item.question} />
        {instruction}
        {continueRow}
      </div>
    );
  }

  return (
    <div
      key={`closing-add-${idx}`}
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      <section
        className="min-h-full flex flex-col justify-center space-y-5 px-5 py-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {titleBlock}
        {item.questionBackgroundAudioUrl && (
          <AudioButton
            audioUrl={item.questionBackgroundAudioUrl}
            title={item.questionBackgroundAudioTitle}
            autoplay={bgAutoplay}
          />
        )}
        <p className="text-[19px] leading-relaxed font-serif text-text-primary text-left">
          <FormattedText text={background} />
        </p>
        {item.questionBackgroundPhotos && item.questionBackgroundPhotos.length > 0 && (
          <PhotoContent text="" photos={item.questionBackgroundPhotos} />
        )}
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
        <p className="text-[26px] uppercase tracking-[0.14em] font-display text-accent-dark font-semibold">
          Discuss
        </p>
        <QuestionText text={item.question} />
        {instruction}
        {continueRow}
      </section>
    </div>
  );
}
