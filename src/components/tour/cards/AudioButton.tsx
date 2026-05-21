'use client';

/**
 * Audio player bar with timeline, play/pause, and optional title.
 * Sits below the card title. Shows progress bar that tracks playback.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  audioUrl: string;
  title?: string | null;
}

export default function AudioButton({ audioUrl, title }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => setDuration(audio.duration));
    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    });
    audio.addEventListener('ended', () => { setPlaying(false); setProgress(0); setCurrentTime(0); });

    return () => { audio.pause(); audio.src = ''; };
  }, [audioUrl]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing]);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  }, [duration]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="rounded-lg bg-sandstone border border-sandstone-light p-4 space-y-3">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            playing ? 'bg-aged-gold text-white' : 'bg-sandstone-light text-journal'
          }`}
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[18px] font-semibold text-text-primary truncate">
            {title || 'Audio narration'}
          </p>
          <p className="text-xs text-text-secondary">
            {formatTime(currentTime)} / {duration ? formatTime(duration) : '--:--'}
          </p>
        </div>
      </div>

      {/* Timeline bar */}
      <div
        className="h-2 bg-sandstone-light rounded-full cursor-pointer relative"
        onClick={seek}
      >
        <div
          className="h-full bg-aged-gold rounded-full transition-all duration-200"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-aged-gold border-2 border-white shadow"
          style={{ left: `${progress * 100}%`, transform: `translateX(-50%) translateY(-50%)` }}
        />
      </div>
    </div>
  );
}
