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
import PhotoContent from './PhotoContent';
import SnapScrollHint from './SnapScrollHint';
import ActionTitle, { InstructionsTitle, SectionSubtitle } from './ActionTitle';
import OpinionDial from './OpinionDial';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useRoom } from '@/context/RoomContext';
import { useRoomBarrier } from '@/components/room/useRoomBarrier';
import { useTour } from '@/context/TourContext';
import { logOpinionDial } from '@/lib/tour-logger';

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
  const barrier = useRoomBarrier('eq:additional', onContinue);

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

  const asInstructions = !!aq.questionBackgroundAsInstructions;
  // Section 2 → DISCUSS + Investigation + Opinion pill when applicable.
  const discussTitle = <ActionTitle action="DISCUSS" opinion={isOpinion} investigation />;

  const instruction = (
    <p className="text-[18px] text-text-secondary italic leading-relaxed">
      {isOpinion
        ? 'Share your thoughts with your group before continuing.'
        : 'Talk this over with your group before continuing.'}
    </p>
  );

  const { isInRoom } = useRoom();
  const useDial =
    isOpinion &&
    isInRoom &&
    !!(aq.opinionSpectrumLeft || '').trim() &&
    !!(aq.opinionSpectrumRight || '').trim();

  const { session: tourSession } = useTour();

  const continueRow = useDial ? (
    <OpinionDial
      questionKey="eq:additional:0"
      leftLabel={aq.opinionSpectrumLeft!}
      rightLabel={aq.opinionSpectrumRight!}
      onContinue={onContinue}
      continueLabel="Let's find the first stop..."
      onResolved={(data) => {
        if (!tourSession) return;
        logOpinionDial({
          tourId: tour.id,
          sessionId: tourSession.id,
          tourTitle: tour.title,
          stopIndex: -1,
          stopTitle: 'EQ Additional',
          questionKey: 'eq:additional:0',
          questionText: aq.question,
          leftLabel: aq.opinionSpectrumLeft || '',
          rightLabel: aq.opinionSpectrumRight || '',
          myPosition: data.myPosition,
          otherPositions: data.otherPositions,
          similarity: data.similarity,
          averageDistance: data.averageDistance,
        });
      }}
    />
  ) : (
    <div className="space-y-2">
      {barrier.indicator}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={barrier.onPress}
          disabled={barrier.disabled}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white disabled:opacity-50"
        >
          {barrier.label ?? "Let's find the first stop..."}
        </button>
      </div>
    </div>
  );

  if (!hasBackground) {
    return (
      <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
        {discussTitle}
        <QuestionText text={aq.question} />
        {!useDial && instruction}
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
        className="relative min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {asInstructions ? (
          <InstructionsTitle />
        ) : (
          <ActionTitle action="DISCOVER" investigation />
        )}
        {aq.questionBackgroundAudioUrl && (
          <AudioButton
            audioUrl={aq.questionBackgroundAudioUrl}
            title={aq.questionBackgroundAudioTitle}
            autoplay={bgAutoplay}
          />
        )}
        <div>
          {!asInstructions && <SectionSubtitle className="mb-2">Background</SectionSubtitle>}
          <PhotoContent
            text={background}
            photos={aq.questionBackgroundPhotos || []}
            textClass="text-[19px] leading-relaxed font-serif text-text-primary text-left"
          />
        </div>
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
        <QuestionText text={aq.question} />
        {!useDial && instruction}
        {continueRow}
      </section>
    </div>
  );
}
