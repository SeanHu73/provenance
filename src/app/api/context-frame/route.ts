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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tour, PastLens } from '@/lib/types';
import { frameSystem } from '@/lib/context-detective/prompts';
import { frameQuestion } from '@/lib/context-detective/claude';

export const maxDuration = 30;

const LENS_LABEL: Record<PastLens, string> = {
  place: 'Place', attitudes: 'Affairs', society: 'Society', technology: 'Technology',
};

export async function POST(req: Request) {
  let body: { question?: string; tourId?: string; lens?: PastLens } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const question = (body.question || '').trim();
  const tourId = (body.tourId || '').trim();
  const lens = body.lens;
  if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 });

  // Load tour-specific coaching guidance + the act's framing, if available.
  let coaching = '';
  let tourTitle = '';
  try {
    if (tourId) {
      const snap = await getDoc(doc(db, 'memorial-church-tours', tourId));
      if (snap.exists()) {
        const tour = snap.data() as Tour;
        coaching = (tour.questionCoaching || '').trim();
        tourTitle = tour.title || '';
      }
    }
  } catch (err) {
    console.error('[context-frame] load tour failed:', err);
  }

  try {
    const userText =
      `LEARNER'S QUESTION:\n"${question}"\n\n`
      + `CHOSEN LENS: ${lens ? LENS_LABEL[lens] : 'not specified'}\n`
      + (tourTitle ? `TOUR: ${tourTitle}\n` : '')
      + `\nCoach this question per your Framing Coach skill, then call the tool exactly once.`;

    const out = await frameQuestion(frameSystem(coaching), userText);
    if (!out) {
      // Degrade gracefully: treat as fine to proceed, no reframe.
      return NextResponse.json({ ok: true, reorientation: '', needsReframe: false, reframeTip: '', suggestedQuestions: [] });
    }
    // Coherence guard: ok and needsReframe must not both be true.
    const needsReframe = out.needsReframe && !out.ok;
    return NextResponse.json({
      ok: out.ok,
      reorientation: out.reorientation || '',
      needsReframe,
      reframeTip: needsReframe ? (out.reframeTip || '') : '',
      suggestedQuestions: needsReframe ? (out.suggestedQuestions || []).filter(Boolean).slice(0, 3) : [],
    });
  } catch (err) {
    console.error('[context-frame] error:', err);
    return NextResponse.json({ ok: true, reorientation: '', needsReframe: false, reframeTip: '', suggestedQuestions: [] });
  }
}
