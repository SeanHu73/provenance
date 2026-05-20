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
import IntroScreens from './cards/IntroScreens';
import EqOpeningCard from './cards/EqOpeningCard';
import EqClosingCard from './cards/EqClosingCard';
import EqFinalReflectCard from './cards/EqFinalReflectCard';
import EqQuestionsCard from './cards/EqQuestionsCard';
import ProgressBar from './ProgressBar';
import JournalOverlay from './JournalOverlay';
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
    completeEqOpening,
    completeEqClosing,
    completeEqFinalReflect,
    endTour,
  } = useTour();

  const [paused, setPaused] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showQuestionInput, setShowQuestionInput] = useState(false);
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

  // Progress bar visibility — show during stops, hide on intro/end
  const showProgress = !['intro', 'end'].includes(phase);

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
    // Walk stops up to current index, applying overrides
    for (let i = 0; i <= (session?.currentStopIndex ?? -1); i++) {
      const s = tour.stops[i];
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
      style={{ backgroundColor: '#FFF8EE' }}
    >
      {/* Title bar — centered, above progress */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2">
        <div className="w-8">
          {canGoBack && phase !== 'end' && (
            <button
              onClick={goBack}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B5D4F] hover:bg-[#D4BFA0]/30"
              title="Go back"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-lg font-bold text-[#2C2418] text-center">{tour.title}</p>
        <div className="w-8">
          <button
            onClick={endTour}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B5D4F] hover:bg-[#D4BFA0]/30 text-sm"
            title="Exit tour"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {showProgress && <ProgressBar tour={tour} session={session} />}

      {/* Card area — scrollable with slide transitions */}
      <div className="flex-1 overflow-hidden relative" style={{ backgroundColor: '#E8D8C0' }}>
        {/* Background photo (fixed behind cards, always visible when loaded) */}
        {bgPhoto && (
          <div
            className={`absolute inset-0 transition-opacity duration-500 ${bgLoaded ? 'opacity-100' : 'opacity-0'}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bgPhoto} alt="" className="w-full h-full object-cover" />
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
            className="absolute inset-0 overflow-y-auto p-4"
          >
            <div className={`min-h-full rounded-2xl shadow-lg px-5 py-6 ${
              showBgPhoto
                ? phase === 'reveal'
                  ? blurSupported
                    ? 'bg-[#FFF8EE]/80 backdrop-blur-[10px]'
                    : 'bg-[#FFF8EE]/85'
                  : blurSupported
                    ? 'bg-[#FFF8EE]/[0.65] backdrop-blur-[12px]'
                    : 'bg-[#FFF8EE]/75'
                : 'bg-[#FFF8EE]'
            }`}
            >

        {phase === 'intro' && (
          <IntroScreens tour={tour} onComplete={completeIntro} />
        )}

        {phase === 'eq_opening' && tour.essentialQuestion && (
          <EqOpeningCard tour={tour} onComplete={completeEqOpening} />
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
          const virtualStop = { ...currentStop, wonder };
          return <WonderCard key={`wonder-${round}`} stop={virtualStop} onContinue={advancePhase} />;
        })()}

        {phase === 'reveal' && currentStop && (() => {
          const round = session.currentRound;
          const extras = currentStop.extraRounds || [];

          if (round === 0) {
            return <RevealCard key="reveal-0" stop={currentStop} onContinue={advancePhase} />;
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
          return <RevealCard key={`reveal-${round}`} stop={virtualStop} onContinue={advancePhase} />;
        })()}

        {phase === 'whats_next' && currentStop && (
          <div className="animate-fade-in flex flex-col justify-center min-h-full space-y-6">
            {currentStop.isFinalStop ? (
              <>
                {currentStop.reveal.bridgeText && (
                  <p className="text-[18px] text-[#6B5D4F] italic leading-relaxed">
                    <FormattedText text={currentStop.reveal.bridgeText} />
                  </p>
                )}
                <button
                  onClick={advanceStop}
                  className="w-full py-3 rounded-lg text-sm font-semibold bg-[#7A7A5E] text-white"
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
          />
        )}

        {phase === 'branch' && (
          <BranchCard />
        )}

        {phase === 'eq_closing' && tour.essentialQuestion && (
          <EqClosingCard tour={tour} onComplete={completeEqClosing} />
        )}

        {phase === 'eq_final_reflect' && (
          <EqFinalReflectCard onComplete={completeEqFinalReflect} />
        )}

        {phase === 'eq_questions' && (
          <EqQuestionsCard />
        )}

        {phase === 'end' && (
          <EndCard />
        )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer bar — Journal + Question buttons */}
      {phase !== 'end' && (
        <div className="shrink-0 px-4 py-3 border-t flex items-center gap-3" style={{ borderColor: '#D4BFA0' }}>
          <button
            onClick={() => setShowJournal(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-[#5C4A35] bg-[#D4BFA0]/40 hover:bg-[#D4BFA0]/60 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
            </svg>
            Journal
          </button>
          <button
            onClick={() => setShowQuestionInput(true)}
            className="w-14 h-12 flex items-center justify-center rounded-xl text-base font-bold text-[#8B3A3A] bg-[#8B3A3A]/10 hover:bg-[#8B3A3A]/20 transition-colors"
            title="Ask a question"
          >
            ?
          </button>
        </div>
      )}

      {/* Question input overlay */}
      {showQuestionInput && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowQuestionInput(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-lg bg-[#FFF8EE] rounded-t-2xl shadow-2xl animate-slide-up flex flex-col"
            style={{ height: '50vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: '#D4BFA0' }}>
              <h3 className="text-base font-semibold text-[#2C2418]">Ask a question</h3>
              <button onClick={() => setShowQuestionInput(false)} className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B5D4F] hover:bg-[#D4BFA0]/30 text-lg">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <QuestionInputPanel
                onSubmit={() => setShowQuestionInput(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Journal overlay */}
      {showJournal && (
        <JournalOverlay tour={tour} session={session} onClose={() => setShowJournal(false)} />
      )}
    </div>
  );
}

// ─── Question Input Panel (used in the ? overlay) ───────────────

import MicButton from './MicButton';

function QuestionInputPanel({ onSubmit }: { onSubmit: () => void }) {
  const { tour, session, bankQuestion, currentStop } = useTour();
  const [question, setQuestion] = useState('');
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    if (!question.trim() || !tour || !session) return;
    bankQuestion({
      id: `bq_${Date.now().toString(36)}`,
      tourId: tour.id,
      sessionId: session.id,
      questionText: question.trim(),
      askedAfterStopId: currentStop?.id || 'unknown',
      aiResponse: 'banked',
      timestamp: new Date().toISOString(),
    });
    setQuestion('');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6B5D4F] leading-relaxed">
        Something specific or an open-ended question to be posed to the community.
      </p>
      <div className="flex gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What are you curious about?"
          rows={3}
          className="flex-1 px-4 py-3 rounded-lg border-2 border-[#D4BFA0] bg-white text-[18px] font-serif text-[#2C2418] placeholder:text-[#6B5D4F]/40 focus:outline-none focus:border-[#C4923A]"
        />
        <MicButton onTranscript={(t) => setQuestion((prev) => prev ? prev + ' ' + t : t)} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={!question.trim()}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-[#C4923A] text-white disabled:opacity-30"
        >
          {added ? '✓ Added' : 'Add question'}
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-3 rounded-lg text-base font-semibold text-[#6B5D4F] border border-[#D4BFA0]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
