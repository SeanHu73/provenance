/**
 * POST /api/embed — OpenAI text embedding.
 *
 * Takes `{ text }` and returns `{ embedding: number[], model }` using
 * text-embedding-3-small (1536 dims). The OpenAI key stays server-side.
 *
 * Used to embed knowledge-base entries on save (admin) and to embed a learner's
 * question at ask time (the Context Detective retrieval step). Cosine comparison
 * itself happens in code — there is no vector DB at this scale.
 */

import { NextResponse } from 'next/server';

const MODEL = 'text-embedding-3-small';
const MAX_CHARS = 30000; // generous; entries/questions are far shorter

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set in this environment.' }, { status: 500 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const text = (body.text || '').toString().trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: 'No text to embed.' }, { status: 400 });

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: text }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[api/embed] OpenAI error:', res.status, detail.slice(0, 300));
      return NextResponse.json({ error: `Embedding failed (${res.status}).` }, { status: 502 });
    }

    const data = await res.json();
    const embedding = data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      return NextResponse.json({ error: 'No embedding returned.' }, { status: 502 });
    }
    return NextResponse.json({ embedding, model: MODEL });
  } catch (err) {
    console.error('[api/embed] request error:', err);
    return NextResponse.json({ error: 'Embedding request failed.' }, { status: 502 });
  }
}
