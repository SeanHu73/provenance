'use client';

/**
 * Read-aloud with e-reader word highlighting, via the browser's free Web Speech
 * API (`speechSynthesis`). The `boundary` event gives the char offset of the
 * word being spoken; we map it to a segment and highlight it. Whitespace is
 * preserved so paragraph breaks survive. (A premium voice — ElevenLabs etc. —
 * can swap in later behind the same component API.)
 *
 * Boundary events are well-supported on desktop Chrome/Edge; some mobile voices
 * don't fire them, in which case audio still plays without highlighting.
 */

import { useEffect, useMemo, useState } from 'react';

/** Split text into segments (words + whitespace), each tagged with its start
 *  char offset so a speech `boundary` charIndex maps to the right segment. */
function buildSegments(text: string) {
  const parts = text.split(/(\s+)/);
  const out: { text: string; start: number; isSpace: boolean }[] = [];
  let pos = 0;
  for (const t of parts) {
    out.push({ text: t, start: pos, isSpace: /^\s+$/.test(t) || t === '' });
    pos += t.length;
  }
  return out;
}

export default function ReadAloud({ text, colour }: { text: string; colour: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [charIndex, setCharIndex] = useState(-1);

  const segments = useMemo(() => buildSegments(text), [text]);

  const currentIdx = charIndex < 0 ? -1
    : segments.findIndex((s) => !s.isSpace && charIndex >= s.start && charIndex < s.start + s.text.length);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stop = () => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
    setCharIndex(-1);
  };

  const play = () => {
    if (!supported || !text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onboundary = (e) => { if (e.name === 'word' || e.name === 'sentence') setCharIndex(e.charIndex); };
    u.onend = () => { setSpeaking(false); setCharIndex(-1); };
    u.onerror = () => { setSpeaking(false); setCharIndex(-1); };
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

  // Cancel any speech if the reader unmounts.
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  return (
    <div>
      {supported && (
        <button
          onClick={speaking ? stop : play}
          className="mb-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
          style={{ backgroundColor: speaking ? colour : `${colour}1f`, color: speaking ? '#fff' : colour }}
        >
          {speaking ? (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>Stop</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20" /></svg>Read aloud</>
          )}
        </button>
      )}
      <p className="text-[17px] font-serif text-text-primary leading-relaxed whitespace-pre-wrap">
        {segments.map((s, i) => (
          s.isSpace
            ? <span key={i}>{s.text}</span>
            : <span key={i} style={i === currentIdx ? { backgroundColor: `${colour}33`, borderRadius: 3 } : undefined}>{s.text}</span>
        ))}
      </p>
    </div>
  );
}
