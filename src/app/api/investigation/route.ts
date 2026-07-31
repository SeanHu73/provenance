/**
 * POST /api/investigation — split one submission into separate questions.
 *
 * The learner writes or dictates several questions in one go ("who built it, and
 * why here, and was it always a church"), so this does three jobs in a single
 * cheap call before any research starts:
 *
 *   1. Split the text into individual questions.
 *   2. Merge near-identical ones — kept, not dropped: every original wording goes
 *      into `mergedFrom` so the admin can see what they actually said.
 *   3. Classify each as `factual` (a lookup with an answer: who, when, how many)
 *      or `contextual` (why it was so, what made it possible — the tour's job).
 *
 * Haiku, one call, no web access. This is a parsing task, not a research one, and
 * it sits between the learner pressing submit and the screen moving on — so it
 * has to be fast above all else.
 */

import { NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { parseInvestigation } from '@/lib/context-detective/claude';
import { embedTexts, cosine } from '@/lib/context-detective/embed';
import { embeddingKey, getCachedEmbeddings, putCachedEmbedding } from '@/lib/context-detective/embed-cache';
import type { InvestigationQuestion, Tour } from '@/lib/types';

export const maxDuration = 60;

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `iq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * How close a question has to sit to a later act's material before we hold it.
 *
 * Measured on this tour, where Act 2 holds "The Chinese Exclusion Act of 1882"
 * and "The Frontier: A Moving Line":
 *     0.69  "What was the frontier?"                    ← must hold
 *     0.54  "What was happening with Chinese immigration" ← must hold
 *     0.31  "How did the railroad make them rich?"        ← Act 1, answer it
 *     0.26  "Why did they build it here?"                 ← answer it
 *     0.12  "Who designed the church?"                    ← answer it
 * The gap between 0.54 and 0.31 is wide, so 0.45 sits comfortably in it — and
 * happens to match the retrieval floor used elsewhere for "is this related at
 * all". Getting this wrong is asymmetric but not one-sided: holding a question
 * the tour never returns to is a broken promise, answering one it was about to
 * cover spends the reveal. The measured gap is what makes the choice safe.
 */
const SPOILER_MIN = 0.45;

/**
 * Which questions the tour is about to answer itself.
 *
 * Act 1's own material is fair game — they are about to explore it, and an answer
 * they then hear confirmed is a good experience. Anything belonging to a LATER
 * act is held: answering it here would spend the reveal the tour was built
 * around. Post-tour additional stops are excluded, since a learner may never
 * reach them and holding a question for a stop they skip means never answering it.
 *
 * Uses the embeddings both sides already have — the authored contexts are cached
 * by text hash, and the questions are embedded in one batch — so this costs one
 * call regardless of how many questions were asked.
 */
async function findSpoilers(tourId: string, questions: string[]): Promise<boolean[]> {
  const none = questions.map(() => false);
  if (!tourId || !questions.length) return none;
  try {
    const snap = await getDoc(doc(db, 'memorial-church-tours', tourId));
    if (!snap.exists()) return none;
    const tour = snap.data() as Tour;
    const acts = tour.acts || [];
    // Everything from act 2 onward. `contexts` only — additional stops live
    // elsewhere on the tour and are deliberately not consulted.
    const laterTexts = acts.slice(1).flatMap((a) => (a.contexts || []).map(
      (c) => `${c.title}

${c.shortSummary}

${c.longExplanation}`.trim(),
    )).filter(Boolean);
    if (!laterTexts.length) return none;

    const keys = laterTexts.map(embeddingKey);
    const cached = await getCachedEmbeddings(keys);
    const missIdx = laterTexts.map((_, i) => i).filter((i) => !cached.has(keys[i]));
    const vectors = await embedTexts([...questions, ...missIdx.map((i) => laterTexts[i])]);
    const qVecs = vectors.slice(0, questions.length);
    const missVecs = vectors.slice(questions.length);
    const laterVecs = laterTexts.map((_, i) => cached.get(keys[i]));
    missIdx.forEach((textI, k) => {
      laterVecs[textI] = missVecs[k];
      void putCachedEmbedding(keys[textI], missVecs[k]);
    });

    return qVecs.map((qv, i) => {
      let best = 0;
      for (const lv of laterVecs) if (lv) best = Math.max(best, cosine(qv, lv));
      const held = best >= SPOILER_MIN;
      console.log(`[investigation]   ${held ? 'HOLD' : 'answer'} ${best.toFixed(2)}  "${questions[i].slice(0, 55)}"`);
      return held;
    });
  } catch (err) {
    // A failed check must not hold a question back: answering something the tour
    // also covers is a far smaller harm than silently refusing to answer.
    console.error('[investigation] spoiler check failed, answering everything:', err);
    return none;
  }
}

/** Last-resort split when the model gives us nothing usable: one question per
 *  line or per question mark. A rough list beats losing what they wrote. */
function naiveSplit(raw: string): string[] {
  return raw
    .split(/\n+|(?<=\?)\s+/)
    .map((q) => q.trim())
    .filter((q) => q.length > 3)
    .slice(0, 20);
}

export async function POST(req: Request) {
  let body: { raw?: string; tourId?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const raw = (body.raw || '').trim();
  const tourId = (body.tourId || '').trim();
  if (!raw) return NextResponse.json({ questions: [] });

  const started = Date.now();
  let parsed = await parseInvestigation(raw);

  if (!parsed?.length) {
    // The parse failed. Fall back to a dumb split rather than dropping the
    // learner's questions on the floor — an unclassified question still gets
    // researched, it just takes the contextual path.
    console.warn('[investigation] parse returned nothing — falling back to a naive split');
    parsed = naiveSplit(raw).map((text) => ({ text, kind: 'contextual' as const, mergedFrom: [] }));
  }

  const usable = parsed.filter((q) => q.text?.trim());
  // One batch check for the whole list, before anything is dispatched.
  const spoilers = await findSpoilers(tourId, usable.map((q) => q.text.trim()));
  const questions: InvestigationQuestion[] = usable.map((q, i) => ({
    id: newId(),
    text: q.text.trim(),
    kind: q.kind === 'factual' ? 'factual' : 'contextual',
    ...(q.mergedFrom?.length ? { mergedFrom: q.mergedFrom } : {}),
    // `later` never reaches a research pipeline — the tour answers it in person.
    status: spoilers[i] ? ('later' as const) : ('pending' as const),
  }));

  console.log(
    `[investigation] ${questions.length} question(s) from ${raw.length} chars in ${Date.now() - started}ms · `
    + `${questions.filter((q) => q.kind === 'factual').length} factual, `
    + `${questions.filter((q) => q.kind === 'contextual').length} contextual`
    + `, ${questions.filter((q) => q.status === 'later').length} held for a later act`,
  );
  return NextResponse.json({ questions });
}
