'use client';

import { useState, useEffect } from 'react';
import { Stop } from '@/lib/types';
import PhotoContent from './PhotoContent';
import AudioButton from './AudioButton';
import NoticeMapDisplay from './NoticeMapDisplay';
import ActionTitle from './ActionTitle';
import { useAudioAutoplay } from '@/lib/audio-autoplay';

interface Props {
  stop: Stop;
  onContinue: () => void;
}

export default function NoticeCard({ stop, onContinue }: Props) {
  const [autoplayPref] = useAudioAutoplay();
  const shouldAutoplay = autoplayPref && !stop.notice.audioAutoplayDisabled;
  const [secondsLeft, setSecondsLeft] = useState(stop.notice.timerSeconds);
  const timerDone = secondsLeft <= 0;

  useEffect(() => {
    if (timerDone) return;
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(s - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [timerDone]);

  // SVG ring progress
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const progress = timerDone ? 0 : (secondsLeft / stop.notice.timerSeconds) * circumference;

  return (
    <div className="animate-fade-in space-y-6 min-h-full flex flex-col justify-center">
      {/* Title */}
      <ActionTitle action="FIND" />

      {/* Audio player */}
      {stop.notice.audioUrl && <AudioButton audioUrl={stop.notice.audioUrl} title={stop.notice.audioTitle} autoplay={shouldAutoplay} />}

      {/* Indoor "where to go" map — only when the admin uploaded one */}
      {stop.notice.noticeMap && stop.notice.noticeMap.url && (
        <NoticeMapDisplay map={stop.notice.noticeMap} />
      )}

      {/* Prompt + photos interleaved via [photo:N] markers */}
      <PhotoContent
        text={stop.notice.prompt}
        photos={stop.notice.photos || []}
        legacyPhotoUrl={stop.notice.photoUrl}
        legacyPhotoCaption={stop.notice.photoCaption}
        textClass="text-[23px] leading-relaxed font-serif text-text-primary"
      />

      {/* Timer ring */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32" cy="32" r={radius}
              fill="none"
              stroke="var(--th-border)"
              strokeWidth="3"
            />
            <circle
              cx="32" cy="32" r={radius}
              fill="none"
              stroke="var(--th-accent-dark)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-accent-dark">
            {secondsLeft}
          </span>
        </div>
        <p className="text-xs text-text-secondary">
          {timerDone ? 'Time’s up — ready when you are' : 'Look together...'}
        </p>
      </div>

      {/* Continue */}
      <button
        onClick={onContinue}
        className={`w-full py-3 rounded-lg text-base font-semibold transition-all ${
          timerDone
            ? 'bg-accent-dark text-white'
            : 'bg-accent-dark/20 text-accent-dark'
        }`}
      >
        We&apos;ve looked &mdash; continue
      </button>
    </div>
  );
}
