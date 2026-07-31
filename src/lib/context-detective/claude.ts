/**
 * The Context Detective's Claude passes (raw fetch, matching the codebase's
 * provider convention). Research+draft runs Sonnet 5 with web search and returns
 * a structured answer via a `submit_answer` tool (near-Opus quality on this task
 * but meaningfully faster, so answers land well under the serverless time limit);
 * voice runs Opus 4.8 and returns the narrative plus its title and summary.
 *
 * Two passes, not three. A third (Haiku) pass used to re-read the finished
 * narrative to produce the handout — but it spent most of its ~40s retyping the
 * answer verbatim into the card's `explanation`, and its extra capabilities
 * (splitting into several cards, per-source `checkThis` marks) were never read by
 * the app, which only ever renders cards[0]. Voice now returns the title and
 * summary directly (they inherit its rules anyway) and the route uses the
 * narrative as the explanation.
 */

import { PastLens } from '../types';

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const OPUS = 'claude-opus-4-8';
const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Statuses worth trying again: rate limit, overload, and the 5xx family. */
const RETRYABLE = new Set([408, 429, 500, 502, 503, 504, 529]);
const MAX_ATTEMPTS = 3;

/**
 * One Claude call, with backoff on the transient failures.
 *
 * This used to throw on any non-2xx, and the route turns a throw into a banked
 * answer — so a single `529 Overloaded`, which says nothing about the question,
 * cost a learner their answer entirely. Caught in testing when a run banked after
 * two minutes with twenty perfectly good sources already in hand. Some fraction
 * of the banks in the logs are almost certainly this rather than the model
 * declining, since the two are indistinguishable once it reaches the UI.
 *
 * Honours `retry-after` when the API sends one; otherwise 1s, 2s with jitter.
 * Three attempts is the ceiling — the research pass can make several calls of its
 * own, and the route has a 300s budget to stay inside.
 */
async function callClaude(body: Json, signal?: AbortSignal): Promise<Json> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set.');
  let lastErr = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) throw new Error('aborted');
    let res: Response;
    try {
      res = await fetch(ANTHROPIC, {
        method: 'POST',
        signal,
        headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Losing the race aborts the fetch, which lands here looking like a network
      // failure. Don't retry it — the caller has already stopped caring, and
      // backing off first would sleep a second before noticing.
      if (signal?.aborted) throw new Error('aborted');
      // A genuine connection-level failure — no response at all. Worth another go.
      lastErr = `network: ${err instanceof Error ? err.message : String(err)}`;
      if (attempt === MAX_ATTEMPTS) break;
      console.warn(`[detective]   claude ${lastErr} — retrying (${attempt + 1}/${MAX_ATTEMPTS})`);
      await sleep(backoffMs(attempt));
      continue;
    }
    if (res.ok) return res.json();

    const detail = await res.text().catch(() => '');
    lastErr = `Claude ${res.status}: ${detail.slice(0, 400)}`;
    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) break;
    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
    console.warn(`[detective]   claude ${res.status} — retrying in ${wait}ms (${attempt + 1}/${MAX_ATTEMPTS})`);
    await sleep(wait);
  }
  throw new Error(lastErr || 'Claude request failed');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** 1s, 2s, with jitter so parallel asks don't retry in lockstep. */
const backoffMs = (attempt: number) => 2 ** (attempt - 1) * 1000 + Math.floor(Math.random() * 400);

const cachedSystem = (text: string) => [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];

// ── Research + draft (Opus 4.8 + web search) ──

export interface ResearchSource {
  kind: 'entry' | 'context' | 'web';
  id: string; url: string; name: string; author: string; date: string; verified: boolean;
}
export interface ResearchOutput {
  status: 'answered' | 'banked' | 'declined';
  branch: 'verified-base' | 'live' | 'banked';
  leadLens: PastLens;
  draft: string;
  relevanceNote: string;
  sources: ResearchSource[];
}

