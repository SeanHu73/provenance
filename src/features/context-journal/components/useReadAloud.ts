'use client';

/**
 * Sequenced read-aloud via the browser's free Web Speech API
 * (`speechSynthesis`). Speaks an optional short **lead** (the context title),
 * pauses ~1s, then the **body** (the long explanation). Word-highlight indices
 * track the *body* only — the `boundary` event gives the char offset of the word
 * being spoken, which we expose as `charIndex` so the caller can highlight the
 * matching segment.
 *
 * Boundary events are well-supported on desktop Chrome/Edge; some mobile voices
 * don't fire them, in which case audio still plays without highlighting.
 * Autoplay is attempted (`play()` in a mount effect); browsers that block
 * speech without a user gesture simply stay paused and the caller's play button
 * starts it. (A premium voice can swap in later behind this same hook.)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface Segment { text: string; start: number; isSpace: boolean }

/** Split text into segments (words + whitespace), each tagged with its start
 *  char offset so a speech `boundary` charIndex maps to the right segment. */
export function buildSegments(text: string): Segment[] {
  const parts = text.split(/(\s+)/);
  const out: Segment[] = [];
  let pos = 0;
  for (const t of parts) {
    out.push({ text: t, start: pos, isSpace: /^\s+$/.test(t) || t === '' });
    pos += t.length;
  }
  return out;
}

interface Options {
  /** Spoken first, briefly (e.g. the title). Omit for none. */
  lead?: string;
  /** The main body; highlight indices track this text. */
  body: string;
  /** Pause between lead and body, ms. */
  gapMs?: number;
}

export function useReadAloud({ lead, body, gapMs = 1000 }: Options) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const [charIndex, setCharIndex] = useState(-1); // into `body`
  const timerRef = useRef<number | null>(null);

  const segments = useMemo(() => buildSegments(body), [body]);
  const currentIdx = charIndex < 0 ? -1
    : segments.findIndex((s) => !s.isSpace && charIndex >= s.start && charIndex < s.start + s.text.length);

  const stop = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    setSpeaking(false);
    setCharIndex(-1);
  }, [supported]);

  const play = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    const speakBody = () => {
      if (!body.trim()) { setSpeaking(false); return; }
      const u = new SpeechSynthesisUtterance(body);
      u.rate = 1;
      u.onboundary = (e) => { if (e.name === 'word' || e.name === 'sentence') setCharIndex(e.charIndex); };
      u.onend = () => { setSpeaking(false); setCharIndex(-1); };
      u.onerror = () => { setSpeaking(false); setCharIndex(-1); };
      window.speechSynthesis.speak(u);
    };
    setSpeaking(true);
    setCharIndex(-1);
    const leadText = lead?.trim();
    if (leadText) {
      const u = new SpeechSynthesisUtterance(leadText);
      u.rate = 1;
      const next = () => { timerRef.current = window.setTimeout(speakBody, gapMs); };
      u.onend = next;
      u.onerror = next;
      window.speechSynthesis.speak(u);
    } else {
      speakBody();
    }
  }, [supported, lead, body, gapMs]);

  // Cancel any speech + pending timer if the reader unmounts.
  useEffect(() => stop, [stop]);

  return { supported, speaking, charIndex, currentIdx, segments, play, stop };
}
