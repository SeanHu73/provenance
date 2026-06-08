'use client';

/**
 * React context for tour playback state.
 *
 * Provides the Tour, TourSession, and mutation functions to all tour
 * components without prop drilling. Mirrors session state to
 * sessionStorage for reload survival.
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { Tour, Stop, TourSession, TourPhase, BankedQuestion } from '@/lib/types';
import { getTour, getActiveStops, getTourMode } from '@/lib/tours-store';
import { persistTourSession } from '@/lib/tour-sessions-store';
import { useRoom } from './RoomContext';
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
  completeEqClosingAdditional as completeEqClosingAdditionalImpl,
  completeEqFinalReflect as completeEqFinalReflectImpl,
  finishTour as finishTourImpl,
  completeGuideOutro as completeGuideOutroImpl,
  bankQuestion as bankQuestionImpl,
  selectUnstructuredStop as selectUnstructuredStopImpl,
  completeMidwayCheckin as completeMidwayCheckinImpl,
  completeOpeningFrame as completeOpeningFrameImpl,
  completeActIntro as completeActIntroImpl,
  completeActOpening as completeActOpeningImpl,
  completeActClosing as completeActClosingImpl,
  completeActQuestions as completeActQuestionsImpl,
  completeCommunityForum as completeCommunityForumImpl,
  completeStopMap as completeStopMapImpl,
  loadTourSession,
  saveTourSession,
  clearTourSession,
  getLogicalStops,
  newSessionId,
} from '@/lib/tour-session';

interface TourContextValue {
  tour: Tour | null;
  session: TourSession | null;
  currentStop: Stop | null;
  isActive: boolean;
  isLastStop: boolean;
  startTour: (tour: Tour, opts?: { sessionId?: string }) => void;
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
  completeEqClosing: (finalReflection: string, finalReasoning: string, additionalClosingResponses: string[]) => void;
  completeEqClosingAdditional: () => void;
  completeEqFinalReflect: (cognitive: number, perceptual: number | null, whatShifted: string[] | null, reasoningSource: string[] | null) => void;
  finishTour: () => void;
  completeGuideOutro: () => void;
  endTour: () => void;
  // Context-Prototype mode
  completeOpeningFrame: () => void;
  completeActIntro: () => void;
  completeActOpening: (response: string) => void;
  completeActClosing: (response: string) => void;
  completeActQuestions: () => void;
  completeCommunityForum: () => void;
  completeStopMap: () => void;
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

  // Multi-device room state (null when running single-player).
  const {
    room,
    mySessionId: roomSessionId,
    setMySessionId: setRoomSessionId,
    isHost: isRoomHost,
    proposeStop: proposeStopInRoom,
    markCurrentStopCompleted: markStopCompletedInRoom,
    recordHostAdvance: recordHostAdvanceInRoom,
    setGroupPhase: setGroupPhaseInRoom,
  } = useRoom();

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

  const startTour = useCallback((t: Tour, opts?: { sessionId?: string }) => {
    const s = createSession(t, { id: opts?.sessionId });
    setTour(t);
    persist(s);
  }, [persist]);

  // ─── Room sync ──────────────────────────────────────────────────
  //
  // Mirror the local TourSession.id into RoomContext so the room
  // knows who *we* are. Runs on every session change, including
  // restoration from sessionStorage.
  useEffect(() => {
    if (!session) return;
    if (roomSessionId === session.id) return;
    setRoomSessionId(session.id);
  }, [session, roomSessionId, setRoomSessionId]);

  // When room.started flips true and we don't yet have a TourSession
  // (e.g. a member who joined the room from the lobby), create one
  // with the sessionId the room knows us by, aligned to the room's
  // current stop if one is already in progress.
  useEffect(() => {
    if (!room || !room.started || session) return;
    void (async () => {
      const t = await getTour(room.tourId);
      if (!t) return;
      // Find the index of the room's currentStopId so a late joiner
      // lands on the right stop. Fallback to 0 if none.
      const stops = getActiveStops(t);
      const idx = room.currentStopId
        ? Math.max(0, stops.findIndex((s) => s.id === room.currentStopId))
        : 0;
      const aligned: TourSession = {
        ...createSession(t, { id: roomSessionId ?? newSessionId() }),
        currentStopIndex: idx,
        currentPhase: room.currentStopId ? 'seed' : (t.unstructuredMode ? 'unstructured_map' : 'intro'),
        completedStops: room.completedStopIds || [],
      };
      setTour(t);
      persist(aligned);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.started, session]);

  // Closing-flow phases run per-device — never yank a member out of
  // their own closing once they've started writing.
  const closingPhasesSet = new Set<TourPhase>([
    'eq_closing_discuss', 'eq_closing', 'eq_closing_additional',
    'eq_final_reflect', 'eq_questions', 'guide_outro', 'end',
  ]);

  // Single consolidated room → local sync. Combines what used to be a
  // currentStopId-watcher and a separate completedStops mirror; running
  // both caused them to race-overwrite each other (each `persist` used
  // the same stale `session` reference, so the second clobbered the
  // first). One effect with one persist eliminates the race and also
  // lets us mirror `completionOrder` and `groupPhase` — both required
  // for unstructured-room features (progress bar count, cluster
  // mini-map, midway threshold, closing transitions) to work.
  const roomCompletedKey = (room?.completedStopIds || []).join('|');
  const roomCOKey = (room?.completionOrder || []).join('|');
  useEffect(() => {
    if (!room || !tour || !session) return;
    const inClosing = closingPhasesSet.has(session.currentPhase);
    const stops = getActiveStops(tour);

    const updates: Partial<TourSession> = {};
    let needsHistoryEntry = false;

    if (!inClosing) {
      const nextStopId = room.currentStopId;
      if (nextStopId) {
        const idx = stops.findIndex((s) => s.id === nextStopId);
        if (idx >= 0 && idx !== session.currentStopIndex) {
          updates.currentStopIndex = idx;
          updates.currentPhase = 'seed';
          updates.currentRound = 0;
          needsHistoryEntry = true;
        }
      } else if (room.started && (room.completedStopIds?.length || 0) > 0) {
        // Mid-tour, between stops — the host's local advance state
        // machine decides which outer surface (map, midway, closing)
        // and writes it to `room.groupPhase`. Members align here.
        const targetPhase: TourPhase = room.groupPhase ?? 'unstructured_map';
        if (session.currentPhase !== targetPhase) {
          updates.currentPhase = targetPhase;
          needsHistoryEntry = true;
        }
      }
    }

    // Always mirror completedStops + completionOrder so progress bar
    // and cluster mini-map logic reflect the group's actual state
    // (even on a late-joiner / closing-flow device).
    const roomCompleted = room.completedStopIds || [];
    if (
      roomCompleted.length !== session.completedStops.length
      || !roomCompleted.every((id, i) => session.completedStops[i] === id)
    ) {
      updates.completedStops = [...roomCompleted];
    }
    const roomCO = room.completionOrder || [];
    const sessionCO = session.completionOrder || [];
    if (
      roomCO.length !== sessionCO.length
      || !roomCO.every((id, i) => sessionCO[i] === id)
    ) {
      updates.completionOrder = [...roomCO];
    }

    if (Object.keys(updates).length === 0) return;

    persist({
      ...session,
      ...updates,
      phaseHistory: needsHistoryEntry
        ? [...session.phaseHistory, {
            phase: session.currentPhase,
            round: session.currentRound,
            stopIndex: session.currentStopIndex,
          }]
        : session.phaseHistory,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.currentStopId, room?.groupPhase, room?.started, roomCompletedKey, roomCOKey, tour]);

  // Back navigation: in single-player we allow anything. In a room we
  // allow back navigation only when it stays inside the stop the
  // explorer is already in — so going wonder → seed to re-read the
  // background works, but backing out of seed onto the map (which
  // would desync from the group) doesn't.
  const canGoBack = (() => {
    const history = session?.phaseHistory;
    if (!history || history.length === 0) return false;
    if (!room || !room.started) return true;

    const last = history[history.length - 1];
    const inStopPhases = new Set<TourPhase>([
      'seed', 'notice', 'wonder', 'reveal', 'reflect',
      'whats_next', 'branch', 'off_path',
    ]);
    const closingPhases = new Set<TourPhase>([
      'eq_closing_discuss', 'eq_closing', 'eq_closing_additional',
      'eq_final_reflect', 'eq_questions', 'guide_outro', 'end',
    ]);

    const curInStop = inStopPhases.has(session!.currentPhase);
    if (curInStop) {
      // Back only if it stays in the same stop AND lands on another
      // in-stop phase (not back out to the map / midway / EQ opening).
      return inStopPhases.has(last.phase) && last.stopIndex === session!.currentStopIndex;
    }
    const curClosing = closingPhases.has(session!.currentPhase);
    if (curClosing) {
      // Within the closing flow back nav is per-device and harmless;
      // re-entering a stop from closing is blocked.
      return closingPhases.has(last.phase);
    }
    // Group-level phases (intro / EQ opening / map / midway) — no
    // back-out in room mode.
    return false;
  })();

  const goBackFn = useCallback(() => {
    if (!session) return;
    const prev = goBackImpl(session);
    if (prev) persist(prev);
  }, [session, persist]);

  const advanceStop = useCallback(() => {
    if (!session || !tour) return;
    if (room && room.started) {
      // Only host drives stop transitions; non-host advanceStop is a
      // no-op until the room signals the change.
      if (!isRoomHost) return;

      const stops = getActiveStops(tour);
      const currentStop = stops[session.currentStopIndex];
      const isFinal = currentStop?.isFinalStop || false;
      const nextIndex = session.currentStopIndex + 1;
      const closingTransition = isFinal || nextIndex >= stops.length;

      if (tour.unstructuredMode) {
        // Run the unstructured advance state machine locally. It knows
        // how to handle cluster sub-stops (return to mini-map), the
        // midway threshold, and final-stop → closing transitions.
        const next = advanceToNextStopImpl(session, tour);
        persist(next);
        // Publish the result so members align: completedStops drives the
        // pin-completed state; completionOrder drives the "N of M
        // explored" progress count and midway threshold; groupPhase
        // tells members whether to land on the map, the midway card, or
        // the closing flow.
        void recordHostAdvanceInRoom({
          completedStopIds: next.completedStops,
          completionOrder: next.completionOrder || [],
          groupPhase: next.currentPhase,
        });
        return;
      }

      // Linear room mode.
      if (closingTransition) {
        // Last stop done — run the linear advance to land on closing
        // and publish so members come along too.
        const next = advanceToNextStopImpl(session, tour);
        persist(next);
        void recordHostAdvanceInRoom({
          completedStopIds: next.completedStops,
          completionOrder: next.completionOrder || [],
          groupPhase: next.currentPhase,
        });
        return;
      }
      // Mid-tour linear: drop everyone on the map, host taps next pin.
      void markStopCompletedInRoom();
      return;
    }
    const next = advanceToNextStopImpl(session, tour);
    persist(next);
    // Log when we actually enter a new stop (linear mode)
    if (next.currentPhase === 'seed' && next.currentStopIndex !== session.currentStopIndex && next.currentStopIndex >= 0) {
      const stop = getActiveStops(tour)[next.currentStopIndex];
      if (stop) {
        logStopEntered({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, stopIndex: next.currentStopIndex, stopTitle: stop.mergeGroup || stop.title || `Stop ${next.currentStopIndex + 1}` });
      }
    }
  }, [session, tour, persist, room, isRoomHost, markStopCompletedInRoom, recordHostAdvanceInRoom]);

  const advancePhase = useCallback(() => {
    if (!session || !currentStop || !tour) return;
    // Context mode skips per-stop discussion questions entirely.
    const isContext = getTourMode(tour) === 'context';
    const next = advancePhaseImpl(session, currentStop, { skipWonder: isContext });
    // Bridge unselected (or context mode, which has no bridge) → no whats_next
    // screen; advance straight to the next stop (or closing). The cards on the
    // final in-stop screen relabel their "continue" button to reflect this.
    if (next.currentPhase === 'whats_next' && (isContext || !hasBridgeContent(currentStop))) {
      advanceStop();
      return;
    }
    persist(next);
  }, [session, currentStop, tour, persist, advanceStop]);

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

  const completeEqClosingFn = useCallback((finalReflection: string, finalReasoning: string, additionalClosingResponses: string[]) => {
    if (!session || !tour) return;
    persist(completeEqClosingImpl(session, finalReflection, finalReasoning, additionalClosingResponses, tour));
    logEqClosing({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, finalReflection, finalReasoning });
  }, [session, tour, persist]);

  const completeEqClosingAdditionalFn = useCallback(() => {
    if (!session || !tour) return;
    persist(completeEqClosingAdditionalImpl(session, tour));
  }, [session, tour, persist]);

  const completeEqFinalReflectFn = useCallback((cognitive: number, perceptual: number | null, whatChanged: string[] | null, whyChanged: string[] | null) => {
    if (!session || !tour) return;
    persist(completeEqFinalReflectImpl(session, cognitive, perceptual, whatChanged, whyChanged));
    logEqFinalReflect({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, cognitiveSlider: cognitive, perceptualSlider: perceptual, whatChanged, whyChanged });
  }, [session, tour, persist]);

  const enterUnstructuredStopFn = useCallback((stopIndex: number) => {
    if (!session || !tour) return;
    // In a room, only the host can pick a stop and even they go through
    // proposeStop rather than advancing locally. Members tapping a pin
    // is a no-op.
    if (room && room.started) {
      setSelectedUnstructuredStopId(null);
      if (!isRoomHost) return;
      const stop = getActiveStops(tour)[stopIndex];
      if (stop) void proposeStopInRoom(stop.id);
      return;
    }
    setSelectedUnstructuredStopId(null);
    persist(selectUnstructuredStopImpl(session, stopIndex));
    const stop = getActiveStops(tour)[stopIndex];
    if (stop) {
      logStopEntered({ tourId: tour.id, sessionId: session.id, tourTitle: tour.title, stopIndex, stopTitle: stop.mergeGroup || stop.title || `Stop ${stopIndex + 1}` });
    }
  }, [session, tour, persist, room, isRoomHost, proposeStopInRoom]);

  const completeMidwayCheckinFn = useCallback((responseText: string) => {
    if (!session) return;
    persist(completeMidwayCheckinImpl(session, responseText));
    // Host publishes the new outer phase so members' sync effect
    // doesn't try to pull them back to the midway card after the
    // barrier resolved.
    if (room && room.started && isRoomHost) {
      void setGroupPhaseInRoom('unstructured_map');
    }
  }, [session, persist, room, isRoomHost, setGroupPhaseInRoom]);

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

  // ── Context-Prototype actions ──
  // Log a stop_entered event when a context transition lands on a stop's seed
  // (these don't go through advanceStop, so they wouldn't be logged otherwise).
  const logSeedIfEntered = useCallback((next: TourSession, t: Tour) => {
    if (next.currentPhase === 'seed' && next.currentStopIndex >= 0) {
      const stop = getActiveStops(t)[next.currentStopIndex];
      if (stop) {
        logStopEntered({ tourId: t.id, sessionId: next.id, tourTitle: t.title, stopIndex: next.currentStopIndex, stopTitle: stop.title || `Stop ${next.currentStopIndex + 1}` });
      }
    }
  }, []);

  const completeOpeningFrameFn = useCallback(() => {
    if (!session || !tour) return;
    const next = completeOpeningFrameImpl(session, tour);
    persist(next);
    logSeedIfEntered(next, tour);
  }, [session, tour, persist, logSeedIfEntered]);

  const completeActIntroFn = useCallback(() => {
    if (!session || !tour) return;
    persist(completeActIntroImpl(session, tour));
  }, [session, tour, persist]);

  const completeActQuestionsFn = useCallback(() => {
    if (!session) return;
    persist(completeActQuestionsImpl(session));
  }, [session, persist]);

  const completeCommunityForumFn = useCallback(() => {
    if (!session || !tour) return;
    persist(completeCommunityForumImpl(session, tour));
  }, [session, tour, persist]);

  const completeStopMapFn = useCallback(() => {
    if (!session || !tour) return;
    const next = completeStopMapImpl(session);
    persist(next);
    logSeedIfEntered(next, tour);
  }, [session, tour, persist, logSeedIfEntered]);

  const completeActOpeningFn = useCallback((response: string) => {
    if (!session || !tour) return;
    const next = completeActOpeningImpl(session, tour, response);
    persist(next);
    logSeedIfEntered(next, tour);
  }, [session, tour, persist, logSeedIfEntered]);

  const completeActClosingFn = useCallback((response: string) => {
    if (!session || !tour) return;
    const next = completeActClosingImpl(session, tour, response);
    persist(next);
    logSeedIfEntered(next, tour);
  }, [session, tour, persist, logSeedIfEntered]);

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
      completeEqClosingAdditional: completeEqClosingAdditionalFn,
      completeEqFinalReflect: completeEqFinalReflectFn,
      finishTour: finishTourFn,
      completeGuideOutro: completeGuideOutroFn,
      endTour,
      completeOpeningFrame: completeOpeningFrameFn,
      completeActIntro: completeActIntroFn,
      completeActOpening: completeActOpeningFn,
      completeActClosing: completeActClosingFn,
      completeActQuestions: completeActQuestionsFn,
      completeCommunityForum: completeCommunityForumFn,
      completeStopMap: completeStopMapFn,
      enterUnstructuredStop: enterUnstructuredStopFn,
      completeMidwayCheckin: completeMidwayCheckinFn,
      selectedUnstructuredStopId,
      setSelectedUnstructuredStopId,
    }}>
      {children}
    </TourCtx.Provider>
  );
}
