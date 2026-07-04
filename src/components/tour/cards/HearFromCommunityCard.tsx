'use client';

/**
 * Context-Prototype — "Hear from the Community", shown at the end of each act
 * after the reflection. Lists other explorers' shared reflections (text +
 * photos + their map pin) for this act; each can be upvoted and commented on.
 *
 * On Continue, if this explorer wrote a reflection but did NOT share it, we
 * re-prompt them to share before moving to the next act.
 */

import { useEffect, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { findActOfStop, getActs } from '@/lib/tour-session';
import { CommunityShare, CommunityComment, ForumIdentity } from '@/lib/types';
import {
  getShares,
  getComments,
  submitComment,
  upvoteShare,
  getUpvotedShareIds,
  saveUpvotedShareIds,
  submitShare,
  promoteUnsharedShare,
  getForumIdentity,
  saveForumIdentity,
} from '@/lib/community-store';

interface Props {
  onComplete: () => void;
}

export default function HearFromCommunityCard({ onComplete }: Props) {
  const { tour, session, currentStop, markReflectionShared } = useTour();
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  const actId = act?.id ?? '';
  const reflection = (actId && session?.actResponses?.[actId]?.reflection) || null;
  const acts = tour ? getActs(tour) : [];
  const isLastAct = act ? acts.findIndex((a) => a.id === act.id) === acts.length - 1 : false;

  const [shares, setShares] = useState<CommunityShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [shared, setShared] = useState(!!reflection?.sharedToCommunity);
  const [askShare, setAskShare] = useState(false);   // "Would you like to share your thoughts?"
  const [nameSheet, setNameSheet] = useState(false); // "Share your response" (name entry)
  const [continueAfter, setContinueAfter] = useState(false);

  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    (async () => {
      const list = actId ? await getShares(tour.id, actId) : [];
      if (cancelled) return;
      setShares(list);
      setCounts(Object.fromEntries(list.map((s) => [s.id, s.upvotes || 0])));
      setUpvoted(getUpvotedShareIds());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tour, actId]);

  const toggleUpvote = (id: string) => {
    const isUp = upvoted.has(id);
    const nextUp = new Set(upvoted);
    if (isUp) nextUp.delete(id); else nextUp.add(id);
    setUpvoted(nextUp);
    saveUpvotedShareIds(nextUp);
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + (isUp ? -1 : 1)) }));
    upvoteShare(id, !isUp).catch((err) => console.error('[community] upvote failed:', err));
  };

  // Continue: if they wrote a reflection but haven't shared, ask first.
  const handleContinue = () => {
    if (reflection && !shared) { setContinueAfter(true); setAskShare(true); return; }
    onComplete();
  };

  // Direct "Share your thoughts" — goes straight to the name sheet, stays here.
  const openShareSheet = () => { setContinueAfter(false); setNameSheet(true); };

  const shareNow = async (name?: string) => {
    if (tour && act && reflection) {
      let identity: ForumIdentity | undefined = getForumIdentity() ?? undefined;
      const typed = name?.trim();
      if (typed && (!identity || identity.name !== typed)) {
        identity = { name: typed, about: identity?.about || '' };
        saveForumIdentity(identity);
      }
      try {
        // Every reflection was already recorded as an unshared community doc;
        // sharing promotes that same doc (no duplicate). Fall back to a fresh
        // submit if the record is missing (e.g. it failed to record earlier).
        let shareId: string;
        if (reflection.unsharedRecordId) {
          shareId = reflection.unsharedRecordId;
          await promoteUnsharedShare(shareId, {
            text: reflection.text, photos: reflection.photos || [], pin: reflection.pin ?? null,
            name: identity?.name, about: identity?.about,
          });
        } else {
          shareId = await submitShare({
            tourId: tour.id, actId: act.id, text: reflection.text,
            photos: reflection.photos || [], pin: reflection.pin ?? null,
            sessionId: session?.id || 'unknown', name: identity?.name, about: identity?.about,
          });
        }
        markReflectionShared(shareId);
        setShares((prev) => [{
          id: shareId, tourId: tour.id, actId: act.id, text: reflection.text,
          photos: reflection.photos || [], pin: reflection.pin ?? null,
          sessionId: session?.id || 'unknown', name: identity?.name, upvotes: 0,
          status: 'approved', createdAt: new Date().toISOString(),
        } as CommunityShare, ...prev]);
        setShared(true);
      } catch (err) {
        console.error('[community] share failed:', err);
      }
    }
    setNameSheet(false);
    setAskShare(false);
    if (continueAfter) onComplete();
  };

  return (
    <div className="animate-fade-in space-y-5">
      <h2 className="font-display font-bold leading-tight" style={{ fontSize: 30, color: 'var(--th-primary)' }}>
        Hear from the Community
      </h2>
      <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        What others took away from this part of the tour.
      </p>

      {loading ? (
        <div className="flex justify-center py-6"><span className="w-6 h-6 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" /></div>
      ) : shares.length === 0 ? (
        <p className="text-[15px] italic py-4" style={{ color: 'var(--text-secondary)' }}>
          No one has shared here yet — you could be the first.
        </p>
      ) : (
        <div className="space-y-3">
          {shares.map((s) => (
            <ShareCard
              key={s.id}
              share={s}
              tourId={tour!.id}
              sessionId={session?.id || 'unknown'}
              upvoted={upvoted.has(s.id)}
              count={counts[s.id] || 0}
              onUpvote={() => toggleUpvote(s.id)}
            />
          ))}
        </div>
      )}

      {shared && (
        <p className="text-center text-[13px] font-semibold" style={{ color: 'var(--th-primary)' }}>✓ Your response is shared with the community</p>
      )}

      <div className="flex gap-2 pt-1">
        {reflection && !shared && (
          <button onClick={openShareSheet} className="flex-1 py-3 rounded-lg text-base font-semibold border-2" style={{ color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}>
            Share your thoughts
          </button>
        )}
        <button onClick={handleContinue} className="flex-1 py-3 rounded-lg text-base font-semibold bg-accent-dark text-white">
          {isLastAct ? 'End Tour' : 'Continue Tour'}
        </button>
      </div>

      {askShare && (
        <AskShareSheet
          onYes={() => { setAskShare(false); setNameSheet(true); }}
          onNo={() => { setAskShare(false); setContinueAfter(false); onComplete(); }}
        />
      )}
      {nameSheet && (
        <NameShareSheet
          defaultName={getForumIdentity()?.name || ''}
          onShare={shareNow}
          onCancel={() => { setNameSheet(false); setAskShare(false); setContinueAfter(false); }}
        />
      )}
    </div>
  );
}

