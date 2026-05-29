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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import BackButton from './BackButton';
import QuestionText from './QuestionText';
import SnapScrollHint from './SnapScrollHint';
import ActionTitle, { InstructionsTitle, SectionSubtitle } from './ActionTitle';
import OpinionDial from './OpinionDial';
import UserChoicePanel from './UserChoicePanel';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useRoom } from '@/context/RoomContext';
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

  const asInstructions = !!wonder.questionBackgroundAsInstructions;
  const discussTitle = <ActionTitle action="DISCUSS" opinion={isOpinion} />;

  const { room, mySessionId, isInRoom, selectUserChoiceQuestion } = useRoom();
  const opinionKey = `${stop.id}:wonder:${round}`;
  const useDial =
    isOpinion &&
    isInRoom &&
    !!(wonder.opinionSpectrumLeft || '').trim() &&
    !!(wonder.opinionSpectrumRight || '').trim();

  // User-choice mode: explorer (or first non-host picker) chooses the
  // question from a list or proposes their own.
  const userChoiceOptions = wonder.userChoiceQuestions ?? [];
  const useUserChoice = !!wonder.userChoiceEnabled && userChoiceOptions.filter((q) => q.trim()).length > 0;
  const userChoiceKey = opinionKey; // share the same key shape

  // Picker = first non-host member by joinedAt. Solo → self is picker.
  const pickerSessionId = useMemo(() => {
    if (!room) return null;
    const candidates = room.members.filter((m) => m.sessionId !== room.hostSessionId);
    if (candidates.length === 0) return null;
    return [...candidates].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0].sessionId;
  }, [room]);
  const isPicker = !isInRoom || mySessionId === pickerSessionId;

  // Choice source of truth: room (group) or local state (solo).
  const groupChoice = room?.userChoiceSelections?.[userChoiceKey] ?? null;
  const [localChoice, setLocalChoice] = useState<{ question: string; isCustom?: boolean } | null>(null);
  const chosen = useUserChoice ? (isInRoom ? groupChoice : localChoice) : null;

  // Auto-scroll the question section into view as soon as a choice
  // appears (either local or pushed from the room).
  const userChoiceQuestionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!chosen) return;
    const el = userChoiceQuestionRef.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [chosen?.question]);

  const handlePick = useCallback(
    (question: string, isCustom: boolean) => {
      if (isInRoom) {
        void selectUserChoiceQuestion(userChoiceKey, question, isCustom);
      } else {
        setLocalChoice({ question, isCustom });
      }
    },
    [isInRoom, selectUserChoiceQuestion, userChoiceKey],
  );

  const effectiveQuestion = useUserChoice ? (chosen?.question ?? wonder.question) : wonder.question;

  const continueRow = useDial ? (
    <OpinionDial
      questionKey={opinionKey}
      leftLabel={wonder.opinionSpectrumLeft!}
      rightLabel={wonder.opinionSpectrumRight!}
      onContinue={onContinue}
      continueLabel={buttonLabel}
    />
  ) : (
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

  // User-choice mode — two-snap-section layout: choice → question.
  // The question section auto-scrolls into view as soon as the picker
  // commits. Background-mode (`hasBackground`) is intentionally ignored
  // here so the choice screen stays the explorer's first surface.
  if (useUserChoice) {
    return (
      <div
        className="animate-fade-in absolute inset-0 overflow-y-auto"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        <section
          className="relative min-h-full flex flex-col justify-center space-y-6 px-5 pt-10 pb-6"
          style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
          {discussTitle}
          {isPicker ? (
            <UserChoicePanel
              options={userChoiceOptions.filter((q) => q.trim())}
              onPick={handlePick}
              stopId={stop.id}
            />
          ) : (
            <p className="text-center text-[20px] italic leading-relaxed py-8" style={{ color: 'var(--th-text-secondary)' }}>
              Your friend is choosing a question…
            </p>
          )}
          {chosen && <SnapScrollHint />}
        </section>
        {chosen && (
          <section
            ref={userChoiceQuestionRef}
            className="min-h-full flex flex-col justify-center space-y-6 px-5 pt-10 pb-6"
            style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
          >
            {discussTitle}
            {wonder.audioUrl && (
              <AudioButton audioUrl={wonder.audioUrl} title={wonder.audioTitle} autoplay={wonderAutoplay} />
            )}
            <QuestionText text={effectiveQuestion} />
            {wonder.photos && wonder.photos.length > 0 && (
              <PhotoContent text="" photos={wonder.photos} />
            )}
            {continueRow}
          </section>
        )}
      </div>
    );
  }

  // No background → single-section layout. Question takes the new styled
  // treatment but renders directly with audio + photos around it.
  if (!hasBackground) {
    return (
      <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
        {discussTitle}
        {wonder.audioUrl && <AudioButton audioUrl={wonder.audioUrl} title={wonder.audioTitle} autoplay={wonderAutoplay} />}
        <QuestionText text={effectiveQuestion} />
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
        {asInstructions ? <InstructionsTitle /> : <ActionTitle action="LEARN" />}
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
        <div>
          {!asInstructions && <SectionSubtitle className="mb-2">Background</SectionSubtitle>}
          <PhotoContent
            text={background}
            photos={wonder.questionBackgroundPhotos || []}
            textClass="text-[19px] leading-relaxed font-serif text-text-primary text-left"
          />
        </div>
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
        <QuestionText text={effectiveQuestion} />
        {continueRow}
      </section>
    </div>
  );
}