/**
 * Only `kind` and `verified` are required.
 *
 * All seven used to be, with the prompt telling the model to "leave unused source
 * sub-fields as empty strings" — so citing one URL meant filling seven fields,
 * five of them meaningless. Measured across the logged answers, most drafts came
 * back with an EMPTY sources array rather than pay that: 6 of the last 10, on both
 * research paths, going back before either was touched. A required field the
 * caller doesn't want is friction on every citation, and the cheapest way out of
 * friction is to cite nothing.
 *
 * `additionalProperties: false` still holds, so the shape can't drift.
 */
const SOURCE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    kind: { type: 'string', enum: ['entry', 'context', 'web'] },
    id: { type: 'string' },
    url: { type: 'string' },
    name: { type: 'string' },
    author: { type: 'string' },
    date: { type: 'string' },
    verified: { type: 'boolean' },
  },
  required: ['kind', 'verified'],
};

const RESEARCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['answered', 'banked', 'declined'] },
    branch: { type: 'string', enum: ['verified-base', 'live', 'banked'] },
    leadLens: { type: 'string', enum: ['place', 'attitudes', 'society', 'technology'] },
    draft: { type: 'string' },
    relevanceNote: { type: 'string' },
    sources: { type: 'array', items: SOURCE_SCHEMA },
  },
  required: ['status', 'branch', 'leadLens', 'draft', 'relevanceNote', 'sources'],
};

