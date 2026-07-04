/**
 * POST /api/tts — OpenAI text-to-speech.
 *
 * Takes `{ text, voice?, model?, speed? }` and returns MP3 audio bytes. The
 * OpenAI key stays server-side. Callers are responsible for caching:
 *   - Authored stop narration: the admin "Generate missing narration" button
 *     generates once, uploads the MP3 to Firebase Storage, and stores the URL
 *     on the stop (keyed by a text hash) so listeners stream a static file.
 *   - AI context answers: generated on demand (per listen) and cached in memory
 *     for the session, since each answer is unique.
 *
 * Requires OPENAI_API_KEY in the server environment. Optional overrides:
 *   OPENAI_TTS_VOICE (default "nova"), OPENAI_TTS_MODEL (default "tts-1").
 */

import { NextResponse } from 'next/server';

// tts-1 / tts-1-hd accept up to 4096 characters per request.
const MAX_CHARS = 4096;

export async function POST(req: Request) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'OPENAI_API_KEY is not set in this environment.' }, { status: 500 });
  }

  let body: { text?: string; voice?: string; model?: string; speed?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const text = (body.text || '').toString().trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: 'No text to speak.' }, { status: 400 });

  const voice = (body.voice || process.env.OPENAI_TTS_VOICE || 'nova').toString();
  const model = (body.model || process.env.OPENAI_TTS_MODEL || 'tts-1').toString();
  const speed = typeof body.speed === 'number' ? Math.min(2, Math.max(0.5, body.speed)) : 0.95;

  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, voice, input: text, response_format: 'mp3', speed }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[api/tts] OpenAI error:', res.status, detail.slice(0, 300));
      return NextResponse.json({ error: `OpenAI TTS failed (${res.status}).` }, { status: 502 });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // The durable cache is Firebase Storage (authored) / in-memory (answers);
        // don't let intermediaries cache the raw generation response.
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/tts] request error:', err);
    return NextResponse.json({ error: 'TTS request failed.' }, { status: 502 });
  }
}
