'use client';

/**
 * Tour introduction screens — onboarding sequence shown before any
 * stop screens. Seven screens total:
 *
 *   0 Set Up           — solo or group; group lobby flow
 *   1 Welcome          — brand framing
 *   2 How it works     — interactive map mockup with spotlight pin
 *                        and a mocked journal-peek overlay (group
 *                        mode shows host vs non-host messaging and a
 *                        mocked "I'm in" step for the participant)
 *   3 What you do      — DISCUSS / LEARN / FIND / RESPOND teaser with
 *                        tap-to-reveal sections that snap-scroll
 *   4 Your thinking    — Inquiries spotlight tutorial
 *   5 Audio            — autoplay choice + Auto-button spotlight
 *   6 One last thing   — closing reminder
 *
 * Spotlight callouts query the real footer / modal buttons by data
 * attribute via SpotlightOverlay, so the explorer is interacting with
 * the same elements they'll use during the tour.
 */

import { useEffect, useRef, useState } from 'react';
import { Tour } from '@/lib/types';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useTour } from '@/context/TourContext';
import { useRoom } from '@/context/RoomContext';
import RoomEntrySheet from '@/components/room/RoomEntrySheet';
import SpotlightOverlay from './SpotlightOverlay';
import IntroMapMockup from './IntroMapMockup';

interface Props {
  tour: Tour;
  onComplete: () => void;
  /** No longer used (the Inquiries cue is now built into the Your
   *  Thinking screen as a full spotlight) but kept to preserve the
   *  callback contract with TourFooter. */
  onPointAtQuestion?: (show: boolean) => void;
  onPointAtAutoplay?: (show: boolean) => void;
}

const TITLES = [
  'Set Up',
  'Welcome',
  'How it works',
  'What you do',
  'Your thinking matters',
  'Audio',
  'One last thing',
];
const SETUP_INDEX = 0;
const HOWITWORKS_INDEX = 2;
const WHATYOUDO_INDEX = 3;
const THINKING_INDEX = 4;
const AUDIO_INDEX = 5;
const LASTTHING_INDEX = 6;
const TOTAL = TITLES.length;

const bodyClass = 'text-[24px] leading-relaxed font-serif text-text-primary animate-fade-in';

