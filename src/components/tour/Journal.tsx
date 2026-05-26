'use client';

/**
 * Full-screen tour playback overlay.
 *
 * Renders the current phase card and manages transitions. Sits above
 * the map at z-40. Each phase card calls advancePhase() from context
 * when the learner is ready to proceed — the components never decide
 * what comes next; they just call "continue" and the state machine
 * in tour-session.ts determines the next phase.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTour } from '@/context/TourContext';
import { canUseBlur } from '@/lib/device-capability';
import { getActiveStops } from '@/lib/tours-store';
import { hasBridgeContent, nextPhaseWouldBeWhatsNext } from '@/lib/tour-session';
import IntroScreens from './cards/IntroScreens';
import MeetGuideCard from './cards/MeetGuideCard';
import GuideOutroCard from './cards/GuideOutroCard';
import EqSceneCard from './cards/EqSceneCard';
import EqDiscussCard from './cards/EqDiscussCard';
import EqOpeningCard from './cards/EqOpeningCard';
import EqAdditionalCard from './cards/EqAdditionalCard';
import EqClosingCard from './cards/EqClosingCard';
import EqFinalReflectCard from './cards/EqFinalReflectCard';
import EqQuestionsCard from './cards/EqQuestionsCard';
import ProgressBar from './ProgressBar';
import TourFooter from './TourFooter';
import SeedCard from './cards/SeedCard';
import NoticeCard from './cards/NoticeCard';
import WonderCard from './cards/WonderCard';
import RevealCard from './cards/RevealCard';
import ReflectCard from './cards/ReflectCard';
import FormattedText from './cards/FormattedText';
import WhatsNext from './cards/WhatsNext';
import BranchCard from './cards/BranchCard';
import EndCard from './cards/EndCard';

interface JournalProps {
  /** If provided, renders a "View on map" button (for stops at a different location). */
  onMapPeek?: () => void;
}

