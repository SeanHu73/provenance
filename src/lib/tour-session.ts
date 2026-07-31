/**
 * Tour session state management.
 *
 * Pure functions for creating, advancing, and persisting TourSession
 * objects. The session lives in sessionStorage so it survives page
 * reloads but resets when the tab closes — the right lifecycle for
 * a single group visit.
 */

import type { Tour, Stop, TourSession, TourPhase, BankedQuestion, Act, ActReflectionResponse, InvestigationQuestion, ContextQuestionEntry, ContextEntrySnapshot, ActContextItem, ContextMediaItem, ContextQuestion, ReflectionPrompt, MergedReflectionPrompt, AdditionalStop } from './types';
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
  // Context mode strips per-stop discussion AND its extra "discussion +
  // context" rounds (they're hidden in the admin there), so a stop shows only
  // its main context. Skip straight to reflect / end-of-stop.
  const nextRoundIndex = currentRound; // extraRounds[0] = round 1
  if (!skipWonder && nextRoundIndex < extras.length) {
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
      const wonder = stop.wonder;
      if (!skipWonder && wonder !== null) return { phase: 'wonder', round: 0 };
      // Context mode merges FIND + DISCOVER onto the seed screen (the reveal is
      // shown there as a second snap section), so skip the standalone reveal
      // round-0 phase and go straight to whatever follows it (reflect / end).
      if (skipWonder) return advanceFromReveal(0, extras, stop, skipWonder);
      return { phase: 'reveal', round: 0 };
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
  // so the tour still runs (no opening/closing questions). Additional (post-tour)
  // stops are excluded — they play from their own menu, not as guided stops.
  if (activeStops.length > 0) {
    const additionalIds = new Set((tour.additionalStops || []).map((a) => a.stopId));
    const ids = activeStops.map((s) => s.id).filter((id) => !additionalIds.has(id));
    if (ids.length > 0) {
      return [{
        id: '__implicit_act__',
        title: '',
        stopIds: ids,
        openingQuestion: null,
        closingQuestion: null,
      }];
    }
  }
  return [];
}

/** The tour's post-tour "additional" stops, resolved to their Stop objects (in
 *  `additionalStops` order, skipping ids that no longer resolve). */
export function getAdditionalStops(tour: Tour): { stop: Stop; entry: AdditionalStop }[] {
  const byId = new Map(getActiveStops(tour).map((s) => [s.id, s] as const));
  return (tour.additionalStops || []).flatMap((entry) => {
    const stop = byId.get(entry.stopId);
    return stop ? [{ stop, entry }] : [];
  });
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

/** Position the session at the start of an act. Every act begins with the
 *  `act_intro` splash (which then routes to the opening question or the first
 *  stop's map). currentStopIndex is parked on the act's first stop. */
function positionAtAct(session: TourSession, tour: Tour, act: Act): TourSession {
  const idx = indexOfStopId(tour, act.stopIds[0]);
  return {
    ...session,
    currentStopIndex: idx >= 0 ? idx : session.currentStopIndex,
    currentRound: 0,
    currentPhase: 'act_intro',
  };
}

/** Enter the first act of a context tour. No acts → the additional-stops menu if
 *  any exist, else straight to closing. */
function enterFirstContextAct(session: TourSession, tour: Tour): TourSession {
  const acts = getActs(tour);
  if (acts.length === 0) {
    if (getAdditionalStops(tour).length > 0) {
      return { ...session, currentPhase: 'additional_menu', currentRound: 0, additionalActive: false, currentAdditionalStopId: null, completedAt: new Date().toISOString() };
    }
    return { ...session, currentPhase: 'eq_questions', currentRound: 0, completedAt: new Date().toISOString() };
  }
  return positionAtAct(session, tour, acts[0]);
}

/** After an act fully wraps up, move to the next act (or end the tour). */
function advanceToNextActOrClosing(session: TourSession, tour: Tour, currentAct: Act | null): TourSession {
  const acts = getActs(tour);
  const idx = currentAct ? acts.findIndex((a) => a.id === currentAct.id) : -1;
  const nextAct = idx >= 0 ? acts[idx + 1] : undefined;
  if (nextAct) {
    return positionAtAct({ ...session, phaseHistory: pushHistory(session) }, tour, nextAct);
  }
  // No more acts. If the tour has post-tour "additional" stops, land on their
  // menu (the "end of the guided tour, explore these stops" screen) before the
  // final closing. Otherwise end the tour directly.
  if (getAdditionalStops(tour).length > 0) {
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: 'additional_menu',
      currentRound: 0,
      additionalActive: false,
      currentAdditionalStopId: null,
      // The guided tour is complete at this point even though optional stops remain.
      completedAt: session.completedAt ?? new Date().toISOString(),
    };
  }
  // No more acts → end the tour (the per-act questions screens replace the
  // single tour-level "Any remaining questions" closing in context mode).
  return finishContextTour({ ...session, phaseHistory: pushHistory(session) }, tour);
}

