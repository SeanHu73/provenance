'use client';

/**
 * Essential Question — Combined closing screen (snap-scroll redesign).
 *
 *   Section 1 — "Tour complete" + admin-authored closing framing +
 *     closing audio + a button that opens the Journal on the Your
 *     Theory tab so the explorer can re-read their opening answers
 *     before drafting their closing ones. That journal mount has a
 *     "Return when ready" button that returns them to this card.
 *   Section 2 — every closing question (the main EQ + each
 *     additionalClosingQuestion) listed under one "Closing questions"
 *     heading, each with its own response textbox + mic. After
 *     submission, the state machine advances to eq_questions ("Any
 *     remaining questions?"). "Where are you now?" is gone; the
 *     sliders / chip-set page has been removed from the flow.
 */

import { useEffect, useRef, useState } from 'react';
import { Tour, TourSession } from '@/lib/types';
import BackButton from './BackButton';
import MicButton from '../MicButton';
import FormattedText from './FormattedText';
import AudioButton from './AudioButton';
import QuestionText from './QuestionText';
import SnapScrollHint from './SnapScrollHint';
import JournalOverlay from '../JournalOverlay';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  tour: Tour;
  session: TourSession;
  onComplete: (finalReflection: string, finalReasoning: string, additionalClosingResponses: string[]) => void;
}

const REVEAL_DELAY_MS = 400;
const REVEAL_TRANSITION_MS = 400;

export default function EqClosingCard({ tour, session, onComplete }: Props) {
  const eq = tour.essentialQuestion!;
  const additionalQuestions = eq.additionalClosingQuestions ?? [];
  const [autoplayPref] = useAudioAutoplay();
  const shouldAutoplay = autoplayPref && !eq.closingAudioAutoplayDisabled;

  // Per-question response state — main reflection + reasoning, then one
  // entry per additionalClosingQuestions[].
  const [reflection, setReflection] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [additionalResponses, setAdditionalResponses] = useState<string[]>(
    () => additionalQuestions.map(() => ''),
  );

  const updateAdditional = (i: number, value: string) => {
    setAdditionalResponses((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  // Journal-peek state: when the explorer clicks the section-1 button,
  // mount a JournalOverlay with closingPeek=true. The overlay opens on
  // the Your Theory tab and shows a "Return when ready" bottom button
  // that closes it.
  const [journalOpen, setJournalOpen] = useState(false);

  // Snap-scroll reveal: section 2 starts dimmed + offset until the
  // explorer has scrolled past section 1. After they tap "Open your
  // theory journal" we also auto-scroll to section 2 on close so they
  // land on the closing-questions section seamlessly.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const section2Ref = useRef<HTMLElement | null>(null);
  const [section2Revealed, setSection2Revealed] = useState(false);

  useEffect(() => {
    if (section2Revealed) return;
    const el = section2Ref.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(10);
            }
            timeoutId = setTimeout(() => setSection2Revealed(true), REVEAL_DELAY_MS);
            obs.disconnect();
            return;
          }
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [section2Revealed]);

  const handleJournalClose = () => {
    setJournalOpen(false);
    // Auto-scroll into section 2 so they don't have to find it.
    const c = scrollContainerRef.current;
    const s2 = section2Ref.current;
    if (c && s2) {
      c.scrollTo({ top: s2.offsetTop, behavior: 'smooth' });
    }
  };

  const submitDisabled = !reflection.trim();
  const handleSubmit = () => {
    if (submitDisabled) return;
    onComplete(
      reflection.trim(),
      reasoning.trim(),
      additionalResponses.map((r) => r.trim()),
    );
  };

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="animate-fade-in absolute inset-0 overflow-y-auto"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {/* Section 1 — Tour Complete + closing framing + audio + journal peek */}
        <section
          className="relative min-h-full flex flex-col justify-center space-y-6 px-5 pt-10 pb-6"
          style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
        >
          <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
            Tour complete
          </p>
          {eq.closingFraming && (
            <p className="text-[19px] leading-relaxed font-serif text-text-primary">
              <FormattedText text={eq.closingFraming} />
            </p>
          )}
          {eq.closingAudioUrl && (
            <AudioButton audioUrl={eq.closingAudioUrl} title={eq.closingAudioTitle} autoplay={shouldAutoplay} />
          )}
          <button
            onClick={() => setJournalOpen(true)}
            className="w-full py-3 rounded-lg text-base font-semibold text-warm-white"
            style={{ backgroundColor: 'var(--th-primary)' }}
          >
            Open your theory journal
          </button>
          <p className="text-[13px] text-text-secondary text-center -mt-2">
            Re-read what you wrote at the start, then return when you&apos;re ready.
          </p>
          <SnapScrollHint />
        </section>

        {/* Section 2 — every closing question + its own response box */}
        <section
          ref={section2Ref}
          className="min-h-full flex flex-col justify-center space-y-6 px-5 pt-10 pb-6"
          style={{
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            opacity: section2Revealed ? 1 : 0,
            transform: section2Revealed ? 'translateY(0)' : 'translateY(20px)',
            transition: `opacity ${REVEAL_TRANSITION_MS}ms ease-out, transform ${REVEAL_TRANSITION_MS}ms ease-out`,
          }}
        >
          <p className="text-[26px] uppercase tracking-[0.14em] font-display text-aged-gold font-semibold">
            Closing questions
          </p>

          {/* Main EQ closing question */}
          <div className="space-y-3">
            <QuestionText text={eq.question} sizeClass="text-[26px]" />
            <div className="space-y-2">
              {eq.finalReflectionPrompt && (
                <p className="text-[15px] font-semibold text-text-primary">
                  {eq.finalReflectionPrompt}
                </p>
              )}
              <div className="flex gap-2">
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  placeholder={eq.finalReflectionPlaceholder}
                  rows={4}
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
                />
                <MicButton onTranscript={(t) => setReflection((prev) => prev ? prev + ' ' + t : t)} />
              </div>
            </div>
            {eq.finalReasoningPrompt && (
              <div className="space-y-2">
                <p className="text-[15px] font-semibold text-text-primary">
                  {eq.finalReasoningPrompt}
                </p>
                <div className="flex gap-2">
                  <textarea
                    value={reasoning}
                    onChange={(e) => setReasoning(e.target.value)}
                    placeholder={eq.finalReasoningPlaceholder}
                    rows={3}
                    className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[18px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
                  />
                  <MicButton onTranscript={(t) => setReasoning((prev) => prev ? prev + ' ' + t : t)} />
                </div>
              </div>
            )}
          </div>

          {/* Additional closing questions — each its own textbox */}
          {additionalQuestions.map((q, i) => (
            <div key={i} className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--th-border)' }}>
              <QuestionText text={q.question} sizeClass="text-[24px]" />
              <div className="flex gap-2">
                <textarea
                  value={additionalResponses[i] ?? ''}
                  onChange={(e) => updateAdditional(i, e.target.value)}
                  placeholder="Your thoughts..."
                  rows={3}
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[18px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
                />
                <MicButton onTranscript={(t) => updateAdditional(i, (additionalResponses[i] ?? '') ? (additionalResponses[i] ?? '') + ' ' + t : t)} />
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <BackButton />
            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="flex-1 py-3 rounded-lg text-base font-semibold bg-olive text-white disabled:opacity-30"
            >
              Continue
            </button>
          </div>
        </section>
      </div>

      {journalOpen && (
        <JournalOverlay
          tour={tour}
          session={session}
          onClose={handleJournalClose}
          closingPeek
        />
      )}
    </>
  );
}
