/**
 * Image search for reflections — proxies Wikimedia Commons.
 *
 * Thin wrapper over the shared `searchCommonsImages` helper (see
 * `@/lib/image-search`), server-side so there's no CORS/`origin=*` dance and the
 * source can be swapped later without touching the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchCommonsImages } from '@/lib/image-search';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [] });

  // Strip the extra `ext` field so the client response shape is unchanged.
  const results = (await searchCommonsImages(q)).map((r) => ({
    id: r.id, title: r.title, thumbUrl: r.thumbUrl, fullUrl: r.fullUrl, credit: r.credit,
  }));
  return NextResponse.json({ results });
}
