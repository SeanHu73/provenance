/**
 * Image search for reflections — proxies Wikimedia Commons.
 *
 * Commons is keyless, free, and its media is public-domain / CC-licensed, which
 * fits a history/context app (and avoids shipping a paid image-API key). We query
 * the File namespace and return thumbnail + full URLs plus a short attribution.
 * Server-side so there's no CORS/`origin=*` dance and the source can be swapped
 * later without touching the client.
 */

import { NextRequest, NextResponse } from 'next/server';

export interface ImageResult {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  credit: string;
}

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: q,
    gsrnamespace: '6', // File:
    gsrlimit: '24',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '400',
    format: 'json',
    origin: '*',
  });

  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { 'User-Agent': 'Provenance/1.0 (context tour app)' },
      // Commons results are stable enough to cache briefly.
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ results: [], error: `Commons ${res.status}` }, { status: 200 });
    const data = await res.json();
    const pages = data?.query?.pages ?? {};

    const results: ImageResult[] = Object.values<Record<string, unknown>>(pages)
      .map((p) => {
        const info = (p.imageinfo as Array<Record<string, unknown>> | undefined)?.[0];
        if (!info) return null;
        const thumbUrl = (info.thumburl as string) || (info.url as string);
        const fullUrl = (info.url as string) || thumbUrl;
        if (!thumbUrl) return null;
        const meta = (info.extmetadata as Record<string, { value?: string }> | undefined) ?? {};
        const artist = meta.Artist?.value?.replace(/<[^>]*>/g, '').trim();
        const license = meta.LicenseShortName?.value?.trim();
        const credit = [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons';
        return {
          id: String(p.pageid ?? thumbUrl),
          title: String(p.title ?? '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
          thumbUrl,
          fullUrl,
          credit,
        };
      })
      .filter((r): r is ImageResult => r !== null);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[image-search] failed:', err);
    return NextResponse.json({ results: [], error: 'Search failed' }, { status: 200 });
  }
}
