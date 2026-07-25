/**
 * Wikimedia Commons image search — shared server helper.
 *
 * Commons is keyless, free, and its media is public-domain / CC-licensed, which
 * fits a history/context app (and avoids shipping a paid image-API key). Used by
 * `/api/image-search` (the learner-facing picker) and by the Context Detective
 * pipeline, which illustrates an answer with a best-effort Commons photo when the
 * answer doesn't already draw on an authored context that carries one.
 */

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

export interface ImageResult {
  id: string;
  title: string;
  thumbUrl: string;
  fullUrl: string;
  credit: string;
  /** Lower-cased file extension of the full image (e.g. 'jpg', 'png', 'svg'). */
  ext: string;
}

/** True for raster photo formats — used to skip diagrams / logos / maps (svg) and
 *  other non-photographic files when auto-picking an illustrative image. */
export function isPhotoExt(ext: string): boolean {
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp';
}

/** Query Commons' File namespace, newest results first by relevance. Never throws
 *  — returns [] on any failure so callers can degrade gracefully. `timeoutMs`
 *  aborts a slow request (the Detective must not block on it). */
export async function searchCommonsImages(
  q: string,
  opts: { thumbWidth?: number; limit?: number; timeoutMs?: number } = {},
): Promise<ImageResult[]> {
  const query = q.trim();
  if (!query) return [];
  const { thumbWidth = 400, limit = 24, timeoutMs } = opts;

  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6', // File:
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: String(thumbWidth),
    format: 'json',
    origin: '*',
  });

  const ctrl = timeoutMs ? new AbortController() : undefined;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : undefined;
  try {
    const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { 'User-Agent': 'Provenance/1.0 (context tour app)' },
      // Commons results are stable enough to cache briefly.
      next: { revalidate: 3600 },
      signal: ctrl?.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages ?? {};

    return Object.values<Record<string, unknown>>(pages)
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
        const ext = (fullUrl.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
        return {
          id: String(p.pageid ?? thumbUrl),
          title: String(p.title ?? '').replace(/^File:/, '').replace(/\.[a-z0-9]+$/i, ''),
          thumbUrl,
          fullUrl,
          credit,
          ext,
        } satisfies ImageResult;
      })
      .filter((r): r is ImageResult => r !== null);
  } catch {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}
