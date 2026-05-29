'use client';

import { useState } from 'react';
import { Tour, TourSession } from '@/lib/types';
import { useTour } from '@/context/TourContext';
import JournalOverlay from './JournalOverlay';
import MicButton from './MicButton';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useRoom } from '@/context/RoomContext';
import RoomMenu from '@/components/room/RoomMenu';

interface Props {
  tour: Tour;
  session: TourSession;
  /** When true, the onboarding "point at the ? button" arrow shows over the ? button. */
  pointAtQuestion?: boolean;
  /** When true, the bouncing arrow shows over the autoplay toggle so users
   *  who just made an autoplay choice in onboarding see they can change it. */
  pointAtAutoplay?: boolean;
}

/**
 * The Journal + Ask (?) bottom bar plus the overlays the two buttons open.
 * Shared between Journal.tsx (in-stop phases) and page.tsx (map, midway,
 * closing) so the footer stays visible across the whole active tour.
 */
export default function TourFooter({ tour, session, pointAtQuestion = false, pointAtAutoplay = false }: Props) {
  const [showJournal, setShowJournal] = useState(false);
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [autoplayPref, setAutoplayPref] = useAudioAutoplay();
  const { room, isInRoom } = useRoom();

  return (
    <>
      <div
        className="shrink-0 px-4 py-3 border-t flex items-center justify-center gap-3"
        style={{ backgroundColor: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}
      >
        <button
          onClick={() => setShowJournal(true)}
          className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-base font-semibold text-warm-white bg-white/25 hover:bg-white/35 transition-colors border border-white/50"
          style={{ boxShadow: '0 3px 10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          Journal
        </button>
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
        <button
          data-auto-button
          onClick={() => setAutoplayPref(!autoplayPref)}
          className={`relative flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] uppercase tracking-wider font-semibold transition-colors border ${
            autoplayPref
              ? 'bg-warm-white text-journal border-warm-white shadow'
              : 'text-warm-white/85 hover:text-warm-white bg-black/15 hover:bg-black/25 border-white/20'
          }`}
          title={autoplayPref ? 'Auto-play narration: on (tap to disable)' : 'Auto-play narration: off (tap to enable)'}
          aria-pressed={autoplayPref}
        >
          Auto
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={autoplayPref ? 'currentColor' : 'none'}
          >
            <polygon points="6,4 20,12 6,20" />
          </svg>
          {pointAtAutoplay && (
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

      {showJournal && (
        <JournalOverlay tour={tour} session={session} onClose={() => setShowJournal(false)} />
      )}

      {showRoomMenu && <RoomMenu onDismiss={() => setShowRoomMenu(false)} />}
    </>
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
