/**
 * POST /api/log-tour — logs tour session events to Google Sheets.
 *
 * Accepts tour events (reflection scores, banked questions, tour
 * completion) from the client and appends them as rows via the same
 * Google Sheets webhook used by the ask logger.
 *
 * Keeps the webhook URL server-side (no NEXT_PUBLIC_ exposure).
 */

import { NextResponse } from 'next/server';

interface TourLogEntry {
  event: string;
  tourId: string;
  sessionId: string;
  tourTitle?: string;
  stopIndex?: number;
  stopTitle?: string;
  // Per-stop reflection
  reflectionScore?: number;
  followUpResponse?: string | null;
  // Question routing
  questionText?: string;
  questionRouting?: string;
  // Completion
  stopsCompleted?: number;
  totalStops?: number;
  durationMinutes?: number;
  // Essential question
  eqTheory?: string;
  eqReasoning?: string;
  eqFinalReflection?: string;
  eqFinalReasoning?: string;
  eqCognitiveSlider?: number;
  eqPerceptualSlider?: number | null;
  eqWhatChanged?: string;
  eqWhyChanged?: string;
  // Group / room context (present on every event)
  roomCode?: string | null;
  isHost?: boolean;
  memberCount?: number;
  // Opinion dial
  questionKey?: string;
  opinionLeftLabel?: string;
  opinionRightLabel?: string;
  opinionMyPosition?: number;
  opinionOtherPositions?: string;
  opinionSimilarity?: 'similar' | 'different';
  opinionAvgDistance?: number;
  // User-choice question
  userChoiceQuestion?: string;
  userChoiceIsCustom?: boolean;
  // Context-Prototype act questions
  actTitle?: string;
  actQuestionKind?: 'opening' | 'closing';
  actQuestion?: string;
  actResponse?: string;
  timestamp: string;
}

export async function POST(req: Request) {
  try {
    const entry: TourLogEntry = await req.json();

    const url = process.env.SHEETS_WEBHOOK_URL;
    if (!url) {
      console.warn('[log-tour] Skipped: SHEETS_WEBHOOK_URL not set');
      return NextResponse.json({ ok: true });
    }

    // Tag so the sheet can distinguish tour events from ask events
    const row = {
      ...entry,
      source: 'tour',
    };

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(row),
      keepalive: true,
    }).catch((err) => {
      console.error('[log-tour] Sheet write error:', err);
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
