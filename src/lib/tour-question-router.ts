/**
 * Question routing for tour branch points.
 *
 * When a learner taps "Ask our own question" after reflection, this
 * module decides one of three response paths:
 *   A — "It's coming up" (keyword match against upcoming stops)
 *   B — "Let me show you" (AI answers from knowledge base)
 *   C — "I don't know, let's save it" (bank the question)
 */

import { Tour, TourSession, AskResponse } from './types';
import { getActiveStops } from './tours-store';

export type RouteResult =
  | { type: 'coming_up'; matchedStopOrder: number }
  | { type: 'answered'; data: AskResponse }
  | { type: 'banked' };

/**
 * Check if any upcoming stop covers this question via keyword overlap.
 * Case-insensitive substring match against each stop's upcomingTopics.
 */
function checkUpcoming(
  question: string,
  tour: Tour,
  session: TourSession
): { type: 'coming_up'; matchedStopOrder: number } | null {
  const q = question.toLowerCase();
  const stops = getActiveStops(tour);
  for (let i = session.currentStopIndex + 1; i < stops.length; i++) {
    const stop = stops[i];
    for (const topic of stop.upcomingTopics) {
      if (topic && q.includes(topic.toLowerCase())) {
        return { type: 'coming_up', matchedStopOrder: stop.order + 1 };
      }
    }
  }
  return null;
}

/**
 * Heuristic: does the AI response indicate it doesn't know the answer?
 */
function isIDontKnow(answer: string): boolean {
  const lower = answer.toLowerCase();
  const markers = [
    "i don't have information",
    "i don't know",
    "i'm not sure",
    "beyond what i know",
    "outside my knowledge",
    "i can't answer",
    "not something i can",
    "don't have enough information",
    "i'm unable to",
  ];
  return markers.some((m) => lower.includes(m));
}

/**
 * Route a learner's question through the three-path decision tree.
 *
 * 1. Keyword match against upcoming stops → Response A
 * 2. AI answer via /api/ask → Response B (if substantive) or C (if idk)
 */
export async function routeQuestion(
  question: string,
  tour: Tour,
  session: TourSession
): Promise<RouteResult> {
  // Step 1: keyword match
  const upcoming = checkUpcoming(question, tour, session);
  if (upcoming) return upcoming;

  // Step 2: Bank the question (AI calls disabled for now)
  // To re-enable AI responses, uncomment the block below.
  return { type: 'banked' };

  /*
  // Step 2: AI response (currently disabled)
  try {
    const currentStop = getActiveStops(tour)[session.currentStopIndex];
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        pinId: null,
        physicalArea: currentStop?.physicalLocationTag || 'general',
        mode: 'direct',
      }),
    });

    if (!res.ok) {
      return { type: 'banked' };
    }

    const data = await res.json() as AskResponse;

    if (isIDontKnow(data.answer)) {
      return { type: 'banked' };
    }

    return { type: 'answered', data };
  } catch {
    return { type: 'banked' };
  }
  */
}
