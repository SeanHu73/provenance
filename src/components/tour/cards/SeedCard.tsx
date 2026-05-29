'use client';

/**
 * Combined Background + Look Around card.
 *
 * When the stop has notice content (prompt / audio / indoor map / photos),
 * Background and Look Around are split into two `scroll-snap` sections —
 * each `min-h-screen`, the second one starting hidden and revealing with
 * a short haptic + fade after the IntersectionObserver detects it
 * entering the viewport. When the stop has no notice content the card
 * falls back to a single non-snap layout with the Continue button at the
 * bottom (no point forcing a snap with only one section).
 */

import { useState, useEffect, useRef } from 'react';
import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import BackButton from './BackButton';
import NoticeMapDisplay from './NoticeMapDisplay';
import SnapScrollHint from './SnapScrollHint';
import ActionTitle from './ActionTitle';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  stop: Stop;
  onContinue: () => void;
  /** Optional handler for the "find me on the map" button on the
   *  Look Around section. Visible only when the stop has a location. */
  onPeekMap?: () => void;
}

const REVEAL_DELAY_MS = 400;
const REVEAL_TRANSITION_MS = 400;

export default function SeedCard({ stop, onContinue, onPeekMap }: Props) {
  const [autoplayPref] = useAudioAutoplay();
  const seedAutoplay = autoplayPref && !stop.seed.audioAutoplayDisabled;
  // When both seed and notice audio are present on this combined screen,
  // suppress notice autoplay so the two streams don't play in parallel.
  const noticeAutoplay = autoplayPref && !stop.notice.audioAutoplayDisabled && !stop.seed.audioUrl;

  const hasNoticeSection = !!(
    stop.notice.prompt
    || stop.notice.audioUrl
    || stop.notice.noticeMap?.url
    || (stop.notice.photos && stop.notice.photos.length > 0)
    || stop.notice.photoUrl
  );

  // Use the notice timer as the primary timer
  const noticeTimer = stop.notice.timerSeconds || 0;
  const seedTimer = stop.seed.timerSeconds ?? null;
  const totalTimer = seedTimer ?? (noticeTimer > 0 ? noticeTimer : null);

  const [secondsLeft, setSecondsLeft] = useState(totalTimer);
  const timerActive = totalTimer !== null && totalTimer > 0;
  const timerDone = !timerActive || (secondsLeft !== null && secondsLeft <= 0);

  useEffect(() => {
    if (!timerActive || timerDone) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max((s ?? 0) - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timerDone]);

  // SVG ring for the timer
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = timerDone || !totalTimer ? 0 : ((secondsLeft ?? 0) / totalTimer) * circumference;

  // Reveal state for the Look Around section — fires haptic + fade in
  // when the section first scrolls into view.
  const noticeRef = useRef<HTMLElement | null>(null);
  const [noticeRevealed, setNoticeRevealed] = useState(false);

  useEffect(() => {
    if (!hasNoticeSection || noticeRevealed) return;
    const el = noticeRef.current;
    if (!el) return;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(10);
            }
            timeoutId = setTimeout(() => setNoticeRevealed(true), REVEAL_DELAY_MS);
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
  }, [hasNoticeSection, noticeRevealed]);

  // Background block (shared across snap and non-snap layouts)
  const backgroundBlock = (
    <>
      <ActionTitle action="LEARN" />
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-accent-dark font-semibold">
        Background...
      </p>
      {stop.seed.audioUrl && <AudioButton audioUrl={stop.seed.audioUrl} title={stop.seed.audioTitle} autoplay={seedAutoplay} />}
      {stop.seed.text ? (
        <PhotoContent
          text={stop.seed.text}
          photos={stop.seed.photos || []}
          legacyPhotoUrl={stop.seed.photoUrl}
          legacyPhotoCaption={stop.seed.photoCaption}
        />
      ) : !stop.seed.audioUrl && (
        <p className="text-base text-text-secondary italic">Take a moment to look around this spot.</p>
      )}
    </>
  );

  // Look Around block (only when hasNoticeSection)
  const lookAroundBlock = (
    <>
      <ActionTitle action="FIND" />
      {onPeekMap && stop.location && (
        <div>
          <button
            onClick={onPeekMap}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-wider"
            style={{
              color: 'var(--th-primary)',
              border: '1px solid var(--th-primary)',
              backgroundColor: 'color-mix(in srgb, var(--th-primary) 6%, transparent)',
            }}
            title="Find this stop on the map"
            aria-label="Find this stop on the map"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-7.5-7-13a7 7 0 0 1 14 0c0 5.5-7 13-7 13z" />
              <circle cx="12" cy="9" r="2" fill="currentColor" stroke="none" />
            </svg>
            Find pin
          </button>
        </div>
      )}
      {stop.notice.audioUrl && <AudioButton audioUrl={stop.notice.audioUrl} title={stop.notice.audioTitle} autoplay={noticeAutoplay} />}
      {stop.notice.noticeMap && stop.notice.noticeMap.url && (
        <NoticeMapDisplay map={stop.notice.noticeMap} />
      )}
      {(stop.notice.prompt || (stop.notice.photos && stop.notice.photos.length > 0) || stop.notice.photoUrl) && (
        <PhotoContent
          text={stop.notice.prompt}
          photos={stop.notice.photos || []}
          legacyPhotoUrl={stop.notice.photoUrl}
          legacyPhotoCaption={stop.notice.photoCaption}
          textClass="text-[23px] leading-relaxed font-serif text-text-primary"
        />
      )}
    </>
  );

  // Timer + continue/back row (always present)
  const footerBlock = (
    <>
      {timerActive && (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--th-border)" strokeWidth="3" />
              <circle
                cx="32" cy="32" r={radius} fill="none" stroke="var(--th-accent-dark)" strokeWidth="3"
                strokeLinecap="round" strokeDasharray={circumference}
                strokeDashoffset={circumference - progress}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-accent-dark">
              {secondsLeft}
            </span>
          </div>
          <p className="text-xs text-text-secondary">
            {timerDone ? 'Ready when you are' : 'Take a moment...'}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className={`flex-1 py-3 rounded-lg text-base font-semibold transition-all ${
            timerDone ? 'bg-accent-dark text-white' : 'bg-accent-dark/20 text-accent-dark'
          }`}
        >
          We&apos;ve looked &mdash; continue
        </button>
      </div>
    </>
  );

  // Single-section fallback when there's no notice content — keeps the
  // original centred layout, no snap.
  if (!hasNoticeSection) {
    return (
      <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
        {backgroundBlock}
        {footerBlock}
      </div>
    );
  }

  // Two-section snap layout. SeedCard's outer is the actual scroll
  // container, sized exactly to the parent card frame via absolute
  // positioning — so each `h-full` section is exactly the height of the
  // visible card area (no overshoot like min-h-screen produced) and a
  // snap lands the next section's top at the viewport top with content
  // centred in it.
  return (
    <div
      className="animate-fade-in absolute inset-0 overflow-y-auto"
      style={{ scrollSnapType: 'y mandatory' }}
    >
      {/* `min-h-full` (not `h-full`) lets each section grow when content
          overflows the visible area; otherwise centred content would be
          pushed above the viewport top and snap would yank the user
          back. With min-h-full, short content sits centred in the
          visible area, and long content fills + grows the section so
          the top edge of the text lands at the top of the viewport
          after the snap. Side padding restores the visual margin we
          lost when SeedCard's outer started overlapping the card
          frame's padding box. */}
      <section
        className="relative min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
      >
        {backgroundBlock}
        <SnapScrollHint />
      </section>

      <section
        ref={noticeRef}
        className="min-h-full flex flex-col justify-center space-y-5 px-5 pt-10 pb-6"
        style={{
          scrollSnapAlign: 'start',
          scrollSnapStop: 'always',
          opacity: noticeRevealed ? 1 : 0,
          transform: noticeRevealed ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity ${REVEAL_TRANSITION_MS}ms ease-out, transform ${REVEAL_TRANSITION_MS}ms ease-out`,
        }}
      >
        {lookAroundBlock}
        {footerBlock}
      </section>
    </div>
  );
}
