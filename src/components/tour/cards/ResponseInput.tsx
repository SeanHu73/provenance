'use client';

/**
 * Response input used on context-mode question screens. The explorer first
 * chooses how to answer: a "Type" button on the left, or a big circular
 * record button on the right. Choosing Type (or recording) reveals the
 * textbox with a small mic beside it.
 */

import { useState } from 'react';
import MicButton from '../MicButton';

interface Props {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

export default function ResponseInput({ value, onChange, placeholder = 'Type your answer…' }: Props) {
  const [mode, setMode] = useState<'choose' | 'type'>(value.trim() ? 'type' : 'choose');

  if (mode === 'choose') {
    return (
      <div className="flex items-center justify-center gap-6 py-3">
        {/* Type */}
        <button
          onClick={() => setMode('type')}
          className="flex-1 max-w-[150px] py-4 rounded-xl text-base font-semibold text-text-primary border-2 border-sandstone-light bg-white shadow-sm hover:bg-sandstone-light/20 transition-colors"
        >
          Type
        </button>
        {/* Record */}
        <div className="flex flex-col items-center gap-1.5">
          <MicButton
            size="xl"
            variant="outline"
            onTranscript={(t) => { onChange(value ? value + ' ' + t : t); setMode('type'); }}
          />
          <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Record</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-start">
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
