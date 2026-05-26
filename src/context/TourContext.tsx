'use client';

/**
 * React context for tour playback state.
 *
 * Provides the Tour, TourSession, and mutation functions to all tour
 * components without prop drilling. Mirrors session state to
 * sessionStorage for reload survival.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Tour, Stop, TourSession, BankedQuestion } from '@/lib/types';
import { getTour, getActiveStops } from '@/lib/tours-store';
import { persistTourSession } from '@/lib/tour-sessions-store';
import { logReflection, logQuestionRouted, logTourComplete, logEqOpening, logEqClosing, logEqFinalReflect, logStopEntered } from '@/lib/tour-logger';
import {
  createSession,
  advancePhase as advancePhaseImpl,
  advanceToNextStop as advanceToNextStopImpl,
  enterBranch as enterBranchImpl,
  returnFromBranch as returnFromBranchImpl,
  addReflection as addReflectionImpl,
  recordDetourVisit as recordDetourVisitImpl,
  goBack as goBackImpl,
  hasBridgeContent,
  completeIntro as completeIntroImpl,
  completeMeetGuide as completeMeetGuideImpl,
  completeEqScene as completeEqSceneImpl,
  completeEqDiscuss as completeEqDiscussImpl,
  completeEqAdditional as completeEqAdditionalImpl,
  completeEqOpening as completeEqOpeningImpl,
  completeEqClosing as completeEqClosingImpl,
  completeEqFinalReflect as completeEqFinalReflectImpl,
  finishTour as finishTourImpl,
  completeGuideOutro as completeGuideOutroImpl,
  bankQuestion as bankQuestionImpl,
  selectUnstructuredStop as selectUnstructuredStopImpl,
  completeMidwayCheckin as completeMidwayCheckinImpl,
  loadTourSession,
  saveTourSession,
  clearTourSession,
  getLogicalStops,
} from '@/lib/tour-session';

interface TourContextValue {
  tour: Tour | null;
  session: TourSession | null;
  currentStop: Stop | null;
  isActive: boolean;
  isLastStop: boolean;
  startTour: (tour: Tour) => void;
  goBack: () => void;
  canGoBack: boolean;
  advancePhase: () => void;
  advanceStop: () => void;
  enterBranch: () => void;
  returnFromBranch: () => void;
  addReflection: (sliderValue: number, followUpResponse: string | null) => void;
  bankQuestion: (q: BankedQuestion) => void;
  recordDetourVisit: (detourId: string) => void;
  isDetourVisited: (detourId: string) => boolean;
  completeIntro: () => void;
  completeMeetGuide: () => void;
  completeEqScene: () => void;
  completeEqDiscuss: () => void;
  completeEqOpening: (theory: string, reasoning: string) => void;
  completeEqAdditional: () => void;
  completeEqClosing: (finalReflection: string, finalReasoning: string) => void;
  completeEqFinalReflect: (cognitive: number, perceptual: number | null, whatShifted: string[] | null, reasoningSource: string[] | null) => void;
  finishTour: () => void;
  completeGuideOutro: () => void;
  endTour: () => void;
  // Unstructured exploration mode
  enterUnstructuredStop: (stopIndex: number) => void;
  completeMidwayCheckin: (responseText: string) => void;
  selectedUnstructuredStopId: string | null;
  setSelectedUnstructuredStopId: (id: string | null) => void;
}

const TourCtx = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourCtx);
  if (!ctx) throw new Error('useTour must be used inside TourProvider');
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<Tour | null>(null);
  const [session, setSession] = useState<TourSession | null>(null);
  const [selectedUnstructuredStopId, setSelectedUnstructuredStopId] = useState<string | null>(null);

  // On mount, restore any persisted session
  useEffect(() => {
    const saved = loadTourSession();
    if (saved && !saved.completedAt) {
      getTour(saved.tourId).then((t) => {
        if (t) {
          setTour(t);
          setSession(saved);
        } else {
          clearTourSession();
        }
      });
    }
  }, []);

  const persist = useCallback((s: TourSession) => {
    setSession(s);
    saveTourSession(s);
    // Fire-and-forget write to Firestore for analytics
    persistTourSession(s);
  }, []);

  const currentStop = tour && session
    ? getActiveStops(tour)[session.currentStopIndex] ?? null
    : null;

  const isLastStop = tour && session
    ? tour.unstructuredMode
      ? (session.completionOrder || []).length + 1 >= getLogicalStops(tour).length
      : session.currentStopIndex >= getActiveStops(tour).length - 1
    : false;

  const startTour = useCallback((t: Tour) => {
    const s = createSession(t);
    setTour(t);
    persist(s);
  }, [persist]);

  const canGoBack = !!(session?.phaseHistory && session.phaseHistory.length > 0);

  const goBackFn = useCallback(() => {
    if (!session) return;
    const prev = goBackImpl(session);
    if (prev) persist(prev);
  }, [session, persist]);

  const advanceStop = useCallback(() => {
    if (!session || !tour) return;
    const next = advanceToNextStopImpl(session, tour);
    persist(next);
    // Log when we actually enter a new stop (linear mode)
    if (next.currentPhase === 'seed' && next.currentStopIndex !== session.currentStopIndex && next.currentStopIndex >= 0) {
      const stop = getActiveStops(tour)[next.currentStopIndex];
      if (stop) {
        logStopEntered({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, stopIndex: next.currentStopIndex, stopTitle: stop.mergeGroup || stop.title || `Stop ${next.currentStopIndex + 1}` });
      }
    }
  }, [session, tour, persist]);

  const advancePhase = useCallback(() => {
    if (!session || !currentStop) return;
    const next = advancePhaseImpl(session, currentStop);
    // Bridge unselected → no whats_next screen; advance straight to the
    // next stop (or closing). The cards on the final in-stop screen
    // relabel their "continue" button to reflect this.
    if (next.currentPhase === 'whats_next' && !hasBridgeContent(currentStop)) {
      advanceStop();
      return;
    }
    persist(next);
  }, [session, currentStop, persist, advanceStop]);

  const enterBranch = useCallback(() => {
    if (!session) return;
    persist(enterBranchImpl(session));
  }, [session, persist]);

  const returnFromBranch = useCallback(() => {
    if (!session || !tour) return;
    persist(returnFromBranchImpl(session, tour));
  }, [session, tour, persist]);

  const addReflection = useCallback((sliderValue: number, followUpResponse: string | null) => {
    if (!session || !currentStop || !tour) return;
    persist(addReflectionImpl(session, currentStop.id, sliderValue, followUpResponse));
    logReflection({
      tourId: tour.id,
      sessionId: session.id,
      tourTitle: tour.title,
      stopIndex: session.currentStopIndex,
      stopTitle: currentStop.title || `Stop ${session.currentStopIndex + 1}`,
      score: sliderValue,
      followUpResponse,
    });
  }, [session, currentStop, tour, persist]);

  const bankQuestionFn = useCallback((q: BankedQuestion) => {
    if (!session || !tour) return;
    persist(bankQuestionImpl(session, q));
    logQuestionRouted({
      tourId: tour.id,
      sessionId: session.id,
      tourTitle: tour.title,
      stopIndex: session.currentStopIndex,
      stopTitle: currentStop?.title || `Stop ${session.currentStopIndex + 1}`,
      questionText: q.questionText,
      routing: q.aiResponse,
    });
  }, [session, tour, currentStop, persist]);

  const recordDetourVisitFn = useCallback((detourId: string) => {
    if (!session || !currentStop) return;
    persist(recordDetourVisitImpl(session, currentStop.id, detourId));
  }, [session, currentStop, persist]);

  const isDetourVisited = useCallback((detourId: string) => {
    if (!session) return false;
    return session.detourVisits.some((v) => v.detourId === detourId);
  }, [session]);

  const completeIntroFn = useCallback(() => {
    if (!session || !tour) return;
    const next = completeIntroImpl(session, tour);
    persist(next);
    // Log the first stop when intro transitions directly to seed phase (no EQ)
    if (next.currentPhase === 'seed' && next.currentStopIndex >= 0) {
      const stop = getActiveStops(tour)[next.currentStopIndex];
      if (stop) {
        logStopEntered({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, stopIndex: next.currentStopIndex, stopTitle: stop.mergeGroup || stop.title || `Stop ${next.currentStopIndex + 1}` });
      }
    }
  }, [session, tour, persist]);

  const completeMeetGuideFn = useCallback(() => {
    if (!session || !tour) return;
    const next = completeMeetGuideImpl(session, tour);
    persist(next);
    // Log the first stop when this transitions directly to seed (a tour with no EQ).
    if (next.currentPhase === 'seed' && next.currentStopIndex >= 0) {
      const stop = getActiveStops(tour)[next.currentStopIndex];
      if (stop) {
        logStopEntered({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, stopIndex: next.currentStopIndex, stopTitle: stop.mergeGroup || stop.title || `Stop ${next.currentStopIndex + 1}` });
      }
    }
  }, [session, tour, persist]);

  const completeEqSceneFn = useCallback(() => {
    if (!session) return;
    persist(completeEqSceneImpl(session));
  }, [session, persist]);

  const completeEqDiscussFn = useCallback(() => {
    if (!session) return;
    persist(completeEqDiscussImpl(session));
  }, [session, persist]);

  const completeEqAdditionalFn = useCallback(() => {
    if (!session || !tour) return;
    const next = completeEqAdditionalImpl(session, tour);
    persist(next);
    // Log first stop for EQ tours (linear mode only) — unstructured goes to map
    if (next.currentPhase === 'seed' && next.currentStopIndex >= 0) {
      const stop = getActiveStops(tour)[next.currentStopIndex];
      if (stop) {
        logStopEntered({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, stopIndex: next.currentStopIndex, stopTitle: stop.mergeGroup || stop.title || `Stop ${next.currentStopIndex + 1}` });
      }
    }
  }, [session, tour, persist]);

  const completeEqOpeningFn = useCallback((theory: string, reasoning: string) => {
    if (!session || !tour) return;
    persist(completeEqOpeningImpl(session, theory, reasoning, tour));
    logEqOpening({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, theory, reasoning });
  }, [session, tour, persist]);

  const completeEqClosingFn = useCallback((finalReflection: string, finalReasoning: string) => {
    if (!session || !tour) return;
    persist(completeEqClosingImpl(session, finalReflection, finalReasoning));
    logEqClosing({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, finalReflection, finalReasoning });
  }, [session, tour, persist]);

  const completeEqFinalReflectFn = useCallback((cognitive: number, perceptual: number | null, whatChanged: string[] | null, whyChanged: string[] | null) => {
    if (!session || !tour) return;
    persist(completeEqFinalReflectImpl(session, cognitive, perceptual, whatChanged, whyChanged));
    logEqFinalReflect({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, cognitiveSlider: cognitive, perceptualSlider: perceptual, whatChanged, whyChanged });
  }, [session, tour, persist]);

  const enterUnstructuredStopFn = useCallback((stopIndex: number) => {
    if (!session || !tour) return;
    setSelectedUnstructuredStopId(null);
    persist(selectUnstructuredStopImpl(session, stopIndex));
    const stop = getActiveStops(tour)[stopIndex];
    if (stop) {
      logStopEntered({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, stopIndex, stopTitle: stop.mergeGroup || stop.title || `Stop ${stopIndex + 1}` });
    }
  }, [session, tour, persist]);

  const completeMidwayCheckinFn = useCallback((responseText: string) => {
    if (!session) return;
    persist(completeMidwayCheckinImpl(session, responseText));
  }, [session, persist]);

  const finishTourFn = useCallback(() => {
    if (!session || !tour) return;
    persist(finishTourImpl(session, tour));
    logTourComplete({
      tourId: tour.id,
      sessionId: session.id,
      tourTitle: tour.title,
      stopsCompleted: session.completedStops.length,
      totalStops: getActiveStops(tour).length,
      startedAt: session.startedAt,
    });
  }, [session, tour, persist]);

  const completeGuideOutroFn = useCallback(() => {
    if (!session) return;
    persist(completeGuideOutroImpl(session));
  }, [session, persist]);

  const endTour = useCallback(() => {
    setTour(null);
    setSession(null);
    clearTourSession();
  }, []);

  return (
    <TourCtx.Provider value={{
      tour,
      session,
      currentStop,
      isActive: tour !== null && session !== null && !['end'].includes(session.currentPhase),
      isLastStop,
      startTour,
      goBack: goBackFn,
      canGoBack,
      advancePhase,
      advanceStop,
      enterBranch,
      returnFromBranch,
      addReflection,
      bankQuestion: bankQuestionFn,
      recordDetourVisit: recordDetourVisitFn,
      isDetourVisited,
      completeIntro: completeIntroFn,
      completeMeetGuide: completeMeetGuideFn,
      completeEqScene: completeEqSceneFn,
      completeEqDiscuss: completeEqDiscussFn,
      completeEqOpening: completeEqOpeningFn,
      completeEqAdditional: completeEqAdditionalFn,
      completeEqClosing: completeEqClosingFn,
      completeEqFinalReflect: completeEqFinalReflectFn,
      finishTour: finishTourFn,
      completeGuideOutro: completeGuideOutroFn,
      endTour,
      enterUnstructuredStop: enterUnstructuredStopFn,
      completeMidwayCheckin: completeMidwayCheckinFn,
      selectedUnstructuredStopId,
      setSelectedUnstructuredStopId,
    }}>
      {children}
    </TourCtx.Provider>
  );
}
