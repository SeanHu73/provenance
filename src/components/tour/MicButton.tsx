'use client';

/**
 * Standalone mic button that records audio, sends to Deepgram,
 * and calls onTranscript with the result. Used alongside existing
 * textareas without replacing them. Recording lifecycle lives in
 * useVoiceRecorder so ResponseInput can drive its own record morph.
 */

import { useVoiceRecorder, formatRecordTime } from './useVoiceRecorder';

interface Props {
  onTranscript: (text: string) => void;
  /** Size variant */
  size?: 'xs' | 'sm' | 'lg' | 'xl';
  /** Visual style — 'filled' (gold) or 'outline' (transparent circle + ring). */
  variant?: 'filled' | 'outline';
}

const SIZES = {
  xs: { box: 'w-12 h-12', icon: 18, rounded: 'rounded-lg' },
  sm: { box: 'w-16 h-20 self-center', icon: 26, rounded: 'rounded-lg' },
  lg: { box: 'w-16 h-16', icon: 24, rounded: 'rounded-lg' },
  xl: { box: 'w-24 h-24', icon: 40, rounded: 'rounded-full' },
} as const;

export default function MicButton({ onTranscript, size = 'sm', variant = 'filled' }: Props) {
  const { state, elapsed, error, start, stop, reset } = useVoiceRecorder(onTranscript);
  const { box, icon: iconSize, rounded } = SIZES[size];

  if (state === 'recording') {
    return (
      <button
        onClick={stop}
        className={`${box} ${rounded} shrink-0 bg-red-500 text-white flex flex-col items-center justify-center gap-0.5 animate-pulse shadow-md`}
        title="Stop recording"
      >
        <div className="w-3 h-3 rounded-sm bg-white" />
        <span className="text-[8px] font-mono">{formatRecordTime(elapsed)}</span>
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
        onClick={reset}
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
      onClick={start}
      className={`${box} ${rounded} shrink-0 flex items-center justify-center transition-colors ${idleClass}`}
      title="Record voice"
    >
      <MicGlyph size={iconSize} />
    </button>
  );
}

export function MicGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
      <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
  );
}
