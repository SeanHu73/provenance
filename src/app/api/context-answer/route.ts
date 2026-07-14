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
  Tour, KnowledgeEntry, PastLens,
  DetectiveAnswer, DetectiveHandout, DetectiveSource, DetectiveLog,
} from '@/lib/types';
import { researchSystem, voiceSystem } from '@/lib/context-detective/prompts';
import { researchDraft, voiceRewrite, ResearchSource } from '@/lib/context-detective/claude';
import { embedTexts, cosine } from '@/lib/context-detective/embed';
import { embeddingKey, getCachedEmbeddings, putCachedEmbedding } from '@/lib/context-detective/embed-cache';
import { hashText } from '@/lib/tts-text';

// The three-pass pipeline + web search can run a couple of minutes; allow it on
// Vercel (Pro caps at 300s). The learner sees the "researching…" screen meanwhile.
export const maxDuration = 300;

const LOG_COLLECTION = 'memorial-church-detective-responses';
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

function banked(question: string, tourId: string, actId: string | undefined, narrative = '', originalQuestion?: string): DetectiveAnswer {
  void logResponse({ question, originalQuestion, tourId, actId, status: 'banked', narrative, handout: null, branch: 'banked', sources: [], retrievedIds: [] });
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
    const [embedding] = await embedTexts([embedText]);
    const id = newId();
    const now = new Date().toISOString();
    const entry: Omit<KnowledgeEntry, 'id'> = {
      title, shortSummary, longExplanation, sourceLinks, lens,
      embedding, embeddingModel: 'text-embedding-3-small', embeddingHash: hashText(embedText),
      status: 'candidate', sourceQuestion: question.trim(),
      createdAt: now, updatedAt: now,
    };
    await setDoc(doc(col, id), JSON.parse(JSON.stringify(entry)));
  } catch (err) {
    console.error('[context-answer] candidate capture failed:', err);
  }
}

