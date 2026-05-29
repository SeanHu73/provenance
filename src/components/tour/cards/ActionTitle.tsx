'use client';

/**
 * Shared "action" page-title used across every learner card.
 *
 *   DISCUSS  → speech / sound-waves icon (with optional "Opinion" pill)
 *   LEARN    → lightbulb icon
 *   FIND     → magnifying-glass icon
 *   RESPOND  → pen-on-paper icon
 *
 * Layout: the action label sits on the LEFT, the matching icon on the
 * RIGHT of the card (with a small right margin) for breathing room.
 * Both render in bronze (--th-accent-dark) for a consistent look.
 *
 * `investigation` adds a "The Investigation" sub-title BELOW the action
 * label (theme-primary, smaller than the action). Used on every
 * EQ-related card (scene, discuss, additional, opening write, closing,
 * closing-additional, midway).
 *
 * `subtitle` renders an additional uppercase theme-primary line below
 * the action label (and below Investigation when both are present).
 * Used for the legacy page titles ("Background", "Context", "Setting
 * the scene...", "Tour complete", "Closing questions", "Mid point
 * check-in", "Share your discussion...") that the new spec keeps in
 * place underneath the new action title.
 */

type Action = 'DISCUSS' | 'LEARN' | 'FIND' | 'RESPOND';

interface Props {
  action: Action;
  /** Small grey "Opinion" pill rendered under the action label. */
  opinion?: boolean;
  /** "The Investigation" sub-title (smaller than the action, theme primary). */
  investigation?: boolean;
  /** Legacy page subtitle ("Background", "Context", "Setting the scene...", etc.). */
  subtitle?: string;
  /** Extra Tailwind classes on the outer wrapper. */
  className?: string;
}

const ICON_SIZE = 46;
const ACTION_TITLE_PX = 44;
const SUB_TITLE_PX = 22;

export default function ActionTitle({
  action,
  opinion = false,
  investigation = false,
  subtitle,
  className = '',
}: Props) {
  return (
    <div className={className}>
      {/* Action row — label on the left, icon on the right (with a
          small right margin so it doesn't crowd the card edge). */}
      <div
        className="flex items-end justify-between gap-3 pr-2"
        style={{ color: 'var(--th-accent-dark)' }}
      >
        <h2
          className="uppercase tracking-[0.12em] font-display font-bold leading-none"
          style={{ fontSize: ACTION_TITLE_PX }}
        >
          {action}
        </h2>
        <ActionIcon action={action} size={ICON_SIZE} />
      </div>

      {opinion && (
        <span
          className="inline-block mt-2 text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full"
          style={{
            color: 'var(--th-text-secondary)',
            backgroundColor: 'color-mix(in srgb, var(--th-text-secondary) 18%, transparent)',
          }}
        >
          Opinion
        </span>
      )}

      {investigation && (
        <p
          className="mt-2 uppercase tracking-[0.14em] font-display font-semibold leading-tight"
          style={{ fontSize: SUB_TITLE_PX, color: 'var(--th-primary)' }}
        >
          The Investigation
        </p>
      )}

      {subtitle && (
        <p
          className="mt-1 uppercase tracking-[0.14em] font-display font-semibold leading-tight"
          style={{ fontSize: SUB_TITLE_PX, color: 'var(--th-primary)' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

function ActionIcon({ action, size }: { action: Action; size: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  switch (action) {
    case 'DISCUSS':
      return (
        <svg {...common}>
          <circle cx="9" cy="7" r="3" />
          <path d="M3 21v-1.5A4.5 4.5 0 0 1 7.5 15h3A4.5 4.5 0 0 1 15 19.5V21" />
          <path d="M16 9a3 3 0 0 1 0 6" />
          <path d="M18.5 6a6 6 0 0 1 0 12" />
        </svg>
      );
    case 'LEARN':
      return (
        <svg {...common}>
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z" />
        </svg>
      );
    case 'FIND':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'RESPOND':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L13 14l-4 1 1-4 8.5-8.5z" />
        </svg>
      );
  }
}

/**
 * Italic "Instructions" title used in place of an ActionTitle when the
 * admin has flipped a question background into instructions mode. Same
 * theme-primary color and overall size as a subtitle, but italic and
 * NOT uppercase to make the swap visually obvious.
 */
export function InstructionsTitle({ className = '' }: { className?: string }) {
  return (
    <p
      className={`font-display italic font-semibold leading-tight ${className}`}
      style={{ fontSize: 26, color: 'var(--th-primary)' }}
    >
      Instructions
    </p>
  );
}
