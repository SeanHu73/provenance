'use client';

/**
 * Per-tour audio setup — shown once at the start of each tour (after "Begin
 * Tour"), moved here from the old onboarding setup wizard. The learner picks
 * their default: Listen (narration auto-plays; read-along collapsed) or Read
 * (text expanded; audio is tap-to-play). They can flip Auto-Play later from the
 * top-right menu.
 */

import { useState } from 'react';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useReadMode } from '@/lib/read-mode';

export default function TourAudioSetup({ onDone }: { onDone: () => void }) {
  const [, setAutoplayPref] = useAudioAutoplay();
  const [, setReadMode] = useReadMode();
  const [mode, setMode] = useState<'listen' | 'read' | null>(null);

  const pickListen = () => { setMode('listen'); setReadMode(false); setAutoplayPref(true); };
  const pickRead = () => { setMode('read'); setReadMode(true); setAutoplayPref(false); };

  const selStyle = { background: 'var(--th-primary)', color: 'var(--th-surface)', borderColor: 'var(--th-primary)' };
  const unselStyle = { background: 'transparent', color: 'var(--th-primary)', borderColor: 'var(--th-primary)' };

  return (
    <div className="fixed inset-0 z-[75] flex flex-col animate-fade-in" style={{ backgroundColor: 'var(--th-surface)' }}>
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col justify-center px-7 py-8">
        <h2 className="font-display text-[30px] font-bold text-center" style={{ color: 'var(--text-primary)' }}>Audio</h2>
        <p className="mt-3 text-[18px] font-serif text-center leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <strong>Earphones</strong> are recommended for the best experience.
        </p>

        <p className="mt-6 text-[17px] font-semibold text-center" style={{ color: 'var(--text-primary)' }}>What is your preferred default?</p>
        <div className="mt-4 flex gap-3 justify-center">
          <button onClick={pickListen} className="flex items-center gap-2 px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors" style={mode === 'listen' ? selStyle : unselStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14v-3a9 9 0 0 1 18 0v3" /><path d="M21 17a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2v2z" /><path d="M3 17a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2v2z" /></svg>
            Listen
          </button>
          <button onClick={pickRead} className="flex items-center gap-2 px-6 py-3 rounded-lg text-[17px] font-semibold border-2 transition-colors" style={mode === 'read' ? selStyle : unselStyle}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></svg>
            Read
          </button>
        </div>

        {mode && (
          <p className="mt-5 text-[14px] text-center px-3 animate-fade-in" style={{ color: 'var(--text-secondary)' }}>
            {mode === 'listen'
              ? 'Narration will play automatically — change that anytime in the menu.'
              : 'Text shows by default; audio is tap-to-play. Change that in the menu.'}
          </p>
        )}

        <div className="mt-8">
          <button
            onClick={onDone}
            disabled={mode === null}
            className="w-full py-3.5 rounded-full text-[17px] font-semibold transition-opacity disabled:opacity-40"
            style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
          >
            Start tour
          </button>
        </div>
      </div>
    </div>
  );
}
