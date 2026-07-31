/**
 * POST /api/context-answer — the Context Detective pipeline.
 *
 * embed question → cosine-retrieve over this tour's verified base (knowledge
 * entries + authored Add-Context items) → research + draft (Sonnet 5, web search,
 * domains prioritised-not-enforced) → voice rewrite (Opus 4.8), which also returns
 * the card's title and summary → build the handout here → return + log it.
 *
 * The route stamps the framing question and entry lens; the model never
 * generates them. Any failure degrades to a "banked" answer so the UI still
 * shows the friendly saved state.
 */

import { NextResponse } from 'next/server';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Tour, KnowledgeEntry, PastLens, ActContextItem,
  DetectiveAnswer, DetectiveHandout, DetectiveSource, DetectiveLog, ResearchBackend,
} from '@/lib/types';
import { researchSystem, voiceSystem } from '@/lib/context-detective/prompts';
import { researchDraft, synthesiseResearch, voiceRewrite, ResearchSource } from '@/lib/context-detective/claude';
import { perplexitySearch, findingsBlock, type PerplexityFindings } from '@/lib/context-detective/perplexity';
import { getResearchBackend } from '@/lib/app-settings-store';
import { embedTexts, cosine } from '@/lib/context-detective/embed';
import { searchCommonsImages, isPhotoExt } from '@/lib/image-search';
import { embeddingKey, getCachedEmbeddings, putCachedEmbedding } from '@/lib/context-detective/embed-cache';
import { hashText } from '@/lib/tts-text';

// The three-pass pipeline + web search can run a couple of minutes; allow it on
// Vercel (Pro caps at 300s). The learner sees the "researching…" screen meanwhile.
export const maxDuration = 300;

const LOG_COLLECTION = 'memorial-church-detective-responses';
/**
 * How long to hold out for the *preferred* research path before shipping the
 * other one's answer.
 *
 * Both paths run at once (see the hedge below), so this is not "how long before
 * we start the fallback" — the fallback is already finished or nearly so. It is
 * only "how long do we prefer mode 1's answer over a mode 2 answer that is
 * sitting ready". That makes a short value cheap: passing it costs the learner
 * nothing, because the alternative is already in hand.
 *
 * Deliberately NOT a substitute for the attempt caps (`max_uses: 8` on the search
 * tool, 8 loop iterations). Those bound how much work the model does; this bounds
 * how long the learner waits. A slow network sails straight past the first and is
 * caught only by the second.
 */
const PREFER_PRIMARY_MS = 60_000;
/**
 * Hard ceiling on research, both paths included. Past this we bank deliberately
 * rather than let Vercel kill the function at `maxDuration` — a graceful miss the
 * learner can see beats a request that dies holding the answer. Two minutes is
 * already longer than anyone will happily wait at a stop, and it leaves plenty of
 * room for the voice pass and the photo lookup, which run afterwards.
 */
const RESEARCH_CEILING_MS = 120_000;
const TOP_K = 6;
/** Cosine floor a base entry must clear to be shown to the model at all. Below this
 *  it is not "related material", it is a distraction we have stamped as verified. */
const MIN_SCORE = 0.45;

interface Candidate {
  kind: 'entry' | 'context';
  id: string;
  title: string;
  summary: string;
  explanation: string;
  lens: PastLens;
  domains: string[];
  embedding?: number[];
  score: number;
}

/** A citation's href, or undefined. Accepts a full URL, and promotes a bare
 *  domain ("stanford.edu/…") to one — the model writes both, and only the first
 *  is a working link. Anything that isn't plausibly a web address (a book title,
 *  an archive box number) returns undefined and renders as plain text. */
function linkOf(raw?: string): string | undefined {
  const v = (raw || '').trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  // A domain, optionally with a path — no spaces, a dot, and a plausible TLD.
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) && /\.[a-z]{2,}(\/|$)/i.test(v)) return `https://${v}`;
  return undefined;
}

