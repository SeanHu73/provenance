/**
 * Tour session state management.
 *
 * Pure functions for creating, advancing, and persisting TourSession
 * objects. The session lives in sessionStorage so it survives page
 * reloads but resets when the tab closes — the right lifecycle for
 * a single group visit.
 */

import type { Tour, Stop, TourSession, TourPhase, BankedQuestion, Act } from './types';
import { getActiveStops, getTourMode } from './tours-store';

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
/** After a reveal (or skipped reveal), check for next round or go to reflect.
 *  `skipWonder` (context mode) treats every extra-round wonder as absent so
 *  only the context/reveal screens play. */
function advanceFromReveal(
  currentRound: number,
  extras: Stop['extraRounds'],
  stop: Stop,
  skipWonder = false
): { phase: TourPhase; round: number } {
  const nextRoundIndex = currentRound; // extraRounds[0] = round 1
  if (nextRoundIndex < extras.length) {
    const nextExtra = extras[nextRoundIndex];
    if (!skipWonder && nextExtra.wonder !== null) {
      return { phase: 'wonder', round: currentRound + 1 };
    }
    if (nextExtra.reveal !== null) {
      return { phase: 'reveal', round: currentRound + 1 };
    }
    // Both null (or wonder skipped and no reveal) — skip this round, try the next
    return advanceFromReveal(currentRound + 1, extras, stop, skipWonder);
  }
  // No more rounds — go to reflect or whats_next. (whats_next is intercepted
  // by TourContext: skipped when there's no bridge, and always in context mode,
  // where it serves only as the "end of stop" sentinel.)
  if (stop.reflect !== null) {
    return { phase: 'reflect', round: currentRound };
  }
  return { phase: 'whats_next', round: currentRound };
}

