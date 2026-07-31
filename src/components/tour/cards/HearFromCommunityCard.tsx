'use client';

/**
 * Context-Prototype — "Hear from the Community", the screen after the tour's
 * closing reflection. Lists other explorers' shared reflections (text + photos +
 * their map pin) for the whole tour, grouped under the question each one answers;
 * every share can be upvoted and commented on.
 *
 * Reflections recorded before the prompts were merged carry an act but no
 * question — they keep their own group under that act rather than being dropped.
 *
 * On Continue, if this explorer wrote reflections but did NOT share them, we
 * re-prompt them to share before the tour ends.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTour } from '@/context/TourContext';
import { findActOfStop, getActs, getAdditionalStops, allReflectionPrompts, actReflectionsOf } from '@/lib/tour-session';
import { CommunityShare, CommunityComment, ForumIdentity } from '@/lib/types';
import {
  getSharesForTour,
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

/** One question's worth of shared reflections. */
interface ShareGroup {
  key: string;
  question: string;
  shares: CommunityShare[];
}

export default function HearFromCommunityCard({ onComplete }: Props) {
  const { tour, session, currentStop, markReflectionsShared } = useTour();
  const act = tour && currentStop ? findActOfStop(tour, currentStop.id) : null;
  const acts = useMemo(() => (tour ? getActs(tour) : []), [tour]);
  const isLastAct = act ? acts.findIndex((a) => a.id === act.id) === acts.length - 1 : false;
  // On the last act, if the tour has post-tour "additional" stops, the button
  // leads into their map rather than ending — so it invites exploration.
  const hasAdditional = tour ? getAdditionalStops(tour).length > 0 : false;
  const lastActLabel = hasAdditional ? 'Explore related stops' : 'End Tour';

  // Everything this explorer wrote, across every act — the closing reflection
  // lets them answer several prompts, and all of them share together.
  const myReflections = useMemo(
    () => Object.values(session?.actResponses ?? {}).flatMap((entry) => actReflectionsOf(entry)),
    [session?.actResponses],
  );
  const unsharedMine = myReflections.filter((r) => !r.sharedToCommunity);

  const [shares, setShares] = useState<CommunityShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [shared, setShared] = useState(unsharedMine.length === 0 && myReflections.length > 0);
  const [askShare, setAskShare] = useState(false);   // "Would you like to share your thoughts?"
  const [nameSheet, setNameSheet] = useState(false); // "Share your response" (name entry)
  const [continueAfter, setContinueAfter] = useState(false);

  useEffect(() => {
    if (!tour) return;
    let cancelled = false;
    (async () => {
      const list = await getSharesForTour(tour.id);
      if (cancelled) return;
      setShares(list);
      setCounts(Object.fromEntries(list.map((s) => [s.id, s.upvotes || 0])));
      setUpvoted(getUpvotedShareIds());
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tour]);

  // Categorise the wall by question: the tour's prompts in authored order, then
  // the ones explorers wrote themselves, then anything recorded before the merge
  // (grouped by its act, since no question was stored on it).
  const groups: ShareGroup[] = useMemo(() => {
    const prompts = allReflectionPrompts(tour);
    const order = new Map(prompts.map((p, i) => [p.id, i]));
    const promptText = new Map(prompts.map((p) => [p.id, p.prompt]));
    const actLabel = (id: string) => {
      const i = acts.findIndex((a) => a.id === id);
      if (i < 0) return 'Earlier reflections';
      return `Act ${i + 1} — ${acts[i].guidingQuestion?.trim() || acts[i].title}`;
    };
    const map = new Map<string, ShareGroup>();
    const rank = new Map<string, number>();
    for (const s of shares) {
      let key: string;
      let question: string;
      let at: number;
      if (s.promptId && (order.has(s.promptId) || s.promptText)) {
        key = s.promptId;
        // Prefer the prompt as it reads now; the snapshot covers prompts the
        // admin has since edited away.
        question = promptText.get(s.promptId) || s.promptText || '';
        at = order.get(s.promptId) ?? 500;
      } else if (s.isCustom || (!s.promptId && s.promptText)) {
        key = 'custom';
        question = 'Prompts explorers wrote themselves';
        at = 1000;
      } else {
        key = `act:${s.actId}`;
        question = actLabel(s.actId);
        at = 2000 + Math.max(0, acts.findIndex((a) => a.id === s.actId));
      }
      const group = map.get(key);
      if (group) group.shares.push(s);
      else { map.set(key, { key, question, shares: [s] }); rank.set(key, at); }
    }
    return [...map.values()].sort((a, b) => (rank.get(a.key) ?? 0) - (rank.get(b.key) ?? 0));
  }, [shares, tour, acts]);

  const toggleUpvote = (id: string) => {
    const isUp = upvoted.has(id);
    const nextUp = new Set(upvoted);
    if (isUp) nextUp.delete(id); else nextUp.add(id);
    setUpvoted(nextUp);
    saveUpvotedShareIds(nextUp);
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + (isUp ? -1 : 1)) }));
    upvoteShare(id, !isUp).catch((err) => console.error('[community] upvote failed:', err));
  };

  // Continue: if they wrote reflections but haven't shared, ask first.
  const handleContinue = () => {
    if (unsharedMine.length > 0 && !shared) { setContinueAfter(true); setAskShare(true); return; }
    onComplete();
  };

  // Direct "Share your thoughts" — goes straight to the name sheet, stays here.
  const openShareSheet = () => { setContinueAfter(false); setNameSheet(true); };

  const shareNow = async (name?: string) => {
    if (tour && unsharedMine.length > 0) {
      let identity: ForumIdentity | undefined = getForumIdentity() ?? undefined;
      const typed = name?.trim();
      if (typed && (!identity || identity.name !== typed)) {
        identity = { name: typed, about: identity?.about || '' };
        saveForumIdentity(identity);
      }
      // Publish every response they wrote, under the same name — one decision
      // covers the lot, and none is left behind.
      const publishedIds: Record<string, string> = {};
      const published: CommunityShare[] = [];
      for (const reflection of unsharedMine) {
        const actId = reflection.actId || act?.id || '';
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
              tourId: tour.id, actId,
              promptId: reflection.promptId, promptText: reflection.promptText, isCustom: reflection.isCustom,
              text: reflection.text,
              photos: reflection.photos || [], pin: reflection.pin ?? null,
              sessionId: session?.id || 'unknown', name: identity?.name, about: identity?.about,
            });
          }
          const key = reflection.id || reflection.unsharedRecordId;
          if (key) publishedIds[key] = shareId;
          published.push({
            id: shareId, tourId: tour.id, actId,
            promptId: reflection.promptId, promptText: reflection.promptText, isCustom: reflection.isCustom,
            text: reflection.text,
            photos: reflection.photos || [], pin: reflection.pin ?? null,
            sessionId: session?.id || 'unknown', name: identity?.name, upvotes: 0,
            status: 'approved', createdAt: new Date().toISOString(),
          } as CommunityShare);
        } catch (err) {
          console.error('[community] share failed:', err);
        }
      }
      if (published.length) {
        markReflectionsShared(publishedIds);
        setShares((prev) => [...published, ...prev]);
        setShared(true);
      }
    }
    setNameSheet(false);
    setAskShare(false);
    if (continueAfter) onComplete();
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Two-tone title, centred, with the subject on its own line. */}
      <h2
        className="text-center"
        style={{
          fontFamily: 'var(--ds-h2-family)',
          fontSize: 'var(--ds-h2-size)',
          lineHeight: 'var(--ds-h2-line)',
          fontWeight: 'var(--ds-h2-weight)',
        }}
      >
        <span className="block" style={{ color: 'var(--ds-ink)' }}>Hear from the</span>
        <span className="block" style={{ color: 'var(--ds-cardinal)' }}>Community</span>
      </h2>
      <p
        className="text-center"
        style={{
          fontFamily: 'var(--ds-body-l-family)',
          fontSize: 'var(--ds-body-l-size)',
          lineHeight: 'var(--ds-body-l-line)',
          color: 'var(--ds-ink-soft)',
        }}
      >
        What others took away from the tour.
      </p>

      {loading ? (
        <div className="flex justify-center py-6"><span className="w-6 h-6 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" /></div>
      ) : groups.length === 0 ? (
        <p className="text-[15px] italic py-4" style={{ color: 'var(--text-secondary)' }}>
          No one has shared here yet — you could be the first.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} className="space-y-3">
              {/* The question the responses under it answer. */}
              <h3
                style={{
                  fontFamily: 'var(--ds-title-s-family)',
                  fontSize: 'var(--ds-title-s-size)',
                  lineHeight: 'var(--ds-title-s-line)',
                  fontWeight: 'var(--ds-title-s-weight)',
                  color: 'var(--ds-cardinal)',
                }}
              >
                {g.question}
              </h3>
              {g.shares.map((s) => (
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
            </section>
          ))}
        </div>
      )}

      {shared && (
        <p className="text-center text-[13px] font-semibold" style={{ color: 'var(--th-primary)' }}>
          {myReflections.length > 1 ? '✓ Your responses are shared with the community' : '✓ Your response is shared with the community'}
        </p>
      )}

      {/* Continue leads on the left as the filled pill; sharing sits beside it as
          the outlined one — the order the mockup puts them in. */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleContinue}
          className="flex-1 flex items-center justify-center text-white"
          style={{
            minHeight: 'var(--ds-btn-s-height)',
            paddingInline: 12,
            borderRadius: 'var(--ds-radius-pill)',
            backgroundColor: 'var(--ds-cardinal)',
            fontFamily: 'var(--ds-button-s-family)',
            fontSize: 'var(--ds-button-s-size)',
            fontWeight: 'var(--ds-button-s-weight)',
          }}
        >
          {isLastAct ? lastActLabel : 'Continue Tour'}
        </button>
        {unsharedMine.length > 0 && !shared && (
          <button
            onClick={openShareSheet}
            className="flex-1 flex items-center justify-center"
            style={{
              minHeight: 'var(--ds-btn-s-height)',
              paddingInline: 12,
              borderRadius: 'var(--ds-radius-pill)',
              border: 'var(--ds-btn-border-width) solid var(--ds-cardinal)',
              color: 'var(--ds-cardinal)',
              fontFamily: 'var(--ds-button-s-family)',
              fontSize: 'var(--ds-button-s-size)',
              fontWeight: 'var(--ds-button-s-weight)',
            }}
          >
            Share your thoughts
          </button>
        )}
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

  // The count shows on collapsed cards now, so the thread is fetched when the
  // card mounts rather than when it is opened — "1 Comment" is the thing that
  // invites the tap, and it cannot say that without having looked.
  useEffect(() => {
    let alive = true;
    getComments(share.id).then((c) => { if (alive) setComments(c); }).catch(() => { /* count just stays 0 */ });
    return () => { alive = false; };
  }, [share.id]);

  const expand = () => setOpen((v) => !v);

  return (
    <div
      className="p-4"
      style={{
        backgroundColor: 'var(--ds-white)',
        borderRadius: 'var(--ds-radius-card)',
        boxShadow: 'var(--ds-shadow-sm)',
      }}
    >
      {share.name && (
        <p
          className="mb-2"
          style={{
            fontFamily: 'var(--ds-title-s-family)',
            fontSize: 'var(--ds-title-s-size)',
            lineHeight: 'var(--ds-title-s-line)',
            fontWeight: 'var(--ds-title-s-weight)',
            color: 'var(--ds-cardinal)',
          }}
        >
          {share.name}
        </p>
      )}
      <p
        style={{
          fontFamily: 'var(--ds-body-l-family)',
          fontSize: 'var(--ds-body-l-size)',
          lineHeight: 'var(--ds-body-l-line)',
          color: 'var(--ds-ink)',
        }}
      >
        {share.text}
      </p>

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

      {/* Footer: the comment count opens the thread; the upvote sits beside it. */}
      <div className="flex items-center gap-4 mt-3">
        <button
          onClick={expand}
          aria-expanded={open}
          className="flex items-center gap-2"
          style={{ fontFamily: 'var(--ds-body-family)', fontSize: 'var(--ds-body-size)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ds-cardinal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
          </svg>
          <span style={{ color: 'var(--ds-cardinal)', fontWeight: 700 }}>{comments.length}</span>
          <span style={{ color: 'var(--ds-grey)' }}>{open ? 'Hide' : 'Comment'}</span>
        </button>
        <button
          onClick={onUpvote}
          aria-pressed={upvoted}
          aria-label="Upvote"
          className="flex items-center gap-1.5"
          style={{ fontFamily: 'var(--ds-body-family)', fontSize: 'var(--ds-body-size)', fontWeight: 700, color: upvoted ? 'var(--ds-cardinal)' : 'var(--ds-grey)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={upvoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><polyline points="18 15 12 9 6 15" /></svg>
          {count}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 pt-3 border-t" style={{ borderColor: 'var(--ds-blush)' }}>
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
    /* Stacked and full width, per the mockup: name, then the comment, then Post
       as an outlined pill of its own — not a small button crowded beside the
       field it submits. */
    <div className="space-y-2 pt-1">
      {needName && (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="ds-textarea px-4 py-3"
          style={{
            fontFamily: 'var(--ds-body-l-family)',
            fontSize: 'var(--ds-body-l-size)',
            borderColor: 'var(--ds-grey-light)',
          }}
        />
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Add a comment…"
        className="ds-textarea px-4 py-3"
        style={{
          fontFamily: 'var(--ds-body-l-family)',
          fontSize: 'var(--ds-body-l-size)',
          borderColor: 'var(--ds-grey-light)',
        }}
      />
      <button
        onClick={async () => { if (!canSubmit) return; setBusy(true); await onSubmit(text.trim(), name.trim() || undefined); setText(''); setBusy(false); }}
        disabled={!canSubmit}
        className="w-full flex items-center justify-center disabled:opacity-40"
        style={{
          minHeight: 'var(--ds-btn-s-height)',
          borderRadius: 'var(--ds-radius-pill)',
          border: 'var(--ds-btn-border-width) solid var(--ds-cardinal)',
          color: 'var(--ds-cardinal)',
          fontFamily: 'var(--ds-button-s-family)',
          fontSize: 'var(--ds-button-s-size)',
          fontWeight: 'var(--ds-button-s-weight)',
        }}
      >
        {busy ? 'Posting…' : 'Post'}
      </button>
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
