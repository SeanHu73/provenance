'use client';

/**
 * Per-stop discussion question card.
 *
 * When the wonder has a `questionBackground`, the card splits into two
 * `scroll-snap` sections (background → question), mirroring SeedCard's
 * pattern. The question section is isolated — just the "Discuss" title
 * and the question text. When there's no background, the card falls
 * back to a single-section layout with the question shown directly.
 */

import { useEffect, useRef, useState } from 'react';
import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import BackButton from './BackButton';
import QuestionText from './QuestionText';
import SnapScrollHint from './SnapScrollHint';
import ActionTitle from './ActionTitle';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useRoomBarrier } from '@/components/room/useRoomBarrier';

interface Props {
  stop: Stop;
  onContinue: () => void;
  /** Whether a context (reveal) screen follows this discussion question. */
  hasContext?: boolean;
  /** True when this wonder is the final in-stop screen (no bridge → no whats_next). */
  isFinalInStop?: boolean;
  /** 0 = main wonder, 1+ = extra rounds. Used to keep the room barrier
   *  key unique per round. */
  round?: number;
}

const REVEAL_DELAY_MS = 400;
const REVEAL_TRANSITION_MS = 400;

export default function WonderCard({ stop, onContinue, hasContext = true, isFinalInStop = false, round = 0 }: Props) {
  const [autoplayPref] = useAudioAutoplay();
  const barrier = useRoomBarrier(`${stop.id}:wonder:${round}`, onContinue);
  if (!stop.wonder) return null;

  const wonder = stop.wonder;
  const background = (wonder.questionBackground || '').trim();
  const hasBackground = background.length > 0;
  const wonderAutoplay = autoplayPref && !wonder.audioAutoplayDisabled;
  const bgAutoplay = autoplayPref && !wonder.questionBackgroundAudioAutoplayDisabled;

  const buttonLabel = isFinalInStop
    ? "We've talked — continue tour"
    : hasContext
      ? "We've talked — show us"
      : "We've talked — what's next?";

  const isOpinion = wonder.questionType === 'opinion';

  // Reveal state for the question section in the snap layout.
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

  const discussTitle = <ActionTitle action="DISCUSS" opinion={isOpinion} />;
  const learnTitle = <ActionTitle action="LEARN" />;

  const continueRow = (
    <div className="space-y-2">
      {barrier.indicator}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={barrier.onPress}
          disabled={barrier.disabled}
          className="flex-1 py-3 rounded-lg text-base font-semibold text-white transition-colors disabled:opacity-50"
          style={{ backgroundColor: 'var(--th-primary)' }}
        >
          {barrier.label ?? buttonLabel}
        </button>
      </div>
    </div>
  );

  // No background → single-section layout. Question takes the new styled
  // treatment but renders directly with audio + photos around it.
  if (!hasBackground) {
    return (
      <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
        {discussTitle}
        {wonder.audioUrl && <AudioButton audioUrl={wonder.audioUrl} title={wonder.audioTitle} autoplay={wonderAutoplay} />}
        <QuestionText text={wonder.question} />
        {wonder.photos && wonder.photos.length > 0 && (
          <PhotoContent text="" photos={wonder.photos} />
        )}
        {continueRow}
      </div>
    );
  }

  // Two-section snap layout: background → "Discuss" + question.
  return (
    <div
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      <section
        className="relative min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {learnTitle}
        {wonder.questionBackgroundAudioUrl && (
          <AudioButton
            audioUrl={wonder.questionBackgroundAudioUrl}
            title={wonder.questionBackgroundAudioTitle}
            autoplay={bgAutoplay}
          />
        )}
        {wonder.audioUrl && (
          <AudioButton audioUrl={wonder.audioUrl} title={wonder.audioTitle} autoplay={wonderAutoplay} />
        )}
        <PhotoContent
          text={background}
          photos={wonder.questionBackgroundPhotos || []}
          textClass="text-[19px] leading-relaxed font-serif text-text-primary text-left"
        />
        {wonder.photos && wonder.photos.length > 0 && (
          <PhotoContent text="" photos={wonder.photos} />
        )}
        <SnapScrollHint />
      </section>

      <section
        ref={questionRef}
        className="min-h-full flex flex-col justify-center space-y-6 px-5 pt-10 pb-6"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          opacity: questionRevealed ? 1 : 0,
          transform: questionRevealed ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease-out, transform ${REVEAL_TRANSITION_MS}ms ease-out`,
        }}
      >
        {discussTitle}
        <QuestionText text={wonder.question} />
        {continueRow}
      </section>
    </div>
  );
}
