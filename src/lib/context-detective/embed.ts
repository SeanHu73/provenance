/**
 * Server-side OpenAI embeddings for the Context Detective retrieval step, plus a
 * cosine helper (retrieval runs in code — no vector DB at this scale).
 */

const MODEL = 'text-embedding-3-small';

/** Embed one or more texts in a single OpenAI call. Returns vectors in input order. */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not set.');
  if (texts.length === 0) return [];
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: texts.map((t) => t.slice(0, 8000)) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Embedding failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return ((data.data || []) as { index: number; embedding: number[] }[])
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

export function cosine(a: number[] | undefined, b: number[] | undefined): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}
