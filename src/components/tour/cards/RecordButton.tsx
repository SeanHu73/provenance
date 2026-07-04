'use client';

/**
 * Big centered record button — records mic audio, transcribes via /api/transcribe
 * (Deepgram), and hands the text back so the caller can drop it into a textbox to
 * proof-read. Shared by the reflection response and the Context Detective ask.
 */

import { useEffect, useRef, useState } from 'react';

export default function RecordButton({ onTranscript }: { onTranscript: (t: string) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing' | 'error'>('idle');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => () => { recRef.current?.stream?.getTracks().forEach((t) => t.stop()); }, []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState('transcribing');
        try {
          const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' });
          const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
          const data = await res.json();
          if (res.ok && data.transcript) { onTranscript(String(data.transcript).trim()); setState('idle'); }
          else setState('error');
        } catch { setState('error'); }
      };
      rec.start(250);
      setState('recording');
    } catch {
      setState('error');
    }
  };

  const stop = () => { if (recRef.current?.state === 'recording') recRef.current.stop(); };

  if (state === 'transcribing') {
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--th-primary)', borderTopColor: 'transparent' }} />
        <p className="text-sm italic text-text-secondary">Tidying up what you said…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={state === 'recording' ? stop : start}
        className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg text-white"
        style={{ backgroundColor: state === 'recording' ? '#c0392b' : 'var(--th-primary)' }}
        aria-label={state === 'recording' ? 'Stop recording' : 'Record'}
      >
        {state === 'recording' ? (
          <span className="w-6 h-6 rounded bg-white animate-pulse" />
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
        )}
      </button>
      <p className="text-sm text-text-secondary">
        {state === 'recording' ? 'Listening… tap to finish' : state === 'error' ? 'Mic unavailable — type below' : 'Tap to record your thoughts'}
      </p>
    </div>
  );
}
