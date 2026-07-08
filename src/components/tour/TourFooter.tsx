'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, useAnimationControls } from 'framer-motion';
import { Tour, TourSession } from '@/lib/types';
import { getTourMode, getActiveStops } from '@/lib/tours-store';
import { findActOfStop, getActs, getActContexts } from '@/lib/tour-session';
import { useTour } from '@/context/TourContext';
import MicButton from './MicButton';
import { useRoom } from '@/context/RoomContext';
import RoomMenu from '@/components/room/RoomMenu';
import ContextJournal from '@/features/context-journal/ContextJournal';
import { authoredToEntry } from '@/features/context-journal/adapters';

/**
 * Phases at or after an act's Context step. Used by the base (revisit) journal to
 * decide whether the *current* act's authored questions have been "gone through"
 * yet — earlier phases (act_intro, seed, stop_map, act_opening…) keep them hidden.
 */
const CONTEXT_DONE_PHASES = new Set([
  'act_context', 'act_reflection_intro', 'act_context_questions', 'act_reflection', 'community_share',
]);

interface Props {
  tour: Tour;
  session: TourSession;
  /** When true, the onboarding "point at the ? button" arrow shows over the ? button. */
  pointAtQuestion?: boolean;
}

/**
 * The Journal + Ask (?) bottom bar plus the overlays the two buttons open.
 * Shared between Journal.tsx (in-stop phases) and page.tsx (map, midway,
 * closing) so the footer stays visible across the whole active tour.
 */
