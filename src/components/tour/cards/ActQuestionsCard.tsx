'use client';

/**
 * Context-Prototype — the per-act wrap-up question screen, shown after each
 * act's closing question. A two-section snap-scroll: a prompt panel cues a
 * scroll down to "Any Remaining Questions", where the explorer can record or
 * type something else they're curious about. Anything entered is banked.
 */

import { useEffect, useRef, useState } from 'react';
import { useTour } from '@/context/TourContext';
import BackButton from './BackButton';
import ResponseInput from './ResponseInput';
import SnapScrollHint from './SnapScrollHint';
import { SectionSubtitle } from './ActionTitle';

interface Props {
  onComplete: () => void;
}

const REVEAL_DELAY_MS = 200;
const REVEAL_TRANSITION_MS = 250;

export default function ActQuestionsCard({ onComplete }: Props) {
  const { tour, session, currentStop, bankQuestion } = useTour();
  const [text, setText] = useState('');
  const formSectionRef = useRef<HTMLElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (revealed) return;
    const el = formSectionRef.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(10);
            timeoutId = setTimeout(() => setRevealed(true), REVEAL_DELAY_MS);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => { obs.disconnect(); if (timeoutId) clearTimeout(timeoutId); };
  }, [revealed]);

  const submit = () => {
    const q = text.trim();
    if (q && tour && session) {
      bankQuestion({
        id: `bq_${Date.now().toString(36)}`,
        tourId: tour.id,
        sessionId: session.id,
        questionText: q,
        askedAfterStopId: currentStop?.id || 'unknown',
        aiResponse: 'banked',
        timestamp: new Date().toISOString(),
      });
    }
    onComplete();
  };

  return (
    <div className="animate-fade-in absolute inset-0 overflow-y-auto" style={{ scrollSnapType: 'y mandatory' }}>
      <section
        className="relative min-h-full flex flex-col justify-center space-y-4 px-5 pt-10 pb-6 text-center"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p className="font-display font-bold leading-tight text-text-primary" style={{ fontSize: 'clamp(24px, 6vw, 34px)' }}>
          Before we wrap up this act…
        </p>
        <p className="text-[20px] leading-relaxed text-text-secondary">
          Is there anything else this tour has prompted you to ask? What else are you curious about?
        </p>
        <SnapScrollHint />
      </section>

      <section
        ref={formSectionRef}
        className="min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease-out, transform ${REVEAL_TRANSITION_MS}ms ease-out`,
        }}
      >
        <SectionSubtitle>Any Remaining Questions</SectionSubtitle>
        <ResponseInput value={text} onChange={setText} placeholder="What are you curious about?" />
        <div className="flex gap-2">
          <BackButton />
          <button onClick={submit} className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white">
            Continue
          </button>
        </div>
      </section>
    </div>
  );
}
