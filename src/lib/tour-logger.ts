/**
 * Client-side tour event logger.
 *
 * Fire-and-forget calls to /api/log-tour, which appends rows to
 * the same Google Sheet as the ask logger. No await, no error
 * handling — if it fails, it fails silently.
 *
 * Group context (room code, host flag, member count) is held in a
 * module-level slot and merged onto every event row by `fire()`.
 * RoomContext keeps it current via `setLogContext()`.
 */

interface LogContext {
  roomCode: string | null;
  isHost: boolean;
  memberCount: number;
}

let logContext: LogContext = {
  roomCode: null,
  isHost: true,
  memberCount: 1,
};

/** Called by RoomContext whenever the room state changes (created,
 *  joined, members updated, left). The logger merges these fields
 *  onto every subsequent event row so analytics can group rows by
 *  room and distinguish host vs participant. */
export function setLogContext(ctx: LogContext): void {
  logContext = ctx;
}

export function logReflection(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  stopIndex: number;
  stopTitle: string;
  score: number;
  followUpResponse: string | null;
}): void {
  fire({
    event: 'reflection',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    stopIndex: opts.stopIndex,
    stopTitle: opts.stopTitle,
    reflectionScore: opts.score,
    followUpResponse: opts.followUpResponse,
    timestamp: new Date().toISOString(),
  });
}

export function logQuestionRouted(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  stopIndex: number;
  stopTitle: string;
  questionText: string;
  routing: 'coming_up' | 'answered_off_path' | 'banked';
}): void {
  fire({
    event: opts.routing === 'banked' ? 'question_banked' : 'question_routed',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    stopIndex: opts.stopIndex,
    stopTitle: opts.stopTitle,
    questionText: opts.questionText,
    questionRouting: opts.routing,
    timestamp: new Date().toISOString(),
  });
}

export function logTourComplete(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  stopsCompleted: number;
  totalStops: number;
  startedAt: string;
}): void {
  const started = new Date(opts.startedAt).getTime();
  const durationMinutes = Math.round((Date.now() - started) / 60000);
  fire({
    event: 'tour_complete',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    stopsCompleted: opts.stopsCompleted,
    totalStops: opts.totalStops,
    durationMinutes,
    timestamp: new Date().toISOString(),
  });
}

export function logEqOpening(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  theory: string;
  reasoning: string;
}): void {
  fire({
    event: 'eq_opening',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    eqTheory: opts.theory,
    eqReasoning: opts.reasoning,
    timestamp: new Date().toISOString(),
  });
}

export function logEqClosing(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  finalReflection: string;
  finalReasoning: string;
}): void {
  fire({
    event: 'eq_closing',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    eqFinalReflection: opts.finalReflection,
    eqFinalReasoning: opts.finalReasoning,
    timestamp: new Date().toISOString(),
  });
}

export function logEqFinalReflect(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  cognitiveSlider: number;
  perceptualSlider: number | null;
  whatChanged: string[] | null;
  whyChanged: string[] | null;
}): void {
  fire({
    event: 'eq_final_reflect',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    eqCognitiveSlider: opts.cognitiveSlider,
    eqPerceptualSlider: opts.perceptualSlider,
    eqWhatChanged: opts.whatChanged?.join(', ') || '',
    eqWhyChanged: opts.whyChanged?.join(', ') || '',
    timestamp: new Date().toISOString(),
  });
}

export function logStopEntered(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  stopIndex: number;
  stopTitle: string;
}): void {
  fire({
    event: 'stop_entered',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    stopIndex: opts.stopIndex,
    stopTitle: opts.stopTitle,
    timestamp: new Date().toISOString(),
  });
}

/** Opinion-dial reveal — fired by each member's device once every
 *  member has chosen + revealed. Each row records that member's own
 *  position, the average distance from them to the others, and the
 *  similarity verdict the explorer saw. */
export function logOpinionDial(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  stopIndex: number;
  stopTitle: string;
  questionKey: string;
  questionText: string;
  leftLabel: string;
  rightLabel: string;
  myPosition: number;
  otherPositions: number[];
  similarity: 'similar' | 'different';
  averageDistance: number;
}): void {
  fire({
    event: 'opinion_dial',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    stopIndex: opts.stopIndex,
    stopTitle: opts.stopTitle,
    questionKey: opts.questionKey,
    questionText: opts.questionText,
    opinionLeftLabel: opts.leftLabel,
    opinionRightLabel: opts.rightLabel,
    opinionMyPosition: opts.myPosition,
    opinionOtherPositions: opts.otherPositions.join(', '),
    opinionSimilarity: opts.similarity,
    opinionAvgDistance: opts.averageDistance,
    timestamp: new Date().toISOString(),
  });
}

/** User-choice question pick — fired by the picker only (solo OR
 *  first non-host in a group). Other members of the group don't fire
 *  this event; their own row appears via the standard stop_entered
 *  event. */
export function logUserChoice(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  stopIndex: number;
  stopTitle: string;
  questionKey: string;
  chosenQuestion: string;
  isCustom: boolean;
}): void {
  fire({
    event: 'user_choice_picked',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    stopIndex: opts.stopIndex,
    stopTitle: opts.stopTitle,
    questionKey: opts.questionKey,
    userChoiceQuestion: opts.chosenQuestion,
    userChoiceIsCustom: opts.isCustom,
    timestamp: new Date().toISOString(),
  });
}

/** Context-Prototype Act question response — fired per device when an
 *  explorer submits an act's opening or closing question. Lands in the
 *  dedicated Act Title / Act Question Kind / Act Question / Act Response
 *  columns (added 2026-06-09 — re-run addHeaders() + redeploy the Apps
 *  Script; see §4 / docs/sheets-apps-script.gs). */
export function logActQuestion(opts: {
  tourId: string;
  sessionId: string;
  tourTitle: string;
  actTitle: string;
  kind: 'opening' | 'closing';
  question: string;
  response: string;
}): void {
  fire({
    event: 'act_question',
    tourId: opts.tourId,
    sessionId: opts.sessionId,
    tourTitle: opts.tourTitle,
    actTitle: opts.actTitle,
    actQuestionKind: opts.kind,
    actQuestion: opts.question,
    actResponse: opts.response,
    timestamp: new Date().toISOString(),
  });
}

function fire(entry: Record<string, unknown>): void {
  // Merge the current room context onto every event row.
  const enriched = {
    ...entry,
    roomCode: logContext.roomCode,
    isHost: logContext.isHost,
    memberCount: logContext.memberCount,
  };
  const payload = JSON.stringify(enriched);

  // Try sendBeacon first — designed to survive page transitions on mobile.
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    const sent = navigator.sendBeacon('/api/log-tour', blob);
    if (sent) return;
  }

  // Fallback to fetch with keepalive, retrying a couple of times on a flaky
  // connection. (The durable backstop is the Firestore session backup, which
  // persists the full session server-side regardless of these beacons.)
  postWithRetry(payload, 3);
}

function postWithRetry(payload: string, attempts: number): void {
  fetch('/api/log-tour', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok && attempts > 1) setTimeout(() => postWithRetry(payload, attempts - 1), 1000);
    })
    .catch(() => {
      if (attempts > 1) setTimeout(() => postWithRetry(payload, attempts - 1), 1000);
    });
}
