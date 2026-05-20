/**
 * Client-side tour event logger.
 *
 * Fire-and-forget calls to /api/log-tour, which appends rows to
 * the same Google Sheet as the ask logger. No await, no error
 * handling — if it fails, it fails silently.
 */

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

function fire(entry: Record<string, unknown>): void {
  const payload = JSON.stringify(entry);

  // Try sendBeacon first — designed to survive page transitions on mobile
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    const sent = navigator.sendBeacon('/api/log-tour', blob);
    if (sent) return;
  }

  // Fallback to fetch with keepalive
  fetch('/api/log-tour', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
