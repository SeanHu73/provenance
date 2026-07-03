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
 * RIGHT of the card (with a small right margin). Both render in bronze
 * (--th-accent-dark) so the action header is visually consistent.
 *
 * `investigation` adds a black "The Investigation" sub-title BELOW the
 * action label on EQ-related cards.
 *
 * Per-page subtitles (e.g. "Background", "Context", "Setting the
 * scene...", "Tour complete", "Closing questions", "Mid point check-in",
 * "Share your discussion...") are NOT rendered by this component. Each
 * card renders the SectionSubtitle helper directly above its main
 * content so the subtitle visually pairs with the text / question it
 * introduces instead of being attached to the action header.
 */

type Action = 'DISCUSS' | 'LEARN' | 'FIND' | 'RESPOND';

interface Props {
  action: Action;
  /** Small grey "Opinion" pill rendered under the action label. */
  opinion?: boolean;
  /** Black "The Investigation" subtitle under the action label. */
  investigation?: boolean;
  /** Extra Tailwind classes on the outer wrapper. */
  className?: string;
}

const ICON_SIZE = 64;
const ACTION_TITLE_PX = 44;
const INVESTIGATION_PX = 22;

export default function ActionTitle({
  action,
  opinion = false,
  investigation = false,
  className = '',
}: Props) {
  return (
    <div className={className}>
      {/* Action row — label left, icon right (margin from edge). */}
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
          style={{ color: '#FFFFFF', backgroundColor: '#3F3F46' }}
        >
          Opinion
        </span>
      )}

      {investigation && (
        <p
          className="mt-2 uppercase tracking-[0.14em] font-display font-semibold leading-tight"
          style={{ fontSize: INVESTIGATION_PX, color: '#000' }}
        >
          The Investigation
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
    strokeWidth: 1.8,
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
      // Binoculars (the magnifier now belongs to the P.A.S.T. lens cards).
      return (
        <svg {...common}>
          <circle cx="6" cy="15" r="4" /><circle cx="18" cy="15" r="4" />
          <path d="M10 15a2 2 0 0 1 4 0" />
          <path d="M6 11V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v5" />
          <path d="M18 11V6a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v5" />
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
 * Per-page subtitle — used immediately above the main text / question
 * a section introduces. Theme-primary, uppercase, 22px. Render this
 * DIRECTLY ABOVE the question / paragraph it labels — never attached
 * to the action title — so the subtitle reads as a label for that
 * specific piece of content.
 */
export function SectionSubtitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`uppercase tracking-[0.14em] font-display font-semibold leading-tight ${className}`}
      style={{ fontSize: 22, color: 'var(--th-primary)' }}
    >
      {children}
    </p>
  );
}

/**
 * Italic "Instructions" title used in place of an ActionTitle when the
 * admin has flipped a question background into instructions mode.
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
