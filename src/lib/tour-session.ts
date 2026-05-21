/**
 * Tour session state management.
 *
 * Pure functions for creating, advancing, and persisting TourSession
 * objects. The session lives in sessionStorage so it survives page
 * reloads but resets when the tab closes — the right lifecycle for
 * a single group visit.
 */

import type { Tour, Stop, TourSession, TourPhase, BankedQuestion } from './types';

export type { TourPhase };

const STORAGE_KEY = 'mc_tour_session_v1';

// ── Phase state machine ─────────────────────────────────────────

/**
 * Advance to the next phase within a stop, handling extra rounds.
 *
 * Round 0 uses stop.wonder + stop.reveal.
 * Rounds 1+ use stop.extraRounds[round-1].wonder + .reveal.
 *
 * After each reveal, check if there's another round. If so, advance
 * to the next round's wonder (or reveal if wonder is null). If not,
 * advance to reflect (or stay on reveal if reflect is null).
 */
/** After a reveal (or skipped reveal), check for next round or go to reflect. */
function advanceFromReveal(
  currentRound: number,
  extras: Stop['extraRounds'],
  stop: Stop
): { phase: TourPhase; round: number } {
  const nextRoundIndex = currentRound; // extraRounds[0] = round 1
  if (nextRoundIndex < extras.length) {
    const nextExtra = extras[nextRoundIndex];
    if (nextExtra.wonder !== null) {
      return { phase: 'wonder', round: currentRound + 1 };
    }
    if (nextExtra.reveal !== null) {
      return { phase: 'reveal', round: currentRound + 1 };
    }
    // Both null — skip this round entirely, try the next
    return advanceFromReveal(currentRound + 1, extras, stop);
  }
  // No more rounds — go to reflect or whats_next
  // Final stops without reflect skip whats_next entirely
  if (stop.reflect !== null) {
    return { phase: 'reflect', round: currentRound };
  }
  if (stop.isFinalStop) {
    return { phase: 'whats_next', round: currentRound }; // whats_next will auto-continue to closing
  }
  return { phase: 'whats_next', round: currentRound };
}

function nextPhaseAndRound(
  current: TourPhase,
  currentRound: number,
  stop: Stop
): { phase: TourPhase; round: number } {
  const extras = stop.extraRounds || [];

  switch (current) {
    case 'seed': {
      // Seed + Notice are merged into one screen.
      // Skip notice, go directly to wonder or reveal.
      const wonder = stop.wonder;
      return wonder !== null
        ? { phase: 'wonder', round: 0 }
        : { phase: 'reveal', round: 0 };
    }

    case 'notice': {
      // Legacy — shouldn't be reached, but handle gracefully
      const wonder = stop.wonder;
      return wonder !== null
        ? { phase: 'wonder', round: 0 }
        : { phase: 'reveal', round: 0 };
    }

    case 'wonder': {
      // Check if this round has a reveal
      if (currentRound === 0) {
        return { phase: 'reveal', round: 0 }; // main reveal always exists
      }
      const extra = extras[currentRound - 1];
      if (extra?.reveal !== null) {
        return { phase: 'reveal', round: currentRound };
      }
      // No reveal for this round — advance to next round or reflect
      return advanceFromReveal(currentRound, extras, stop);
    }

    case 'reveal':
      return advanceFromReveal(currentRound, extras, stop);

    default:
      return { phase: current, round: currentRound };
  }
}

/** Push current state onto the phase history before a transition. */
function pushHistory(session: TourSession): TourSession['phaseHistory'] {
  return [...(session.phaseHistory || []), {
    phase: session.currentPhase,
    round: session.currentRound,
    stopIndex: session.currentStopIndex,
  }];
}

/** Go back to the previous screen. Returns null if no history. */
export function goBack(session: TourSession): TourSession | null {
  const history = session.phaseHistory || [];
  if (history.length === 0) return null;
  const prev = history[history.length - 1];
  return {
    ...session,
    phaseHistory: history.slice(0, -1),
    currentPhase: prev.phase,
    currentRound: prev.round,
    currentStopIndex: prev.stopIndex,
  };
}

// ── Session CRUD ────────────────────────────────────────────────

// ── Unstructured mode helpers ───────────────────────────────────

/**
 * Returns the "logical stops" for unstructured mode — standalone stops plus
 * the first stop of each merge group. These are what count toward progress
 * and the midway check-in threshold.
 */