export async function researchDraft(system: string, userText: string, signal?: AbortSignal): Promise<ResearchOutput | null> {
  const tools = [
    // max_uses was 3, and the model kept walking into it — partly by re-issuing queries
    // it had already run. Hitting the cap produced an error it read as "research failed",
    // so it banked while holding 25+ good hits it had already been given. The cap exists
    // to bound latency, not to end the research: 8 leaves headroom for a couple of wasted
    // queries, and the prompt now tells it the cap is never a reason to bank.
    //
    // Deliberately the _20250305 tool, not _20260209. The newer one "filters" results by
    // writing Python and running it in a container — and that container is where this
    // pipeline's latency went. Measured on Sonnet 5, same question, n=5 each:
    //   _20250305  16.7 17.9 17.4 18.0 19.1s   mean 17.8s
    //   _20260209  32.8 34.1 42.7 124.1 131.1s mean 72.9s
    // 4x on the mean, 7x at the tail, and the 124-131s runs are the same outlier class as
    // the 236s run in the logs. It cost more input tokens too (53k vs 37k) — the code it
    // writes and the container round-trips outweigh what the filtering saves. Do not
    // "upgrade" this back without re-timing it.
    { type: 'web_search_20250305', name: 'web_search', max_uses: 8 },
    {
      name: 'submit_answer',
      description:
        'Submit your final structured answer. Call this exactly once, after any web research. '
        + 'Put EVERY source you used as its own object in the `sources` array — never as text. '
        + '`relevanceNote` is a short plain sentence or an empty string; never put sources, JSON, or markup in it.',
      // Strict schema adherence — the model can't drop required fields (it was
      // occasionally omitting `sources`/`branch`, yielding uncited answers).
      strict: true,
      input_schema: RESEARCH_SCHEMA,
    },
  ];
  const messages: Json[] = [{ role: 'user', content: userText }];
  const started = Date.now();
  let totalSearches = 0;
  let repairs = 0; // pushbacks spent forcing a citable answer (see below)
  // One, not two. An uncited answer is now caught downstream — the route attaches
  // what the research consulted — so a second round of arguing with the model
  // buys a marginal citation at the cost of a whole model call, on a stage that
  // is already the slowest thing a learner waits for.
  const MAX_REPAIRS = 1;
  let bankChallenged = false; // a bank made while holding results gets challenged once
  const seenUrls: string[] = []; // every URL the search tool has handed back this run
  // (The container plumbing that used to live here died with _20260209. It existed only
  // because dynamic filtering ran the search inside code execution: any turn resending
  // assistant content with those tool uses had to hand the container back or the API 400'd
  // — "container_id is required when there are pending tool uses generated by code
  // execution with tools" — which killed every pushback below. _20250305 has no container,
  // so the whole failure mode is gone. Restore this if you ever restore _20260209.)
  for (let i = 0; i < 8; i++) {
    const iterStart = Date.now();
    if (signal?.aborted) return null;
    const resp = await callClaude({
      model: SONNET,
      max_tokens: 8000,
      system: cachedSystem(system),
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      tools,
      messages,
    }, signal);
    const content: Json[] = resp.content || [];

    // Visibility: what did this turn search, and how long did it take? Web search
    // is the pipeline's main latency, so log every query + how many results came
    // back. server_tool_use carries the query; web_search_tool_result the hits.
    const queries = content
      .filter((b: Json) => b.type === 'server_tool_use' && b.name === 'web_search')
      .map((b: Json) => b.input?.query as string)
      .filter(Boolean);
    const resultUrls = content
      .filter((b: Json) => b.type === 'web_search_tool_result' && Array.isArray(b.content))
      .flatMap((b: Json) => (b.content as Json[]).map((r) => r?.url as string).filter(Boolean));
    totalSearches += queries.length;
    for (const u of resultUrls) if (!seenUrls.includes(u)) seenUrls.push(u);
    const iterMs = Date.now() - iterStart;
    console.log(
      `[detective] research call ${i + 1} · ${iterMs}ms · stop=${resp.stop_reason}`
      + (queries.length ? ` · searched: ${queries.map((q) => `"${q}"`).join(', ')}` : '')
      + (resultUrls.length ? ` → ${resultUrls.length} hits (${resultUrls.slice(0, 6).join(' | ')})` : ''),
    );

    const submit = content.find((b: Json) => b.type === 'tool_use' && b.name === 'submit_answer');
    if (submit) {
      const out = submit.input as ResearchOutput;

      // Two failures we must never ship, both of which end in an uncited or absent answer:
      //
      //  1. An *answered* draft citing nothing. The model wrote from memory (it often
      //     genuinely knows the answer) and so did not feel it "used" the 30-odd results
      //     it was just handed. The citation panel is what the learner judges us by —
      //     Research skill §5: every claim traces to a returned identifier.
      //  2. A bank submitted while search results are sitting in context. The searches
      //     came back with 25-40 hits from Wikipedia, the Smithsonian, university archives
      //     — and it banked anyway. That is not an honest miss; it is the unnecessary bank
      //     §4a exists to stop, and it leaves the learner with nothing. Challenge it once,
      //     handing the URLs back. If it banks a second time, we accept: it has now looked
      //     at what it holds and told us the record genuinely has nothing, which is the
      //     honest miss the skill does allow.
      //
      // A banked/declined answer legitimately has no sources, so neither can be a schema
      // rule.
      const uncited = out.status === 'answered' && !(out.sources?.length);
      const hollowBank = out.status === 'banked' && seenUrls.length > 0 && !bankChallenged;
      if ((uncited && repairs < MAX_REPAIRS) || hollowBank) {
        if (hollowBank) bankChallenged = true;
        repairs++;
        console.warn(
          `[detective] research ${uncited ? 'submitted an ANSWER with zero sources' : 'BANKED while holding ' + seenUrls.length + ' search results'}`
          + ` — pushing back (${repairs}/${MAX_REPAIRS})`
          + `\n[detective]   rejected draft: ${(out.draft || '').trim().slice(0, 240).replace(/\s+/g, ' ')}`,
        );
        messages.push({ role: 'assistant', content });
        // Hand the URLs back explicitly, so citing is a copy rather than a recall.
        const urlList = seenUrls.slice(0, 15).map((u) => `  - ${u}`).join('\n');
        const pushback = hollowBank
          ? 'Rejected: you banked this question, but you are holding the results of your own searches, and a '
            + 'moment ago you drafted an answer from them. Banking to avoid attaching citations is not an honest '
            + 'miss — it is the unnecessary bank your Research skill §4a exists to prevent, and it leaves the '
            + 'learner with nothing.\n\nThese results are in your context now:\n' + urlList
            + '\n\nResubmit with status="answered": your draft, and in `sources` the results that support the '
            + 'claims you made (kind "web", the url, verified false). Say plainly in the draft whatever the record '
            + 'does not establish — a partial answer is expected and welcome. Do not bank again.'
          : 'Rejected: you submitted status="answered" with an empty sources array. Every claim must trace to a '
            + 'source (Research skill §5): entry/context ids for verified-base material, URLs for web material. '
            + 'Knowing something yourself is not a source — if you stated it, you must be able to point at where '
            + 'it is established.\n\n'
            + (seenUrls.length
              ? 'Your searches this run returned these results, and they are already in your context:\n' + urlList
                + '\n\nCall submit_answer again with the same draft, listing in `sources` the ones that actually '
                + 'support the claims you made (kind "web", the url, verified false). Do NOT bank: you have the '
                + 'material, and a bank here would be a failure, not an honest miss.'
              : 'You have run no searches. Search now, then submit with the sources you find — or, only if the '
                + 'record genuinely has nothing, resubmit with status="banked".');
        messages.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: submit.id, is_error: true, content: pushback }],
        });
        continue;
      }

      console.log(`[detective] research done · ${Date.now() - started}ms total · ${i + 1} model calls · ${totalSearches} web searches`);
      return out;
    }
    // Web search is a server tool (resolved inline); on pause_turn/tool_use, resend.
    if (resp.stop_reason === 'pause_turn' || resp.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content });
      continue;
    }
    console.log(`[detective] research ended without submitting (stop=${resp.stop_reason}) after ${Date.now() - started}ms`);
    return null; // ended without submitting — treat as a miss
  }
  console.log(`[detective] research hit the 8-call cap after ${Date.now() - started}ms, ${totalSearches} searches — giving up`);
  return null;
}