function nextPhaseAndRound(
  current: TourPhase,
  currentRound: number,
  stop: Stop,
  skipWonder = false
): { phase: TourPhase; round: number } {
  const extras = stop.extraRounds || [];

  switch (current) {
    case 'seed': {
      // Seed + Notice are merged into one screen.
      // Skip notice, go directly to wonder or reveal.
      const wonder = stop.wonder;
      return (!skipWonder && wonder !== null)
        ? { phase: 'wonder', round: 0 }
        : { phase: 'reveal', round: 0 };
    }

    case 'notice': {
      // Legacy — shouldn't be reached, but handle gracefully
      const wonder = stop.wonder;
      return (!skipWonder && wonder !== null)
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
      return advanceFromReveal(currentRound, extras, stop, skipWonder);

    default:
      return { phase: current, round: currentRound };
  }
}

/**
 * Whether the stop's reveal carries a bridge — used to decide if
 * `whats_next` is worth showing. The admin toggle wipes both fields
 * when the author turns the bridge off, so checking content is
 * sufficient.
 */
export function hasBridgeContent(stop: Stop): boolean {
  return !!(stop.reveal.bridgeText || (stop.reveal.bridgePhotos || []).length > 0);
}

/**
 * Whether the next advancePhase call would land on `whats_next`. Lets
 * the explorer cards relabel their "continue" button to the
 * end-of-stop variant when whats_next is about to be skipped.
 */
export function nextPhaseWouldBeWhatsNext(
  stop: Stop,
  currentPhase: TourPhase,
  currentRound: number,
  skipWonder = false
): boolean {
  return nextPhaseAndRound(currentPhase, currentRound, stop, skipWonder).phase === 'whats_next';
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
  for (const stop of getActiveStops(tour)) {
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

/** All stops in a merge group, in authored order. */
export function getStopsInGroup(tour: Tour, groupId: string): Stop[] {
  return getActiveStops(tour).filter((s) => s.mergeGroup === groupId);
}

/**
 * Returns the group ID currently "mid-tour" — at least one of its sub-stops
 * has been completed, but not all. When non-null, the explorer is in
 * mini-map mode: only this group's pins are shown and the next sub-stop
 * flashes. When null, we're either on the main map (no group in progress)
 * or in another phase entirely.
 */
export function getActiveGroupId(tour: Tour, session: TourSession): string | null {
  const stops = getActiveStops(tour);
  const completedSet = new Set(session.completedStops);
  const seenGroups = new Set<string>();
  for (const stop of stops) {
    const g = stop.mergeGroup;
    if (!g || seenGroups.has(g)) continue;
    seenGroups.add(g);
    const groupStops = stops.filter((s) => s.mergeGroup === g);
    const anyDone = groupStops.some((s) => completedSet.has(s.id));
    const allDone = groupStops.every((s) => completedSet.has(s.id));
    if (anyDone && !allDone) return g;
  }
  return null;
}

/** The next sub-stop in a group that hasn't been completed yet. */
export function getNextStopInGroup(
  tour: Tour,
  groupId: string,
  session: TourSession
): Stop | null {
  const completedSet = new Set(session.completedStops);
  return getStopsInGroup(tour, groupId).find((s) => !completedSet.has(s.id)) ?? null;
}

// ── Context-Prototype (Acts) helpers ────────────────────────────

/** Acts that still resolve to at least one real stop, in authored order.
 *  Stop IDs that no longer exist (deleted stops) are filtered out, and
 *  empty acts are dropped so the playback flow never stalls. */
export function getActs(tour: Tour): Act[] {
  const activeStops = getActiveStops(tour);
  const stopIds = new Set(activeStops.map((s) => s.id));
  const authored = (tour.acts || [])
    .map((a) => ({ ...a, stopIds: (a.stopIds || []).filter((id) => stopIds.has(id)) }))
    .filter((a) => a.stopIds.length > 0);
  if (authored.length > 0) return authored;
  // Fallback: no usable acts authored — play every stop as one implicit act
  // so the tour still runs (no opening/closing questions).
  if (activeStops.length > 0) {
    return [{
      id: '__implicit_act__',
      title: '',
      stopIds: activeStops.map((s) => s.id),
      openingQuestion: null,
      closingQuestion: null,
    }];
  }
  return [];
}

/** The flattened context playback order — each act's stops, in act order. */
export function getContextOrderedStops(tour: Tour): Stop[] {
  const byId = new Map(getActiveStops(tour).map((s) => [s.id, s] as const));
  const result: Stop[] = [];
  for (const act of getActs(tour)) {
    for (const id of act.stopIds) {
      const s = byId.get(id);
      if (s) result.push(s);
    }
  }
  return result;
}

/** The act a stop belongs to (among acts with resolvable stops), or null. */
export function findActOfStop(tour: Tour, stopId: string): Act | null {
  return getActs(tour).find((a) => a.stopIds.includes(stopId)) ?? null;
}

/** Whether the tour's Opening Frame carries any content worth showing. */
export function hasOpeningFrameContent(tour: Tour): boolean {
  const f = tour.openingFrame;
  if (!f) return false;
  return !!(
    f.scenePhotoUrl ||
    (f.sceneDescription || '').trim() ||
    f.sceneAudioUrl ||
    (f.openingFraming || '').trim()
  );
}

/** Index of a stop ID within the active stops array (currentStopIndex space). */
function indexOfStopId(tour: Tour, stopId: string): number {
  return getActiveStops(tour).findIndex((s) => s.id === stopId);
}

/** Position the session at the first stop of an act: the act's opening
 *  question if one is authored, otherwise straight into the stop's seed. */
function positionAtAct(session: TourSession, tour: Tour, act: Act): TourSession {
  const idx = indexOfStopId(tour, act.stopIds[0]);
  const hasOpening = !!act.openingQuestion?.prompt?.trim();
  return {
    ...session,
    currentStopIndex: idx >= 0 ? idx : session.currentStopIndex,
    currentRound: 0,
    currentPhase: hasOpening ? 'act_opening' : 'seed',
  };
}

/** Enter the first act of a context tour. No acts → straight to closing. */
function enterFirstContextAct(session: TourSession, tour: Tour): TourSession {
  const acts = getActs(tour);
  if (acts.length === 0) {
    return { ...session, currentPhase: 'eq_questions', currentRound: 0, completedAt: new Date().toISOString() };
  }
  return positionAtAct(session, tour, acts[0]);
}

/** After an act finishes, move to the next act (or the closing flow). */
function advanceToNextActOrClosing(session: TourSession, tour: Tour, currentAct: Act | null): TourSession {
  const acts = getActs(tour);
  const idx = currentAct ? acts.findIndex((a) => a.id === currentAct.id) : -1;
  const nextAct = idx >= 0 ? acts[idx + 1] : undefined;
  if (nextAct) {
    return positionAtAct({ ...session, phaseHistory: pushHistory(session) }, tour, nextAct);
  }
  // No more acts → "Any remaining questions?" closing path (context has no EQ).
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_questions',
    currentRound: 0,
    completedAt: new Date().toISOString(),
  };
}

/** Merge a single act-question response into the session map. */
function setActResponse(
  map: TourSession['actResponses'],
  actId: string,
  kind: 'opening' | 'closing',
  value: string
): TourSession['actResponses'] {
  const prev = map || {};
  return { ...prev, [actId]: { ...(prev[actId] || {}), [kind]: value } };
}

/** Generate a fresh TourSession id. Exposed so room flows can mint
 *  an id before creating the session (we hand the same id to the
 *  room doc as the member's sessionId). */
export function newSessionId(): string {
  return `ts_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(tour: Tour, opts?: { id?: string }): TourSession {
  return {
    id: opts?.id ?? newSessionId(),
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

export function advancePhase(
  session: TourSession,
  stop: Stop,
  opts?: { skipWonder?: boolean }
): TourSession {
  const { phase, round } = nextPhaseAndRound(
    session.currentPhase,
    session.currentRound,
    stop,
    opts?.skipWonder ?? false,
  );
  return { ...session, phaseHistory: pushHistory(session), currentPhase: phase, currentRound: round };
}

export function advanceToNextStop(session: TourSession, tour: Tour): TourSession {
  if (getTourMode(tour) === 'context') return advanceToNextStopContext(session, tour);
  if (tour.unstructuredMode) return advanceToNextStopUnstructured(session, tour);

  const stops = getActiveStops(tour);
  const currentStop = stops[session.currentStopIndex];
  const isFinal = currentStop?.isFinalStop || false;
  const nextIndex = session.currentStopIndex + 1;

  // If this is marked as final stop OR there are no more stops, go to closing flow
  if (isFinal || nextIndex >= stops.length) {
    const endPhase = tour.essentialQuestion ? 'eq_closing' : 'eq_questions';
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

/** Called after a stop completes in Context-Prototype mode. Walks stops in
 *  Act order, inserting the act's closing question at the end of an act and
 *  the next act's opening question at its start. */
function advanceToNextStopContext(session: TourSession, tour: Tour): TourSession {
  const stops = getActiveStops(tour);
  const currentStop = stops[session.currentStopIndex];
  if (!currentStop) return session;

  const completedStops = session.completedStops.includes(currentStop.id)
    ? session.completedStops
    : [...session.completedStops, currentStop.id];

  const act = findActOfStop(tour, currentStop.id);
  if (!act) {
    // Stop belongs to no act (shouldn't happen) — end the tour gracefully.
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: 'eq_questions',
      currentRound: 0,
      completedStops,
      completedAt: new Date().toISOString(),
    };
  }

  const posInAct = act.stopIds.indexOf(currentStop.id);
  const isLastInAct = posInAct === act.stopIds.length - 1;

  if (!isLastInAct) {
    const nextIdx = indexOfStopId(tour, act.stopIds[posInAct + 1]);
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentStopIndex: nextIdx >= 0 ? nextIdx : session.currentStopIndex,
      currentRound: 0,
      currentPhase: 'seed',
      completedStops,
    };
  }

  // Last stop in the act — show the act's closing question if authored,
  // otherwise move straight to the next act / closing.
  if (act.closingQuestion?.prompt?.trim()) {
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: 'act_closing',
      completedStops,
    };
  }
  return advanceToNextActOrClosing({ ...session, completedStops }, tour, act);
}

/** Called after a stop completes in unstructured mode. */
function advanceToNextStopUnstructured(session: TourSession, tour: Tour): TourSession {
  const stops = getActiveStops(tour);
  const stop = stops[session.currentStopIndex];
  if (!stop) return session;

  const newCompletedStops = [...session.completedStops, stop.id];
  const currentGroup = stop.mergeGroup || null;

  // In a merge group, every sub-stop completion bounces back to the
  // mini-map (derived from getActiveGroupId) until the LAST sub-stop is
  // done — then we count it as one logical-stop completion and
  // continue to the full main map (or midway / closing).
  if (currentGroup) {
    const groupStops = stops.filter((s) => s.mergeGroup === currentGroup);
    const completedSet = new Set(newCompletedStops);
    const allGroupDone = groupStops.every((s) => completedSet.has(s.id));

    if (allGroupDone) {
      const leader = groupStops[0];
      return finishLogicalStop(session, tour, leader.id, newCompletedStops);
    }

    // Group still in progress — back to the map. The mini-map view is
    // derived from getActiveGroupId so the next sub-stop pin flashes.
    return {
      ...session,
      phaseHistory: pushHistory(session),
      completedStops: newCompletedStops,
      currentPhase: 'unstructured_map',
    };
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
  // Don't double-count: if this logical stop is already in the visit
  // order, leave it where it is. (A double-count would push
  // completionOrder past logicalTotal and fire the closing transition
  // early — which would also rob us of the midway check-in slot.)
  const prevOrder = session.completionOrder || [];
  const completionOrder = prevOrder.includes(logicalStopId)
    ? prevOrder
    : [...prevOrder, logicalStopId];
  const logicalTotal = getLogicalStops(tour).length;

  // All logical stops done → closing
  if (completionOrder.length >= logicalTotal) {
    const endPhase = tour.essentialQuestion ? 'eq_closing' : 'eq_questions';
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

/** Phase that follows the "Meet Your Guide" screen (non-context modes). */
function afterGuide(tour: Tour): TourPhase {
  return tour.essentialQuestion
    ? 'eq_scene'
    : tour.unstructuredMode
      ? 'unstructured_map'
      : 'seed';
}

/** Route into the tour body after intro / meet-guide. Context mode shows the
 *  Opening Frame (if authored) then enters the first act, positioning the
 *  session at the right stop; other modes use afterGuide. Assumes the caller
 *  has NOT yet pushed history. */
function routeAfterGuide(session: TourSession, tour: Tour): TourSession {
  const base = { ...session, phaseHistory: pushHistory(session) };
  if (getTourMode(tour) === 'context') {
    if (hasOpeningFrameContent(tour)) {
      return { ...base, currentPhase: 'opening_frame' };
    }
    return enterFirstContextAct(base, tour);
  }
  return { ...base, currentPhase: afterGuide(tour) };
}

export function completeIntro(session: TourSession, tour: Tour): TourSession {
  // "Meet Your Guide" shows whenever the tour has a named guide.
  if (tour.guide?.name) {
    return { ...session, phaseHistory: pushHistory(session), currentPhase: 'meet_guide' };
  }
  return routeAfterGuide(session, tour);
}

export function completeMeetGuide(session: TourSession, tour: Tour): TourSession {
  return routeAfterGuide(session, tour);
}

/** Context mode: the Opening Frame "Begin the tour" button → first act. */
export function completeOpeningFrame(session: TourSession, tour: Tour): TourSession {
  return enterFirstContextAct({ ...session, phaseHistory: pushHistory(session) }, tour);
}

/** Context mode: explorer answers an act's opening question → first stop seed. */
export function completeActOpening(session: TourSession, tour: Tour, response: string): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'seed',
    currentRound: 0,
    actResponses: act ? setActResponse(session.actResponses, act.id, 'opening', response) : session.actResponses,
  };
}

/** Context mode: explorer answers an act's closing question → next act / closing. */
export function completeActClosing(session: TourSession, tour: Tour, response: string): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  const withResponse: TourSession = {
    ...session,
    actResponses: act ? setActResponse(session.actResponses, act.id, 'closing', response) : session.actResponses,
  };
  return advanceToNextActOrClosing(withResponse, tour, act);
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

export function completeEqClosing(
  session: TourSession,
  finalReflection: string,
  finalReasoning: string,
  additionalClosingResponses: string[],
  _tour: Tour,
): TourSession {
  // The new closing card captures every closing question (main +
  // additionals) in one snap-scroll screen. After it, the explorer
  // moves through the slider / chip-set final-reflect screen, then
  // "Any remaining questions". eq_closing_additional remains a no-op
  // pass-through for in-flight legacy sessions.
  void _tour;
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_final_reflect',
    currentRound: 0,
    essentialQuestionResponses: session.essentialQuestionResponses
      ? {
          ...session.essentialQuestionResponses,
          finalReflection,
          finalReasoning,
          additionalClosingResponses,
        }
      : null,
  };
}

/** Legacy path kept for sessions parked on eq_closing_additional from
 *  before the closing redesign. Now just advances to eq_questions. */
export function completeEqClosingAdditional(session: TourSession, _tour: Tour): TourSession {
  void _tour;
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_questions',
    currentRound: 0,
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

export function finishTour(session: TourSession, tour: Tour): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    // The guide's optional closing message comes just before the end card.
    currentPhase: (tour.guide?.thankYouMessage || tour.guide?.thankYouAudioUrl)
      ? 'guide_outro'
      : 'end',
    completedAt: new Date().toISOString(),
  };
}

export function completeGuideOutro(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'end',
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
