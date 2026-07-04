/**
 * The Context Detective's Claude passes (raw fetch, matching the codebase's
 * provider convention). Research+draft runs Opus 4.8 with web search and returns
 * a structured answer via a `submit_answer` tool; voice runs Opus 4.8 (prose
 * only); parse runs Haiku 4.5 with a structured-output schema.
 */

import { PastLens } from '../types';

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';
const OPUS = 'claude-opus-4-8';
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
      input_schema: RESEARCH_SCHEMA,
    },
  ];
  const messages: Json[] = [{ role: 'user', content: userText }];
  for (let i = 0; i < 8; i++) {
    const resp = await callClaude({
      model: OPUS,
      max_tokens: 8000,
      system: cachedSystem(system),
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      tools,
      messages,
    });
    const content: Json[] = resp.content || [];
    const submit = content.find((b: Json) => b.type === 'tool_use' && b.name === 'submit_answer');
    if (submit) return submit.input as ResearchOutput;
    // Web search is a server tool (resolved inline); on pause_turn/tool_use, resend.
    if (resp.stop_reason === 'pause_turn' || resp.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content });
      continue;
    }
    return null; // ended without submitting — treat as a miss
  }
  return null;
}

// ── Voice rewrite (Opus 4.8, prose only) ──

export async function voiceRewrite(system: string, userText: string): Promise<string> {
  const resp = await callClaude({
    model: OPUS,
    max_tokens: 2000,
    system: cachedSystem(system),
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: userText }],
  });
  return ((resp.content || []) as Json[])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

// ── Parse to handout JSON (Haiku 4.5, structured output) ──

export interface ParseCard {
  lens: PastLens;
  title: string;
  summary: string;
  explanation: string;
  sources: (ResearchSource & { checkThis: string[] })[];
}
export interface ParseOutput { cards: ParseCard[]; relevanceNote: string; }

const HANDOUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          lens: { type: 'string', enum: ['place', 'attitudes', 'society', 'technology'] },
          title: { type: 'string' },
          summary: { type: 'string' },
          explanation: { type: 'string' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                kind: { type: 'string', enum: ['entry', 'context', 'web'] },
                id: { type: 'string' }, url: { type: 'string' }, name: { type: 'string' },
                author: { type: 'string' }, date: { type: 'string' }, verified: { type: 'boolean' },
                checkThis: { type: 'array', items: { type: 'string' } },
              },
              required: ['kind', 'id', 'url', 'name', 'author', 'date', 'verified', 'checkThis'],
            },
          },
        },
        required: ['lens', 'title', 'summary', 'explanation', 'sources'],
      },
    },
    relevanceNote: { type: 'string' },
  },
  required: ['cards', 'relevanceNote'],
};

export async function parseHandout(system: string, userText: string): Promise<ParseOutput | null> {
  const resp = await callClaude({
    model: HAIKU,
    max_tokens: 4000,
    system: cachedSystem(system),
    output_config: { format: { type: 'json_schema', schema: HANDOUT_SCHEMA } },
    messages: [{ role: 'user', content: userText }],
  });
  const text = ((resp.content || []) as Json[]).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  try {
    return JSON.parse(text) as ParseOutput;
  } catch (err) {
    console.error('[detective] parse JSON failed:', err, text.slice(0, 200));
    return null;
  }
}