/** Begin exploring a post-tour additional stop from the menu: park on its stop
 *  and play its content (seed → reveal → [reflect]); `additionalActive` diverts
 *  the end-of-stop flow into its Context Journal and back to the menu. */
export function startAdditionalStop(session: TourSession, tour: Tour, stopId: string): TourSession {
  const idx = indexOfStopId(tour, stopId);
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentStopIndex: idx >= 0 ? idx : session.currentStopIndex,
    currentRound: 0,
    currentPhase: 'seed',
    additionalActive: true,
    currentAdditionalStopId: stopId,
    currentContextId: null,
  };
}

/** Leave the additional-stops menu ("Finish") → the tour's final closing. */
export function finishAdditionalStops(session: TourSession, tour: Tour): TourSession {
  return finishContextTour({ ...session, phaseHistory: pushHistory(session), additionalActive: false, currentAdditionalStopId: null }, tour);
}

/** Final stretch of a context tour: the guide's closing message if present,
 *  then the Suggested Resources screen (guide_outro routes there in context),
 *  then the end card. */
function finishContextTour(session: TourSession, tour: Tour): TourSession {
  return {
    ...session,
    currentPhase: (tour.guide?.thankYouMessage || tour.guide?.thankYouAudioUrl) ? 'guide_outro' : 'resources',
    currentRound: 0,
    completedAt: new Date().toISOString(),
  };
}