export default function TourFooter({ tour, session, pointAtQuestion = false }: Props) {
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const { room, isInRoom } = useRoom();
  const { recordContextViewed } = useTour();
  // Context-Prototype hides the Inquiries (ask a question) affordance and
  // surfaces the current Act's title on the footer bar, next to Journal.
  const isContext = getTourMode(tour) === 'context';
  const showInquiries = !isContext;
  let actNumLabel: string | null = null;
  let actTitleText = '';
  const inActPhase = ['act_intro', 'act_opening', 'act_closing', 'act_questions', 'community_forum', 'stop_map', 'seed', 'notice', 'wonder', 'reveal', 'reflect', 'whats_next', 'branch'].includes(session.currentPhase);
  if (isContext && inActPhase) {
    const currentStop = getActiveStops(tour)[session.currentStopIndex];
    const act = currentStop ? findActOfStop(tour, currentStop.id) : null;
    if (act) {
      const num = getActs(tour).findIndex((a) => a.id === act.id) + 1;
      actNumLabel = `Act ${num}`;
      actTitleText = (act.guidingQuestion?.trim() || act.title.trim());
    }
  }

  // Context Journal revisit overlay — the footer button opens the *same*
  // guest-local journal the learner added to, so their saved contexts show up
  // (the old footer Link went to the standalone Firestore route, which never
  // sees the sessionStorage adds).
  const [showJournal, setShowJournal] = useState(false);
  const journalStop = getActiveStops(tour)[session.currentStopIndex] ?? null;
  const journalAct = journalStop ? findActOfStop(tour, journalStop.id) : null;
  // The base (revisit) journal only reveals an act's authored questions once the
  // learner has actually gone through that act's context step. Past acts
  // accumulate; future acts stay hidden. The current act unlocks when its
  // context step is reached (CONTEXT_DONE_PHASES).
  const journalActs = getActs(tour);
  const currentActIndex = journalAct ? journalActs.findIndex((a) => a.id === journalAct.id) : -1;
  const currentActContextReached = CONTEXT_DONE_PHASES.has(session.currentPhase);
  // The bottom-right Context Journal is locked until the learner reaches their
  // first act's Context step naturally (`contextIntroSeen`). Non-context tours are
  // never locked. Once unlocked it stays open for the rest of the tour.
  const journalUnlocked = !isContext || !!session.contextIntroSeen;
  // The current act's guiding (framing) question only appears in the revisit
  // journal once that act's Context step has been reached naturally.
  const journalGuiding = currentActContextReached ? (journalAct?.guidingQuestion?.trim() || undefined) : undefined;
  const journalAuthored = currentActIndex < 0 ? [] : journalActs.flatMap((a, i) => {
    const goneThrough = i < currentActIndex || (i === currentActIndex && currentActContextReached);
    return goneThrough ? getActContexts(a).map((c) => authoredToEntry(c, tour.id)) : [];
  });
  const journalResponses = Object.entries(session.actResponses ?? {}).flatMap(([aid, r]) => {
    const refl = r?.reflection;
    if (!refl) return [];
    const a = getActs(tour).find((x) => x.id === aid);
    return [{ actTitle: a?.title ?? '', promptText: refl.promptText ?? '', text: refl.text }];
  });

  // One-time nudge: the first time the learner reaches a reflection, point out
  // that the Context Journal can be revisited anytime. Seen-state is per tour in
  // sessionStorage (matches the guest-contexts lifecycle).
  const [showJournalTip, setShowJournalTip] = useState(false);
  useEffect(() => {
    if (session.currentPhase !== 'act_reflection') return;
    const key = `provenance-revisit-tip:${tour.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* storage unavailable — just show it */ }
    const raf = requestAnimationFrame(() => setShowJournalTip(true));
    const t = setTimeout(() => setShowJournalTip(false), 9000);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [session.currentPhase, tour.id]);

  const openJournal = () => { if (!journalUnlocked) return; setShowJournalTip(false); setShowJournal(true); };

  return (
    <>
      <div
        className={`shrink-0 px-4 py-3 border-t flex items-center gap-3 ${isContext ? 'justify-between' : 'justify-center'}`}
        style={{ backgroundColor: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}
      >
        <div className="relative shrink-0">
          <button
            onClick={openJournal}
            disabled={!journalUnlocked}
            aria-label="Context Journal"
            title={journalUnlocked ? 'Context Journal' : 'Opens once you reach the Context Journal'}
            className={`relative flex items-center justify-center rounded-xl text-warm-white transition-colors border ${
              journalUnlocked
                ? 'bg-white/25 hover:bg-white/35 border-white/50'
                : 'bg-white/10 border-white/25 opacity-45 cursor-not-allowed'
            } ${isContext ? 'w-11 h-11' : 'gap-2 px-5 py-3.5 text-base font-semibold'}`}
            style={{ boxShadow: journalUnlocked ? '0 3px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' : 'none' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            {!isContext && 'Context Journal'}
            {/* lock badge until it's unlocked */}
            {!journalUnlocked && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-warm-white text-journal flex items-center justify-center shadow" aria-hidden>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
            )}
          </button>
          {showJournalTip && <RevisitTip onDismiss={() => setShowJournalTip(false)} />}
        </div>

        {/* Current Act (context mode) — sits next to Journal: number on top,
            title in italics below, truncated so it always fits. */}
        {actNumLabel && (
          <div
            className="flex-1 min-w-0 text-center leading-tight"
            style={{ color: 'var(--cream, #FFF8EE)' }}
            title={actTitleText ? `${actNumLabel}: ${actTitleText}` : actNumLabel}
          >
            <div className="uppercase tracking-[0.14em] opacity-80" style={{ fontSize: 11 }}>{actNumLabel}</div>
            {actTitleText && <GuidingBanner text={actTitleText} />}
          </div>
        )}
        {showInquiries && (
        <button
          data-inquiries-button
          onClick={() => setShowQuestionInput(true)}
          className="relative flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-base font-semibold text-warm-white bg-white/25 hover:bg-white/35 transition-colors border border-white/50"
          style={{ boxShadow: '0 3px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' }}
          title="Ask a question"
        >
          <span className="text-xl leading-none font-bold">?</span>
          Inquiries
          {pointAtQuestion && (
            <span className="absolute left-1/2 bottom-full mb-1.5 -translate-x-1/2 pointer-events-none">
              <svg
                className="animate-bounce"
                width="46"
                height="46"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--th-secondary)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))' }}
              >
                <line x1="12" y1="3" x2="12" y2="17" />
                <polyline points="5 11 12 18 19 11" />
              </svg>
            </span>
          )}
        </button>
        )}
      </div>

      {/* Group / room indicator — only mounted while a room is active.
          Sits below the main footer row (pushing the Journal / ? / Auto
          buttons up) so the code is visible at arm's length without
          competing with the primary actions. Tap to open the room menu
          (members, leave, kick). */}
      {isInRoom && room && (
        <button
          onClick={() => setShowRoomMenu(true)}
          className="shrink-0 w-full px-4 py-3 flex items-center justify-center gap-2 text-warm-white"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--th-primary) 70%, black)',
            borderTop: '1px solid color-mix(in srgb, var(--th-primary) 50%, black)',
          }}
        >
          <span className="text-[12px] uppercase tracking-[0.18em] opacity-85">Group</span>
          <span className="text-[22px] font-display font-bold tracking-[0.1em]">{room.code}</span>
          <span className="text-[12px] uppercase tracking-[0.14em] opacity-85">· {room.members.length}</span>
        </button>
      )}

      {showQuestionInput && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowQuestionInput(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-lg bg-warm-white rounded-t-2xl shadow-2xl animate-slide-up flex flex-col"
            style={{ height: '50vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--th-border)' }}>
              <h3 className="text-base font-semibold text-text-primary">Ask a question</h3>
              <button
                data-question-close
                onClick={() => setShowQuestionInput(false)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:bg-sandstone-light/30 text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <QuestionInputPanel onSubmit={() => setShowQuestionInput(false)} />
            </div>
          </div>
        </div>
      )}

      {showRoomMenu && <RoomMenu onDismiss={() => setShowRoomMenu(false)} />}

      {/* Context Journal revisit overlay — guest-backed, closeable, no gate. */}
      {showJournal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[60]">
          <ContextJournal
            tourId={tour.id}
            authored={journalAuthored}
            revisit
            onExit={() => setShowJournal(false)}
            responses={journalResponses}
            guidingQuestion={journalGuiding}
            viewedContextIds={(session.viewedContexts || []).map((v) => v.contextId)}
            onContextViewed={recordContextViewed}
          />
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * A one-time speech bubble above the Context Journal button, nudging the learner
 * that they can reopen it anytime. Tap to dismiss (also auto-dismisses).
 */
function RevisitTip({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      className="absolute left-0 bottom-full mb-3 z-10 w-[19rem] max-w-[80vw] text-left rounded-2xl bg-warm-white px-5 py-4 shadow-2xl"
      style={{ border: '1px solid var(--th-border)' }}
    >
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full text-text-secondary hover:bg-black/5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <span className="block text-[16px] font-bold leading-snug text-text-primary pr-7">
        Revisit the Context Journal anytime
      </span>
      <span className="mt-1 block text-[14px] leading-snug text-text-secondary">
        Everything you add stays here for the rest of the tour.
      </span>
      {/* little arrow pointing down at the button */}
      <span
        className="absolute left-6 top-full -mt-2 w-3.5 h-3.5 rotate-45 bg-warm-white"
        style={{ borderRight: '1px solid var(--th-border)', borderBottom: '1px solid var(--th-border)' }}
      />
    </motion.div>
  );
}

/**
 * The act's guiding question in the footer — big, single-line. If it overspills,
 * it scrolls like a banner (a couple of passes) then settles truncated with "…".
 * Tapping replays the scroll so it can be read again.
 */
function GuidingBanner({ text }: { text: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const controls = useAnimationControls();
  const [overflow, setOverflow] = useState(0);
  // Start un-settled so the first measure reads the full (non-truncated) width.
  const [settled, setSettled] = useState(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    const measure = () => {
      const c = containerRef.current, t = textRef.current;
      if (!c || !t) return;
      const ov = t.scrollWidth - c.clientWidth;
      setOverflow(ov > 4 ? ov : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);

  const runMarquee = useCallback(async () => {
    const myId = ++runIdRef.current;
    if (overflow <= 0) { setSettled(true); return; }
    setSettled(false);
    const dur = Math.max(2.2, overflow / 40);
    for (let i = 0; i < 2; i++) {
      await controls.start({ x: -overflow, transition: { duration: dur, ease: 'linear' } });
      if (runIdRef.current !== myId) return;
      await controls.start({ x: 0, transition: { duration: dur, ease: 'linear' } });
      if (runIdRef.current !== myId) return;
    }
    setSettled(true);
  }, [overflow, controls]);

  useEffect(() => {
    const id = requestAnimationFrame(() => { void runMarquee(); });
    return () => cancelAnimationFrame(id);
  }, [runMarquee]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden ${overflow > 0 ? 'text-left' : 'text-center'}`}
      onClick={() => { if (settled) runMarquee(); }}
    >
      <motion.span
        ref={textRef}
        animate={controls}
        className={`font-display font-bold ${settled ? 'block truncate' : 'inline-block whitespace-nowrap'}`}
        style={{ fontSize: 19 }}
      >
        {text}
      </motion.span>
    </div>
  );
}