function ShareCard({ share, tourId, sessionId, upvoted, count, onUpvote }: {
  share: CommunityShare; tourId: string; sessionId: string; upvoted: boolean; count: number; onUpvote: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const expand = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setComments(await getComments(share.id));
      setLoaded(true);
    }
  };

  return (
    <div className="rounded-xl p-3.5" style={{ backgroundColor: 'var(--th-surface-alt)' }}>
      {share.name && <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--th-primary)' }}>{share.name}</p>}
      <p className="text-[16px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{share.text}</p>

      {share.photos && share.photos.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {share.photos.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover" />
          ))}
        </div>
      )}

      {share.pin && (
        <div className="mt-2 inline-flex items-start gap-1.5 text-[14px]" style={{ color: 'var(--text-secondary)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 shrink-0"><path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" /></svg>
          <span><span className="font-semibold">{share.pin.title || 'Their spot'}</span>{share.pin.note ? ` — ${share.pin.note}` : ''}</span>
        </div>
      )}

      {/* Footer: upvote + comments toggle */}
      <div className="flex items-center gap-4 mt-3 text-[13px]">
        <button onClick={onUpvote} className="flex items-center gap-1.5 font-semibold" style={{ color: upvoted ? 'var(--th-primary)' : 'var(--text-secondary)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill={upvoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
          {count}
        </button>
        <button onClick={expand} className="font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {open ? 'Hide comments' : 'Comment'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--th-border)' }}>
          {comments.map((c) => (
            <div key={c.id} className="text-[15px]">
              {c.name && <span className="font-semibold" style={{ color: 'var(--th-primary)' }}>{c.name}: </span>}
              <span style={{ color: 'var(--text-primary)' }}>{c.text}</span>
            </div>
          ))}
          <CommentComposer
            onSubmit={async (text, name) => {
              const identity = getForumIdentity() ?? (name ? { name, about: '' } : undefined);
              if (identity && !getForumIdentity()) saveForumIdentity(identity);
              await submitComment(share.id, tourId, text, sessionId, identity);
              setComments((prev) => [...prev, { id: `local_${prev.length}`, shareId: share.id, tourId, text, sessionId, name: identity?.name, status: 'approved', createdAt: new Date().toISOString() }]);
            }}
          />
        </div>
      )}
    </div>
  );
}

