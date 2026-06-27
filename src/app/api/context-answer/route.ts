/**
 * POST /api/context-answer — answers a learner's "context question" at the end
 * of an Act.
 *
 * ⚠️ STUB. Currently returns `{ answer: null, status: 'banked' }` so the
 * explorer UI shows a friendly "saved — we'll help you find this" state. No
 * model is called yet.
 *
 * TODO (AI SKILL — scaffold later). When wired, this must have the SKILL to
 * contextualise well and sound like a warm tour guide, NOT like an AI:
 *   1. Search the knowledge database FIRST (`src/lib/knowledge-db.ts` +
 *      `src/lib/hint-matcher.ts`); reuse the raw-fetch Claude pattern in
 *      `src/app/api/ask/route.ts` (model `claude-haiku-4-5-20251001`).
 *   2. If the knowledge DB can't answer, search the WEB, prioritising:
 *        academic sources → official / government sites.
 *      STRICTLY EXCLUDE discussion forums (Reddit, Quora, etc.).
 *   3. Answer in a grounded, conversational tour-guide voice (cite where the
 *      claim comes from). Return `{ answer, status: 'answered' }`, or
 *      `{ answer: null, status: 'banked' }` if nothing solid is found.
 */

import { NextResponse } from 'next/server';

interface ContextAnswerBody {
  question?: string;
  tourId?: string;
  actId?: string;
}

export async function POST(req: Request) {
  let body: ContextAnswerBody = {};
  try {
    body = (await req.json()) as ContextAnswerBody;
  } catch {
    /* empty body is fine */
  }

  const question = (body.question || '').trim();
  if (!question) {
    return NextResponse.json({ error: 'No question provided' }, { status: 400 });
  }

  // STUB: bank the question for now. The explorer card renders the banked
  // state ("Saved — we'll help you find this"). Wire the AI per the TODO above.
  return NextResponse.json({ answer: null, status: 'banked' as const });
}
