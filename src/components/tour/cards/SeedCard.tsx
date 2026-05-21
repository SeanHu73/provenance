'use client';

/**
 * Combined Background + Look Around card.
 * Shows the seed context at the top, then the notice observation
 * prompt with its timer below — all on one screen.
 */

import { useState, useEffect } from 'react';
import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import BackButton from './BackButton';

interface Props {
  stop: Stop;
  onContinue: () => void;
}

export default function SeedCard({ stop, onContinue }: Props) {
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

  return (
    <div className="animate-fade-in space-y-5 min-h-full flex flex-col justify-center">
      {/* Background section */}
      <p className="text-[26px] uppercase tracking-[0.14em] font-display text-accent-dark font-semibold">
        Background...
      </p>

      {/* Seed audio */}
      {stop.seed.audioUrl && <AudioButton audioUrl={stop.seed.audioUrl} title={stop.seed.audioTitle} />}

      {/* Seed text + photos */}
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

      {/* Divider */}
      {stop.notice.prompt && (
        <div className="border-t border-sandstone-light my-1" />
      )}

      {/* Look Around section */}
      {stop.notice.prompt && (
        <>
          <p className="text-[26px] uppercase tracking-[0.14em] font-display text-accent-dark font-semibold">
            Look around...
          </p>

          {/* Notice audio */}
          {stop.notice.audioUrl && <AudioButton audioUrl={stop.notice.audioUrl} title={stop.notice.audioTitle} />}

          {/* Notice prompt + photos */}
          <PhotoContent
            text={stop.notice.prompt}
            photos={stop.notice.photos || []}
            legacyPhotoUrl={stop.notice.photoUrl}
            legacyPhotoCaption={stop.notice.photoCaption}
            textClass="text-[23px] leading-relaxed font-serif text-text-primary"
          />
        </>
      )}

      {/* Timer */}
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

      {/* Continue + Back */}
      <div className="flex gap-2">
        <BackButton />
        <button
          onClick={onContinue}
          className={`flex-1 py-3 rounded-lg text-base font-semibold transition-all ${
            timerDone
              ? 'bg-accent-dark text-white'
              : 'bg-accent-dark/20 text-accent-dark'
          }`}
        >
          We&apos;ve looked &mdash; continue
        </button>
      </div>
    </div>
  );
}