export function getLogicalStops(tour: Tour): Stop[] {
  const seenGroups = new Set<string>();
  const result: Stop[] = [];
  for (const stop of tour.stops) {
    const g = stop.mergeGroup;
    if (g) {
      if (!seenGroups.has(g)) {
        seenGroups.add(g);
        result.push(stop);
      }
    } else {
      result.push(stop);
    }
  }
  return result;
}

export function createSession(tour: Tour): TourSession {
  return {
    id: `ts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    tourId: tour.id,
    phaseHistory: [],
    currentStopIndex: 0,
    currentRound: 0,
    currentPhase: 'intro',
    completedStops: [],
    completionOrder: [],
    midwayResponseText: null,
    midwayShownAt: null,
    reflections: [],
    bankedQuestions: [],
    detourVisits: [],
    essentialQuestionResponses: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function advancePhase(session: TourSession, stop: Stop): TourSession {
  const { phase, round } = nextPhaseAndRound(session.currentPhase, session.currentRound, stop);
  return { ...session, phaseHistory: pushHistory(session), currentPhase: phase, currentRound: round };
}

export function advanceToNextStop(session: TourSession, tour: Tour): TourSession {
  if (tour.unstructuredMode) return advanceToNextStopUnstructured(session, tour);

  const currentStop = tour.stops[session.currentStopIndex];
  const isFinal = currentStop?.isFinalStop || false;
  const nextIndex = session.currentStopIndex + 1;

  // If this is marked as final stop OR there are no more stops, go to closing flow
  if (isFinal || nextIndex >= tour.stops.length) {
    const endPhase = tour.essentialQuestion ? 'eq_closing_discuss' : 'eq_questions';
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: endPhase,
      completedStops: currentStop
        ? [...session.completedStops, currentStop.id]
        : session.completedStops,
      completedAt: new Date().toISOString(),
    };
  }
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentStopIndex: nextIndex,
    currentRound: 0,
    currentPhase: 'seed',
    completedStops: currentStop
      ? [...session.completedStops, currentStop.id]
      : session.completedStops,
  };
}

/** Called after a stop completes in unstructured mode. */
function advanceToNextStopUnstructured(session: TourSession, tour: Tour): TourSession {
  const stop = tour.stops[session.currentStopIndex];
  if (!stop) return session;

  const newCompletedStops = [...session.completedStops, stop.id];
  const currentGroup = stop.mergeGroup || null;

  // If in a merge group, check whether the next stop continues the group
  if (currentGroup) {
    const nextIdx = session.currentStopIndex + 1;
    if (nextIdx < tour.stops.length && tour.stops[nextIdx].mergeGroup === currentGroup) {
      return {
        ...session,
        phaseHistory: pushHistory(session),
        currentStopIndex: nextIdx,
        currentRound: 0,
        currentPhase: 'seed',
        completedStops: newCompletedStops,
      };
    }
    // End of merge group — treat as completing one logical stop (the group leader)
    const leader = tour.stops.find((s) => s.mergeGroup === currentGroup)!;
    return finishLogicalStop(session, tour, leader.id, newCompletedStops);
  }

  // Standalone stop
  return finishLogicalStop(session, tour, stop.id, newCompletedStops);
}

function finishLogicalStop(
  session: TourSession,
  tour: Tour,
  logicalStopId: string,
  newCompletedStops: string[]
): TourSession {
  const completionOrder = [...(session.completionOrder || []), logicalStopId];
  const logicalTotal = getLogicalStops(tour).length;

  // All logical stops done → closing
  if (completionOrder.length >= logicalTotal) {
    const endPhase = tour.essentialQuestion ? 'eq_closing_discuss' : 'eq_questions';
    return {
      ...session,
      phaseHistory: pushHistory(session),
      completedStops: newCompletedStops,
      completionOrder,
      currentPhase: endPhase,
      completedAt: new Date().toISOString(),
    };
  }

  // Midway check — only once, after completing ceil(total/2) logical stops
  const midwayThreshold = Math.ceil(logicalTotal / 2);
  if (
    tour.midwayEnabled &&
    tour.midwayQuestion &&
    completionOrder.length >= midwayThreshold &&
    (session.midwayShownAt === null || session.midwayShownAt === undefined)
  ) {
    return {
      ...session,
      phaseHistory: pushHistory(session),
      completedStops: newCompletedStops,
      completionOrder,
      currentPhase: 'midway_checkin',
      midwayShownAt: completionOrder.length,
    };
  }

  return {
    ...session,
    phaseHistory: pushHistory(session),
    completedStops: newCompletedStops,
    completionOrder,
    currentPhase: 'unstructured_map',
  };
}

/** In unstructured mode: explorer taps a pin and enters that stop. */
export function selectUnstructuredStop(session: TourSession, stopIndex: number): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentStopIndex: stopIndex,
    currentRound: 0,
    currentPhase: 'seed',
  };
}

/** Explorer submits their midway check-in response and returns to the map. */
export function completeMidwayCheckin(session: TourSession, responseText: string): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    midwayResponseText: responseText,
    currentPhase: 'unstructured_map',
  };
}

export function enterBranch(session: TourSession): TourSession {
  return { ...session, phaseHistory: pushHistory(session), currentPhase: 'branch' };
}

export function enterOffPath(session: TourSession): TourSession {
  return { ...session, phaseHistory: pushHistory(session), currentPhase: 'off_path' };
}

export function returnFromBranch(session: TourSession, tour: Tour): TourSession {
  return advanceToNextStop(session, tour);
}

export function addReflection(
  session: TourSession,
  stopId: string,
  sliderValue: number,
  followUpResponse: string | null
): TourSession {
  return {
    ...session,
    reflections: [...session.reflections, { stopId, sliderValue, followUpResponse }],
  };
}

export function recordDetourVisit(
  session: TourSession,
  stopId: string,
  detourId: string
): TourSession {
  return {
    ...session,
    detourVisits: [...session.detourVisits, { stopId, detourId, timestamp: new Date().toISOString() }],
  };
}

export function completeIntro(session: TourSession, tour: Tour): TourSession {
  const afterIntro: TourPhase = tour.essentialQuestion
    ? 'eq_scene'
    : tour.unstructuredMode
      ? 'unstructured_map'
      : 'seed';
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: afterIntro,
  };
}

export function completeEqScene(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_discuss',
  };
}

export function completeEqDiscuss(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_opening',
  };
}

export function completeEqOpening(
  session: TourSession,
  theory: string,
  reasoning: string,
  tour: Tour
): TourSession {
  const hasAdditional = !!tour.essentialQuestion?.additionalQuestion;
  const afterEq: TourPhase = tour.unstructuredMode ? 'unstructured_map' : 'seed';
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: hasAdditional ? 'eq_additional' : afterEq,
    essentialQuestionResponses: {
      initialTheory: theory,
      initialReasoning: reasoning,
      finalReflection: '',
      finalReasoning: '',
      finalCognitiveSlider: 0.5,
      finalPerceptualSlider: null,
      whatShiftedResponse: null,
      reasoningSourceResponse: null,
    },
  };
}

export function completeEqAdditional(session: TourSession, tour: Tour): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: tour.unstructuredMode ? 'unstructured_map' : 'seed',
  };
}

export function completeEqClosingDiscuss(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_closing',
  };
}

export function completeEqClosing(
  session: TourSession,
  finalReflection: string,
  finalReasoning: string
): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_final_reflect',
    essentialQuestionResponses: session.essentialQuestionResponses
      ? { ...session.essentialQuestionResponses, finalReflection, finalReasoning }
      : null,
  };
}

export function completeEqFinalReflect(
  session: TourSession,
  cognitiveSlider: number,
  perceptualSlider: number | null,
  whatShifted: string[] | null,
  reasoningSource: string[] | null
): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_questions',
    essentialQuestionResponses: session.essentialQuestionResponses
      ? {
          ...session.essentialQuestionResponses,
          finalCognitiveSlider: cognitiveSlider,
          finalPerceptualSlider: perceptualSlider,
          whatShiftedResponse: whatShifted,
          reasoningSourceResponse: reasoningSource,
        }
      : null,
  };
}

export function finishTour(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'end',
    completedAt: new Date().toISOString(),
  };
}

export function bankQuestion(
  session: TourSession,
  question: BankedQuestion
): TourSession {
  return {
    ...session,
    bankedQuestions: [...session.bankedQuestions, question],
  };
}

// ── Persistence ─────────────────────────────────────────────────

export function loadTourSession(): TourSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TourSession;
  } catch {
    return null;
  }
}

export function saveTourSession(session: TourSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage full or unavailable — non-fatal
  }
}

export function clearTourSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
