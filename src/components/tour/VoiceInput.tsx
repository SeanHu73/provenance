'use client';

/**
 * Voice-to-text input component using Deepgram REST API.
 *
 * Flow: tap mic → record audio → send to /api/transcribe → show
 * transcript for confirmation → submit.
 *
 * Two modes:
 *   - "inline" (default): mic button sits next to a text field
 *   - "prominent": large centered mic button with "or type instead"
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  /** Called with the final confirmed text */
  onSubmit: (text: string) => void;
  /** Placeholder for the text input */
  placeholder?: string;
  /** Number of rows for the textarea */
  rows?: number;
  /** "inline" = mic beside text field, "prominent" = big mic centered */
  mode?: 'inline' | 'prominent';
  /** Initial value for the text field */
  initialValue?: string;
}

type State = 'idle' | 'recording' | 'transcribing' | 'confirming' | 'error';

const MAX_RECORDING_MS = 120_000; // 2 minutes

export default function VoiceInput({
  onSubmit,
  placeholder = 'Type or use the mic...',
  rows = 3,
  mode = 'inline',
  initialValue = '',
}: Props) {
  const [state, setState] = useState<State>('idle');
  const [text, setText] = useState(initialValue);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm, fall back to whatever is available
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
        sendToDeepgram();
      };

      recorder.start(250); // collect data every 250ms
      setState('recording');
      setElapsed(0);

      // Elapsed timer
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);

      // Max recording cap
      maxTimerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, MAX_RECORDING_MS);
    } catch {
      setError('To use voice, allow microphone access in your browser settings.');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const sendToDeepgram = async () => {
    setState('transcribing');
    try {
      const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' });

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type },
        body: blob,
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error === 'No speech detected'
          ? "Couldn't catch that — try again or type instead."
          : "Couldn't catch that — try again or type instead.");
        setState('error');
        return;
      }

      setTranscript(data.transcript);
      setState('confirming');
    } catch {
      setError("Couldn't catch that — try again or type instead.");
      setState('error');
    }
  };

  const confirmTranscript = () => {
    onSubmit(transcript);
    setTranscript('');
    setText('');
    setState('idle');
  };

  const retryRecording = () => {
    setTranscript('');
    setError('');
    setState('idle');
  };

  // Format elapsed time
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Recording UI ──
  if (state === 'recording') {
    return (
      <div className="w-full p-6 rounded-lg bg-sandstone border border-sandstone-light flex flex-col items-center gap-4">
        {/* Pulsing dot + time */}
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[18px] font-semibold text-text-primary font-mono">{formatTime(elapsed)}</span>
        </div>
        <p className="text-sm text-text-secondary">Listening...</p>
        <button
          onClick={stopRecording}
          className="px-6 py-3 rounded-full bg-aged-gold text-white text-base font-semibold"
        >
          Done
        </button>
      </div>
    );
  }

  // ── Transcribing UI ──
  if (state === 'transcribing') {
    return (
      <div className="w-full p-6 rounded-lg bg-sandstone border border-sandstone-light flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary italic">Tidying up what you said...</p>
      </div>
    );
  }

  // ── Confirmation UI ──
  if (state === 'confirming') {
    return (
      <div className="w-full space-y-3">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          rows={rows}
          className="w-full px-4 py-3 rounded-lg border-2 border-aged-gold/40 bg-white text-[20px] font-serif text-text-primary focus:outline-none focus:border-aged-gold"
        />
        <div className="flex gap-2">
          <button
            onClick={retryRecording}
            className="px-4 py-3 rounded-lg text-base font-semibold text-text-secondary border border-sandstone-light hover:bg-sandstone-light/20"
          >
            Try again
          </button>
          <button
            onClick={confirmTranscript}
            className="flex-1 py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
          >
            Use this
          </button>
        </div>
      </div>
    );
  }

  // ── Error UI ──
  if (state === 'error') {
    return (
      <div className="w-full space-y-3">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
        <div className="flex gap-2">
          <button
            onClick={retryRecording}
            className="px-4 py-3 rounded-lg text-base font-semibold text-aged-gold border border-aged-gold/40 hover:bg-aged-gold/10"
          >
            Try again
          </button>
          <button
            onClick={() => setState('idle')}
            className="flex-1 py-3 rounded-lg text-base font-semibold text-text-secondary border border-sandstone-light"
          >
            Type instead
          </button>
        </div>
      </div>
    );
  }

  // ── Idle UI — prominent mode ──
  if (mode === 'prominent') {
    return (
      <div className="w-full space-y-4">
        {/* Big mic button */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={startRecording}
            className="w-20 h-20 rounded-full bg-aged-gold text-white flex items-center justify-center shadow-lg hover:bg-aged-gold-light transition-colors"
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
          <p className="text-sm text-text-secondary">Tap to speak</p>
        </div>

        {/* Or type */}
        <div className="space-y-2">
          <p className="text-xs text-text-secondary/60 text-center">or type instead</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
          />
          {text.trim() && (
            <button
              onClick={() => onSubmit(text.trim())}
              className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
            >
              Submit
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Idle UI — inline mode ──
  return (
    <div className="w-full space-y-2">
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="flex-1 px-4 py-3 rounded-lg border-2 border-sandstone-light bg-white text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-aged-gold"
        />
        <button
          onClick={startRecording}
          className="shrink-0 w-12 h-12 rounded-lg bg-aged-gold text-white flex items-center justify-center self-end hover:bg-aged-gold-light transition-colors"
          title="Record voice"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
      </div>
      {text.trim() && (
        <button
          onClick={() => onSubmit(text.trim())}
          className="w-full py-3 rounded-lg text-base font-semibold bg-aged-gold text-white"
        >
          Submit
        </button>
      )}
    </div>
  );
}
