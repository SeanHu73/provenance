/**
 * POST /api/log-tour — RETIRED forwarder.
 *
 * The Google Sheets logging pipeline has been replaced by the durable Firestore
 * session backup (`memorial-church-tour-sessions`), reviewable in /admin/sessions.
 * We still accept the POST (so in-flight client beacons don't error) but no
 * longer forward anything to Sheets.
 */

import { NextResponse } from 'next/server';
export async function POST(req: Request) {
  try {
    await req.json().catch(() => null);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
