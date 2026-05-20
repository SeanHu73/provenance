'use client';

import { useTour } from '@/context/TourContext';

/**
 * Small back button to place beside continue/action buttons.
 * Only renders when there's history to go back to.
 */
export default function BackButton() {
  const { goBack, canGoBack } = useTour();
  if (!canGoBack) return null;

  return (
    <button
      onClick={goBack}
      className="shrink-0 w-14 rounded-lg flex items-center justify-center text-[#5C4A35] border-2 border-[#7A7A5E] hover:bg-[#D4BFA0]/20 transition-colors self-stretch"
      title="Go back"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
