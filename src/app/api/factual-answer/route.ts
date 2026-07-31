/**
 * POST /api/factual-answer — the short, plain answer to a lookup question.
 *
 * Deliberately NOT the Context Detective. That pipeline exists to recreate a
 * world; this one exists to say who designed the church. So it shares almost
 * nothing with it: a small system prompt of its own (loading P.A.S.T., Research
 * and Grounding here would put the expensive part back and save nothing), one
 * Sonnet call, no voice rewrite, no photo lookup, no candidate capture.
 *
 * Two rules the model cannot be trusted to keep on its own, so the route keeps
 * them instead:
 *
 *   • **Sources.** The prompt asks for reference works, institutions and official
 *     pages, but a prompt is a preference. Every citation is filtered by hostname
 *     on the way out, and forums and user-generated answers are dropped whatever
 *     the model thought of them. No acceptable source left → no answer.
 *   • **Length.** 100 words, and one sentence when the question is small. We have
 *     watched a stated ceiling be missed by 10% on average elsewhere in this
 *     codebase, so this one is counted.
 *
 * The learner never sees this happen. It runs while they explore Act 1 and the
 * answer is waiting at the end of it.
 */

import { NextResponse } from 'next/server';
import { factualAnswer } from '@/lib/context-detective/claude';

export const maxDuration = 120;

/**
 * Word ceiling on the answer — a sentence, or two when the question genuinely has
 * two answers. Counted in `factualAnswer`, which pushes back once when a draft
 * runs over rather than trusting the instruction.
 *
 * Was 100, which bought a whole second and third sentence, and that is where
 * explanation crept in: why it mattered, what it led to. At that length a lookup
 * starts reading like a thin version of a context answer, which is the one thing
 * it must not be — if an answer needs that, the question was a context question
 * and belongs in the Detective's pipeline instead.
 */
const MAX_WORDS = 40;

/**
 * Hostnames we will show a learner, and ones we won't.
 *
 * The allow side is shape-based rather than a list, because "any university" is
 * the actual rule and no list expresses it. The deny side is specific: forums and
 * user-generated answers are exactly what was ruled out, and they rank well, so
 * leaving them to the prompt would let them through.
 */
const DENY = [
  'reddit.com', 'quora.com', 'stackexchange.com', 'stackoverflow.com', 'answers.com',
  'yahoo.com', 'facebook.com', 'x.com', 'twitter.com', 'instagram.com', 'tiktok.com',
  'youtube.com', 'medium.com', 'pinterest.com', 'tripadvisor.com', 'ancestry.com',
  'wikihow.com', 'fandom.com', 'blogspot.com', 'wordpress.com', 'substack.com',
];
/** Reference works and publishers that are fine anywhere. */
const ALLOW_EXACT = [
  'wikipedia.org', 'britannica.com', 'jstor.org', 'archive.org', 'loc.gov',
  'si.edu', 'nps.gov', 'oxfordreference.com', 'doi.org', 'nature.com', 'science.org',
];

function acceptableSource(url: string): boolean {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return false; }
  if (DENY.some((d) => host === d || host.endsWith(`.${d}`))) return false;
  if (ALLOW_EXACT.some((a) => host === a || host.endsWith(`.${a}`))) return true;
  // Institutions and government, wherever they are: .edu, .gov, .ac.uk, .edu.au…
  if (/(^|\.)(edu|gov|mil)(\.[a-z]{2})?$/.test(host)) return true;
  if (/(^|\.)ac\.[a-z]{2}$/.test(host)) return true;
  // A museum, archive, or society.
  if (/(^|\.)(museum|org)$/.test(host)) return true;
  return false;
}

const wordCount = (t: string) => (t || '').trim().split(/\s+/).filter(Boolean).length;

export async function POST(req: Request) {
  let body: { question?: string; domains?: string[] } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const question = (body.question || '').trim();
  if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 });

  const started = Date.now();
  try {
    const out = await factualAnswer(question, body.domains || [], MAX_WORDS);
    if (!out?.answer?.trim()) {
      console.log(`[factual] "${question.slice(0, 60)}" → no answer (${Date.now() - started}ms)`);
      return NextResponse.json({ status: 'failed', answer: '', sources: [] });
    }

    const clean = (list: { url: string; name?: string }[]) => {
      const seen = new Set<string>();
      return list
        .filter((s) => s.url && acceptableSource(s.url))
        .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
        .map((s) => ({ label: (s.name || s.url).slice(0, 120), url: s.url }));
    };

    const cited = clean(out.sources || []);
    const dropped = (out.sources || []).length - cited.length;
    // Nothing citable came back, but the search still opened pages — use those
    // rather than throwing the answer away. The model answering from memory and
    // reporting no sources is the common case, not a sign the answer is bad; the
    // Detective takes the same floor. Capped, since these were consulted rather
    // than deliberately chosen.
    const sources = cited.length ? cited : clean(out.searched || []).slice(0, 3);
    if (!cited.length && sources.length) {
      console.log(`[factual] "${question.slice(0, 60)}" → model cited nothing; using ${sources.length} searched page(s)`);
    }

    // A plain fact with nothing behind it is exactly what this app should not be
    // showing. Better to say we couldn't find one than to assert it unsourced.
    if (!sources.length) {
      console.warn(
        `[factual] "${question.slice(0, 60)}" → answered but every source was rejected `
        + `(${dropped} dropped) — returning no answer`,
      );
      return NextResponse.json({ status: 'failed', answer: '', sources: [] });
    }

    const words = wordCount(out.answer);
    console.log(
      `[factual] "${question.slice(0, 60)}" → ${words} words, ${sources.length} source(s)`
      + `${dropped ? `, ${dropped} rejected` : ''} · ${Date.now() - started}ms`,
    );
    return NextResponse.json({ status: 'answered', answer: out.answer.trim(), sources });
  } catch (err) {
    console.error('[factual] failed:', err);
    return NextResponse.json({ status: 'failed', answer: '', sources: [] });
  }
}
