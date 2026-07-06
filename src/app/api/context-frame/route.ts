/**
 * POST /api/context-frame — the Context Detective's fast "Framing Coach".
 *
 * A single quick Haiku pass that runs BEFORE the heavy /api/context-answer
 * pipeline: it reorients the learner, decides whether their question is already a
 * good contextual question, and (only when it's too narrow/factual/off-topic)
 * offers a short tip plus a few tap-to-use reframes. It never researches or
 * answers — so it returns in a couple of seconds, letting the UI respond first.
 */

import { NextResponse } from 'next/server';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tour, PastLens } from '@/lib/types';
import { frameSystem } from '@/lib/context-detective/prompts';
import { frameQuestion, FrameOutput } from '@/lib/context-detective/claude';

export const maxDuration = 30;

// Every framing pass is logged here — the learner's ORIGINAL question (before any
// reframe) plus the coach's verdict, so the author can see whether learners knew
// what contextual question to ask.
const FRAMING_COLLECTION = 'memorial-church-detective-framing';

const LENS_LABEL: Record<PastLens, string> = {
  place: 'Place', attitudes: 'Affairs', society: 'Society', technology: 'Technology',
};

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `df_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function logFraming(input: {
  question: string; tourId: string; actId?: string; lens?: PastLens; result: FrameOutput;
}): Promise<void> {
  try {
    const id = newId();
    const data = {
      id,
      question: input.question,
      tourId: input.tourId,
      actId: input.actId ?? null,
      lens: input.lens ?? null,
      ok: input.result.ok,
      needsReframe: input.result.needsReframe,
      reframeTip: input.result.reframeTip,
      suggestedQuestions: input.result.suggestedQuestions,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, FRAMING_COLLECTION, id), JSON.parse(JSON.stringify(data)));
  } catch (err) {
    console.error('[context-frame] log failed:', err);
  }
}

export async function POST(req: Request) {
  let body: { question?: string; tourId?: string; actId?: string; lens?: PastLens } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const question = (body.question || '').trim();
  const tourId = (body.tourId || '').trim();
  const actId = body.actId;
  const lens = body.lens;
  if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 });

  // Build a compact TOUR CONTEXT block from the tour's existing metadata so the
  // coach can judge "relevant to this tour" (Tier 1) without any manual field.
  let tourContext = '';
  try {
    if (tourId) {
      const snap = await getDoc(doc(db, 'memorial-church-tours', tourId));
      if (snap.exists()) {
        const tour = snap.data() as Tour;
        const parts: string[] = [];
        if (tour.title) parts.push(`Title: ${tour.title}`);
        if (tour.subtitle) parts.push(`Subtitle: ${tour.subtitle}`);
        if (tour.description) parts.push(`About: ${tour.description}`);
        if (tour.essentialQuestion?.question) parts.push(`Essential question: ${tour.essentialQuestion.question}`);
        const act = actId ? (tour.acts || []).find((a) => a.id === actId) : undefined;
        if (act?.guidingQuestion) parts.push(`Current section's guiding question: ${act.guidingQuestion}`);
        tourContext = parts.join('\n');
      }
    }
  } catch (err) {
    console.error('[context-frame] load tour failed:', err);
  }

  try {
    const userText =
      `LEARNER'S QUESTION:\n"${question}"\n\n`
      + `CHOSEN LENS: ${lens ? LENS_LABEL[lens] : 'not specified'}\n\n`
      + `TOUR CONTEXT (what this tour is about — for judging broad relevance):\n${tourContext || '(unknown)'}\n\n`
      + `Coach this question per your Framing Coach skill, then call the tool exactly once.`;

    const out = await frameQuestion(frameSystem(), userText);
    if (!out) {
      // Degrade gracefully: treat as fine to proceed, no reframe.
      const fallback: FrameOutput = { ok: true, reorientation: '', needsReframe: false, reframeTip: '', suggestedQuestions: [] };
      void logFraming({ question, tourId, actId, lens, result: fallback });
      return NextResponse.json(fallback);
    }
    // Coherence guard: ok and needsReframe must not both be true.
    const needsReframe = out.needsReframe && !out.ok;
    // Keep EVERY proposed reframe (no truncation) so the author can review the
    // full set the coach offered and give feedback on it.
    const result: FrameOutput = {
      ok: out.ok,
      reorientation: out.reorientation || '',
      needsReframe,
      reframeTip: needsReframe ? (out.reframeTip || '') : '',
      suggestedQuestions: needsReframe ? (out.suggestedQuestions || []).filter(Boolean) : [],
    };
    void logFraming({ question, tourId, actId, lens, result });
    return NextResponse.json(result);
  } catch (err) {
    console.error('[context-frame] error:', err);
    const fallback: FrameOutput = { ok: true, reorientation: '', needsReframe: false, reframeTip: '', suggestedQuestions: [] };
    void logFraming({ question, tourId, actId, lens, result: fallback });
    return NextResponse.json(fallback);
  }
}