/**
 * Draft from research someone else did (the Perplexity backend).
 *
 * Same skills, same `submit_answer` schema, same downstream handling as
 * `researchDraft` — the only difference is that the searching already happened,
 * so there is no web_search tool, no multi-round loop, and no repair pushbacks.
 * The two failure modes those pushbacks exist to catch are structurally harder
 * here: the sources arrive as a list in the prompt, so citing is a copy.
 *
 * `tool_choice` forces the submission, which removes the "ended without
 * submitting" miss entirely — the model cannot answer in prose and leave the
 * route with nothing.
 */
export async function synthesiseResearch(
  system: string,
  userText: string,
  /** The URLs the search returned, for the pushback below. */
  availableUrls: string[] = [],
  signal?: AbortSignal,
): Promise<ResearchOutput | null> {
  const tools = [{
    name: 'submit_answer',
    description:
      'Submit your final structured answer. Put EVERY source you used as its own object in the `sources` '
      + 'array — never as text. `relevanceNote` is a short plain sentence or an empty string.',
    strict: true,
    input_schema: RESEARCH_SCHEMA,
  }];
  const messages: Json[] = [{ role: 'user', content: userText }];
  const started = Date.now();

  // Two passes at most: the draft, and one pushback if it comes back uncited.
  // Handing a model the sources as data was supposed to make citing automatic. It
  // did not — measured, it drafted from the retrieved base and cited nothing while
  // holding fourteen URLs. So the Claude path's repair loop earns its keep here
  // too, just shorter: the sources are already in the prompt, so one reminder is
  // either enough or the problem is not forgetfulness.
  for (let i = 0; i < 2; i++) {
    if (signal?.aborted) return null;
    const resp = await callClaude({
      model: SONNET,
      max_tokens: 8000,
      system: cachedSystem(system),
      thinking: { type: 'adaptive' },
      // The searching is done: this pass judges what came back and writes it up.
      // At `medium` it was spending 62s thinking about a task whose hard part had
      // already happened — most of the Perplexity path's latency was here, not in
      // the search.
      output_config: { effort: 'low' },
      tools,
      tool_choice: { type: 'tool', name: 'submit_answer' },
      messages,
    }, signal);
    const content: Json[] = resp.content || [];
    const submit = content.find((b: Json) => b.type === 'tool_use' && b.name === 'submit_answer');
    if (!submit) {
      console.log(`[detective] synthesis ended without submitting (stop=${resp.stop_reason}) after ${Date.now() - started}ms`);
      return null;
    }
    const out = submit.input as ResearchOutput;
    if (out.status !== 'answered' || out.sources?.length || i > 0) {
      console.log(`[detective] synthesis done · ${Date.now() - started}ms · ${i + 1} model call${i ? 's' : ''}`);
      return out;
    }
    console.warn(
      `[detective] synthesis submitted an ANSWER with zero sources — pushing back once`
      + `\n[detective]   rejected draft: ${(out.draft || '').trim().slice(0, 200).replace(/\s+/g, ' ')}`,
    );
    messages.push({ role: 'assistant', content });
    messages.push({
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: submit.id,
        is_error: true,
        content:
          'Rejected: status="answered" with an empty sources array. Every claim must trace to a source '
          + '(Research skill §5), and you are holding them — they are listed in the prompt above.\n\n'
          + (availableUrls.length
            ? `The web results available to you:\n${availableUrls.slice(0, 15).map((u) => `  - ${u}`).join('\n')}\n\n`
            : '')
          + 'Call submit_answer again with the same draft, listing in `sources` the ones that actually support '
          + 'the claims you made (kind "web", the url, verified false) and any verified-base entry or context '
          + 'you leaned on (kind "entry"/"context", its id, verified true). Do NOT bank: you have the material.',
      }],
    });
  }
  return null;
}