function QuestionInputPanel({ onSubmit }: { onSubmit: () => void }) {
  const { tour, session, bankQuestion, currentStop } = useTour();
  const [question, setQuestion] = useState('');
  const [added, setAdded] = useState(false);

  const handleAdd = () => {
    if (!question.trim() || !tour || !session) return;
    bankQuestion({
      id: `bq_${Date.now().toString(36)}`,
      tourId: tour.id,
      sessionId: session.id,
      questionText: question.trim(),
      askedAfterStopId: currentStop?.id || 'unknown',
      aiResponse: 'banked',
      timestamp: new Date().toISOString(),
    });
    setQuestion('');
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary leading-relaxed">
        Something specific or an open-ended question to be posed to the community.
      </p>
      <div className="flex gap-2">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What are you curious about?"
          rows={3}
          className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[18px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
        />
        <MicButton onTranscript={(t) => setQuestion((prev) => prev ? prev + ' ' + t : t)} />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAdd}
          disabled={!question.trim()}
          className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white disabled:opacity-30"
        >
          {added ? '✓ Added' : 'Add question'}
        </button>
        <button
          onClick={onSubmit}
          className="px-4 py-3 rounded-lg text-base font-semibold text-text-secondary border border-sandstone-light"
        >
          Done
        </button>
      </div>
    </div>
  );
}