const candidateText = (c: { title: string; summary: string; explanation: string }) =>
  `${c.title}\n\n${c.summary}\n\n${c.explanation}`.trim();

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `dr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function logResponse(input: Omit<DetectiveLog, 'id' | 'createdAt' | 'reviewStatus'>): Promise<void> {
  try {
    const id = newId();
    const log: DetectiveLog = { ...input, id, createdAt: new Date().toISOString(), reviewStatus: 'unreviewed' };
    const { id: _id, ...data } = log;
    void _id;
    // Firestore rejects `undefined` field values — round-trip to drop them.
    await setDoc(doc(db, LOG_COLLECTION, id), JSON.parse(JSON.stringify(data)));
  } catch (err) {
    console.error('[context-answer] log failed:', err);
  }
}

function banked(
  question: string,
  tourId: string,
  actId: string | undefined,
  narrative = '',
  originalQuestion?: string,
  /** Which backend ran, and how long its research took — recorded even on a miss,
   *  since "how often does it come back with nothing" is half the comparison. */
  trace?: { researchBackend?: ResearchBackend; researchMs?: number },
): DetectiveAnswer {
  void logResponse({
    question, originalQuestion, tourId, actId, status: 'banked', narrative,
    handout: null, branch: 'banked', sources: [], retrievedIds: [], ...trace,
  });
  return { status: 'banked', narrative, handout: null, branch: 'banked', sources: [] };
}

/**
 * Knowledge accretion: after a live (web) answer, write it back as a **candidate**
 * knowledge entry for this tour — embedded, lens-tagged, carrying its web sources.
 * Candidates are NOT retrieved (see loadCandidates) until an admin promotes them,
 * so this can never degrade answers; it just pre-fills the review queue so the
 * verified base grows and repeat questions stop needing web search.
 */
async function captureCandidate(input: {
  tourId: string;
  question: string;
  lens: PastLens;
  card: DetectiveHandout['cards'][number] | undefined;
  narrative: string;
  sources: DetectiveSource[];
}): Promise<void> {
  try {
    const { tourId, question, lens, card, narrative, sources } = input;
    const title = (card?.title || question).trim();
    const shortSummary = (card?.summary || '').trim();
    const longExplanation = (card?.explanation || narrative || '').trim();
    if (!longExplanation) return;
    // Provenance required (mirrors the curator rule) — keep only web source links.
    const sourceLinks = sources
      .filter((s) => s.kind === 'web' && s.url)
      .map((s) => ({ label: (s.name || s.url || '').slice(0, 120), url: s.url as string }));
    if (sourceLinks.length === 0) return;

    const qKey = question.trim().toLowerCase();
    const col = collection(db, 'memorial-church-tours', tourId, 'knowledge-entries');
    const snap = await getDocs(col);
    // Dedup: skip if a candidate for the same question already exists.
    let dup = false;
    snap.forEach((d) => {
      const e = d.data() as KnowledgeEntry;
      if (e.status === 'candidate' && (e.sourceQuestion || '').trim().toLowerCase() === qKey) dup = true;
    });
    if (dup) return;

    const embedText = `${shortSummary}\n\n${longExplanation}`.trim();
    // Two vectors: the answer text (for topical retrieval) and the question
    // itself (so a later ask can be matched question-to-question and served
    // from here — see reuseFromBase).
    const [embedding, questionEmbedding] = await embedTexts([embedText, question.trim()]);
    const id = newId();
    const now = new Date().toISOString();
    const entry: Omit<KnowledgeEntry, 'id'> = {
      title, shortSummary, longExplanation, sourceLinks, lens,
      embedding, embeddingModel: 'text-embedding-3-small', embeddingHash: hashText(embedText),
      questionEmbedding,
      status: 'candidate', sourceQuestion: question.trim(),
      // Remember the illustration so promoting this entry keeps its picture and
      // no repeat ask has to search Commons for one again.
      ...(card?.imageUrl ? { photoUrl: card.imageUrl } : {}),
      ...(card?.imageCredit ? { photoCredit: card.imageCredit } : {}),
      createdAt: now, updatedAt: now,
    };
    await setDoc(doc(col, id), JSON.parse(JSON.stringify(entry)));
  } catch (err) {
    console.error('[context-answer] candidate capture failed:', err);
  }
}

/** The best illustrative photo for an authored context: its chosen thumbnail,
 *  else its first photo, else a cited source's image. Null when it has none. */
function contextPhoto(c: ActContextItem): { url: string; credit?: string } | null {
  const photos = (c.media || []).filter((m) => m.kind === 'photo' && m.url);
  const pick = (c.thumbnailMediaId && photos.find((m) => m.id === c.thumbnailMediaId)) || photos[0];
  if (pick?.url) return { url: pick.url };
  const withImg = (c.sources || []).find((s) => s.imageUrl);
  if (withImg?.imageUrl) return { url: withImg.imageUrl, credit: withImg.name || undefined };
  return null;
}

async function loadCandidates(tourId: string): Promise<{
  candidates: Candidate[];
  preferredDomains: string[];
  contextPhotos: Record<string, { url: string; credit?: string }>;
  /** Verified entries, kept whole so a repeat question can be answered from one. */
  entries: KnowledgeEntry[];
}> {
  const out: Candidate[] = [];
  const contextPhotos: Record<string, { url: string; credit?: string }> = {};
  const entries: KnowledgeEntry[] = [];
  let preferredDomains: string[] = [];
  // Knowledge entries (already embedded)
  try {
    const snap = await getDocs(collection(db, 'memorial-church-tours', tourId, 'knowledge-entries'));
    snap.forEach((d) => {
      const e = { id: d.id, ...d.data() } as KnowledgeEntry;
      // Candidates (auto-captured from learner answers) stay out of retrieval
      // until an admin promotes them to the verified base.
      if (e.status === 'candidate') return;
      entries.push(e);
      // An entry that remembers its photo illustrates its own answer, exactly as
      // an authored context does.
      if (e.photoUrl) contextPhotos[e.id] = { url: e.photoUrl, credit: e.photoCredit };
      out.push({
        kind: 'entry', id: e.id, title: e.title, summary: e.shortSummary, explanation: e.longExplanation,
        lens: e.lens, domains: (e.sourceLinks || []).map((l) => l.url).filter(Boolean),
        embedding: e.embedding, score: 0,
      });
    });
  } catch (err) {
    console.error('[context-answer] load entries failed:', err);
  }
  // Authored Add-Context items across the tour's acts (embedded at ask time)
  try {
    const tSnap = await getDoc(doc(db, 'memorial-church-tours', tourId));
    if (tSnap.exists()) {
      const tour = tSnap.data() as Tour;
      preferredDomains = (tour.preferredDomains || []).map((d) => d.trim()).filter(Boolean);
      for (const act of tour.acts || []) {
        for (const c of act.contexts || []) {
          out.push({
            kind: 'context', id: c.id, title: c.title, summary: c.shortSummary, explanation: c.longExplanation,
            lens: c.pastCategory, domains: (c.sources || []).map((s) => s.url || '').filter(Boolean),
            score: 0,
          });
          const photo = contextPhoto(c);
          if (photo) contextPhotos[c.id] = photo;
        }
      }
    }
  } catch (err) {
    console.error('[context-answer] load contexts failed:', err);
  }
  return { candidates: out, preferredDomains, contextPhotos, entries };
}

/** Backfill a promoted entry's question vector. Best-effort: a failure just means
 *  near-match reuse waits for the next ask. */
async function persistQuestionEmbedding(tourId: string, id: string, vec: number[]): Promise<void> {
  try {
    await setDoc(
      doc(db, 'memorial-church-tours', tourId, 'knowledge-entries', id),
      { questionEmbedding: vec, updatedAt: new Date().toISOString() },
      { merge: true },
    );
  } catch (err) {
    console.error('[context-answer] question-embedding backfill failed:', err);
  }
}

/** Questions match on wording alone once punctuation and case are set aside. */
const normaliseQuestion = (q: string) => q.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ');

/**
 * Cosine floor for treating a new question as "basically the same" as the one a
 * verified entry was captured from. Deliberately high: a near-miss served from
 * the base is a wrong answer delivered confidently and fast, which is worse than
 * a slow right one. Below it, the question goes through the full pipeline.
 */
const REUSE_MIN = 0.94;

/**
 * Serve a repeat question straight from the verified base.
 *
 * Only entries promoted by an admin are eligible, and only those captured from a
 * question in the first place (`sourceQuestion`) — a curator-authored entry has
 * no question to compare against and stays on the normal retrieval path. Matching
 * is question-to-question via `questionEmbedding`, not question-to-answer-text,
 * so it measures "did someone already ask this" rather than "is this on topic".
 *
 * Returns null when nothing is close enough, and the pipeline runs as usual.
 */
function reuseFromBase(
  entries: KnowledgeEntry[],
  question: string,
  qVec: number[] | undefined,
): { entry: KnowledgeEntry; score: number; exact: boolean } | null {
  const target = normaliseQuestion(question);
  let best: { entry: KnowledgeEntry; score: number; exact: boolean } | null = null;
  for (const e of entries) {
    const asked = (e.sourceQuestion || '').trim();
    if (!asked || !e.longExplanation) continue;
    if (normaliseQuestion(asked) === target) return { entry: e, score: 1, exact: true };
    if (!qVec || !e.questionEmbedding) continue;
    const score = cosine(qVec, e.questionEmbedding);
    if (score >= REUSE_MIN && (!best || score > best.score)) best = { entry: e, score, exact: false };
  }
  return best;
}

export async function POST(req: Request) {
  let body: { question?: string; originalQuestion?: string; tourId?: string; actId?: string; lens?: PastLens; priorStops?: string[] } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const question = (body.question || '').trim();
  // Titles of stops the learner has already seen — their prior knowledge. Passed
  // to the model as background ONLY (see the guardrail in researchUser); it must
  // never argue from stop content — contextualising is the learner's job.
  const priorStops = Array.isArray(body.priorStops)
    ? body.priorStops.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 40)
    : [];
  // The learner's first-asked question, before any Framing Coach reframe. Defaults
  // to the final question when they kept their wording. Logged for the author.
  const originalQuestion = (body.originalQuestion || body.question || '').trim();
  const tourId = (body.tourId || '').trim();
  const actId = body.actId;
  const requestLens = body.lens;
  if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 });
  if (!tourId) return NextResponse.json(banked(question, tourId, actId, '', originalQuestion));

  const t0 = Date.now();
  const timings: Record<string, number> = {};
  try {
    // 1. Retrieval — embed the question + rank. Authored-context embeddings are
    //    cached by text hash and reused (only cache-misses are embedded here);
    //    knowledge entries already carry theirs. The question is always embedded.
    const tRetrieve = Date.now();
    const { candidates, preferredDomains, contextPhotos, entries } = await loadCandidates(tourId);
    const contexts = candidates.filter((c) => c.kind === 'context');
    const ctxTexts = contexts.map(candidateText);
    const ctxHashes = ctxTexts.map(embeddingKey);
    const cached = await getCachedEmbeddings(ctxHashes);
    const missIdx = contexts.map((_, i) => i).filter((i) => !cached.has(ctxHashes[i]));
    // Entries promoted before question-embeddings existed carry a sourceQuestion
    // but no vector for it. Embed those in this same batch and write them back, so
    // near-match reuse starts working for the base as it already stands rather
    // than only for questions asked from now on.
    const needQVec = entries.filter((e) => (e.sourceQuestion || '').trim() && !e.questionEmbedding);
    const [qVec, ...rest] = await embedTexts([
      question,
      ...missIdx.map((i) => ctxTexts[i]),
      ...needQVec.map((e) => (e.sourceQuestion || '').trim()),
    ]);
    const missVecs = rest.slice(0, missIdx.length);
    const legacyQVecs = rest.slice(missIdx.length);
    contexts.forEach((c, i) => { c.embedding = cached.get(ctxHashes[i]); });
    missIdx.forEach((ctxI, k) => {
      contexts[ctxI].embedding = missVecs[k];
      void putCachedEmbedding(ctxHashes[ctxI], missVecs[k]); // fill the cache for next time
    });
    needQVec.forEach((e, k) => {
      if (!legacyQVecs[k]) return;
      e.questionEmbedding = legacyQVecs[k];
      void persistQuestionEmbedding(tourId, e.id, legacyQVecs[k]);
    });
    timings.retrieve = Date.now() - tRetrieve;

    // 1b. Already answered? If this question — or one that means the same thing —
    //     produced an entry an admin has since promoted, serve that entry and
    //     stop. This skips research and voice entirely, so a repeat ask returns
    //     in the time it takes to embed one question instead of a couple of
    //     minutes, and returns the *reviewed* wording rather than a fresh
    //     generation that may drift from it.
    const reuse = reuseFromBase(entries, question, qVec);
    if (reuse) {
      const { entry, score, exact } = reuse;
      const sources: DetectiveSource[] = [
        { kind: 'entry', id: entry.id, name: entry.title, verified: true },
        ...(entry.sourceLinks || []).map((l) => ({
          kind: 'web' as const, url: l.url, name: l.label, verified: true,
        })),
      ];
      const handout: DetectiveHandout = {
        framingQuestion: question,
        entryLens: entry.lens,
        cards: [{
          lens: entry.lens,
          title: entry.title,
          summary: entry.shortSummary,
          explanation: entry.longExplanation,
          sources,
          ...(entry.photoUrl
            ? { imageUrl: entry.photoUrl, ...(entry.photoCredit ? { imageCredit: entry.photoCredit } : {}) }
            : {}),
        }],
      };
      const answer: DetectiveAnswer = {
        status: 'answered', narrative: entry.longExplanation, handout,
        branch: 'verified-base', sources,
      };
      console.log(
        `[detective] "${question.slice(0, 70)}" → reused ${exact ? 'exact' : `${score.toFixed(3)}`} `
        + `match "${(entry.sourceQuestion || '').slice(0, 50)}" · total=${Date.now() - t0}ms`,
      );
      void logResponse({ ...answer, question, originalQuestion, tourId, actId, retrievedIds: [entry.id] });
      return NextResponse.json(answer);
    }

    // Rank, then drop the weak matches entirely. Taking the top K regardless of score
    // was actively harmful: a small base skews to whatever it happens to contain (here,
    // the railroad), so *every* technology question was handed railroad entries stamped
    // "curator-authored; verified" and the model anchored on them — answering about the
    // railroad when asked about the campus. An entry the question does not actually match
    // is worse than no entry at all, because we vouch for it. Below the floor, we say the
    // base has nothing and let it search.
    const scored = candidates
      .map((c) => ({ ...c, score: cosine(qVec, c.embedding) }))
      .sort((a, b) => b.score - a.score);
    const ranked = scored.filter((c) => c.score >= MIN_SCORE).slice(0, TOP_K);
    console.log(
      `[detective]   retrieval: ${ranked.length}/${scored.length} above floor ${MIN_SCORE} · `
      + (scored.slice(0, 5).map((c) => `${c.score.toFixed(2)} ${c.title.slice(0, 34)}`).join(' | ') || 'base empty'),
    );

    // 2. Research + draft. The tour's preferred domains lead the list (so they
    //    survive the cap), then source links from the retrieved entries.
    const domains = Array.from(new Set([...preferredDomains, ...ranked.flatMap((c) => c.domains)])).slice(0, 16);
    const candidateBlock = ranked.length
      ? ranked.map((c) => `[${c.kind}:${c.id}] (${c.lens}) ${c.title}\n${c.summary}\n${c.explanation}\nSource links: ${c.domains.join(', ') || '—'}`).join('\n\n')
      : '(nothing in the verified base matches this question — research it from the web)';
    const lensLine = requestLens ? `: ${requestLens}` : ' — not specified; determine the lead lens yourself.';

    const priorBlock = priorStops.length
      ? `LEARNER'S PRIOR KNOWLEDGE — stops they have already visited on this tour: ${priorStops.join('; ')}.\n`
        + `This is BACKGROUND ONLY, to gauge what they likely already know and pitch the answer accordingly (don't re-explain what they've clearly seen). Do NOT treat these stops as sources or evidence, do NOT quote or argue from their content, and do NOT make the connections between them and the answer for the learner — drawing those links is the learner's own job.\n\n`
      : '';

    // Everything both research backends need. Only the tail differs: the Claude
    // path is told how to search, the Perplexity path is handed what was found.
    // MECHANICS ONLY. The doctrine — the source ladder, the fit gate, the partial
    // answer, when banking is and is not allowed, and why knowing a fact is not a
    // source for it — lives in the Research skill (§1-§5) and is stated there once.
    // It used to be restated here too, which meant two copies of the same rules
    // drifting apart silently, with only this one visible to whoever edited the
    // route. Say here only what the skill cannot know: the runtime contract.
    const askBlock =
      `QUESTION FROM THE LEARNER:\n"${question}"\n\n`
      + `ENTRY LENS${lensLine}\n\n`
      + priorBlock
      + `RETRIEVED VERIFIED-BASE CANDIDATES (curator-authored; verified. Use only those that DIRECTLY answer — fit, not presence):\n${candidateBlock}\n\n`;
    const submitBlock =
      `SUBMIT: call submit_answer exactly once — the draft (guiding first-person plural; it will be voiced afterwards), the branch (verified-base / live / banked), the lead lens, and every source you actually used as its own object in the sources array, never as text and never inside relevanceNote.\n\n`
      + `CITING IS CHEAP — only two fields are required per source, so there is no reason to skip one:\n`
      + `  • a verified-base entry or context: {"kind":"entry"|"context","id":"<the id in brackets above>","name":"<its title>","verified":true}\n`
      + `  • a web page: {"kind":"web","url":"<the full https:// url>","name":"<page title>","verified":false}\n`
      + `Omit author/date unless you actually know them. An answered draft with an empty sources array is rejected — if you leaned on a retrieved entry, cite the entry; drafting from one without citing it is the same failure as drafting from memory.\n\n`
      + `Leave relevanceNote empty unless this context is likely not relevant to what the learner is exploring.`;

    const researchUser =
      askBlock
      + `PRIORITISED DOMAINS for web search (prioritise, do not restrict to): ${domains.join(', ') || 'academic and official / university sites'}\n\n`
      + `Follow your P.A.S.T., Research, and Grounding skills. Screen first (is this a question? is it about context?).\n\n`
      + `SEARCH BUDGET: web_search is capped. Issue the queries you need together in the SAME turn (several tool calls at once) so they run in parallel and you read all the results before deciding whether another round is warranted. Running out of searches is NOT a research failure: if the tool reports you have hit its usage limit, stop searching and answer from the results already in front of you. Never bank because a tool limit stopped you, and never mention a tool limit to the learner.\n\n`
      + submitBlock;

    // 2. Research + draft. Which backend runs is an app-wide setting an admin
    //    flips once (app-settings-store) — it is read here, per request, so a flip
    //    applies to every explorer on every device without anyone reloading.
    //    Perplexity failing for any reason (no key, timeout, bad endpoint) falls
    //    through to the Claude path rather than costing the learner their answer.
    const setting = await getResearchBackend();
    const tResearch = Date.now();
    let research = null as Awaited<ReturnType<typeof researchDraft>>;
    let backend: ResearchBackend = 'claude';
    // What the search read, when its draft is the one we ship. Only set on the
    // path we actually use, so a Perplexity search that failed and handed over to
    // Claude never attributes its results to an answer Claude wrote.
    let usedFindings: PerplexityFindings | null = null;

    /** Search with Perplexity and draft from it. `research` is null if either half
     *  fails; `findings` comes back either way so the caller can see what it got. */
    const viaPerplexity = async (signal: AbortSignal): Promise<{
      research: Awaited<ReturnType<typeof synthesiseResearch>>;
      findings: PerplexityFindings | null;
    }> => {
      const findings = await perplexitySearch({ question, domains: preferredDomains, signal });
      // Findings with no citations are worse than no findings: the drafting pass
      // has an answer in front of it and nothing to attribute it to.
      if (findings && !findings.sources.length) {
        console.warn('[detective] perplexity returned an answer with no citations — treating as a failed search');
      }
      if (!findings?.sources.length) return { research: null, findings };
      const synthUser =
        askBlock
        + `${findingsBlock(findings)}\n\n`
        + `Follow your P.A.S.T., Research, and Grounding skills. Screen first (is this a question? is it about context?).\n\n`
        + `The search above is raw material, not your answer: judge it, keep what the sources actually support, and write the draft yourself. The synthesis is not a source — cite the URLs. If the material is thin, say plainly what it does not establish and answer as far as it goes; a partial answer is expected and welcome.\n\n`
        + submitBlock;
      const drafted = await synthesiseResearch(researchSystem(), synthUser, findings.sources.map((s) => s.url), signal);
      return { research: drafted, findings };
    };

    // Both paths run at once, and the mode decides which answer we'd rather have.
    //
    // Serially, a fallback only helps after the primary has burned its whole
    // budget — the learner pays the failure *and then* the recovery. Run together,
    // the alternative is finished (or nearly) by the moment the primary gives up,
    // so a handover costs almost nothing. It does mean paying for both on every
    // ask; that is the trade, taken deliberately.
    // Mode 2 is the original flow, kept intact: Claude alone, no Perplexity
    // launched, nothing to race. The other two modes run both and differ only in
    // which answer they'd rather have.
    const claudeOnly = setting === 'claude';
    const claudeCtl = new AbortController();
    const pplxCtl = new AbortController();
    // Launched here and neither awaited yet, so each must swallow its own failure
    // — an unawaited rejection takes the process down rather than politely losing.
    const claudeRun = researchDraft(researchSystem(), researchUser, claudeCtl.signal)
      .catch((err) => {
        if (!claudeCtl.signal.aborted) console.warn(`[detective] claude research failed: ${err instanceof Error ? err.message : err}`);
        return null;
      });
    const pplxRun = claudeOnly
      ? Promise.resolve({ research: null, findings: null as PerplexityFindings | null })
      : viaPerplexity(pplxCtl.signal)
        .catch((err) => {
          if (!pplxCtl.signal.aborted) console.warn(`[detective] perplexity research failed: ${err instanceof Error ? err.message : err}`);
          return { research: null, findings: null as PerplexityFindings | null };
        });

    const preferPerplexity = setting === 'perplexity';
    const primary = preferPerplexity ? pplxRun.then((r) => r.research) : claudeRun;
    const secondary = preferPerplexity ? claudeRun : pplxRun.then((r) => r.research);
    const primaryName: ResearchBackend = preferPerplexity ? 'perplexity' : 'claude';
    const secondaryName: ResearchBackend = preferPerplexity ? 'claude' : 'perplexity';
    type Draft = Awaited<typeof claudeRun>;
    const usable = (r: Draft) => !!r && r.status !== 'banked';
    const after = <T,>(ms: number, value: T) => new Promise<T>((r) => { setTimeout(() => r(value), ms); });
    const LATE = { late: true } as const;

    const raced = await Promise.race([primary, after(PREFER_PRIMARY_MS, LATE)]);
    const first: Draft = raced === LATE ? null : raced as Draft;
    if (raced === LATE) {
      console.warn(`[detective] ${primaryName} research passed ${PREFER_PRIMARY_MS}ms — taking whatever ${secondaryName} has`);
    }

    if (usable(first)) {
      research = first; backend = primaryName;
    } else {
      // The preferred path missed, or is still going. The other has been running
      // the whole time, so this is usually already resolved.
      const remaining = Math.max(0, RESEARCH_CEILING_MS - (Date.now() - tResearch));
      const second = await Promise.race([secondary, after(remaining, null)]);
      if (usable(second)) {
        research = second; backend = secondaryName;
        console.log(`[detective] answered by ${secondaryName} — the ${primaryName} path did not`);
      } else {
        // Neither answered. Keep a banked draft over nothing at all, so the learner
        // gets the friendly saved state rather than a request that died holding it.
        research = first ?? second ?? null;
        backend = first ? primaryName : secondaryName;
      }
    }
    if (backend === 'perplexity') usedFindings = (await pplxRun).findings;
    // Whoever lost stops working — no sense paying for an answer nobody will read.
    (backend === 'perplexity' ? claudeCtl : pplxCtl).abort();
    timings.research = Date.now() - tResearch;
    if (!research || research.status === 'banked') {
      // Banking is meant to be rare (see the Research skill §4a). When it happens,
      // log the model's own account of why — otherwise an unnecessary bank is
      // indistinguishable from a genuine one and we cannot tell which we have.
      const why = !research ? 'no submit_answer returned' : (research.draft || '').trim().slice(0, 300) || '(no reason given)';
      console.log(
        `[detective] "${question.slice(0, 70)}" → banked · backend=${backend} retrieve=${timings.retrieve}ms research=${timings.research}ms total=${Date.now() - t0}ms`
        + `\n[detective]   bank reason: ${why}`,
      );
      return NextResponse.json(banked(question, tourId, actId, '', originalQuestion, {
        researchBackend: backend, researchMs: timings.research,
      }));
    }

    // Guard: a model glitch sometimes dumps source markup into relevanceNote —
    // drop anything that looks like markup, JSON, or a URL.
    const relevanceNote = research.relevanceNote && !/[<{]|https?:\/\//.test(research.relevanceNote)
      ? research.relevanceNote.trim()
      : '';
    research.relevanceNote = relevanceNote;

    const entryLens: PastLens = requestLens || research.leadLens;
    // Resolve a link for every citation. A source the learner can't tap is not a
    // citation, it's a claim with a title attached — and there were three ways to
    // end up with one: a verified-base citation carries an entry/context id rather
    // than a URL, the model sometimes puts the link in `name` and leaves `url`
    // empty, and a bare domain isn't a href. Fix all three here, once, rather than
    // in each of the two places sources are rendered.
    const sources: DetectiveSource[] = (research.sources || []).map((s: ResearchSource) => {
      const fromBase = s.id ? ranked.find((c) => c.id === s.id)?.domains.find(Boolean) : undefined;
      const url = linkOf(s.url) || linkOf(s.name) || linkOf(fromBase);
      return {
        kind: s.kind, id: s.id || undefined, url, name: s.name || undefined,
        author: s.author || undefined, date: s.date || undefined, verified: s.verified,
      };
    });
    // Last resort. Both paths push back on an uncited answer and both still ship
    // one sometimes — measured, 6 of the last 10 logged answers had an empty
    // sources array, on every branch and both backends. An answer with no
    // provenance is the one thing this product cannot show a learner, so when the
    // model won't name what it used, attribute the material it was actually given:
    // the retrieved entries for a verified-base draft, the search results for a
    // live one. That is a statement about what was in front of it rather than a
    // citation it made, so it is logged loudly — `verified` still describes the
    // material (a curator entry is verified whoever names it), not our confidence
    // that the draft leaned on it. Watch the warning count: this firing often
    // means the drafts are unattributed, not that the floor is working.
    if (research.status === 'answered' && sources.length === 0 && ranked.length) {
      const fallback: DetectiveSource[] = ranked.slice(0, 2).map((c) => ({
        kind: c.kind, id: c.id, url: linkOf(c.domains.find(Boolean)), name: c.title, verified: true,
      }));
      console.warn(`[detective]   ⚠ answered with no citations — attributing to the ${fallback.length} retrieved entr(ies) it was given`);
      sources.push(...fallback);
    }

    // Everything the search read, whether or not the draft named it. We know
    // exactly what was consulted, so there is no good reason to show the learner
    // nothing when the model declines to cite — and no reason to hide the other
    // seventeen results either. Cited ones stay at the top; these render collapsed
    // underneath, so the context page isn't buried in links.
    if (usedFindings?.sources.length) {
      const already = new Set(sources.map((s) => s.url).filter(Boolean));
      const consulted = usedFindings.sources
        .filter((s) => !already.has(linkOf(s.url) ?? s.url))
        .map((s): DetectiveSource => ({
          kind: 'web', url: linkOf(s.url), name: s.title || s.url,
          date: s.date, verified: false, consulted: true,
        }))
        .filter((s) => s.url);
      if (consulted.length) {
        console.log(`[detective]   + ${consulted.length} consulted source(s) attached (collapsed for the learner)`);
        sources.push(...consulted);
      }
    }

    const unlinked = sources.filter((s) => !s.url).length;
    if (unlinked) {
      console.warn(`[detective]   ⚠ ${unlinked}/${sources.length} source(s) have no link — they will render as plain titles`);
    }

    // The model self-reports `branch`, and it gets it wrong: it has labelled answers
    // `verified-base` while citing web sources it had just searched. The branch drives
    // the unverified marks and the candidate-capture path, so trust the sources, not
    // the label — any web source means this was a live answer.
    if (sources.some((s) => s.kind === 'web') && research.branch !== 'live') {
      console.log(`[detective]   branch corrected: ${research.branch} → live (web sources cited)`);
      research.branch = 'live';
    }
    // An answer with no sources at all violates the Research skill (§5: every claim must
    // trace to a returned identifier). It means the model drafted from memory or stretched
    // a retrieved entry without citing it. Surface it loudly rather than shipping it silently.
    if (sources.length === 0) {
      console.warn(`[detective]   ⚠ answered with ZERO sources — "${question.slice(0, 70)}" (branch=${research.branch})`);
    }

    if (research.status === 'declined') {
      const declined: DetectiveAnswer = { status: 'declined', narrative: research.draft, handout: null, branch: research.branch, sources, relevanceNote: research.relevanceNote || undefined };
      void logResponse({
        ...declined, question, originalQuestion, tourId, actId,
        retrievedIds: ranked.map((c) => c.id),
        researchBackend: backend, researchMs: timings.research,
      });
      return NextResponse.json(declined);
    }

    // 3. Voice rewrite — and, with it, the card's title and summary. Voice owns
    //    the finished prose, so the two compressions that inherit its rules are
    //    written here rather than by a separate pass that would have to re-read
    //    (and retype) the whole answer to produce them.
    const voiceUser =
      `Rewrite the following draft for the spoken Context Detective voice, following your Narrative Voice skill exactly. Do not add, remove, or change any fact, source, or claim — only the prose. British spelling, no em dashes, written to be heard. You are granted NO rationed devices this turn: no closing question, no painted scene, no exclamation.\n\n`
      + `Return three fields:\n`
      + `- narrative: the rewritten answer, and nothing else. This is read aloud and shown to the learner verbatim.\n`
      + `- title: a short plain phrase naming the CONTEXT ITSELF — the conditions, not the site and not the question. "The Gilded Age economy", not "How Stanford got rich". A few words; no rhetoric, no cleverness, no punctuation tricks. A learner scanning their journal months later should know from the title alone what conditions this holds.\n`
      + `- summary: one to three sentences distilling the conditions. It must stand alone — someone reading only the summary should come away with the core claim, its time, and its place. Name the span the effect ran (rarely a single year) and the region it held over. Your voice rules apply here in miniature: no banned patterns, no rhetoric, claims only at the confidence the sources support.\n\n`
      + `Both title and summary must be drawn from the draft — compress it, never add to it.\n\n`
      + `DRAFT:\n${research.draft}\n\nLENS: ${entryLens}`;
    const tVoice = Date.now();
    const voiced = await voiceRewrite(voiceSystem(), voiceUser);
    timings.voice = Date.now() - tVoice;

    // Voice failing (or returning unusable JSON) must not lose the answer: fall
    // back to the plain research draft, titled with the learner's own question.
    const narrative = voiced?.narrative?.trim() || research.draft;
    const title = voiced?.title?.trim() || question;
    const summary = voiced?.summary?.trim() || '';

    console.log(
      `[detective] "${question.slice(0, 70)}" → ${research.status}/${research.branch} · backend=${backend} · `
      + `retrieve=${timings.retrieve}ms research=${timings.research}ms voice=${timings.voice}ms · total=${Date.now() - t0}ms`,
    );

    // Illustrate the reveal with a photo. Prefer a curated one: the first cited
    // authored context that carries a photo. Only when there's none do we fall back
    // to a best-effort Wikimedia Commons search on the answer's title — attached
    // solely when a raster result comes back, and never allowed to block or fail
    // the answer (searchCommonsImages swallows errors and honours the timeout).
    const photoSource = sources.find((s) => s.kind === 'context' && s.id && contextPhotos[s.id]);
    let cardPhoto = photoSource?.id ? contextPhotos[photoSource.id] : undefined;
    if (!cardPhoto) {
      // Two queries, not one. The title names the *conditions* ("Gilded Age
      // philanthropic values") and Commons has no photograph of an abstraction, so
      // a good title reliably found nothing. The learner's own question names a
      // place or a person, which Commons does have — so fall back to it.
      for (const q of [title, question].filter((v, i, a) => v?.trim() && a.indexOf(v) === i)) {
        const imgs = await searchCommonsImages(q, { thumbWidth: 800, limit: 12, timeoutMs: 4000 });
        const hit = imgs.find((r) => isPhotoExt(r.ext) && r.thumbUrl);
        console.log(`[detective]   illustrate: ${hit ? `commons "${hit.title.slice(0, 40)}"` : 'no photo'} (query "${q.slice(0, 40)}")`);
        if (hit) { cardPhoto = { url: hit.thumbUrl, credit: hit.credit }; break; }
      }
    }

    // One card, built by the route. The explanation IS the voiced narrative —
    // there is nothing to extract, so nothing re-types it.
    const handout: DetectiveHandout = {
      framingQuestion: question,   // stamped by the route
      entryLens,                   // stamped by the route
      cards: [{
        lens: entryLens,
        title,
        summary,
        explanation: narrative,
        sources,
        ...(cardPhoto ? { imageUrl: cardPhoto.url, ...(cardPhoto.credit ? { imageCredit: cardPhoto.credit } : {}) } : {}),
      }],
      relevanceNote: relevanceNote || undefined,
    };

    const answer: DetectiveAnswer = {
      status: 'answered', narrative, handout, branch: research.branch, sources,
      relevanceNote: handout.relevanceNote,
    };
    void logResponse({
      ...answer, question, originalQuestion, tourId, actId,
      retrievedIds: ranked.map((c) => c.id),
      researchBackend: backend, researchMs: timings.research,
    });
    // Grow the verified base over time: capture web-sourced answers as candidates.
    if (research.branch === 'live') {
      void captureCandidate({ tourId, question, lens: entryLens, card: handout.cards[0], narrative, sources });
    }
    return NextResponse.json(answer);
  } catch (err) {
    console.error('[context-answer] pipeline error:', err);
    return NextResponse.json(banked(question, tourId, actId, '', originalQuestion));
  }
}