// ── Voice rewrite (Opus 4.8) — the narrative plus its title and summary ──

export interface VoiceOutput {
  /** The rewritten spoken answer. Becomes the card's full explanation verbatim. */
  narrative: string;
  title: string;
  summary: string;
}

const VOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    narrative: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string' },
  },
  required: ['narrative', 'title', 'summary'],
};

/**
 * Voice owns the finished prose, so it also writes the two compressions that
 * inherit its rules — the card's title and short summary. Producing them here
 * (a few dozen extra tokens on a call we already make) is what lets the route
 * skip a whole third model pass that used to retype the answer to get them.
 *
 * Voice is a constrained rewrite (no new facts) — no thinking needed, and
 * omitting it on Opus 4.8 shaves real latency off the pipeline.
 */
export async function voiceRewrite(
  system: string,
  userText: string,
  /** Hard word ceiling for the narrative. Over it, we ask once for a cut. */
  maxWords = 0,
): Promise<VoiceOutput | null> {
  const messages: Json[] = [{ role: 'user', content: userText }];

  // Two attempts at most. The length rule lived only in the skill and was missed
  // more often than not — measured, 327 words mean against a stated 300 ceiling.
  // A rule nothing checks is a suggestion, so this checks it: over the ceiling,
  // hand the draft back once with its own word count. Cheap, because it only
  // costs a second call on the answers that were going to be too long anyway.
  for (let i = 0; i < 2; i++) {
    const resp = await callClaude({
      model: OPUS,
      max_tokens: 3000,
      system: cachedSystem(system),
      output_config: { format: { type: 'json_schema', schema: VOICE_SCHEMA } },
      messages,
    });
    const text = ((resp.content || []) as Json[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    let out: VoiceOutput;
    try {
      out = JSON.parse(text) as VoiceOutput;
    } catch (err) {
      console.error('[detective] voice JSON failed:', err, text.slice(0, 200));
      return null;
    }
    const count = wordCount(out.narrative);
    if (!maxWords || count <= maxWords || i > 0) {
      if (maxWords && count > maxWords) {
        console.warn(`[detective]   ⚠ narrative still ${count} words after a cut (ceiling ${maxWords}) — shipping it`);
      } else if (maxWords) {
        console.log(`[detective]   narrative ${count} words (~${Math.round((count / 150) * 60)}s aloud)`);
      }
      return out;
    }
    console.warn(`[detective]   narrative ${count} words, over the ${maxWords} ceiling — asking for a cut`);
    messages.push({ role: 'assistant', content: text });
    messages.push({
      role: 'user',
      content:
        `That rewrite is ${count} words. The ceiling is ${maxWords} and the target is 150–200 — it is read aloud, `
        + `and ${count} words is roughly ${Math.round((count / 150) * 60)} seconds of audio.

`
        + `Cut it to the target. Do not trim evenly: pick the single point this answer is making and drop the claims `
        + `that serve other points, however good they are. Keep every hedge and qualification — losing "the record does `
        + `not establish" to save words makes the answer wrong, not shorter. Return the same three fields.`,
    });
  }
  return null;
}

/** Words, as a listener would count them. */
const wordCount = (t: string) => (t || '').trim().split(/\s+/).filter(Boolean).length;

// ── Framing coach (fast pre-pass, Haiku, structured output) ──

export interface FrameOutput {
  ok: boolean;
  reorientation: string;
  needsReframe: boolean;
  reframeTip: string;
  suggestedQuestions: string[];
}

const FRAME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean' },
    reorientation: { type: 'string' },
    needsReframe: { type: 'boolean' },
    reframeTip: { type: 'string' },
    suggestedQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['ok', 'reorientation', 'needsReframe', 'reframeTip', 'suggestedQuestions'],
};

export async function frameQuestion(system: string, userText: string): Promise<FrameOutput | null> {
  const resp = await callClaude({
    model: HAIKU,
    max_tokens: 900,
    system: cachedSystem(system),
    output_config: { format: { type: 'json_schema', schema: FRAME_SCHEMA } },
    messages: [{ role: 'user', content: userText }],
  });
  const text = ((resp.content || []) as Json[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  try {
    return JSON.parse(text) as FrameOutput;
  } catch (err) {
    console.error('[detective] frame JSON failed:', err, text.slice(0, 200));
    return null;
  }
}

// ── Investigation parsing (Haiku) — split, merge, classify ──

export interface ParsedInvestigationQuestion {
  text: string;
  kind: 'factual' | 'contextual';
  /** The original wordings folded into this one, if it merged duplicates. */
  mergedFrom: string[];
}

const INVESTIGATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          kind: { type: 'string', enum: ['factual', 'contextual'] },
          mergedFrom: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'kind', 'mergedFrom'],
      },
    },
  },
  required: ['questions'],
};

