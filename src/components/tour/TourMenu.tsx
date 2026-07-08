'use client';

/**
 * Always-present tour menu — a top-right hamburger button that opens a small
 * dropdown. It owns the Auto-Play toggle (headphone icon) that used to live in
 * the footer. Mounted alongside TourFooter in both chrome renderers
 * (Journal.tsx for in-stop phases, page.tsx for map phases) so it's on screen
 * throughout the tour.
 *
 * Right after onboarding, `requestAutoplayHint()` makes it open on its own and
 * highlight the Auto-Play toggle with a one-line explanation.
 */

import { useState } from 'react';
import { useAudioAutoplay } from '@/lib/audio-autoplay';
import { useAutoplayHint } from '@/lib/autoplay-hint';

/** The Auto-Play on/off row — a headphone icon, a label, and a switch. Shared by
 *  this menu and the Context Journal's menu so it looks/behaves identically. */
export function AutoPlayMenuItem({ highlight = false }: { highlight?: boolean }) {
  const [autoplay, setAutoplay] = useAudioAutoplay();
  return (
    <button
      onClick={() => setAutoplay(!autoplay)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${highlight ? 'bg-[color:var(--th-primary)]/[0.08] ring-2 ring-inset' : 'hover:bg-black/[0.03]'}`}
      style={highlight ? { boxShadow: 'inset 0 0 0 2px var(--th-primary)' } : undefined}
      aria-pressed={autoplay}
    >
      <span
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: autoplay ? 'var(--th-primary)' : 'var(--th-border)', color: autoplay ? '#fff' : 'var(--text-secondary)' }}
      >
        {/* headphone icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
          <rect x="17" y="12" width="4" height="7" rx="1.5" />
          <rect x="3" y="12" width="4" height="7" rx="1.5" />
        </svg>
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-text-primary">Auto-Play {autoplay ? 'on' : 'off'}</span>
        <span className="block text-xs text-text-secondary leading-snug">
          {autoplay ? 'Audio plays automatically.' : 'Tap-to-Play — you control when it plays.'}
        </span>
      </span>
      <span className="shrink-0 w-10 h-6 rounded-full p-0.5 transition-colors" style={{ backgroundColor: autoplay ? 'var(--th-primary)' : 'var(--th-border)' }}>
        <span className="block w-5 h-5 rounded-full bg-white shadow transition-transform" style={{ transform: autoplay ? 'translateX(16px)' : 'translateX(0)' }} />
      </span>
    </button>
  );
}

export default function TourMenu() {
  const [open, setOpen] = useState(false);
  const [hint, clearHint] = useAutoplayHint();

  // Open when the user taps the button OR when onboarding fires the hint. Closing
  // clears the (one-shot) hint so it can't force the menu back open. Derived — no
  // effect needed.
  const shown = open || hint;
  const close = () => { setOpen(false); if (hint) clearHint(); };

  return (
    <>
      <button
        onClick={() => (shown ? close() : setOpen(true))}
        aria-label="Menu" aria-expanded={shown}
        className="fixed top-3 right-3 z-[46] w-10 h-10 rounded-full flex items-center justify-center text-warm-white bg-black/35 hover:bg-black/50 backdrop-blur border border-white/30 shadow-lg"
      >
        {/* three horizontal lines */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {shown && (
        <>
          <div className="fixed inset-0 z-[45]" onClick={close} />
          <div
            className="fixed top-14 right-3 z-[47] w-72 rounded-2xl shadow-2xl bg-warm-white border overflow-hidden"
            style={{ borderColor: 'var(--th-border)' }}
          >
            <AutoPlayMenuItem highlight={hint} />
            {hint && (
              <div className="px-4 py-2.5 border-t text-[13px] leading-snug" style={{ borderColor: 'var(--th-border)', color: 'var(--th-primary)' }}>
                Audio plays automatically. Turn it off here to control when it plays.
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