function CommentComposer({ onSubmit }: { onSubmit: (text: string, name?: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const needName = !getForumIdentity();
  const canSubmit = !!text.trim() && (!needName || !!name.trim()) && !busy;

  return (
    <div className="space-y-2 pt-1">
      {needName && (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
          className="w-full px-3 py-2 rounded-lg text-[15px] font-serif border-2 border-sandstone-light bg-white focus:outline-none" />
      )}
      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…"
          className="flex-1 px-3 py-2 rounded-lg text-[15px] font-serif border-2 border-sandstone-light bg-white focus:outline-none" />
        <button
          onClick={async () => { if (!canSubmit) return; setBusy(true); await onSubmit(text.trim(), name.trim() || undefined); setText(''); setBusy(false); }}
          disabled={!canSubmit}
          className="px-4 rounded-lg text-sm font-semibold bg-aged-gold text-white disabled:opacity-40"
        >
          Post
        </button>
      </div>
    </div>
  );
}

/** Step 1 on Continue-without-sharing: a simple yes/no. */
function AskShareSheet({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onNo} />
      <div className="relative m-4 rounded-2xl shadow-xl p-5 space-y-3 animate-slide-up" style={{ backgroundColor: 'var(--th-surface)' }}>
        <h3 className="font-display font-bold" style={{ fontSize: 22, color: 'var(--th-primary)' }}>Would you like to share your thoughts?</h3>
        <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>Others can learn from what you wrote.</p>
        <div className="flex gap-2 pt-1">
          <button onClick={onNo} className="flex-1 py-3 rounded-full text-[15px] font-semibold border-2" style={{ color: 'var(--text-secondary)', borderColor: 'var(--th-border)' }}>No</button>
          <button onClick={onYes} className="flex-1 py-3 rounded-full text-[15px] font-semibold" style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>Yes</button>
        </div>
      </div>
    </div>
  );
}

/** Step 2: name / alias entry, then post to the community. */
function NameShareSheet({ defaultName, onShare, onCancel }: { defaultName: string; onShare: (name?: string) => void; onCancel: () => void }) {
  const [name, setName] = useState(defaultName);
  const canShare = !!name.trim();
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative m-4 rounded-2xl shadow-xl p-5 space-y-3 animate-slide-up" style={{ backgroundColor: 'var(--th-surface)' }}>
        <h3 className="font-display font-bold" style={{ fontSize: 22, color: 'var(--th-primary)' }}>Share your response</h3>
        <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>Add your name so others know whose reflection this is — then it joins the community wall.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (or alias)"
          className="w-full px-4 py-2.5 rounded-lg text-[17px] font-serif border-2 border-sandstone-light bg-white focus:outline-none" />
        <button onClick={() => onShare(name.trim())} disabled={!canShare}
          className="w-full py-3 rounded-full text-[15px] font-semibold disabled:opacity-40"
          style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}>
          Share with the community
        </button>
        <button onClick={onCancel} className="w-full text-center text-sm py-1" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
      </div>
    </div>
  );
}