export default function Journal({ onMapPeek }: JournalProps) {
  const {
    tour,
    session,
    currentStop,
    isLastStop,
    goBack,
    canGoBack,
    advancePhase,
    advanceStop,
    enterBranch,
    addReflection,
    completeIntro,
    completeMeetGuide,
    completeGuideOutro,
    completeEqScene,
    completeEqDiscuss,
    completeEqOpening,
    completeEqAdditional,
    completeEqClosing,
    completeEqFinalReflect,
  } = useTour();

  const [paused, setPaused] = useState(false);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const [pointAtQuestion, setPointAtQuestion] = useState(false);
  const [pointAtAutoplay, setPointAtAutoplay] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) { setCanScrollMore(false); return; }
    const hasMore = el.scrollHeight - el.scrollTop - el.clientHeight > 30;
    setCanScrollMore(hasMore);
  }, []);
  const lastTapRef = useRef(0);

  // Double-tap handler: two taps within 400ms
  const handleDoubleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastTapRef.current < 400) {
      setPaused(false);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  }, []);

  if (!tour || !session) return null;

  const phase = session.currentPhase;

  const stopNum = session.currentStopIndex + 1;

  // Progress bar visibility — show during stops, hide on pre-tour/end screens
  const showProgress = !['intro', 'meet_guide', 'guide_outro', 'end'].includes(phase);

  // Determine transition type from the phase history.
  // Look at the previous entry — if it was in the same stop, slide. Otherwise fade.
  const history = session.phaseHistory || [];
  const prevEntry = history.length > 0 ? history[history.length - 1] : null;
  const isFade = !prevEntry || prevEntry.stopIndex !== session.currentStopIndex;

  // Device capability for blur
  const blurSupported = useMemo(() => canUseBlur(), []);

  // Compute effective background photo — tour default, overridden per stop
  const bgPhoto = useMemo(() => {
    if (!tour) return null;
    let photo = tour.backgroundPhotoUrl || null;
    const stops = getActiveStops(tour);
    // Walk stops up to current index, applying overrides
    for (let i = 0; i <= (session?.currentStopIndex ?? -1); i++) {
      const s = stops[i];
      // Check new field name; only fall back to legacy if new field is undefined (never set)
      const override = s?.backgroundPhotoOverride !== undefined
        ? s.backgroundPhotoOverride
        : (s as unknown as Record<string, unknown>)?.backgroundPhotoUrl as string | null;
      if (override) photo = override;
    }
    return photo;
  }, [tour, session?.currentStopIndex]);

  const [bgLoaded, setBgLoaded] = useState(false);
  useEffect(() => {
    if (!bgPhoto) { setBgLoaded(false); return; }
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = bgPhoto;
  }, [bgPhoto]);

  // Background photo shows on ALL screens when available
  const showBgPhoto = !!bgPhoto && bgLoaded;

  // Phase key for AnimatePresence
  const phaseKey = `${phase}-${session.currentRound}-${session.currentStopIndex}`;

  // Pause overlay — dark screen, double-tap to return
  if (paused) {
    return (
      <div
        className="fixed inset-0 z-40 bg-black flex items-center justify-center select-none"
        onClick={handleDoubleTap}
        onTouchEnd={handleDoubleTap}
      >
        <p className="text-white/40 text-sm tracking-wide animate-gentle-pulse pointer-events-none">
          Double tap to return to tour
        </p>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col"
      style={{ backgroundColor: 'var(--th-surface)' }}
    >
      {/* Title bar — centered, above progress */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        <div className="w-8">
          {canGoBack && phase !== 'end' && (
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full flex items-center justify-center text-warm-white hover:bg-white/15"
              title="Go back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-lg font-display font-bold text-warm-white text-center">{tour.title}</p>
        {/* Empty placeholder keeps the title centred without offering a
            mid-tour exit. Leaving the tour is only available from the
            EndCard at the natural end of the experience. */}
        <div className="w-8" />
      </div>

      {/* Progress bar */}
      {showProgress && <ProgressBar tour={tour} session={session} />}

      {/* Card area — scrollable with slide transitions */}
      <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: 'var(--th-bg)' }}>
        {/* Background photo (fixed behind cards, always visible when loaded) */}
        {bgPhoto && (
          <div
            className={`absolute inset-0 transition-opacity duration-500 ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgPhoto} alt="" className="w-full h-full object-cover" style={{ filter: `contrast(${tour.backgroundPhotoContrast ?? 100}%)` }} />
          </div>
        )}

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={phaseKey}
            initial={isFade
              ? { opacity: 0 }
              : { x: '100%' }
            }
            animate={{ x: 0, opacity: 1 }}
            exit={isFade
              ? { opacity: 0 }
              : { x: '-100%' }
            }
            transition={{ duration: isFade ? 0.4 : 0.12, ease: isFade ? 'easeInOut' : 'easeOut' }}
            className="absolute inset-0 overflow-y-auto p-4 tour-scroll"
            ref={(el) => { scrollContainerRef.current = el; checkScroll(); }}
            onScroll={checkScroll}
          >
            <div className={`min-h-full rounded-2xl shadow-lg px-5 py-6 flex flex-col justify-center ${
              showBgPhoto
                ? phase === 'reveal'
                  ? blurSupported
                    ? 'bg-warm-white/90 backdrop-blur-[10px]'
                    : 'bg-warm-white/[0.95]'
                  : blurSupported
                    ? 'bg-warm-white/80 backdrop-blur-[12px]'
                    : 'bg-warm-white/[0.85]'
                : 'bg-warm-white'
            }`}
            >

        {phase === 'intro' && (
          <IntroScreens tour={tour} onComplete={completeIntro} onPointAtQuestion={setPointAtQuestion} onPointAtAutoplay={setPointAtAutoplay} />
        )}

        {phase === 'meet_guide' && (
          <MeetGuideCard tour={tour} onContinue={completeMeetGuide} />
        )}

        {phase === 'eq_scene' && tour.essentialQuestion && (
          <EqSceneCard tour={tour} onContinue={completeEqScene} />
        )}

        {phase === 'eq_discuss' && tour.essentialQuestion && (
          <EqDiscussCard tour={tour} onContinue={completeEqDiscuss} />
        )}

        {phase === 'eq_opening' && tour.essentialQuestion && (
          <EqOpeningCard tour={tour} onComplete={completeEqOpening} />
        )}

        {phase === 'eq_additional' && tour.essentialQuestion && (
          <EqAdditionalCard tour={tour} onContinue={completeEqAdditional} />
        )}

        {phase === 'seed' && currentStop && (
          <SeedCard stop={currentStop} onContinue={advancePhase} />
        )}

        {phase === 'notice' && currentStop && (
          <NoticeCard key={currentStop.id} stop={currentStop} onContinue={advancePhase} />
        )}

        {phase === 'wonder' && currentStop && (() => {
          const round = session.currentRound;
          // Round 0 = main wonder, round 1+ = extra rounds
          const wonder = round === 0
            ? currentStop.wonder
            : (currentStop.extraRounds || [])[round - 1]?.wonder ?? null;
          if (!wonder) return null;
          // Build a minimal stop-like object for WonderCard
          const virtualStop = { ...currentStop, wonder: { ...wonder, questionType: wonder.questionType || 'discuss' } };
          // Round 0's main context always follows; an extra round may have none.
          const hasContext = round === 0
            ? true
            : ((currentStop.extraRounds || [])[round - 1]?.reveal ?? null) !== null;
          // Final in-stop screen iff the next state-machine step would
          // land on whats_next AND there is no bridge to render there.
          const isFinalInStop =
            nextPhaseWouldBeWhatsNext(currentStop, 'wonder', round) && !hasBridgeContent(currentStop);
          return (
            <WonderCard
              key={`wonder-${round}`}
              stop={virtualStop}
              onContinue={advancePhase}
              hasContext={hasContext}
              isFinalInStop={isFinalInStop}
            />
          );
        })()}

        {phase === 'reveal' && currentStop && (() => {
          const round = session.currentRound;
          const extras = currentStop.extraRounds || [];
          const isFinalInStop =
            nextPhaseWouldBeWhatsNext(currentStop, 'reveal', round) && !hasBridgeContent(currentStop);

          if (round === 0) {
            return (
              <RevealCard
                key="reveal-0"
                stop={currentStop}
                onContinue={advancePhase}
                isFinalInStop={isFinalInStop}
              />
            );
          }
          // Extra round reveal
          const extra = extras[round - 1];
          if (!extra?.reveal) return null;
          const virtualStop = {
            ...currentStop,
            reveal: {
              text: extra.reveal.text,
              photoUrl: null,
              photoCaption: null,
              photos: extra.reveal.photos || [],
              bridgeText: '',
              bridgePhotos: [],
              audioUrl: extra.reveal.audioUrl ?? null,
              audioTitle: extra.reveal.audioTitle ?? null,
            },
          };
          return (
            <RevealCard
              key={`reveal-${round}`}
              stop={virtualStop}
              onContinue={advancePhase}
              isFinalInStop={isFinalInStop}
            />
          );
        })()}

        {phase === 'whats_next' && currentStop && (
          <div className="animate-fade-in flex flex-col justify-center min-h-full space-y-6">
            {currentStop.isFinalStop && !tour.unstructuredMode ? (
              <>
                {currentStop.reveal.bridgeText && (
                  <p className="text-[18px] text-text-secondary italic leading-relaxed">
                    <FormattedText text={currentStop.reveal.bridgeText} />
                  </p>
                )}
                <button
                  onClick={advanceStop}
                  className="w-full py-3 rounded-lg text-sm font-semibold bg-olive text-white"
                >
                  Continue
                </button>
              </>
            ) : (
              <WhatsNext
                stop={currentStop}
                isLastStop={isLastStop}
                onAskQuestion={enterBranch}
                onContinue={advanceStop}
              />
            )}
          </div>
        )}

        {phase === 'reflect' && currentStop && (
          <ReflectCard
            stop={currentStop}
            isLastStop={isLastStop}
            onAskQuestion={enterBranch}
            onContinue={advanceStop}
            onAddReflection={(sliderValue, followUpResponse) => addReflection(sliderValue, followUpResponse)}
            isFinalInStop={!hasBridgeContent(currentStop)}
          />
        )}

        {phase === 'branch' && (
          <BranchCard />
        )}

        {(phase === 'eq_closing_discuss' || phase === 'eq_closing') && tour.essentialQuestion && session && (
          <EqClosingCard tour={tour} session={session} onComplete={completeEqClosing} />
        )}

        {phase === 'eq_final_reflect' && (
          <EqFinalReflectCard onComplete={completeEqFinalReflect} />
        )}

        {phase === 'eq_questions' && (
          <EqQuestionsCard />
        )}

        {phase === 'guide_outro' && (
          <GuideOutroCard tour={tour} onContinue={completeGuideOutro} />
        )}

        {phase === 'end' && (
          <EndCard />
        )}

        {/* Fallback: stop phase with no currentStop data — prevents blank screen */}
        {['seed', 'notice', 'wonder', 'reveal', 'reflect', 'whats_next', 'branch'].includes(phase) && !currentStop && (
          <div className="animate-fade-in space-y-4 min-h-full flex flex-col justify-center text-center">
            <p className="text-base text-text-secondary italic">This stop has no content yet.</p>
            <button
              onClick={advanceStop}
              className="py-3 rounded-lg text-base font-semibold bg-olive text-white"
            >
              Skip to next stop
            </button>
          </div>
        )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Scroll indicator — pill + chevron above the footer that fades
          gently in and out. Loud enough in size/contrast to be noticed,
          but the motion is a calm breath rather than a bounce. */}
      {canScrollMore && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-1 animate-gentle-fade">
            <span
              className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider shadow-lg"
              style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
            >
              Keep scrolling
            </span>
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--th-primary)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      )}

      {/* Footer bar — Journal + Ask (?) buttons. Shared with page.tsx for
          map / midway / closing phases so the buttons stay visible across
          the whole tour. */}
      {phase !== 'end' && (
        <TourFooter tour={tour} session={session} pointAtQuestion={pointAtQuestion} pointAtAutoplay={pointAtAutoplay} />
      )}
    </div>
  );
}

