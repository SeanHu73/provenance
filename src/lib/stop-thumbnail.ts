/**
 * Which photo represents a stop in thumbnails — the tour overview, the map pin
 * callout, the stops dropdown, the progress bar, the additional-stops menu.
 *
 * The rule is a spoiler rule. The notice photo *is* the thing the explorer is
 * sent to find, so showing it in a thumbnail beforehand hands them the answer —
 * which is the whole point of the FIND activity. So: the stop's info photo until
 * the stop is finished, the notice photo afterwards, when it's the best record of
 * what they saw and no longer spoils anything.
 *
 * **The info photo is `reveal.photos[0]` — the DISCOVER page's photo.** Not
 * `seed.photos[0]`. `seed` is the *Background* section, and in a context tour its
 * stops have no photos at all; the DISCOVER page is `RevealCard`, which is the one
 * carrying `ActionTitle action="DISCOVER"` and the photos the admin actually
 * uploaded. (`SeedCard` renders the DISCOVER title only when *not* embedded, which
 * is the trap: in a context tour it is always embedded and renders FIND.) Reading
 * seed here makes the whole rule a no-op — every stop falls through to the notice
 * photo and the thumbnail spoils the activity.
 *
 * `done` flips on stop *completion* — when they wrap the stop up and head back to
 * the map ("Explore more"), i.e. `session.completedStops.includes(stop.id)` — not
 * the moment they find it. Mid-stop the thumbnail must keep its secret.
 *
 * Each order falls through to the other rung rather than returning null: a stop
 * with only notice photos would otherwise show a blank thumbnail for its whole
 * first half. Better a mild spoiler than an empty frame — but note that fallback
 * silently defeats the spoiler rule, so a stop with no DISCOVER photo is a content
 * gap worth fixing, not a rendering quirk.
 *
 * This lived as six near-identical copies before. If you change the order, change
 * it here.
 */

import type { Stop, StopPhoto } from './types';

export type ThumbPhoto = Pick<StopPhoto, 'url'> & Partial<StopPhoto>;

function firstOf(photos: StopPhoto[] | undefined, legacyUrl: string | null, legacyCaption?: string | null): ThumbPhoto | null {
  const p = (photos || []).find((x) => x.url);
  if (p) return p;
  if (legacyUrl) return { url: legacyUrl, caption: legacyCaption ?? null };
  return null;
}

/** `done` — has the explorer finished this stop? (`completedStops.includes(id)`) */
export function stopThumbnailPhoto(stop: Stop, done: boolean): ThumbPhoto | null {
  // The DISCOVER page's photo, then the Background's as a backstop for stops that
  // predate DISCOVER photos.
  const info = firstOf(stop.reveal.photos, stop.reveal.photoUrl, stop.reveal.photoCaption)
    ?? firstOf(stop.seed.photos, stop.seed.photoUrl, stop.seed.photoCaption);
  const notice = firstOf(stop.notice.photos, stop.notice.photoUrl, stop.notice.photoCaption);
  return done ? (notice ?? info) : (info ?? notice);
}
