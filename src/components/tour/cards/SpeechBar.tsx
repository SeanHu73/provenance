'use client';

/**
 * Auto text-to-speech narration, presented as the *same* bar as an uploaded
 * AudioButton (play/pause + progress + title). Used as the fallback narration
 * when a screen has no uploaded voiceover: it reads the given text via the
 * browser's free Web Speech API (`speechSynthesis`).
 *
 * The caller passes the raw authored text; we sanitize it (`ttsSanitize`) so the
 * [photo:N] markers and **bold** / {{#hex}} style markers are never read aloud.
 *
 * speechSynthesis has no real duration/seek, so the timeline is an estimate:
 * progress tracks the spoken word (`boundary` events) where the voice supports
 * it, falling back to an elapsed-time estimate. If the browser has no speech
 * support the bar renders nothing (the screen simply has no narration).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ttsSanitize } from '@/lib/tts-text';
import { ScrollingTitle } from './AudioButton';

interface Props {
  /** Raw authored text — sanitized here before speaking. */
  text: string;
  title?: string | null;
  /** Speak on mount (browsers may still block without a gesture). Read once. */
  autoplay?: boolean;
}

const WORDS_PER_SEC = 2.6; // ~155 wpm, for the duration estimate only

export default function SpeechBar({ text, title, autoplay = false }: Props) {
  const clean = useMemo(() => ttsSanitize(text), [text]);
  const estTotal = useMemo(
    () => Math.max(2, Math.round(clean.split(/\s+/).filter(Boolean).length / WORDS_PER_SEC)),
    [clean],
  );

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const elapsedRef = useRef(0);
  const boundaryProgRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepaliveRef = useRef(0);

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  const reset = () => {
    clearTick();
    elapsedRef.current = 0;
    boundaryProgRef.current = 0;
    setState('idle');
    setProgress(0);
    setElapsed(0);
  };

  const startTick = () => {
    clearTick();
    keepaliveRef.current = 0;
    tickRef.current = setInterval(() => {
      elapsedRef.current += 0.2;
      keepaliveRef.current += 0.2;
      // Chrome cuts long utterances off after ~15s; a periodic resume keeps it going.
      if (keepaliveRef.current >= 10) {
        keepaliveRef.current = 0;
        try { window.speechSynthesis.pause(); window.speechSynthesis.resume(); } catch { /* ignore */ }
      }
      const timeProg = Math.min(0.99, elapsedRef.current / estTotal);
      setElapsed(elapsedRef.current);
      setProgress(Math.max(timeProg, boundaryProgRef.current));
    }, 200);
  };

  const play = () => {
    if (!supported || !clean.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    elapsedRef.current = 0;
    boundaryProgRef.current = 0;
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1;
    u.onboundary = (e) => { if (clean.length) boundaryProgRef.current = e.charIndex / clean.length; };
    u.onend = () => reset();
    u.onerror = () => reset();
    synth.speak(u);
    setState('playing');
    startTick();
  };

  const toggle = () => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    if (state === 'idle') { play(); return; }
    if (state === 'playing') { try { synth.pause(); } catch { /* ignore */ } clearTick(); setState('paused'); return; }
    // paused → resume
    try { synth.resume(); } catch { /* ignore */ }
    setState('playing');
    startTick();
  };

  // Autoplay on mount (once). Cancel + clean up on unmount.
  useEffect(() => {
    if (autoplay) play();
    return () => { clearTick(); if (supported) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } } };
    // Only on mount — toggling the preference mid-screen shouldn't retro-start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!supported || !clean.trim()) return null;
  const playing = state === 'playing';

  return (
    <div className="rounded-lg bg-sandstone border border-sandstone-light p-4 space-y-3">
      {/* Title row */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            playing ? 'bg-aged-gold text-white' : 'bg-sandstone-light text-journal'
          }`}
          aria-label={playing ? 'Pause narration' : 'Play narration'}
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
          <ScrollingTitle text={title || 'Narration'} />
          <p className="text-xs text-text-secondary">
            {formatTime(elapsed)} / ~{formatTime(estTotal)}
          </p>
        </div>
      </div>

      {/* Timeline bar (no seek — speech can't be scrubbed) */}
      <div className="h-2 bg-sandstone-light rounded-full relative">
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
