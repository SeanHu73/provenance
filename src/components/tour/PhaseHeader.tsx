'use client';

/**
 * The tour's phase header: EXPLORE → CONTEXTUALISE → REFLECT as connected
 * segments with diagonal cuts between them, faded out at both ends. The current
 * phase is the wide amber segment (full word); the others shrink and truncate.
 * Tapping the bar (or the chevron handle beneath it) opens the stops list. The
 * menu circle sits in the bar so it no longer floats out of the header.
 *
 * `tone` adapts the muted segments to their backdrop: 'light' (white on the light
 * header) or 'dark' (translucent, on the maroon Context Journal header).
 */

import type { ReactNode } from 'react';
import type { TourPhase } from '@/lib/types';

export type PhaseGroup = 'explore' | 'contextualise' | 'reflect';
type Tone = 'light' | 'dark';

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
const FADE = 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)';

const BARS: { key: PhaseGroup; label: string }[] = [
  { key: 'explore', label: 'Explore' },
  { key: 'contextualise', label: 'Contextualise' },
  { key: 'reflect', label: 'Reflect' },
];

// Diagonal "/" cuts; segments overlap by 11px so a thin divider sliver shows.
const CLIP = [
  'polygon(0 0,100% 0,calc(100% - 13px) 100%,0 100%)',
  'polygon(13px 0,100% 0,calc(100% - 13px) 100%,0 100%)',
  'polygon(13px 0,100% 0,100% 100%,0 100%)',
];

interface BarsProps {
  active: PhaseGroup;
  /** Tap the bar → open the stops list. */
  onOpen?: () => void;
  tone?: Tone;
  className?: string;
  // Accepted for caller compatibility; not shown (segments are single-line).
  exploreLabel?: string;
  activeSub?: string;
}

/** Just the segments — reused inside the Context Journal's own header. */
export function PhaseBars({ active, onOpen, tone = 'light', className = '' }: BarsProps) {
  const dividerBg = tone === 'light' ? 'var(--th-border)' : 'rgba(255,255,255,0.28)';
  const muted = tone === 'light'
    ? { backgroundColor: 'var(--warm-white)', color: 'var(--text-secondary)' }
    : { backgroundColor: 'rgba(255,255,255,0.14)', color: 'rgba(251,247,239,0.85)' };
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Explore → Contextualise → Reflect — tap to see your stops"
      className={`relative flex min-w-0 h-9 border-0 bg-transparent p-0 ${onOpen ? 'cursor-pointer' : ''} ${className}`}
      style={{ backgroundColor: dividerBg, WebkitMaskImage: FADE, maskImage: FADE }}
    >
      {BARS.map((b, i) => {
        const isActive = b.key === active;
        return (
          <span
            key={b.key}
            aria-current={isActive ? 'step' : undefined}
            className="flex items-center justify-center overflow-hidden leading-none"
            style={{
              flex: isActive ? '2.5 1 0%' : '1 1 0%',
              minWidth: 0,
              clipPath: CLIP[i],
              marginLeft: i === 0 ? 0 : -11,
              paddingLeft: i === 0 ? 14 : 20,
              paddingRight: i === 2 ? 14 : 16,
              ...(isActive ? { backgroundColor: AMBER, color: INK } : muted),
            }}
          >
            <span
              className="font-sans font-bold uppercase truncate max-w-full"
              style={{ fontSize: isActive ? 13 : 10, letterSpacing: isActive ? '0.02em' : '0.04em', opacity: isActive ? 1 : 0.7 }}
            >
              {b.label}
            </span>
          </span>
        );
      })}
    </button>
  );
}

/** The small chevron dropdown handle shown beneath the bar. */
export function StopsHandle({ onClick, tone = 'light' }: { onClick?: () => void; tone?: Tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Show your stops"
      className="mx-auto flex items-center justify-center px-6 pt-0 pb-1"
      style={{ color: tone === 'light' ? 'var(--text-secondary)' : 'var(--warm-white)' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
    </button>
  );
}

interface Props extends BarsProps {
  /** Back chevron on the left, shown only when provided. */
  onBack?: () => void;
  /** The menu circle, rendered inside the bar. */
  menu?: ReactNode;
}

export default function PhaseHeader({ active, onOpen, onBack, menu }: Props) {
  return (
    <div data-cj-keep className="shrink-0" style={{ backgroundColor: 'var(--th-surface-alt)', borderBottom: '2px solid var(--th-border)' }}>
      <div className="flex items-center gap-2 px-2.5 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        )}
        <PhaseBars active={active} onOpen={onOpen} tone="light" className="flex-1" />
        {menu && <div className="shrink-0">{menu}</div>}
      </div>
      {onOpen && <div className="flex justify-center"><StopsHandle onClick={onOpen} tone="light" /></div>}
    </div>
  );
}
