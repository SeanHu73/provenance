/**
 * Perplexity Sonar — the alternative research stage.
 *
 * This module is *only* the search: one call out, an answer plus its cited
 * sources back. It deliberately does not draft, screen, or pick a lens — those
 * are the Detective's own judgements and stay with Claude (`synthesiseResearch`
 * in claude.ts), which reads what comes back from here and writes the draft
 * against the P.A.S.T., Research, and Grounding skills exactly as before.
 *
 * Why it exists: the Claude path can spend up to eight model calls searching,
 * and its two worst failure modes (an answered draft citing nothing, a bank made
 * while holding good results) both come from asking one model to search *and*
 * police its own citations. Sonar returns citations as structured data, so the
 * drafting pass copies identifiers rather than recalling them.
 *
 * Never throws: every failure returns null and the route falls back to the
 * Claude path. A globally-switched backend must not be able to take the
 * Detective down for everyone.
 *
 * ENDPOINT: Perplexity has moved this more than once, so it is an env var
 * (`PERPLEXITY_API_URL`) with the OpenAI-compatible chat/completions path as the
 * default — that is the shape the search parameters below belong to. Confirm it
 * against the current API reference before trusting the toggle in a live tour;
 * a wrong URL shows up as "perplexity search failed" in the logs and a silent
 * fall back to Claude, not as a broken tour.
 */

const DEFAULT_URL = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar-pro';
/** Sonar's own research depth. `low` is the fast one; the drafting pass adds the
 *  depth we care about, so buying more here mostly buys latency. */
const CONTEXT_SIZE = 'low';
/** Cap it well under the route's 300s budget — a slow search should degrade to
 *  the Claude path, not eat the whole request. */
const TIMEOUT_MS = 30_000;

export interface PerplexitySource {
  title: string;
  url: string;
  date?: string;
  snippet?: string;
}

export interface PerplexityFindings {
  /** Sonar's synthesised answer. Raw material for the draft, never shown as-is. */
  answer: string;
  sources: PerplexitySource[];
  ms: number;
}

/** Whether the key is present. The toggle stays visible without it, but the
 *  route needs to know it will have to fall back. */
export function perplexityConfigured(): boolean {
  return !!process.env.PERPLEXITY_API_KEY;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Pull the citation list out, tolerating both shapes the API has used: the rich
 *  `search_results` objects and the older bare `citations` URL array. */
function readSources(data: Json): PerplexitySource[] {
  const rich = Array.isArray(data?.search_results) ? data.search_results : null;
  if (rich) {
    return rich
      .map((r: Json) => ({
        title: String(r?.title || r?.url || '').slice(0, 200),
        url: String(r?.url || ''),
        date: r?.date ? String(r.date) : undefined,
        snippet: r?.snippet ? String(r.snippet).slice(0, 600) : undefined,
      }))
      .filter((r: PerplexitySource) => r.url);
  }
  const urls = Array.isArray(data?.citations) ? data.citations : [];
  return urls
    .map((u: Json) => ({ title: String(u || ''), url: String(u || '') }))
    .filter((r: PerplexitySource) => r.url);
}

/**
 * Search for a question. `domains` are the tour's preferred sources — note the
 * semantics differ from the Claude path, where they are a priority hint: here
 * `search_domain_filter` *restricts*, so we only pass it when the tour has
 * authored some, and Sonar sees the whole web otherwise.
 */
export async function perplexitySearch(input: {
  question: string;
  domains?: string[];
}): Promise<PerplexityFindings | null> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) {
    console.warn('[detective] PERPLEXITY_API_KEY is not set — falling back to the Claude research path');
    return null;
  }
  const url = process.env.PERPLEXITY_API_URL || DEFAULT_URL;
  const domains = (input.domains || []).map((d) => d.trim()).filter(Boolean).slice(0, 20);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a research assistant for a history tour. Answer the question with the historical '
              + 'conditions that explain it — the period, the place, and what was true at the time — and cite '
              + 'every claim. Say plainly what the record does not establish rather than guessing.',
          },
          { role: 'user', content: input.question },
        ],
        web_search_options: { search_context_size: CONTEXT_SIZE },
        ...(domains.length ? { search_domain_filter: domains } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[detective] perplexity ${res.status}: ${detail.slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const answer = String(data?.choices?.[0]?.message?.content || '').trim();
    const sources = readSources(data);
    const ms = Date.now() - started;
    if (!answer) {
      console.error('[detective] perplexity returned no answer text');
      return null;
    }
    console.log(
      `[detective] perplexity ${MODEL} · ${ms}ms · ${sources.length} sources`
      + (sources.length ? ` (${sources.slice(0, 5).map((s) => s.url).join(' | ')})` : ''),
    );
    return { answer, sources, ms };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    console.error(`[detective] perplexity search ${aborted ? `timed out after ${TIMEOUT_MS}ms` : 'failed'}:`, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The findings, rendered for the drafting pass: the answer as raw material and
 *  the sources as the identifiers it must cite from. */
export function findingsBlock(findings: PerplexityFindings): string {
  const list = findings.sources.length
    ? findings.sources
        .map((s, i) => `[${i + 1}] ${s.title}\n    url: ${s.url}${s.date ? `\n    date: ${s.date}` : ''}${s.snippet ? `\n    ${s.snippet}` : ''}`)
        .join('\n')
    : '(the search returned no sources)';
  return `WEB RESEARCH (a search engine's synthesis — raw material, NOT the answer, and NOT a source in itself):\n${findings.answer}\n\nSOURCES IT CITED (these are the URLs available to you; cite the ones that actually support what you write):\n${list}`;
}
