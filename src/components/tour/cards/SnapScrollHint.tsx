'use client';

/**
 * "Keep scrolling" pill + chevron used at the bottom of the first
 * snap section of cards that split content across two snap-scroll
 * sections. Tells the explorer there's more below so they don't
 * accidentally stop at the first one.
 *
 * Positioned absolutely; the surrounding `<section>` needs
 * `position: relative` (use Tailwind's `relative`) for this to anchor
 * to the section's bottom-centre.
 */

export default function SnapScrollHint() {
  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-10">
      <div className="flex flex-col items-center gap-1 animate-gentle-fade">
        <span
          className="px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider shadow-lg"
          style={{ backgroundColor: 'var(--th-primary)', color: 'var(--th-surface)' }}
        >
          Keep scrolling
        </span>
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--th-primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
