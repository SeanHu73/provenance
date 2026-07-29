'use client';

/**
 * JourneyBar — the Context Journal's top bar, per the redesign.
 *
 * A black bar carrying a back button, the Explore › Contextualise › Reflect
 * breadcrumb, and the menu control, with an optional "Open journey" row beneath
 * a hairline divider.
 *
 * Geometry and colour come straight from the style guide's Navigation and
 * Progress boards: a 68px row (102px with the journey row), 44px circular
 * controls at white 10%, a divider at white 20% inset to the controls' outer
 * edges, and breadcrumb steps coloured done / current / upcoming.
 *
 * The tour's own PhaseHeader is unchanged and still drives the rest of the app;
 * this is the journal's bar only.
 */

import type { ReactNode } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@/components/icons';

export type JourneyStep = 'explore' | 'contextualise' | 'reflect';

const STEPS: { key: JourneyStep; label: string }[] = [
  { key: 'explore', label: 'Explore' },
  { key: 'contextualise', label: 'Contextualise' },
  { key: 'reflect', label: 'Reflect' },
];

/** Circular 44px control on the bar — the shape both the back and menu use. */
export function BarButton({ label, onClick, expanded, children }: {
  label: string;
  onClick?: () => void;
  /** Set for controls that open a panel, so the state is announced. */
  expanded?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className="shrink-0 flex items-center justify-center rounded-full border-0 text-white"
      style={{
        width: 'var(--ds-nav-button-size)',
        height: 'var(--ds-nav-button-size)',
        backgroundColor: 'var(--ds-nav-button-bg)',
      }}
    >
      {children}
    </button>
  );
}

interface Props {
  active: JourneyStep;
  /** Left control. Omitted leaves the slot empty so the breadcrumb stays centred. */
  leading?: ReactNode;
  /** Right control — the caller owns its dropdown, so it is passed in whole. */
  menu?: ReactNode;
  /** Shows the "Open journey" row when provided. */
  onOpenJourney?: () => void;
}

export default function JourneyBar({ active, leading, menu, onOpenJourney }: Props) {
  const activeIndex = STEPS.findIndex((s) => s.key === active);

  return (
    <header data-cj-keep className="relative shrink-0" style={{ backgroundColor: 'var(--ds-nav-bg)' }}>
      <div
        className="flex items-center gap-2"
        style={{
          height: 'var(--ds-nav-height)',
          paddingLeft: 'var(--ds-nav-inset)',
          paddingRight: 'var(--ds-nav-inset)',
        }}
      >
        {leading ?? <span style={{ width: 'var(--ds-nav-button-size)' }} aria-hidden />}

        <nav aria-label="Journey progress" className="flex flex-1 min-w-0 items-center justify-center gap-1.5">
          {STEPS.map((step, i) => {
            const isCurrent = i === activeIndex;
            const isDone = i < activeIndex;
            return (
              <span key={step.key} className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className="truncate"
                  style={{
                    fontFamily: 'var(--ds-body-s-family)',
                    fontSize: 'var(--ds-body-s-size)',
                    lineHeight: 'var(--ds-body-s-line)',
                    // The guide has no 12px bold token, so Body S carries a bold
                    // weight for the steps the learner has reached.
                    fontWeight: isCurrent || isDone ? 700 : 400,
                    color: isCurrent
                      ? 'var(--ds-step-current)'
                      : isDone
                        ? 'var(--ds-step-done)'
                        : 'var(--ds-step-upcoming)',
                  }}
                >
                  {step.label}
                </span>
                {i < STEPS.length - 1 && (
                  <ChevronRightIcon
                    width={10}
                    height={10}
                    className="shrink-0"
                    style={{ color: 'var(--ds-step-upcoming)' }}
                  />
                )}
              </span>
            );
          })}
        </nav>

        {menu ?? <span style={{ width: 'var(--ds-nav-button-size)' }} aria-hidden />}
      </div>

      {onOpenJourney && (
        <>
          <div
            aria-hidden
            style={{
              height: 1,
              backgroundColor: 'var(--ds-nav-divider)',
              marginLeft: 'var(--ds-nav-inset)',
              marginRight: 'var(--ds-nav-inset)',
            }}
          />
          <button
            type="button"
            onClick={onOpenJourney}
            className="flex w-full items-center justify-center gap-2 border-0 bg-transparent text-white"
            style={{
              height: 'calc(var(--ds-nav-height-expanded) - var(--ds-nav-height))',
              fontFamily: 'var(--ds-body-s-family)',
              fontSize: 'var(--ds-body-s-size)',
              fontWeight: 700,
            }}
          >
            Open journey
            <ChevronDownIcon width={14} height={14} className="shrink-0" />
          </button>
        </>
      )}
    </header>
  );
}
