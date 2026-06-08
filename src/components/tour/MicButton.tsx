'use client';

/**
 * Standalone mic button that records audio, sends to Deepgram,
 * and calls onTranscript with the result. Used alongside existing
 * textareas without replacing them.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

interface Props {
  onTranscript: (text: string) => void;
  /** Size variant */
  size?: 'xs' | 'sm' | 'lg' | 'xl';
  /** Visual style — 'filled' (gold) or 'outline' (transparent circle + ring). */
  variant?: 'filled' | 'outline';
}

type MicState = 'idle' | 'recording' | 'transcribing' | 'error';

const MAX_RECORDING_MS = 120_000;

const SIZES = {
  xs: { box: 'w-12 h-12', icon: 18, rounded: 'rounded-lg' },
  sm: { box: 'w-16 h-20 self-center', icon: 26, rounded: 'rounded-lg' },
  lg: { box: 'w-16 h-16', icon: 24, rounded: 'rounded-lg' },
  xl: { box: 'w-24 h-24', icon: 40, rounded: 'rounded-full' },
} as const;

export default function MicButton({ onTranscript, size = 'sm', variant = 'filled' }: Props) {
  const [state, setState] = useState<MicState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const sendToDeepgram = useCallback(async () => {
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
        setError("Couldn't catch that — try again or type instead.");
        setState('error');
        return;
      }
      onTranscript(data.transcript);
      setState('idle');
    } catch {
      setError("Couldn't catch that — try again or type instead.");
      setState('error');
    }
  }, [onTranscript]);

  const startRecording = useCallback(async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      recorder.start(250);
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      maxTimerRef.current = setTimeout(() => {
        if (recorder.state === 'recording') recorder.stop();
      }, MAX_RECORDING_MS);
    } catch {
      setError('Allow microphone access to use voice input.');
      setState('error');
    }
  }, [sendToDeepgram]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const { box, icon: iconSize, rounded } = SIZES[size];

  if (state === 'recording') {
    return (
      <button
        onClick={stopRecording}
        className={`${box} ${rounded} shrink-0 bg-red-500 text-white flex flex-col items-center justify-center gap-0.5 animate-pulse shadow-md`}
        title="Stop recording"
      >
        <div className="w-3 h-3 rounded-sm bg-white" />
        <span className="text-[8px] font-mono">{formatTime(elapsed)}</span>
      </button>
    );
  }

  if (state === 'transcribing') {
    return (
      <div className={`${box} ${rounded} shrink-0 bg-sandstone-light/50 flex items-center justify-center`}>
        <div className="w-4 h-4 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <button
        onClick={() => { setError(''); setState('idle'); }}
        className={`${box} ${rounded} shrink-0 bg-red-100 text-red-600 flex items-center justify-center text-xs`}
        title={error}
      >
        !
      </button>
    );
  }

  const idleClass = variant === 'outline'
    ? 'bg-transparent border-[3px] border-aged-gold text-aged-gold shadow-lg hover:bg-aged-gold/10'
    : 'bg-aged-gold text-white hover:bg-aged-gold-light';

  return (
    <button
      onClick={startRecording}
      className={`${box} ${rounded} shrink-0 flex items-center justify-center transition-colors ${idleClass}`}
      title="Record voice"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    </button>
  );
}
