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
  size?: 'sm' | 'lg';
}

type MicState = 'idle' | 'recording' | 'transcribing' | 'error';

const MAX_RECORDING_MS = 120_000;

export default function MicButton({ onTranscript, size = 'sm' }: Props) {
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

  const btnSize = size === 'lg' ? 'w-16 h-16' : 'w-12 h-20 self-center';
  const iconSize = size === 'lg' ? 24 : 20;

  if (state === 'recording') {
    return (
      <button
        onClick={stopRecording}
        className={`${btnSize} shrink-0 rounded-lg bg-red-500 text-white flex flex-col items-center justify-center gap-0.5 animate-pulse`}
        title="Stop recording"
      >
        <div className="w-3 h-3 rounded-sm bg-white" />
        <span className="text-[8px] font-mono">{formatTime(elapsed)}</span>
      </button>
    );
  }

  if (state === 'transcribing') {
    return (
      <div className={`${btnSize} shrink-0 rounded-lg bg-sandstone-light/50 flex items-center justify-center`}>
        <div className="w-4 h-4 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <button
        onClick={() => { setError(''); setState('idle'); }}
        className={`${btnSize} shrink-0 rounded-lg bg-red-100 text-red-600 flex items-center justify-center text-xs`}
        title={error}
      >
        !
      </button>
    );
  }

  return (
    <button
      onClick={startRecording}
      className={`${btnSize} shrink-0 rounded-lg bg-aged-gold text-white flex items-center justify-center hover:bg-aged-gold-light transition-colors`}
      title="Record voice"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
      </svg>
    </button>
  );
}