export default function IntroScreens({ tour, onComplete, onPointAtQuestion, onPointAtAutoplay }: Props) {
  const [current, setCurrent] = useState(0);
  const [phoneSetup, setPhoneSetup] = useState<'me' | 'everyone' | null>(null);
  const [autoplayChoice, setAutoplayChoice] = useState<'on' | 'off' | null>(null);
  const [, setAutoplayPref] = useAudioAutoplay();
  const [roomSheet, setRoomSheet] = useState<'host' | 'join' | null>(null);
  const { session } = useTour();
  const { room, isHost } = useRoom();
  const isLast = current === TOTAL - 1;
  const inRoom = !!room;

  const setupComplete =
    phoneSetup !== null
    && (phoneSetup === 'me' || (inRoom && !!room?.started));
  const audioComplete = autoplayChoice !== null;
  const canAdvance =
    (current !== SETUP_INDEX || setupComplete)
    && (current !== AUDIO_INDEX || audioComplete);

  useEffect(() => {
    if (current !== SETUP_INDEX) return;
    if (phoneSetup !== 'everyone') return;
    if (!room?.started) return;
    setCurrent(SETUP_INDEX + 1);
  }, [room?.started, phoneSetup, current]);

  // Hide legacy footer-pointer arrows — the new onboarding does its own
  // spotlight callouts, so just turn the old ones off.
  useEffect(() => {
    onPointAtQuestion?.(false);
    onPointAtAutoplay?.(false);
  }, [current, onPointAtQuestion, onPointAtAutoplay]);

  const pickAutoplay = (choice: 'on' | 'off') => {
    setAutoplayChoice(choice);
    setAutoplayPref(choice === 'on');
  };

  return (
    <div className="animate-fade-in flex flex-col justify-center min-h-full space-y-7 text-center">
      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {TITLES.map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ backgroundColor: i <= current ? 'var(--th-primary)' : 'var(--th-border)' }}
          />
        ))}
      </div>

      <div className="space-y-5 px-2" key={current}>
        {/* Title — suppressed on the action-title intro screen which
            substitutes a tap-revealed FIND/LEARN/DISCUSS sequence. */}
        {current !== WHATYOUDO_INDEX && (
          <p className="text-[28px] uppercase tracking-[0.14em] font-display text-accent-dark font-semibold animate-fade-in">
            {TITLES[current]}
          </p>
        )}

        {current === SETUP_INDEX && (
          <SetUpScreen
            phoneSetup={phoneSetup}
            setPhoneSetup={setPhoneSetup}
            inRoom={inRoom}
            onHost={() => setRoomSheet('host')}
            onJoin={() => setRoomSheet('join')}
          />
        )}

        {current === 1 && (
          <p className={bodyClass}>
            Learn to see the world like a historian! History is like detective work.
            What you notice and what you ask will shape how you reconstruct the past.
          </p>
        )}

        {current === HOWITWORKS_INDEX && (
          <HowItWorksScreen
            tour={tour}
            isInGroup={inRoom}
            isHost={isHost}
            onContinue={() => setCurrent(current + 1)}
          />
        )}

        {current === WHATYOUDO_INDEX && (
          <WhatYouDoScreen onAdvance={() => setCurrent(current + 1)} />
        )}

        {current === THINKING_INDEX && (
          <YourThinkingScreen onAdvance={() => setCurrent(current + 1)} />
        )}

        {current === AUDIO_INDEX && (
          <AudioScreen
            autoplayChoice={autoplayChoice}
            onPick={pickAutoplay}
          />
        )}

        {current === LASTTHING_INDEX && (
          <>
            <p className="text-[26px] font-semibold text-text-primary animate-fade-in">
              Don&apos;t forget to <strong className="uppercase tracking-wide">LOOK UP</strong>!
            </p>
            <p className={bodyClass}>
              This phone is just a guide to help you <strong>see more</strong> and{' '}
              <strong>think together</strong>. The real experience is the place you&apos;re standing in.
            </p>
          </>
        )}
      </div>

      {/* Navigation — hidden on screens that own their own advance flow. */}
      {current !== HOWITWORKS_INDEX
        && current !== WHATYOUDO_INDEX
        && current !== THINKING_INDEX && (
        <div className="space-y-3">
          <button
            onClick={isLast ? onComplete : () => setCurrent(current + 1)}
            disabled={!canAdvance}
            className="w-full py-3.5 rounded-lg text-[18px] font-semibold bg-aged-gold text-white transition-opacity disabled:opacity-40"
          >
            {isLast ? 'Begin' : 'Next'}
          </button>
          {!isLast && (
            <button
              onClick={onComplete}
              className="text-xs text-text-secondary/50 hover:text-text-secondary transition-colors"
            >
              Skip introduction
            </button>
          )}
        </div>
      )}

      {roomSheet && session && (
        <RoomEntrySheet
          tour={tour}
          newSessionId={session.id}
          mode={roomSheet}
          onDismiss={() => setRoomSheet(null)}
        />
      )}
    </div>
  );
}

/* ─── Set Up ───────────────────────────────────────────────────── */

