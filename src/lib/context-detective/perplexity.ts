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
 * ENDPOINT: Perplexity currently exposes two OpenAI-shaped surfaces, and which
 * one an account sees has moved more than once, so both the URL and the model are
 * env vars:
 *
 *   • the gateway / router — `/router/v1/chat/completions`, multi-provider
 *     (`creator/model-name` ids), citations on `message.annotations[]`. It
 *     REJECTS the search parameters with a 400.
 *   • the native Sonar API — `/chat/completions`, bare model ids, citations on
 *     `search_results[]` or `citations[]`, and it takes `search_domain_filter`
 *     and `web_search_options`.
 *
 * Rather than make that a setting someone has to get right, the call sends the
 * search parameters and retries once without them if the endpoint refuses them,
 * and the citation parser reads all three shapes. So either URL works, and the
 * only thing the domains cost on the gateway is that they don't apply.
 *
 * A wrong URL still degrades safely: it logs and the route falls back to the
 * Claude path, rather than costing a learner their answer.
 */

const DEFAULT_URL = 'https://api.perplexity.ai/router/v1/chat/completions';
/** Gateway ids are `creator/model-name`; the native API wants a bare `sonar-pro`.
 *  Set PERPLEXITY_MODEL to match whichever PERPLEXITY_API_URL points at. */
const DEFAULT_MODEL = 'perplexity/sonar-pro';
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

/** Pull the citation list out, tolerating all three shapes the API surfaces use:
 *  the gateway's `message.annotations[]` url_citations, the native API's rich
 *  `search_results[]` objects, and its older bare `citations` URL array. */
function readSources(data: Json): PerplexitySource[] {
  const dedupe = (list: PerplexitySource[]) => {
    const seen = new Set<string>();
    return list.filter((s) => s.url && !seen.has(s.url) && seen.add(s.url));
  };

  // Gateway: OpenAI-style annotations hanging off the message.
  const annotations = data?.choices?.[0]?.message?.annotations;
  if (Array.isArray(annotations) && annotations.length) {
    const cited = annotations
      .filter((a: Json) => a?.type === 'url_citation' && (a?.url || a?.url_citation?.url))
      .map((a: Json) => {
        const c = a.url_citation ?? a;
        return { title: String(c.title || c.url || '').slice(0, 200), url: String(c.url || '') };
      });
    if (cited.length) return dedupe(cited);
  }

  // Native Sonar: rich results, with dates and snippets worth passing on.
  const rich = Array.isArray(data?.search_results) ? data.search_results : null;
  if (rich?.length) {
    return dedupe(rich.map((r: Json) => ({
      title: String(r?.title || r?.url || '').slice(0, 200),
      url: String(r?.url || ''),
      date: r?.date ? String(r.date) : undefined,
      snippet: r?.snippet ? String(r.snippet).slice(0, 600) : undefined,
    })));
  }

  const urls = Array.isArray(data?.citations) ? data.citations : [];
  return dedupe(urls.map((u: Json) => ({ title: String(u || ''), url: String(u || '') })));
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
  const model = process.env.PERPLEXITY_MODEL || DEFAULT_MODEL;
  const domains = (input.domains || []).map((d) => d.trim()).filter(Boolean).slice(0, 20);
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const baseBody = {
    model,
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
  };
  // Only the native Sonar API takes these; the gateway 400s on them. Send them,
  // and fall back to the bare body if they come back rejected — that way the same
  // code serves either endpoint without anyone having to configure which.
  const searchParams = {
    web_search_options: { search_context_size: CONTEXT_SIZE },
    ...(domains.length ? { search_domain_filter: domains } : {}),
  };

  const post = (body: object) => fetch(url, {
    method: 'POST',
    signal: controller.signal,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  try {
    let res = await post({ ...baseBody, ...searchParams });
    if (res.status === 400) {
      const detail = await res.text().catch(() => '');
      console.warn(`[detective] perplexity refused the search parameters — retrying without them: ${detail.slice(0, 200)}`);
      res = await post(baseBody);
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`[detective] perplexity ${res.status} at ${url}: ${detail.slice(0, 300)}`);
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
      `[detective] perplexity ${model} · ${ms}ms · ${sources.length} sources`
      + (sources.length ? ` (${sources.slice(0, 5).map((s) => s.url).join(' | ')})` : ''),
    );
    if (!sources.length) {
      console.warn('[detective]   ⚠ perplexity returned no citations — the draft will have nothing to cite');
    }
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
