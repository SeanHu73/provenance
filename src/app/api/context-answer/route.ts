/**
 * POST /api/context-answer — the Context Detective pipeline.
 *
 * embed question → cosine-retrieve over this tour's verified base (knowledge
 * entries + authored Add-Context items) → research + draft (Opus 4.8, web search,
 * domains prioritised-not-enforced) → voice rewrite (Opus 4.8) → parse to a
 * handout (Haiku 4.5, structured JSON) → return the full payload + log it.
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
import { researchSystem, voiceSystem, parseSystem } from '@/lib/context-detective/prompts';
import { researchDraft, voiceRewrite, parseHandout, ResearchSource } from '@/lib/context-detective/claude';
import { embedTexts, cosine } from '@/lib/context-detective/embed';

// The three-pass pipeline + web search can run a couple of minutes; allow it on
// Vercel (Pro caps at 300s). The learner sees the "researching…" screen meanwhile.
export const maxDuration = 300;

const LOG_COLLECTION = 'memorial-church-detective-responses';
const TOP_K = 6;

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

async function loadCandidates(tourId: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  // Knowledge entries (already embedded)
  try {
    const snap = await getDocs(collection(db, 'memorial-church-tours', tourId, 'knowledge-entries'));
    snap.forEach((d) => {
      const e = { id: d.id, ...d.data() } as KnowledgeEntry;
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
  return out;
}

export async function POST(req: Request) {
  let body: { question?: string; originalQuestion?: string; tourId?: string; actId?: string; lens?: PastLens } = {};
  try { body = await req.json(); } catch { /* empty */ }

  const question = (body.question || '').trim();
  // The learner's first-asked question, before any Framing Coach reframe. Defaults
  // to the final question when they kept their wording. Logged for the author.
  const originalQuestion = (body.originalQuestion || body.question || '').trim();
  const tourId = (body.tourId || '').trim();
  const actId = body.actId;
  const requestLens = body.lens;
  if (!question) return NextResponse.json({ error: 'No question provided' }, { status: 400 });
  if (!tourId) return NextResponse.json(banked(question, tourId, actId, '', originalQuestion));

  try {
    // 1. Retrieval — embed question + authored contexts, cosine over everything.
    const candidates = await loadCandidates(tourId);
    const contexts = candidates.filter((c) => c.kind === 'context');
    const [qVec, ...ctxVecs] = await embedTexts([question, ...contexts.map(candidateText)]);
    contexts.forEach((c, i) => { c.embedding = ctxVecs[i]; });

    const ranked = candidates
      .map((c) => ({ ...c, score: cosine(qVec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    // 2. Research + draft.
    const domains = Array.from(new Set(ranked.flatMap((c) => c.domains))).slice(0, 12);
    const candidateBlock = ranked.length
      ? ranked.map((c) => `[${c.kind}:${c.id}] (${c.lens}) ${c.title}\n${c.summary}\n${c.explanation}\nSource links: ${c.domains.join(', ') || '—'}`).join('\n\n')
      : '(the verified base has no entries yet)';
    const lensLine = requestLens ? `: ${requestLens}` : ' — not specified; determine the lead lens yourself.';

    const researchUser =
      `QUESTION FROM THE LEARNER:\n"${question}"\n\n`
      + `ENTRY LENS${lensLine}\n\n`
      + `RETRIEVED VERIFIED-BASE CANDIDATES (curator-authored; verified. Use only those that DIRECTLY answer — fit, not presence):\n${candidateBlock}\n\n`
      + `PRIORITISED DOMAINS for web search (prioritise, do not restrict to): ${domains.join(', ') || 'academic and official / university sites'}\n\n`
      + `Follow your P.A.S.T., Research, and Grounding skills. Screen first (is this a question? is it about context?). If the verified base directly answers, use it (branch verified-base). If not, supplement with web search — first decide the specific entities, dates, or sub-questions you actually need and run targeted queries for those rather than one broad search, prioritising the domains above and academic / official / university sources, and marking every web source unverified (branch live). If nothing solid comes back, bank it (status + branch banked). Then call submit_answer exactly once: the draft (guiding first-person plural, it will be voiced afterwards), the branch, the lead lens, and every source you actually used as its own object in the sources array (entry/context id for verified, url for web) — never as text and never inside relevanceNote. Leave unused source sub-fields as empty strings, and relevanceNote empty unless this context is likely not relevant to what the learner is exploring.`;

    const research = await researchDraft(researchSystem(), researchUser);
    if (!research || research.status === 'banked') {
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

    if (research.status === 'declined') {
      const declined: DetectiveAnswer = { status: 'declined', narrative: research.draft, handout: null, branch: research.branch, sources, relevanceNote: research.relevanceNote || undefined };
      void logResponse({ ...declined, question, originalQuestion, tourId, actId, retrievedIds: ranked.map((c) => c.id) });
      return NextResponse.json(declined);
    }

    // 3. Voice rewrite.
    const voiceUser =
      `Rewrite the following draft for the spoken Context Detective voice, following your Narrative Voice skill exactly. Do not add, remove, or change any fact, source, or claim — only the prose. British spelling, no em dashes, written to be heard. You are granted NO rationed devices this turn: no closing question, no painted scene, no exclamation. Return only the rewritten prose.\n\n`
      + `DRAFT:\n${research.draft}\n\nLENS: ${entryLens}`;
    const narrative = (await voiceRewrite(voiceSystem(), voiceUser)) || research.draft;

    // 4. Parse to handout.
    const parseUser =
      `Turn the spoken answer below into the structured handout, following your Parse skill. Extract — never author new facts.\n\n`
      + `FRAMING QUESTION (stamped — do not change): "${question}"\nENTRY LENS (stamped — do not change): ${entryLens}\n\n`
      + `SOURCE IDENTIFIERS the answer used (verified/unverified marks are authoritative — carry them. Fill name/author/date only where the source states them; otherwise leave blank and add that field name to checkThis. An inferred date is checkThis even when filled):\n${(research.sources || []).map((s) => JSON.stringify(s)).join('\n') || '(none)'}\n\n`
      + `BRANCH: ${research.branch}\n${research.relevanceNote ? `RELEVANCE NOTE (Case 2): ${research.relevanceNote}\n` : ''}\n`
      + `SPOKEN ANSWER:\n${narrative}\n\n`
      + `Return the handout JSON: one or more cards (lens, title, summary, explanation, sources[] with checkThis arrays), and relevanceNote (empty string if none).`;
    const parsed = await parseHandout(parseSystem(), parseUser);

    const handout: DetectiveHandout = {
      framingQuestion: question,   // stamped by the route
      entryLens,                   // stamped by the route
      cards: (parsed?.cards || []).map((c) => ({
        lens: c.lens, title: c.title, summary: c.summary, explanation: c.explanation,
        sources: (c.sources || []).map((s) => ({
          kind: s.kind, id: s.id || undefined, url: s.url || undefined, name: s.name || undefined,
          author: s.author || undefined, date: s.date || undefined, verified: s.verified,
          checkThis: (s.checkThis || []).filter(Boolean),
        })),
      })),
      relevanceNote: (parsed?.relevanceNote && !/[<{]|https?:\/\//.test(parsed.relevanceNote)
        ? parsed.relevanceNote.trim()
        : relevanceNote) || undefined,
    };

    const answer: DetectiveAnswer = {
      status: 'answered', narrative, handout, branch: research.branch, sources,
      relevanceNote: handout.relevanceNote,
    };
    void logResponse({ ...answer, question, originalQuestion, tourId, actId, retrievedIds: ranked.map((c) => c.id) });
    return NextResponse.json(answer);
  } catch (err) {
    console.error('[context-answer] pipeline error:', err);
    return NextResponse.json(banked(question, tourId, actId, '', originalQuestion));
  }
}
