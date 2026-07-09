'use client';

/**
 * The tour's phase header: three slant-split bars — EXPLORE → CONTEXTUALISE →
 * REFLECT — that replace the old title bar + progress pills and show at the top
 * of every phase. The current phase is filled (amber); the others are muted with
 * smaller text. Tapping EXPLORE opens the stops list. The menu circle sits in the
 * bar (passed as `menu`) so it no longer floats out of the header.
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

const BARS: { key: PhaseGroup; label: string }[] = [
  { key: 'explore', label: 'Explore' },
  { key: 'contextualise', label: 'Contextualise' },
  { key: 'reflect', label: 'Reflect' },
];

// Slanted "/" dividers; bars overlap by 11px so a thin ink sliver shows between.
const CLIP = [
  'polygon(0 0,100% 0,calc(100% - 13px) 100%,0 100%)',
  'polygon(13px 0,100% 0,calc(100% - 13px) 100%,0 100%)',
  'polygon(13px 0,100% 0,100% 100%,0 100%)',
];

interface BarsProps {
  active: PhaseGroup;
  exploreLabel?: string;
  activeSub?: string;
  onExplore?: () => void;
  className?: string;
}

/** Just the three slant-split bars — reused inside the Context Journal's own
 *  header (which already supplies the maroon bar + its own menu). */
export function PhaseBars({ active, exploreLabel, activeSub, onExplore, className = '' }: BarsProps) {
  return (
    <div className={`relative flex min-w-0 h-11 rounded-[11px] overflow-hidden ${className}`} style={{ backgroundColor: INK, border: `2.5px solid ${INK}` }}>
      {BARS.map((b, i) => {
        const isActive = b.key === active;
        const sub = b.key === 'explore' ? exploreLabel : (isActive ? activeSub : undefined);
        const tappable = b.key === 'explore' && !!onExplore;
        return (
          <button
            key={b.key}
            type="button"
            onClick={tappable ? onExplore : undefined}
            aria-current={isActive ? 'step' : undefined}
            aria-label={`${b.label}${tappable ? ' — see your stops' : ''}`}
            className="relative flex-1 flex flex-col items-center justify-center gap-0.5 border-0 leading-none"
            style={{
              clipPath: CLIP[i],
              marginLeft: i === 0 ? 0 : -11,
              paddingLeft: 6,
              paddingRight: 6,
              backgroundColor: isActive ? AMBER : 'var(--warm-white)',
              color: isActive ? INK : 'var(--text-secondary)',
              cursor: tappable ? 'pointer' : 'default',
            }}
          >
            <span className="font-sans font-extrabold uppercase" style={{ fontSize: isActive ? 13 : 10, letterSpacing: '0.03em', opacity: isActive ? 1 : 0.7 }}>{b.label}</span>
            {sub && <span className="font-sans" style={{ fontSize: 8.5, opacity: 0.85 }}>{sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

interface Props extends BarsProps {
  /** Back chevron on the left, shown only when provided. */
  onBack?: () => void;
  /** The menu circle, rendered inside the bar. */
  menu?: ReactNode;
}

export default function PhaseHeader({ active, exploreLabel, activeSub, onExplore, onBack, menu }: Props) {
  return (
    <div
      data-cj-keep
      className="shrink-0 flex items-stretch gap-2 px-2 py-2"
      style={{ backgroundColor: 'var(--th-primary)', borderBottom: `3px solid ${INK}` }}
    >
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
      <PhaseBars active={active} exploreLabel={exploreLabel} activeSub={activeSub} onExplore={onExplore} className="flex-1" />
      {menu && <div className="shrink-0 self-center">{menu}</div>}
    </div>
  );
}
