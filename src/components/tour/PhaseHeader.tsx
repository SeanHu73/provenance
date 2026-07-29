'use client';

/**
 * The tour's phase header.
 *
 * A thin wrapper over the shared JourneyBar so the tour and the Context Journal
 * carry the same black bar: back control, the Explore › Contextualise › Reflect
 * breadcrumb with the current step set larger, the menu, and a "Revisit Stops"
 * row that opens the stops list.
 *
 * This replaces the old diagonal-cut amber segment bar. The header only appears
 * where it already did — nothing new mounts one.
 */

import type { ReactNode } from 'react';
import type { TourPhase } from '@/lib/types';
import JourneyBar, { BarButton } from './JourneyBar';
import { ChevronLeftIcon } from '@/components/icons';

export type PhaseGroup = 'explore' | 'contextualise' | 'reflect';

const CONTEXTUALISE_PHASES: TourPhase[] = ['act_context_intro', 'act_context', 'act_context_questions'];
const REFLECT_PHASES: TourPhase[] = ['act_reflection_intro', 'act_reflection', 'community_share'];

/** Which of the three phases a raw TourPhase belongs to (everything else = explore). */
export function phaseGroup(phase: TourPhase): PhaseGroup {
  if (CONTEXTUALISE_PHASES.includes(phase)) return 'contextualise';
  if (REFLECT_PHASES.includes(phase)) return 'reflect';
  return 'explore';
}

interface Props {
  active: PhaseGroup;
  /** Tap "Revisit Stops" → open the stops list. */
  onOpen?: () => void;
  /** Back chevron on the left, shown only when provided. */
  onBack?: () => void;
  /** The menu control, rendered on the right of the bar. */
  menu?: ReactNode;
  // Accepted for caller compatibility; the breadcrumb shows phases, not counts.
  exploreLabel?: string;
  activeSub?: string;
}

export default function PhaseHeader({ active, onOpen, onBack, menu }: Props) {
  return (
    <JourneyBar
      active={active}
      onOpenJourney={onOpen}
      leading={onBack ? (
        <BarButton label="Go back" onClick={onBack}>
          <ChevronLeftIcon width={18} height={18} />
        </BarButton>
      ) : undefined}
      menu={menu}
    />
  );
}