function SetUpScreen({
  phoneSetup,
  setPhoneSetup,
  inRoom,
  onHost,
  onJoin,
}: {
  phoneSetup: 'me' | 'everyone' | null;
  setPhoneSetup: (p: 'me' | 'everyone') => void;
  inRoom: boolean;
  onHost: () => void;
  onJoin: () => void;
}) {
  return (
    <>
      <p className={bodyClass}>
        For <strong>best experience</strong>, we suggest everyone use their own devices.
      </p>
      <p className="text-[22px] font-semibold text-text-primary">
        Who has a phone?
      </p>
      <div className="flex gap-3 justify-center">
        {(['me', 'everyone'] as const).map((opt) => {
          const selected = phoneSetup === opt;
          return (
            <button
              key={opt}
              onClick={() => setPhoneSetup(opt)}
              className="px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
              style={
                selected
                  ? { background: 'var(--th-primary)', color: 'var(--th-surface)', borderColor: 'var(--th-primary)' }
                  : { background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }
              }
            >
              {opt === 'me' ? 'Only Me' : 'Everyone'}
            </button>
          );
        })}
      </div>

      {phoneSetup === 'everyone' && !inRoom && (
        <div className="space-y-3 pt-3 animate-fade-in">
          <p className="text-[22px] font-semibold text-text-primary">
            Set up your group
          </p>
          <p className="text-[17px] text-text-secondary">
            Start a room and share the code, or join one your group already created.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={onHost}
              className="px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
              style={{ background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}
            >
              Host a group
            </button>
            <button
              onClick={onJoin}
              className="px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
              style={{ background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }}
            >
              Join a group
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ─── How it works ─────────────────────────────────────────────── */

type HowStep =
  | 'map-intro'        // "You will find pins on this map"
  | 'map-pin-spotlight' // darken + "Click on the pin"
  | 'peek-open'         // mocked journal peek
  | 'participant-waiting'; // group non-host clicked "Begin"; needs "I'm in" mocked

function HowItWorksScreen({
  tour,
  isInGroup,
  isHost,
  onContinue,
}: {
  tour: Tour;
  isInGroup: boolean;
  isHost: boolean;
  onContinue: () => void;
}) {
  const [step, setStep] = useState<HowStep>('map-intro');
  // Auto-spotlight after 3s.
  useEffect(() => {
    if (step !== 'map-intro') return;
    const t = setTimeout(() => setStep('map-pin-spotlight'), 3000);
    return () => clearTimeout(t);
  }, [step]);

  const hostCopy = 'You have control over where the group explores.';
  const guestCopy = 'You can see the pins, but require the host to start.';

  return (
    <div className="space-y-5">
      {step === 'map-intro' && (
        <p className={bodyClass}>You will find <strong>pins</strong> on this map.</p>
      )}
      {(step === 'map-pin-spotlight' || step === 'peek-open' || step === 'participant-waiting') && (
        <p className="text-[18px] text-text-secondary italic">
          The map shows tour stops as pins.
        </p>
      )}

      <IntroMapMockup
        tour={tour}
        onPinTap={() => {
          if (step === 'map-pin-spotlight') setStep('peek-open');
        }}
        pinLabel={step === 'map-pin-spotlight'}
      />

      {step === 'map-pin-spotlight' && (
        <SpotlightOverlay
          targetSelector="[data-onboard-map-pin]"
          dimOpacity={0.55}
          padding={14}
          message="Click on the pin to explore the stop!"
          onTargetTap={() => setStep('peek-open')}
        />
      )}

      {step === 'peek-open' && (
        <MockJournalPeek
          tour={tour}
          isInGroup={isInGroup}
          isHost={isHost}
          hostCopy={hostCopy}
          guestCopy={guestCopy}
          onBegin={() => {
            // Solo or host → go straight to the next intro screen.
            // Non-host in a group → mocked "Your friend has begun…" step.
            if (isInGroup && !isHost) {
              setStep('participant-waiting');
            } else {
              onContinue();
            }
          }}
        />
      )}

      {step === 'participant-waiting' && (
        <MockParticipantImIn onTap={onContinue} />
      )}
    </div>
  );
}

function MockJournalPeek({
  tour,
  isInGroup,
  isHost,
  hostCopy,
  guestCopy,
  onBegin,
}: {
  tour: Tour;
  isInGroup: boolean;
  isHost: boolean;
  hostCopy: string;
  guestCopy: string;
  onBegin: () => void;
}) {
  // Pull the first real stop from the tour so the peek displays
  // authentic content instead of "sample" placeholder text. Falls back
  // gracefully if the tour hasn't been authored yet.
  const stops = tour.unstructuredStops ?? tour.stops ?? [];
  const sample = stops[0];
  const stopTitle = sample?.title || 'Tour stop';
  const stopBlurb = (sample?.seed?.text || sample?.notice?.prompt || '')
    .replace(/\[photo:\s*\d*\s*\]/gi, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim()
    .slice(0, 220);

  return (
    <div className="rounded-2xl shadow-lg p-5 space-y-4 text-left animate-fade-in" style={{ backgroundColor: 'var(--th-surface)', border: '1px solid var(--th-border)' }}>
      <p className="text-[14px] uppercase tracking-[0.18em] font-display font-semibold" style={{ color: 'var(--th-primary)' }}>
        Stop 1
      </p>
      <p className="text-[20px] font-serif text-text-primary leading-snug font-semibold">
        {stopTitle}
      </p>
      {stopBlurb && (
        <p className="text-[15px] font-serif text-text-secondary leading-relaxed">
          {stopBlurb}{stopBlurb.length === 220 ? '…' : ''}
        </p>
      )}
      {isInGroup && (
        <p className="text-[15px] text-text-primary leading-relaxed italic border-t pt-3" style={{ borderColor: 'var(--th-border)' }}>
          {isHost ? hostCopy : guestCopy}
        </p>
      )}
      <button
        onClick={onBegin}
        disabled={isInGroup && !isHost}
        className="w-full py-3 rounded-lg text-[17px] font-semibold text-white disabled:opacity-40"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        Begin this stop
      </button>
      {isInGroup && !isHost && (
        <p className="text-[13px] text-center text-text-secondary italic">
          Only the host can begin a stop.
        </p>
      )}
    </div>
  );
}

function MockParticipantImIn({ onTap }: { onTap: () => void }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <p className="text-[18px] text-text-secondary italic">
        The host has begun the stop. Tap <strong>I&apos;m in</strong> so the group can move together.
      </p>
      <button
        onClick={onTap}
        className="w-full py-3.5 rounded-lg text-[18px] font-semibold text-white"
        style={{ backgroundColor: 'var(--th-primary)' }}
      >
        I&apos;m in — let&apos;s go
      </button>
    </div>
  );
}

/* ─── What you do (action-title teaser) ────────────────────────── */

type WhatStep = 'find' | 'learn-discuss' | 'develop';

const ACTION_DESCRIPTIONS: Record<'FIND' | 'LEARN' | 'DISCUSS', string> = {
  FIND: 'Look for something in the area.',
  LEARN: 'Read or listen to learn about that site.',
  DISCUSS: 'Talk through an interesting question with your friend!',
};

function WhatYouDoScreen({ onAdvance }: { onAdvance: () => void }) {
  const [step, setStep] = useState<WhatStep>('find');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const developRef = useRef<HTMLElement | null>(null);

  // Once the explorer has revealed LEARN/DISCUSS, the next tap snaps
  // to the Develop section. We programmatically scrollIntoView once
  // step flips to 'develop'.
  useEffect(() => {
    if (step !== 'develop') return;
    const el = developRef.current;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const advanceTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (step === 'find') setStep('learn-discuss');
    else if (step === 'learn-discuss') setStep('develop');
  };

  return (
    <div
      ref={scrollRef}
      className="absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {/* Section 1 — actions reveal sequence */}
      <section
        onClick={step === 'develop' ? undefined : advanceTap}
        className="relative min-h-full flex flex-col justify-center space-y-8 px-5 pt-10 pb-6 cursor-pointer select-none"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <div className="space-y-3">
          <p className="text-[24px] italic text-text-secondary">Each stop will have you</p>
          <ActionRow label="FIND" />
          <p className="text-[16px] text-text-primary">{ACTION_DESCRIPTIONS.FIND}</p>
        </div>

        {(step === 'learn-discuss' || step === 'develop') && (
          <div className="space-y-6 animate-fade-in">
            <p className="text-[24px] italic text-text-secondary">Then you will</p>
            <div className="space-y-2">
              <ActionRow label="LEARN" />
              <p className="text-[16px] text-text-primary">{ACTION_DESCRIPTIONS.LEARN}</p>
            </div>
            <p className="text-[24px] italic text-text-secondary text-center">or</p>
            <div className="space-y-2">
              <ActionRow label="DISCUSS" />
              <p className="text-[16px] text-text-primary">{ACTION_DESCRIPTIONS.DISCUSS}</p>
            </div>
          </div>
        )}

        {step !== 'develop' && (
          <p className="text-[14px] italic text-text-secondary animate-fade-in">
            Tap the screen to continue&hellip;
          </p>
        )}
      </section>

      {/* Section 2 — Develop your own historical explanation */}
      <section
        ref={developRef}
        className="min-h-full flex flex-col justify-center space-y-8 px-5 pt-10 pb-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        <p className="text-[30px] font-display font-bold leading-snug text-text-primary text-center">
          Develop your own historical explanation as you question and discuss together!
        </p>
        <button
          onClick={onAdvance}
          className="w-full py-3.5 rounded-lg text-[18px] font-semibold bg-aged-gold text-white"
        >
          Next
        </button>
      </section>
    </div>
  );
}

function ActionRow({ label }: { label: 'FIND' | 'LEARN' | 'DISCUSS' }) {
  return (
    <div className="flex items-end justify-between gap-3 px-2 py-1" style={{ color: 'var(--th-accent-dark)' }}>
      <h3 className="uppercase tracking-[0.12em] font-display font-bold leading-none" style={{ fontSize: 40 }}>
        {label}
      </h3>
      <ActionGlyph label={label} size={44} />
    </div>
  );
}

function ActionGlyph({ label, size }: { label: 'FIND' | 'LEARN' | 'DISCUSS'; size: number }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const,
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
  };
  if (label === 'FIND') return (
    <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  );
  if (label === 'LEARN') return (
    <svg {...common}>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z" />
    </svg>
  );
  return (
    <svg {...common}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-1.5A4.5 4.5 0 0 1 7.5 15h3A4.5 4.5 0 0 1 15 19.5V21" />
      <path d="M16 9a3 3 0 0 1 0 6" />
      <path d="M18.5 6a6 6 0 0 1 0 12" />
    </svg>
  );
}

/* ─── Your thinking matters ───────────────────────────────────── */

type ThinkingStep = 'intro' | 'together-tap' | 'inquiries-spotlight' | 'modal-spotlight';

function YourThinkingScreen({ onAdvance }: { onAdvance: () => void }) {
  const [step, setStep] = useState<ThinkingStep>('intro');
  const [modalOpen, setModalOpen] = useState(false);

  // Watch for the Inquiries modal close button appearing in the DOM —
  // that's how we know the user has tapped the spotlit Inquiries button
  // and the modal has mounted from TourFooter.
  useEffect(() => {
    if (step !== 'inquiries-spotlight') return;
    const interval = setInterval(() => {
      const el = document.querySelector('[data-question-close]');
      if (el) {
        setModalOpen(true);
        setStep('modal-spotlight');
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [step]);

  // When the user closes the modal, the close button disappears →
  // auto-advance.
  useEffect(() => {
    if (step !== 'modal-spotlight') return;
    const interval = setInterval(() => {
      const el = document.querySelector('[data-question-close]');
      if (!el) {
        setModalOpen(false);
        clearInterval(interval);
        onAdvance();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [step, onAdvance]);

  return (
    <div className="space-y-5">
      <p className={bodyClass}>
        Conversations are critical. We are reconstructing history together.
      </p>

      {step === 'intro' && (
        <button
          onClick={() => setStep('together-tap')}
          className="w-full py-3.5 rounded-lg text-[17px] font-semibold bg-aged-gold text-white"
        >
          Next
        </button>
      )}

      {(step === 'together-tap' || step === 'inquiries-spotlight' || step === 'modal-spotlight') && (
        <p className="text-[22px] font-display font-semibold text-text-primary animate-fade-in">
          Together, build on ideas or disagree!
        </p>
      )}

      {step === 'together-tap' && (
        <button
          onClick={() => setStep('inquiries-spotlight')}
          className="w-full py-3.5 rounded-lg text-[17px] font-semibold bg-aged-gold text-white"
        >
          Got it &mdash; next
        </button>
      )}

      {step === 'inquiries-spotlight' && !modalOpen && (
        <SpotlightOverlay
          targetSelector="[data-inquiries-button]"
          dimOpacity={0.78}
          padding={10}
          message={<ShareCallout />}
          arrow={<BouncingDownArrow />}
        />
      )}

      {step === 'modal-spotlight' && (
        // The Inquiries modal stays visible — no dim. Just a circle
        // around the close X so the explorer sees the input UI as it
        // really looks. They tap X to close, the close button leaves
        // the DOM, and we auto-advance.
        <SpotlightOverlay
          targetSelector="[data-question-close]"
          padding={6}
          circleTarget
          dim={false}
        />
      )}
    </div>
  );
}

function BouncingDownArrow() {
  return (
    <span className="block animate-bounce">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--th-surface)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.6))' }}>
        <line x1="12" y1="3" x2="12" y2="17" />
        <polyline points="5 11 12 18 19 11" />
      </svg>
    </span>
  );
}

function ShareCallout() {
  return (
    <div
      className="inline-block max-w-md text-left px-5 py-4 rounded-2xl border-2"
      style={{
        backgroundColor: 'var(--th-surface)',
        borderColor: 'var(--th-secondary)',
        color: 'var(--th-text-primary)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
      }}
    >
      <p className="text-[18px] font-display font-semibold leading-snug">
        <strong>SHARE</strong> to the community:
      </p>
      <p className="mt-1 text-[16px] font-serif leading-snug">
        If something makes you curious, or you have a good inquiry, tap here to share!
      </p>
    </div>
  );
}

/* ─── Audio ────────────────────────────────────────────────────── */

function AudioScreen({
  autoplayChoice,
  onPick,
}: {
  autoplayChoice: 'on' | 'off' | null;
  onPick: (c: 'on' | 'off') => void;
}) {
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [postChoice, setPostChoice] = useState(false);

  useEffect(() => {
    if (autoplayChoice !== null && !postChoice) {
      // Show the spotlight on the real Auto button immediately after pick.
      setShowSpotlight(true);
    }
  }, [autoplayChoice, postChoice]);

  return (
    <>
      <p className={bodyClass}>
        Some screens have narration. Should it play automatically?
      </p>
      <div className="flex gap-3 justify-center">
        {(['on', 'off'] as const).map((opt) => {
          const selected = autoplayChoice === opt;
          return (
            <button
              key={opt}
              onClick={() => onPick(opt)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors"
              style={
                selected
                  ? { background: 'var(--th-primary)', color: 'var(--th-surface)', borderColor: 'var(--th-primary)' }
                  : { background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' }
              }
            >
              {opt === 'on' ? 'Auto-play' : 'Tap to play'}
              <svg width="14" height="14" viewBox="0 0 24 24" fill={opt === 'on' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                <polygon points="6,4 20,12 6,20" />
              </svg>
            </button>
          );
        })}
      </div>

      {postChoice && (
        <div className="space-y-3 pt-3 animate-fade-in">
          <div className="flex items-start justify-center gap-3 px-3">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--th-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 14v-3a9 9 0 0 1 18 0v3" />
              <path d="M21 17a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2z" />
              <path d="M3 17a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2z" />
            </svg>
            <p className="text-[18px] leading-relaxed text-text-primary text-left">
              Use <strong>earphones</strong> if you can! Or <strong>read to each other</strong>.
              Be respectful indoors.
            </p>
          </div>
        </div>
      )}

      {showSpotlight && !postChoice && (
        <SpotlightOverlay
          targetSelector="[data-auto-button]"
          dimOpacity={0.78}
          padding={8}
          message={
            <span>
              You can <strong>toggle at anytime</strong>.<br />
              <span className="block text-[15px] italic mt-2 opacity-90">
                Tap anywhere else to continue.
              </span>
            </span>
          }
          onOutsideTap={() => {
            setShowSpotlight(false);
            setPostChoice(true);
          }}
        />
      )}
    </>
  );
}