/** Context mode: explorer leaves the Suggested Resources screen → end card. */
export function completeResources(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'end',
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

/** Every reflection filed under an act, oldest first. Older sessions only carry
 *  the single `reflection`, so it stands in for the list. */
export function actReflectionsOf(
  entry: { reflection?: ActReflectionResponse; reflections?: ActReflectionResponse[] } | undefined | null
): ActReflectionResponse[] {
  if (!entry) return [];
  if (entry.reflections?.length) return entry.reflections;
  return entry.reflection ? [entry.reflection] : [];
}

/** Append a reflection response to an act. The closing reflection lets the
 *  explorer answer several prompts, so responses accumulate; `reflection` stays
 *  pinned to the first one for everything that reads a single response. */
function addActReflection(
  map: TourSession['actResponses'],
  actId: string,
  value: ActReflectionResponse
): TourSession['actResponses'] {
  const prev = map || {};
  const entry = prev[actId] || {};
  const list = [...actReflectionsOf(entry), value];
  return { ...prev, [actId]: { ...entry, reflection: list[0], reflections: list } };
}

/** Replace the reflections filed under an act (used when marking them shared). */
function setActReflections(
  map: TourSession['actResponses'],
  actId: string,
  list: ActReflectionResponse[]
): TourSession['actResponses'] {
  const prev = map || {};
  return { ...prev, [actId]: { ...(prev[actId] || {}), reflection: list[0], reflections: list } };
}

/** Append a context question (+ answer/status) to the session map. */
function addContextQuestion(
  map: TourSession['actResponses'],
  actId: string,
  entry: ContextQuestionEntry
): TourSession['actResponses'] {
  const prev = map || {};
  const existing = prev[actId]?.contextQuestions || [];
  return { ...prev, [actId]: { ...(prev[actId] || {}), contextQuestions: [...existing, entry] } };
}

/** Record a full snapshot of a Detective answer the learner got from asking their
 *  own question in the Context Journal — captured whether or not they "added" it,
 *  so the admin can review/correct/promote it. Deduped by id. */
export function recordDetectiveAnswer(
  session: TourSession,
  snapshot: ContextEntrySnapshot,
): TourSession {
  const existing = session.detectiveAnswers || [];
  if (existing.some((d) => d.id === snapshot.id)) return session;
  return { ...session, detectiveAnswers: [...existing, snapshot] };
}

/** The reflection prompt for an act — new `reflectionQuestion`, else the legacy
 *  `closingQuestion` for tours authored before the redesign. */
export function reflectionPromptOf(act: Act | null): string {
  return (act?.reflectionQuestion?.prompt ?? act?.closingQuestion?.prompt ?? '').trim();
}

/** End-of-act reflection prompts to offer the learner ("Share Your Thoughts"):
 *  the new `reflectionPrompts`, else the single legacy prompt wrapped as one.
 *  May be empty — the learner can always write their own. */
export function reflectionPromptsOf(act: Act | null): ReflectionPrompt[] {
  const list = (act?.reflectionPrompts ?? []).filter((p) => p.prompt.trim());
  if (list.length) return list;
  const legacy = reflectionPromptOf(act);
  return legacy ? [{ id: 'legacy', prompt: legacy }] : [];
}

/** The prompts for the tour's one closing reflection.
 *
 *  Authored on the tour (`tour.reflectionPrompts`) — reflection is the tour's
 *  closing stage, so that is where the admin writes them. Tours authored before
 *  the move have them on their acts instead: those are merged in act order, with
 *  ids namespaced by act so two acts' legacy prompts can't collide, and the act
 *  each came from riding along (responses stay filed under it). Nothing an act
 *  authored is dropped. */
export function allReflectionPrompts(tour: Tour | null): MergedReflectionPrompt[] {
  if (!tour) return [];
  const authored = (tour.reflectionPrompts ?? []).filter((p) => p.prompt.trim());
  if (authored.length) return authored;
  const out: MergedReflectionPrompt[] = [];
  const seen = new Set<string>();
  for (const act of getActs(tour)) {
    for (const p of reflectionPromptsOf(act)) {
      const id = `${act.id}:${p.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ...p, id, actId: act.id });
    }
  }
  return out;
}

/** Rich "Add Context" items for an act, migrating a legacy `act.context` into a
 *  single item positioned after the act's last stop. */
export function getActContexts(act: Act | null): ActContextItem[] {
  if (!act) return [];
  if (act.contexts && act.contexts.length) return act.contexts;
  const c = act.context;
  if (c && (c.question?.trim() || c.context?.trim() || c.audioUrl || (c.photos && c.photos.length > 0))) {
    const lastStopId = act.stopIds[act.stopIds.length - 1] ?? '';
    const media: ContextMediaItem[] = [
      ...(c.photos ?? []).map((p, i) => ({ id: `legacy-photo-${i}`, kind: 'photo' as const, url: p.url, title: p.caption ?? '' })),
      ...(c.audioUrl ? [{ id: 'legacy-audio', kind: 'audio' as const, url: c.audioUrl, title: c.audioTitle ?? '' }] : []),
    ];
    return [{
      id: 'legacy', afterStopId: lastStopId, pastCategory: 'place',
      question: c.question ?? '', title: '', shortSummary: '', longExplanation: c.context ?? '',
      timeRange: { start: 1900, end: 2000 }, geometry: null, camera: null, mapType: 'default',
      media, thumbnailMediaId: null,
    }];
  }
  return [];
}

/** Items positioned to play right after a given stop, in author order.
 *  (Legacy `afterStopId` positioning; the new model positions via questions.) */
export function contextsAfterStop(act: Act | null, stopId: string): ActContextItem[] {
  return getActContexts(act).filter((c) => c.afterStopId === stopId);
}

// ── New question-centric model (designer poses questions; contexts tag to them) ──

/** Designer-posed context questions for an act, in author order. */
export function getActQuestions(act: Act | null): ContextQuestion[] {
  return act?.questions ?? [];
}

/** Questions posed right after a given stop, in author order. */
export function questionsAfterStop(act: Act | null, stopId: string): ContextQuestion[] {
  return getActQuestions(act).filter((q) => q.afterStopId === stopId);
}

/** The contexts tagged to a given question — the contexts it can surface. */
export function contextsForQuestion(act: Act | null, questionId: string): ActContextItem[] {
  return getActContexts(act).filter((c) => (c.questionIds ?? []).includes(questionId));
}

/** The questions a context is tagged to (for the journal's "questions you asked"
 *  section and the designer's tag editor). */
export function questionsForContext(act: Act | null, context: ActContextItem): ContextQuestion[] {
  const ids = new Set(context.questionIds ?? []);
  return getActQuestions(act).filter((q) => ids.has(q.id));
}

/** The Add-Context item currently being shown (act_context_intro / act_context). */
export function currentContextItem(tour: Tour | null, session: TourSession | null): ActContextItem | null {
  if (!tour || !session) return null;
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  if (!act) return null;
  return getActContexts(act).find((c) => c.id === session.currentContextId) ?? null;
}

/** Whether an act has any authored context worth showing. */
export function actHasContext(act: Act | null): boolean {
  return getActContexts(act).length > 0;
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
    themeQuestionResponse: null,
    onboardingHistoryResponse: null,
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

  // Post-tour additional stop: its content is done → open its (dismissible)
  // Context Journal. Closing the journal (completeActContext) returns to the menu.
  if (session.additionalActive) {
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: 'act_context',
      currentRound: 0,
      currentContextId: null,
    };
  }

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

  // The opening questions come back the moment Discover wraps on act 1's last
  // stop. This sits AHEAD of the positioned contexts on purpose, and not only
  // because that is the order asked for: the only route into the phase used to be
  // resumeAfterContexts, which this next block returns before ever reaching
  // whenever the last stop has Add-Context items positioned after it. On a tour
  // that has them the screen was unreachable — not late, not waiting on research,
  // simply never routed to.
  if (wantsInvestigationReturn(session, tour, act, currentStop)) {
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: 'investigation_return',
      currentRound: 0,
      completedStops,
      currentContextId: null,
    };
  }

  // Play any Add-Context items positioned after this stop first.
  const pending = contextsAfterStop(act, currentStop.id);
  if (pending.length) {
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: 'act_context_intro',
      currentRound: 0,
      completedStops,
      currentContextId: pending[0].id,
    };
  }

  return resumeAfterContexts(session, tour, act, currentStop, completedStops);
}

/** End of act 1's last stop, and they submitted something to investigate — the
 *  one place the opening questions are handed back. Gated on having submitted,
 *  never on the answers being ready: the screen asks what they heard on the tour,
 *  which they can answer whether or not the research has landed. */
function wantsInvestigationReturn(
  session: TourSession, tour: Tour, act: Act, currentStop: Stop,
): boolean {
  if (session.investigationReturned) return false;
  if (!session.investigation?.raw?.trim()) return false;
  const acts = getActs(tour);
  if (acts.findIndex((a) => a.id === act.id) !== 0) return false;
  return act.stopIds.indexOf(currentStop.id) === act.stopIds.length - 1;
}

/** After a stop's positioned contexts are exhausted: advance to the next stop,
 *  or (if this was the act's last stop) enter the act's Contextualise step —
 *  the current end-of-act chain: act_context_intro → act_context → reflection →
 *  community. (It used to route to `act_context_questions`, the retired
 *  ContextQuestionsCard "group discussion / response" screen, which skipped the
 *  redesigned reflection — reachable only on this no-positioned-contexts path, so
 *  it surfaced the old sequence intermittently.) */
function resumeAfterContexts(
  session: TourSession, tour: Tour, act: Act, currentStop: Stop, completedStops: string[],
): TourSession {
  const posInAct = act.stopIds.indexOf(currentStop.id);
  const isLastInAct = posInAct === act.stopIds.length - 1;
  if (!isLastInAct) {
    const nextIdx = indexOfStopId(tour, act.stopIds[posInAct + 1]);
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentStopIndex: nextIdx >= 0 ? nextIdx : session.currentStopIndex,
      currentRound: 0,
      currentPhase: 'stop_map',
      completedStops,
      currentContextId: null,
    };
  }
  // currentStopIndex stays on the act's last stop so each step resolves the act.
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'act_context_intro',
    currentRound: 0,
    completedStops,
    currentContextId: null,
  };
}

/** Anything to show on the end-of-act-1 return screen: a factual question, or one
 *  the tour is holding for a later act. Contextual ones are not shown here — they
 *  go to the P.A.S.T. categorisation still unanswered. */
export function investigationReturnQuestions(session: TourSession): InvestigationQuestion[] {
  return (session.investigation?.questions || []).filter(
    (q) => q.kind === 'factual' || q.status === 'later',
  );
}
/** Leaving the return screen. Picks the flow back up where it was interrupted:
 *  the act's positioned contexts if it has any, else the context step. Marked
 *  returned so re-entering the stop cannot show it twice. */
export function completeInvestigationReturn(session: TourSession, tour: Tour): TourSession {
  const marked = { ...session, investigationReturned: true };
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  const pending = act && stop ? contextsAfterStop(act, stop.id) : [];
  return {
    ...marked,
    phaseHistory: pushHistory(session),
    currentPhase: 'act_context_intro',
    currentRound: 0,
    currentContextId: pending.length ? pending[0].id : null,
  };
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

/** Context mode: the Opening Frame "Continue" button → theme question (if the
 *  admin authored one), otherwise straight into the first act. */
export function completeOpeningFrame(session: TourSession, tour: Tour): TourSession {
  const base = { ...session, phaseHistory: pushHistory(session) };
  if (tour.openingFrame?.themeQuestion?.trim()) {
    return { ...base, currentPhase: 'theme_question', currentRound: 0 };
  }
  return enterFirstContextAct(base, tour);
}

/**
 * Context mode: [Let's Explore!] on the opening investigation → first act.
 *
 * The learner no longer *answers* the theme question here — answering it before
 * seeing anything was guesswork. They ask their own questions about it instead,
 * and those are what the session records: the raw text exactly as written or
 * dictated, plus the parsed, classified list. `themeQuestionResponse` is kept and
 * still holds the raw text, so older sessions and the admin export that read it
 * carry on working.
 */
export function completeThemeQuestion(
  session: TourSession,
  tour: Tour,
  input: { raw: string; questions: InvestigationQuestion[] },
): TourSession {
  return enterFirstContextAct(
    {
      ...session,
      phaseHistory: pushHistory(session),
      themeQuestionResponse: input.raw,
      investigation: { raw: input.raw, questions: input.questions, submittedAt: new Date().toISOString() },
    },
    tour,
  );
}

/** Merge the answers back onto the session as the silent queue finishes them, so
 *  the admin sees what each learner asked cold and what we found. */
export function setInvestigationQuestions(
  session: TourSession,
  questions: InvestigationQuestion[],
): TourSession {
  if (!session.investigation) return session;
  return {
    ...session,
    investigation: { ...session.investigation, questions },
    detectiveAnswers: mergeInvestigationAnswers(session.detectiveAnswers || [], questions),
  };
}

/**
 * Answered investigation questions, as reviewable snapshots alongside the ones
 * asked in the journal. They cost the same research pipeline and are worth the
 * same review, so they go through `detectiveAnswers` rather than a parallel
 * channel — the admin gets edit, verdict and promote-to-base for free, and they
 * reach the CSV and review exports with no extra plumbing.
 *
 * Upserted rather than skipped-if-present: the answer lands before the learner
 * files it into a lens, so a snapshot written once would never learn its lens.
 * Admin edits live in the corrections collection keyed by id, so rewriting the
 * snapshot loses nothing.
 *
 * `actId` is deliberately left unset. The journal's ask gate treats a
 * detectiveAnswer carrying an act's id as "they already asked here" — filling it
 * in would silently satisfy that gate for act 1 with a question asked before the
 * act began.
 */
function mergeInvestigationAnswers(
  existing: ContextEntrySnapshot[],
  questions: InvestigationQuestion[],
): ContextEntrySnapshot[] {
  const answered = questions.filter((q) => q.status === 'answered' && q.answer?.trim());
  if (!answered.length) return existing;
  const snapshots = new Map(existing.map((e) => [e.id, e]));
  for (const q of answered) {
    const id = `inv-${q.id}`;
    snapshots.set(id, {
      ...snapshots.get(id),
      id,
      title: q.title?.trim() || q.text,
      shortSummary: q.summary || '',
      longExplanation: q.answer || '',
      question: q.text,
      // What was actually researched, when it differs from what they typed. An
      // answer that looks wrong for the question asked is usually this — the
      // reference was resolved to the wrong thing — and without it the reviewer
      // cannot see that. NOT `originalQuestion`, which already means the wording
      // before a Framing Coach reframe and reads back to the admin as such.
      ...(q.searchText?.trim() ? { researchedAs: q.searchText.trim() } : {}),
      lens: q.lens || '',
      origin: 'self',
      askedIn: 'investigation',
      // Lookups and contextual answers both. A short sourced fact is as worth
      // correcting as a long one, and it is cheaper to promote.
      askedKind: q.kind,
      sourceLinks: q.sources || [],
    });
  }
  return [...snapshots.values()];
}

/** Context mode: the "Act N: Title" splash finished (auto after a hold, or
 *  tapped). Routes straight to the first stop's map — the act opening
 *  question ("Share what you think") was removed to keep the start of the
 *  tour simple, dropping learners directly onto the map with tappable pins.
 *  (The `act_opening` phase + completeActOpening are retained for in-flight
 *  sessions; new sessions never route there.) currentStopIndex is already on
 *  the act's first stop. */
export function completeActIntro(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'stop_map',
    currentRound: 0,
  };
}

/** Context mode: explorer answers an act's opening question → first stop map. */
export function completeActOpening(session: TourSession, tour: Tour, response: string): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'stop_map',
    currentRound: 0,
    actResponses: act ? setActResponse(session.actResponses, act.id, 'opening', response) : session.actResponses,
  };
}

/** Context mode: explorer has seen the "walk to your next stop" map → seed. */
export function completeStopMap(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'seed',
    currentRound: 0,
  };
}

/** Context mode (legacy): explorer answers an act's closing question → the
 *  act's Community Forum. Retained only for in-flight sessions parked on the
 *  old `act_closing` phase; new sessions use the end-of-act chain below. */
export function completeActClosing(session: TourSession, tour: Tour, response: string): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'community_forum',
    currentRound: 0,
    actResponses: act ? setActResponse(session.actResponses, act.id, 'closing', response) : session.actResponses,
  };
}

/** Context mode (legacy): explorer leaves an act's old Community Forum → next
 *  act / end. Retained for in-flight sessions on the old `community_forum`. */
export function completeCommunityForum(session: TourSession, tour: Tour): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  return advanceToNextActOrClosing(session, tour, act);
}

// ── End-of-act chain: act_context_intro → act_context → next act. Reflection is
//    no longer per-act: after the *last* act's Context step the tour runs one
//    closing chain — act_reflection_intro → act_reflection → community_share —
//    whose prompt picker offers every act's prompts at once (allReflectionPrompts).
//    (`act_context_questions` is retired — nothing routes to it now; its
//    completer/render are kept only for in-flight sessions.)


/** Context mode: the "Context" intro splash ("So what context do we need?")
 *  finished → the Context page itself. */
export function completeContextIntro(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'act_context',
    currentRound: 0,
    // Mark the full intro as played so later context steps use the return intro.
    contextIntroSeen: true,
  };
}

/** Context mode: explorer left the Context Journal ("Continue tour"). The journal
 *  now shows the whole act's contexts at once *and* handles question-asking, so we
 *  go straight to the next act — no per-stop context stepping (which used to
 *  loop), no separate questions screen, and no per-act community step. After the
 *  last act it leads into the tour's one closing reflection instead. */
export function completeActContext(session: TourSession, tour: Tour): TourSession {
  // Post-tour additional stop: closing its journal marks the stop explored and
  // returns to the additional-stops menu (no act reflection flow).
  if (session.additionalActive) {
    const stopId = session.currentAdditionalStopId;
    const completedStops = stopId && !session.completedStops.includes(stopId)
      ? [...session.completedStops, stopId]
      : session.completedStops;
    return {
      ...session,
      phaseHistory: pushHistory(session),
      currentPhase: 'additional_menu',
      currentRound: 0,
      additionalActive: false,
      currentAdditionalStopId: null,
      currentContextId: null,
      completedStops,
    };
  }
  // Reflection is the tour's closing move, not each act's: mid-tour acts hand
  // straight over to the next act. Only the last act's Context step leads into
  // "Share Your Thoughts" — a fade intro, then the picker carrying every act's
  // prompts. The learner can always write their own, so the last act always
  // routes there (the picker handles zero authored prompts).
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  const acts = getActs(tour);
  const isLastAct = !!act && acts.findIndex((a) => a.id === act.id) === acts.length - 1;
  if (!isLastAct) {
    return advanceToNextActOrClosing({ ...session, currentContextId: null }, tour, act);
  }
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'act_reflection_intro',
    currentRound: 0,
    currentContextId: null,
  };
}

/** Context mode: the "Reflection" fade intro finished → the "Share Your Thoughts"
 *  prompt picker. */
export function completeReflectionIntro(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'act_reflection',
    currentRound: 0,
  };
}

/** Context mode: explorer is done asking context questions → reflection (if
 *  the act has a reflection prompt) else straight to the community. `asked` is
 *  the list of questions raised this step (merged into actResponses for the
 *  backup + logging). */
export function completeActContextQuestions(
  session: TourSession,
  tour: Tour,
  asked: ContextQuestionEntry[] = []
): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  let actResponses = session.actResponses;
  if (act) for (const entry of asked) actResponses = addContextQuestion(actResponses, act.id, entry);
  // Per-act reflection is retired — skip act_reflection and go straight to the
  // community. (A single end-of-tour reflection with options lands later.)
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'community_share',
    currentRound: 0,
    actResponses,
  };
}

/** Context mode: explorer saved one "Share Your Thoughts" response. They can
 *  answer more than one prompt, so this only files the response — the phase
 *  stays put until they say they're done. The response is filed under the act
 *  its prompt was authored on (`response.actId`), falling back to the act they
 *  are standing in, which is where a prompt they wrote themselves belongs. */
export function saveActReflection(
  session: TourSession,
  tour: Tour,
  response: ActReflectionResponse
): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  const actId = response.actId || act?.id;
  if (!actId) return session;
  return {
    ...session,
    actResponses: addActReflection(session.actResponses, actId, response),
  };
}

/** Context mode: explorer is done responding → the community ("Hear from the
 *  Community"). */
export function completeActReflection(session: TourSession): TourSession {
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'community_share',
    currentRound: 0,
  };
}

/** Record that the explorer shared reflections to the community (from the "Hear
 *  from the Community" screen) — updates the stored responses without changing
 *  the phase, so the backup shows shared vs unpublished. `shareIds` maps a
 *  reflection's local id to the CommunityShare doc it became; reflections are
 *  scanned across every act, since the closing screen can share several at once.
 *  Responses saved before this screen existed have no local id, so their
 *  community-record id stands in as the key. */
export function markReflectionsShared(session: TourSession, shareIds: Record<string, string>): TourSession {
  if (!Object.keys(shareIds).length) return session;
  const keyOf = (r: ActReflectionResponse) => r.id || r.unsharedRecordId || '';
  let actResponses = session.actResponses;
  for (const [actId, entry] of Object.entries(session.actResponses || {})) {
    const list = actReflectionsOf(entry);
    if (!list.some((r) => shareIds[keyOf(r)])) continue;
    actResponses = setActReflections(
      actResponses,
      actId,
      list.map((r) => (shareIds[keyOf(r)] ? { ...r, sharedToCommunity: true, shareId: shareIds[keyOf(r)] } : r)),
    );
  }
  return { ...session, actResponses };
}

/** Context mode: explorer leaves "Hear from the Community" → next act / end. */
export function completeCommunityShare(session: TourSession, tour: Tour): TourSession {
  const stop = getActiveStops(tour)[session.currentStopIndex];
  const act = stop ? findActOfStop(tour, stop.id) : null;
  return advanceToNextActOrClosing(session, tour, act);
}

export function completeEqScene(session: TourSession): TourSession {
  // The old "DISCUSS — The Investigation" step (eq_discuss) was removed; the
  // scene now leads straight into the written response.
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: 'eq_opening',
  };
}

/** Legacy pass-through kept for in-flight sessions parked on eq_discuss. */
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

export function completeGuideOutro(session: TourSession, tour?: Tour): TourSession {
  // Context tours end with the Suggested Resources screen before the end card.
  const next: TourPhase = tour && getTourMode(tour) === 'context' ? 'resources' : 'end';
  return {
    ...session,
    phaseHistory: pushHistory(session),
    currentPhase: next,
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
