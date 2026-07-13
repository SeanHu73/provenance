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

async function callClaude(body: Json): Promise<Json> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set.');
  const res = await fetch(ANTHROPIC, {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': VERSION, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status}: ${detail.slice(0, 400)}`);
  }
  return res.json();
}

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
  required: ['kind', 'id', 'url', 'name', 'author', 'date', 'verified'],
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

export async function researchDraft(system: string, userText: string): Promise<ResearchOutput | null> {
  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 3 },
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
  for (let i = 0; i < 8; i++) {
    const iterStart = Date.now();
    const resp = await callClaude({
      model: SONNET,
      max_tokens: 8000,
      system: cachedSystem(system),
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      tools,
      messages,
    });
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
    const iterMs = Date.now() - iterStart;
    console.log(
      `[detective] research call ${i + 1} · ${iterMs}ms · stop=${resp.stop_reason}`
      + (queries.length ? ` · searched: ${queries.map((q) => `"${q}"`).join(', ')}` : '')
      + (resultUrls.length ? ` → ${resultUrls.length} hits (${resultUrls.slice(0, 6).join(' | ')})` : ''),
    );

    const submit = content.find((b: Json) => b.type === 'tool_use' && b.name === 'submit_answer');
    if (submit) {
      console.log(`[detective] research done · ${Date.now() - started}ms total · ${i + 1} model calls · ${totalSearches} web searches`);
      return submit.input as ResearchOutput;
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
export async function voiceRewrite(system: string, userText: string): Promise<VoiceOutput | null> {
  const resp = await callClaude({
    model: OPUS,
    max_tokens: 3000,
    system: cachedSystem(system),
    output_config: { format: { type: 'json_schema', schema: VOICE_SCHEMA } },
    messages: [{ role: 'user', content: userText }],
  });
  const text = ((resp.content || []) as Json[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  try {
    return JSON.parse(text) as VoiceOutput;
  } catch (err) {
    console.error('[detective] voice JSON failed:', err, text.slice(0, 200));
    return null;
  }
}

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

