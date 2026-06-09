'use client';

/**
 * Audio-synced photo highlighting. Given a phase's cues + photos, returns
 * `onTimeUpdate` / `onEnded` handlers to feed AudioButton and the
 * `highlightedUrl` of the photo that should glow right now (the last cue whose
 * time has passed). A gentle one-shot haptic fires when the highlight changes.
 *
 * By default the highlight clears when the audio ends. When `holdLast` is
 * true the last cued photo stays highlighted after the audio finishes.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { PhotoCue, StopPhoto } from '@/lib/types';

export function usePhotoCues(cues: PhotoCue[] | undefined, photos: StopPhoto[] | undefined, holdLast = false) {
  const [audioTime, setAudioTime] = useState(0);
  const [ended, setEnded] = useState(false);

  const onTimeUpdate = useCallback((t: number) => { setAudioTime(t); setEnded(false); }, []);
  const onEnded = useCallback(() => setEnded(true), []);

  const sorted = (cues || []).slice().sort((a, b) => a.time - b.time);
  const active = [...sorted].reverse().find((c) => audioTime >= c.time);
  // When the audio has ended and we're not holding the last photo, clear it.
  const shown = (ended && !holdLast) ? undefined : active;
  const highlightedUrl = shown ? ((photos || [])[shown.photoIndex]?.url ?? null) : null;

  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (highlightedUrl && highlightedUrl !== prev.current) {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(15);
    }
    prev.current = highlightedUrl;
  }, [highlightedUrl]);

  return { onTimeUpdate, onEnded, highlightedUrl };
}
