'use client';

/**
 * Auto text-to-speech narration, presented as the *same* bar as an uploaded
 * AudioButton (play/pause + progress + title). Used as the fallback narration
 * when a screen has no uploaded voiceover: it reads the given text via the
 * browser's free Web Speech API (`speechSynthesis`).
 *
 * The caller passes the raw authored text; we sanitize it (`ttsSanitize`) so the
 * [photo:N] markers and **bold** / {{#hex}} style markers are never read aloud,
 * and common abbreviations (Jr., Dr., …) are expanded so they don't sound like
 * the end of a sentence.
 *
 * Playback is chunked: the text is split into short sentence-sized utterances
 * spoken back-to-back. This avoids the Chrome bug where one long utterance falls
 * silent after ~15 seconds, and keeps precise control of progress. Reading runs
 * a little slower than default (`RATE`) so it's easier to follow.
 *
 * If the browser has no speech support the bar renders nothing (the screen
 * simply has no narration).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { ttsSanitize, ttsChunks } from '@/lib/tts-text';
import { ScrollingTitle } from './AudioButton';

interface Props {
  /** Raw authored text — sanitized here before speaking. */
  text: string;
  title?: string | null;
  /** Speak on mount (browsers may still block without a gesture). Read once. */
  autoplay?: boolean;
  /** Fires once the whole narration finishes (all chunks spoken). */
  onEnded?: () => void;
}

const RATE = 0.85;              // slower than default for easier listening
const WORDS_PER_SEC = 2.6 * RATE; // rough estimate, for the duration readout only

export default function SpeechBar({ text, title, autoplay = false, onEnded }: Props) {
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;
  const clean = useMemo(() => ttsSanitize(text), [text]);
  const chunks = useMemo(() => ttsChunks(clean), [clean]);
  // Char offset where each chunk starts, plus the total, to drive progress.
  const { starts, total } = useMemo(() => {
    const s: number[] = [];
    let acc = 0;
    for (const c of chunks) { s.push(acc); acc += c.length; }
    return { starts: s, total: Math.max(1, acc) };
  }, [chunks]);
  const estTotal = useMemo(
    () => Math.max(2, Math.round(clean.split(/\s+/).filter(Boolean).length / WORDS_PER_SEC)),
    [clean],
  );

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const [state, setState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const runIdRef = useRef(0);       // bumped on stop/unmount to orphan stale callbacks
  const idxRef = useRef(0);         // current chunk
  const boundaryRef = useRef(0);    // char offset within the current chunk
  const elapsedRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  const startTick = () => {
    clearTick();
    tickRef.current = setInterval(() => {
      elapsedRef.current += 0.2;
      setElapsed(elapsedRef.current);
      const spoken = (starts[idxRef.current] ?? 0) + boundaryRef.current;
      setProgress(Math.min(0.999, spoken / total));
    }, 200);
  };

  const resetState = () => {
    clearTick();
    idxRef.current = 0;
    boundaryRef.current = 0;
    elapsedRef.current = 0;
    setState('idle');
    setProgress(0);
    setElapsed(0);
  };

  const speakChunk = (runId: number, i: number) => {
    if (runId !== runIdRef.current) return;
    if (i >= chunks.length) { resetState(); onEndedRef.current?.(); return; }
    idxRef.current = i;
    boundaryRef.current = 0;
    const u = new SpeechSynthesisUtterance(chunks[i]);
    u.rate = RATE;
    // Flip to "playing" only once speech actually starts — so if a browser
    // blocks autoplay without a gesture (mobile), the bar stays on its play
    // button instead of a stuck pause button.
    u.onstart = () => { if (runId === runIdRef.current) { setState('playing'); startTick(); } };
    u.onboundary = (e) => { if (runId === runIdRef.current) boundaryRef.current = e.charIndex; };
    u.onend = () => { if (runId === runIdRef.current) speakChunk(runId, i + 1); };
    u.onerror = () => { if (runId === runIdRef.current) speakChunk(runId, i + 1); }; // skip a failed chunk
    window.speechSynthesis.speak(u);
  };

  const play = () => {
    if (!supported || chunks.length === 0) return;
    window.speechSynthesis.cancel();
    const runId = ++runIdRef.current;
    idxRef.current = 0;
    boundaryRef.current = 0;
    elapsedRef.current = 0;
    speakChunk(runId, 0);
  };

  const toggle = () => {
    if (!supported) return;
    if (state === 'idle') { play(); return; }
    if (state === 'playing') { try { window.speechSynthesis.pause(); } catch { /* ignore */ } clearTick(); setState('paused'); return; }
    // paused → resume
    try { window.speechSynthesis.resume(); } catch { /* ignore */ }
    setState('playing');
    startTick();
  };

  // Autoplay on mount (once). Cancel + clean up on unmount.
  useEffect(() => {
    if (autoplay) play();
    return () => {
      clearTick();
      runIdRef.current++;
      if (supported) { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } }
    };
    // Only on mount — toggling the preference mid-screen shouldn't retro-start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!supported || chunks.length === 0) return null;
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
