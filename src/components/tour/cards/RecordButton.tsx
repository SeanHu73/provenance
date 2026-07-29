'use client';

/**
 * Big centred record button — records mic audio, transcribes via /api/transcribe
 * (Deepgram), and hands the text back so the caller can drop it into a textbox to
 * proof-read. Shared by the reflection response and the Context Detective ask.
 *
 * Three states, all drawn at the same diameter so the layout never jumps as the
 * learner moves through them:
 *   idle         filled disc + mic
 *   recording    white disc, ringed, with a pause glyph
 *   transcribing white disc with a spinner ("tidying up what you said")
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  onTranscript: (t: string) => void;
  /** Diameter in px. Every screen that offers dictation uses the same size, so
   *  the control is recognisably the same control wherever it appears. */
  size?: number;
  /** Soft halo behind the disc, to pull the eye before they have answered. */
  halo?: boolean;
}

export default function RecordButton({ onTranscript, size = 140, halo = false }: Props) {
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

  const busy = state === 'transcribing';
  const listening = state === 'recording';
  // The two non-idle states sit on white with a ring, so the disc reads as a
  // control that is *doing something* rather than one waiting to be pressed.
  const onWhite = listening || busy;
  const glyph = Math.round(size * 0.30);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={listening ? stop : busy ? undefined : start}
        disabled={busy}
        className="rounded-full flex items-center justify-center shadow-lg transition-colors"
        style={{
          width: size,
          height: size,
          backgroundColor: onWhite ? 'var(--ds-white, #fff)' : 'var(--ds-cardinal-light, #CF4C4C)',
          color: onWhite ? 'var(--ds-cardinal, #8C1515)' : '#fff',
          border: onWhite ? '2px solid var(--ds-cardinal, #8C1515)' : 'none',
          boxShadow: halo && !onWhite
            ? '0 0 0 10px rgba(207,76,76,0.16), 0 0 26px rgba(207,76,76,0.35)'
            : '0 6px 16px rgba(0,0,0,0.14)',
        }}
        aria-label={listening ? 'Stop recording' : busy ? 'Transcribing' : 'Record'}
      >
        {listening ? (
          // pause bars — tapping again finishes the recording
          <span className="flex items-center" style={{ gap: Math.round(glyph * 0.28) }} aria-hidden>
            <span style={{ width: Math.round(glyph * 0.26), height: glyph, borderRadius: 2, backgroundColor: 'currentColor' }} />
            <span style={{ width: Math.round(glyph * 0.26), height: glyph, borderRadius: 2, backgroundColor: 'currentColor' }} />
          </span>
        ) : busy ? (
          <span
            className="rounded-full animate-spin"
            style={{ width: glyph, height: glyph, border: '3px solid currentColor', borderTopColor: 'transparent' }}
            aria-hidden
          />
        ) : (
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" /><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
        )}
      </button>
      <p className="text-sm text-text-secondary" aria-live="polite">
        {listening ? 'Listening… tap to finish'
          : busy ? 'Tidying up what you said…'
          : state === 'error' ? 'Mic unavailable — type below'
          : 'Tap to record your thoughts'}
      </p>
    </div>
  );
}