async function loadCandidates(tourId: string): Promise<{ candidates: Candidate[]; preferredDomains: string[] }> {
  const out: Candidate[] = [];
  let preferredDomains: string[] = [];
  // Knowledge entries (already embedded)
  try {
    const snap = await getDocs(collection(db, 'memorial-church-tours', tourId, 'knowledge-entries'));
    snap.forEach((d) => {
      const e = { id: d.id, ...d.data() } as KnowledgeEntry;
      // Candidates (auto-captured from learner answers) stay out of retrieval
      // until an admin promotes them to the verified base.
      if (e.status === 'candidate') return;
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
        }
      }
    }
  } catch (err) {
    console.error('[context-answer] load contexts failed:', err);
  }
  return { candidates: out, preferredDomains };
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
    const { candidates, preferredDomains } = await loadCandidates(tourId);
    const contexts = candidates.filter((c) => c.kind === 'context');
    const ctxTexts = contexts.map(candidateText);
    const ctxHashes = ctxTexts.map(embeddingKey);
    const cached = await getCachedEmbeddings(ctxHashes);
    const missIdx = contexts.map((_, i) => i).filter((i) => !cached.has(ctxHashes[i]));
    const [qVec, ...missVecs] = await embedTexts([question, ...missIdx.map((i) => ctxTexts[i])]);
    contexts.forEach((c, i) => { c.embedding = cached.get(ctxHashes[i]); });
    missIdx.forEach((ctxI, k) => {
      contexts[ctxI].embedding = missVecs[k];
      void putCachedEmbedding(ctxHashes[ctxI], missVecs[k]); // fill the cache for next time
    });
    timings.retrieve = Date.now() - tRetrieve;

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

    const researchUser =
      `QUESTION FROM THE LEARNER:\n"${question}"\n\n`
      + `ENTRY LENS${lensLine}\n\n`
      + priorBlock
      + `RETRIEVED VERIFIED-BASE CANDIDATES (curator-authored; verified. Use only those that DIRECTLY answer — fit, not presence):\n${candidateBlock}\n\n`
      + `PRIORITISED DOMAINS for web search (prioritise, do not restrict to): ${domains.join(', ') || 'academic and official / university sites'}\n\n`
      + `Follow your P.A.S.T., Research, and Grounding skills. Screen first (is this a question? is it about context?). If the verified base directly answers, use it (branch verified-base). If not, supplement with web search — first decide the specific entities, dates, or sub-questions you actually need and run targeted queries for those rather than one broad search, and issue those queries together in the SAME turn (several tool calls at once) rather than one after another, so they run in parallel and you read all the results before deciding whether you genuinely need another round; prioritise the domains above and academic / official / university sources, and mark every web source unverified (branch live). Well-established, verifiable facts (who someone was, their religion or role, key dates and events) may be answered from any reputable source — encyclopedic, news, official, or university, not only academic — as long as you cite it and mark it unverified; do not bank a question just because the best source is a general reference. BANKING IS A LAST RESORT, NOT A SAFE DEFAULT, and banking unnecessarily is the most common way this pipeline fails the learner. Follow your Research skill §4a: if you can establish the CONDITIONS the learner is reaching for — the period, the place, the technology, the society they are asking about — then ANSWER, even when you cannot pin down one specific the question happened to name. Give what the record shows, say plainly what it does not show, and stop. A partial answer that admits its own edges is far more useful than a bank, and a question is almost never all-or-nothing. Only bank (status + branch banked) when you have found essentially nothing usable about those conditions — which should be rare. If you do reach that point, reach it PROMPTLY: bank rather than spending further searches, since a fast "we could not find this" beats a slow one. YOUR SEARCH BUDGET IS FINITE, AND RUNNING OUT OF IT IS NOT A RESEARCH FAILURE: if the web_search tool reports that you have hit its usage limit, that is a signal to STOP SEARCHING AND ANSWER FROM THE RESULTS ALREADY IN FRONT OF YOU — never bank because a tool limit stopped you, and never describe a tool limit to the learner. Do not re-issue a query you have already run; you already have its results. KNOWING SOMETHING YOURSELF IS NOT A SOURCE. You will often already know the answer — when the first cars were built, who someone was — and the temptation is to write it from memory and leave sources empty because you did not feel you "used" the search results. That is the single most common way you fail here, and an uncited answer is rejected. If you searched, you have results: attribute the claims you made to the results that establish them. Every factual claim in the draft must point at something in sources. Then call submit_answer exactly once: the draft (guiding first-person plural, it will be voiced afterwards), the branch, the lead lens, and every source you actually used as its own object in the sources array (entry/context id for verified, url for web) — never as text and never inside relevanceNote. Leave unused source sub-fields as empty strings, and relevanceNote empty unless this context is likely not relevant to what the learner is exploring.`;

    const tResearch = Date.now();
    const research = await researchDraft(researchSystem(), researchUser);
    timings.research = Date.now() - tResearch;
    if (!research || research.status === 'banked') {
      // Banking is meant to be rare (see the Research skill §4a). When it happens,
      // log the model's own account of why — otherwise an unnecessary bank is
      // indistinguishable from a genuine one and we cannot tell which we have.
      const why = !research ? 'no submit_answer returned' : (research.draft || '').trim().slice(0, 300) || '(no reason given)';
      console.log(
        `[detective] "${question.slice(0, 70)}" → banked · retrieve=${timings.retrieve}ms research=${timings.research}ms total=${Date.now() - t0}ms`
        + `\n[detective]   bank reason: ${why}`,
      );
      return NextResponse.json(banked(question, tourId, actId, '', originalQuestion));
    }

    // Guard: a model glitch sometimes dumps source markup into relevanceNote —
    // drop anything that looks like markup, JSON, or a URL.
    const relevanceNote = research.relevanceNote && !/[<{]|https?:\/\//.test(research.relevanceNote)
      ? research.relevanceNote.trim()
      : '';
    research.relevanceNote = relevanceNote;

    const entryLens: PastLens = requestLens || research.leadLens;
    const sources: DetectiveSource[] = (research.sources || []).map((s: ResearchSource) => ({
      kind: s.kind, id: s.id || undefined, url: s.url || undefined, name: s.name || undefined,
      author: s.author || undefined, date: s.date || undefined, verified: s.verified,
    }));

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
      void logResponse({ ...declined, question, originalQuestion, tourId, actId, retrievedIds: ranked.map((c) => c.id) });
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
      `[detective] "${question.slice(0, 70)}" → ${research.status}/${research.branch} · `
      + `retrieve=${timings.retrieve}ms research=${timings.research}ms voice=${timings.voice}ms · total=${Date.now() - t0}ms`,
    );

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
      }],
      relevanceNote: relevanceNote || undefined,
    };

    const answer: DetectiveAnswer = {
      status: 'answered', narrative, handout, branch: research.branch, sources,
      relevanceNote: handout.relevanceNote,
    };
    void logResponse({ ...answer, question, originalQuestion, tourId, actId, retrievedIds: ranked.map((c) => c.id) });
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
