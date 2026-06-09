'use client';

/**
 * Response input for context-mode question screens. The explorer first
 * chooses how to answer: a "Type" button (left) or a red "Record" button
 * (right) — same-size soft rectangles. Tapping Record starts recording and
 * morphs into a centered circular indicator (the Type button disappears);
 * tapping it stops and transcribes. Tapping Type reveals the textbox with a
 * small mic vertically centered beside it.
 */

import { useState } from 'react';
import MicButton, { MicGlyph } from '../MicButton';
import { useVoiceRecorder, formatRecordTime } from '../useVoiceRecorder';

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export default function ResponseInput({ value, onChange, placeholder = 'Type your answer…' }: Props) {
  const [mode, setMode] = useState<'choose' | 'type'>(value.trim() ? 'type' : 'choose');
  const rec = useVoiceRecorder((t) => {
    onChange(value ? value + ' ' + t : t);
    setMode('type');
  });

  if (mode === 'choose') {
    // Recording → centered red circle (Type hidden).
    if (rec.state === 'recording') {
      return (
        <div className="flex justify-center py-3">
          <button
            onClick={rec.stop}
            className="w-28 h-28 rounded-full bg-red-500 text-white flex flex-col items-center justify-center gap-1.5 animate-pulse shadow-lg"
            title="Stop recording"
          >
            <div className="w-5 h-5 rounded-sm bg-white" />
            <span className="text-sm font-mono">{formatRecordTime(rec.elapsed)}</span>
          </button>
        </div>
      );
    }
    if (rec.state === 'transcribing') {
      return (
        <div className="flex justify-center py-3">
          <div className="w-28 h-28 rounded-full bg-sandstone-light/50 flex items-center justify-center">
            <div className="w-7 h-7 border-2 border-aged-gold border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {rec.state === 'error' && (
          <p className="text-sm text-red-600 text-center">{rec.error}</p>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setMode('type')}
            className="flex-1 py-4 rounded-xl text-lg font-semibold text-text-primary border-2 border-sandstone-light bg-white shadow-sm hover:bg-sandstone-light/20 transition-colors flex items-center justify-center gap-2"
          >
            <PencilIcon size={22} />
            Type
          </button>
          <button
            onClick={() => { rec.reset(); rec.start(); }}
            className="flex-1 py-4 rounded-xl text-lg font-semibold text-white bg-[#d2776d] shadow-sm hover:bg-[#c4685e] transition-colors flex items-center justify-center gap-2"
          >
            <MicGlyph size={22} />
            Record
          </button>
        </div>
      </div>
    );
  }

  // Type mode — textbox + small mic, vertically centered.
  return (
    <div className="flex gap-2 items-center">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        autoFocus
        className="flex-1 px-4 py-3 rounded-lg text-[20px] font-serif text-text-primary placeholder:text-text-secondary/40 focus:outline-none transition-all border-2 border-sandstone-light bg-white"
      />
      <MicButton size="xs" onTranscript={(t) => onChange(value ? value + ' ' + t : t)} />
    </div>
  );
}

function PencilIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