const INVESTIGATION_SYSTEM = `You split a learner's opening questions into a clean list, before a history tour begins.

They have written or dictated several questions at once, often as one run-on stretch of speech with no punctuation. Your job is mechanical and fast. Do not answer anything.

SPLIT: one entry per question they actually asked. Repair dictation lightly — capitalisation, an added question mark, an obvious mis-transcription — but never rewrite what they asked into a better question. Their wording is the record.

MERGE only when a single answer would satisfy both. The test is not whether two questions are about the same thing — it is whether answering one leaves the other answered.

"Who built it" and "who was it built by" are one question: same answer, different words. "Who designed it" and "who built it" are TWO — the architect and the builder are different people, and folding them together loses one of them. "Who built it" and "when was it built" are obviously two.

When you are unsure, keep them separate. A near-duplicate costs a few seconds of research; a wrong merge costs the learner an answer they actually asked for. List every original wording of a merged question in mergedFrom; when nothing merged, mergedFrom is an empty array.

CLASSIFY each entry:
- "factual" — a lookup with a settled answer. Who designed it, when was it finished, how many people, what is it called, is it still used.
- "contextual" — asks why things were as they were, or what made them possible: motives, conditions, attitudes, consequences, comparisons across time. Anything a plain fact would not satisfy.
When a question could be read either way, classify it contextual: a short factual answer to a question that deserved a fuller one is the worse mistake here.

Discard anything that is not a question — stray dictation, filler, a comment about the weather. If they wrote nothing that is a question, return an empty array.`;

