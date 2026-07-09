'use client';

/**
 * The tour's phase header: breadcrumb-arrow bars — EXPLORE → CONTEXTUALISE →
 * REFLECT — that replace the old title bar + progress pills and show at the top
 * of every phase. The current phase is the wide amber arrow (full word); the
 * others shrink and truncate. Tapping the bar (or the "Stops" handle beneath it)
 * opens the stops list. The menu circle sits in the bar so it no longer floats
 * out of the header.
 */

import type { ReactNode } from 'react';
import type { TourPhase } from '@/lib/types';

export type PhaseGroup = 'explore' | 'contextualise' | 'reflect';

const CONTEXTUALISE_PHASES: TourPhase[] = ['act_context_intro', 'act_context', 'act_context_questions'];
const REFLECT_PHASES: TourPhase[] = ['act_reflection_intro', 'act_reflection', 'community_share'];

/** Which of the three phases a raw TourPhase belongs to (everything else = explore). */
export function phaseGroup(phase: TourPhase): PhaseGroup {
  if (CONTEXTUALISE_PHASES.includes(phase)) return 'contextualise';
  if (REFLECT_PHASES.includes(phase)) return 'reflect';
  return 'explore';
}

const INK = '#241f1b';
const AMBER = '#F59E0B';
const MUTE = '#e7dcc6';

const BARS: { key: PhaseGroup; label: string }[] = [
  { key: 'explore', label: 'Explore' },
  { key: 'contextualise', label: 'Contextualise' },
  { key: 'reflect', label: 'Reflect' },
];

// Right-pointing breadcrumb arrows: first flat-left→point, middle notch→point,
// last notch→flat. They overlap so the points nest into the next notch.
const CLIP = [
  'polygon(0 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,0 100%)',
  'polygon(14px 0,calc(100% - 14px) 0,100% 50%,calc(100% - 14px) 100%,14px 100%,0 50%)',
  'polygon(14px 0,100% 0,100% 100%,14px 100%,0 50%)',
];

interface BarsProps {
  active: PhaseGroup;
  exploreLabel?: string;
  activeSub?: string;
  /** Tap the bar → open the stops list. */
  onOpen?: () => void;
  className?: string;
}

/** Just the breadcrumb bars — reused inside the Context Journal's own header. */
export function PhaseBars({ active, exploreLabel, activeSub, onOpen, className = '' }: BarsProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Explore → Contextualise → Reflect — tap to see your stops"
      className={`relative flex min-w-0 h-10 border-0 bg-transparent p-0 ${onOpen ? 'cursor-pointer' : ''} ${className}`}
    >
      {BARS.map((b, i) => {
        const isActive = b.key === active;
        const sub = isActive ? (b.key === 'explore' ? exploreLabel : activeSub) : undefined;
        return (
          <span
            key={b.key}
            aria-current={isActive ? 'step' : undefined}
            className="relative flex flex-col items-center justify-center overflow-hidden leading-none"
            style={{
              flex: isActive ? '2.6 1 0%' : '1 1 0%',
              minWidth: 0,
              clipPath: CLIP[i],
              marginLeft: i === 0 ? 0 : -11,
              paddingLeft: i === 0 ? 12 : 20,
              paddingRight: i === 2 ? 12 : 18,
              backgroundColor: isActive ? AMBER : MUTE,
              color: isActive ? INK : 'var(--text-secondary)',
              zIndex: isActive ? 2 : 1,
            }}
          >
            <span className="font-sans font-extrabold uppercase truncate max-w-full" style={{ fontSize: isActive ? 13.5 : 10, letterSpacing: '0.03em', opacity: isActive ? 1 : 0.72 }}>{b.label}</span>
            {sub && <span className="font-sans truncate max-w-full" style={{ fontSize: 8.5, opacity: 0.85 }}>{sub}</span>}
          </span>
        );
      })}
    </button>
  );
}

/** The small "Stops ⌄" dropdown handle shown beneath the bar. */
export function StopsHandle({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Show your stops"
      className="mx-auto flex items-center gap-1.5 px-3.5 pt-0.5 pb-1 text-warm-white"
    >
      <span className="font-sans font-extrabold uppercase" style={{ fontSize: 9.5, letterSpacing: '0.1em', opacity: 0.9 }}>Stops</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

interface Props extends BarsProps {
  /** Back chevron on the left, shown only when provided. */
  onBack?: () => void;
  /** The menu circle, rendered inside the bar. */
  menu?: ReactNode;
}

export default function PhaseHeader({ active, exploreLabel, activeSub, onOpen, onBack, menu }: Props) {
  return (
    <div data-cj-keep className="shrink-0" style={{ backgroundColor: 'var(--th-primary)', borderBottom: `3px solid ${INK}` }}>
      <div className="flex items-stretch gap-2 px-2 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center text-warm-white hover:bg-white/15"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <PhaseBars active={active} exploreLabel={exploreLabel} activeSub={activeSub} onOpen={onOpen} className="flex-1" />
        {menu && <div className="shrink-0 self-center">{menu}</div>}
      </div>
      {onOpen && <div className="flex justify-center"><StopsHandle onClick={onOpen} /></div>}
    </div>
  );
}
