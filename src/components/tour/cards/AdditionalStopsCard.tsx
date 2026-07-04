'use client';

/**
 * Context-Prototype — the post-tour "additional stops" menu.
 *
 * Shown once the last act ends, when the tour has any `additionalStops`. It marks
 * the end of the *guided* tour and invites the learner to freely explore the extra
 * stops the author pulled out of the acts. Each stop plays its content and then
 * pops up its own (dismissible) Context Journal; the learner returns here after
 * each and taps "Finish" when done (→ the tour's closing screens).
 */

import { Tour, TourSession, Stop } from '@/lib/types';
import { getAdditionalStops } from '@/lib/tour-session';

interface Props {
  tour: Tour;
  session: TourSession;
  onExplore: (stopId: string) => void;
  onFinish: () => void;
}

type ThumbPhoto = { url: string; thumbnailFocalPoint?: { x: number; y: number } };

function stopThumbnail(stop: Stop): ThumbPhoto | null {
  const np = (stop.notice.photos || []).find((p) => p.url);
  if (np) return np;
  if (stop.notice.photoUrl) return { url: stop.notice.photoUrl };
  const sp = (stop.seed.photos || []).find((p) => p.url);
  if (sp) return sp;
  if (stop.seed.photoUrl) return { url: stop.seed.photoUrl };
  return null;
}

export default function AdditionalStopsCard({ tour, session, onExplore, onFinish }: Props) {
  const stops = getAdditionalStops(tour);
  const explored = new Set(session.completedStops);

  return (
    <div className="animate-fade-in min-h-full py-2 space-y-6">
      <div>
        <p className="uppercase tracking-[0.12em] font-display font-semibold leading-tight" style={{ fontSize: 30, color: 'var(--th-primary)' }}>
          End of the guided tour
        </p>
        <p className="mt-1.5 text-text-secondary" style={{ fontSize: 'clamp(16px, 4.5vw, 19px)' }}>
          That&apos;s the end of the guided part. Feel free to explore these related stops
          — open any that interest you, or finish whenever you like.
        </p>
      </div>

      {stops.length === 0 ? (
        <p className="text-sm text-text-secondary italic">No additional stops.</p>
      ) : (
        <div className="space-y-3">
          {stops.map(({ stop, entry }) => {
            const thumb = stopThumbnail(stop);
            const isExplored = explored.has(stop.id);
            const title = stop.title || entry.guidingQuestion || 'Untitled stop';
            return (
              <button
                key={stop.id}
                onClick={() => onExplore(stop.id)}
                className="w-full flex items-center gap-3 text-left rounded-xl bg-white border border-sandstone-light p-3 hover:border-aged-gold transition-colors"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-sandstone-light/20 shrink-0">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb.url}
                      alt=""
                      className="w-full h-full object-cover"
                      style={thumb.thumbnailFocalPoint ? { objectPosition: `${thumb.thumbnailFocalPoint.x}% ${thumb.thumbnailFocalPoint.y}%` } : undefined}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sandstone-light">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-text-primary leading-tight line-clamp-2" style={{ fontSize: 'clamp(17px, 4.5vw, 20px)' }}>{title}</p>
                  {entry.guidingQuestion?.trim() && entry.guidingQuestion.trim() !== title && (
                    <p className="mt-0.5 text-[13px] font-serif italic text-text-secondary line-clamp-1">{entry.guidingQuestion}</p>
                  )}
                  {isExplored && (
                    <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-olive">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      Explored
                    </span>
                  )}
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--th-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={onFinish} className="w-full py-3 rounded-lg text-base font-semibold bg-olive text-white">
        Finish
      </button>
    </div>
  );
}