/** Split one submission into separate, deduped, classified questions. */
export async function parseInvestigation(raw: string): Promise<ParsedInvestigationQuestion[] | null> {
  try {
    const resp = await callClaude({
      model: HAIKU,
      max_tokens: 2000,
      system: cachedSystem(INVESTIGATION_SYSTEM),
      output_config: { format: { type: 'json_schema', schema: INVESTIGATION_SCHEMA } },
      messages: [{ role: 'user', content: `The learner wrote:

"""
${raw}
"""` }],
    });
    const text = ((resp.content || []) as Json[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const out = JSON.parse(text) as { questions?: ParsedInvestigationQuestion[] };
    return Array.isArray(out.questions) ? out.questions : null;
  } catch (err) {
    console.error('[investigation] parse failed:', err);
    return null;
  }
}

// ── Factual answer (Sonnet + search) — short, plain, sourced ──

export interface FactualOutput {
  answer: string;
  sources: { url: string; name: string }[];
}

const FACTUAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { url: { type: 'string' }, name: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  required: ['answer', 'sources'],
};

const factualSystem = (maxWords: number) => `You answer one factual question about a place, plainly and briefly, for someone standing in front of it.

ANSWER PLAINLY. State the fact and stop. No preamble, no "great question", no restating the question, no explanation of why it matters, no invitation to explore further. If the question is small — "who designed the church" — the answer is one sentence. Never more than ${maxWords} words.

Write to be heard, not read: no markdown, no lists, no parentheses.

SOURCES. Search before answering. Prefer reference works, universities, government and museum pages, and the institution's own site. Never use forums, question-and-answer sites, social media, or personal blogs, no matter how well they rank. Return the pages you actually used.

MORE THAN ONE READING. Some questions have several right answers — "who designed the church" can mean the architect who drew it, or the person whose idea it was and who paid for it. Give both, briefly, rather than picking one and leaving the learner with half of what they asked. Two short sentences, not an essay.

WHEN YOU CANNOT. If searching does not settle it, return an empty answer rather than a hedge or a guess. Something else will handle it. Do not pad, do not speculate, and never present a likely answer as a settled one.

You are not teaching and not contextualising. Another part of this app does that, at length, and it does it better than a short answer can. Your job is the fact.`;

/** One search-and-answer call. Returns null on failure. */
export async function factualAnswer(
  question: string,
  preferredDomains: string[],
  maxWords: number,
): Promise<FactualOutput | null> {
  const domains = preferredDomains.map((d) => d.trim()).filter(Boolean).slice(0, 12);
  const user =
    `QUESTION: "${question}"

`
    + (domains.length ? `Sites worth checking first for this tour: ${domains.join(', ')}

` : '')
    + `Search, then answer in at most ${maxWords} words — one sentence if that is all the question needs. `
    + `Return the answer and the pages you used. If you cannot settle it, return an empty answer.`;
  try {
    const resp = await callClaude({
      model: SONNET,
      max_tokens: 1500,
      system: cachedSystem(factualSystem(maxWords)),
      // Low effort on purpose: this is a lookup. The depth that makes the
      // Detective good is exactly what makes it slow, and none of it is wanted here.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: FACTUAL_SCHEMA } },
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      messages: [{ role: 'user', content: user }],
    });
    const text = ((resp.content || []) as Json[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (!text) return null;
    const out = JSON.parse(text) as FactualOutput;
    return { answer: out.answer || '', sources: Array.isArray(out.sources) ? out.sources : [] };
  } catch (err) {
    console.error('[factual] call failed:', err);
    return null;
  }
}
