'use client';

/**
 * Shared "action" page-title used across every learner card.
 *
 *   DISCUSS  → speech / sound-waves icon (with optional "Opinion" pill)
 *   LEARN    → lightbulb icon
 *   FIND     → magnifying-glass icon
 *   RESPOND  → pen-on-paper icon
 *
 * `investigation` adds a small "The Investigation" eyebrow above the
 * action label — used on every EQ-related card (scene, discuss,
 * additional, opening write, closing, closing-additional, midway).
 *
 * The legacy per-screen heading (e.g. "Background...", "Context",
 * "Share your discussion...") is kept by the calling card and rendered
 * directly below this component when present. When the spec says
 * "change title to X" the legacy heading is dropped; when it says
 * "keep same font style but also put X title that's larger on top",
 * the calling card keeps its existing heading and renders ActionTitle
 * above it.
 */

type Action = 'DISCUSS' | 'LEARN' | 'FIND' | 'RESPOND';

interface Props {
  action: Action;
  /** Small grey "Opinion" pill to the right of the action label. */
  opinion?: boolean;
  /** "The Investigation" eyebrow above the action label. */
  investigation?: boolean;
  /** Override the action-title colour. Defaults to `var(--th-primary)`
   *  (aged-gold in the Red theme, Palo Alto teal in the Teal theme). */
  color?: string;
  /** Extra Tailwind classes on the outer wrapper (e.g. margin). */
  className?: string;
}

const ICON_SIZE = 32;

export default function ActionTitle({
  action,
  opinion = false,
  investigation = false,
  color,
  className = '',
}: Props) {
  return (
    <div className={className}>
      {investigation && (
        <p
          className="text-[12px] uppercase tracking-[0.22em] font-display font-medium mb-1.5"
          style={{ color: 'var(--th-text-secondary)' }}
        >
          The Investigation
        </p>
      )}
      <div
        className="flex items-center gap-2.5 flex-wrap"
        style={{ color: color ?? 'var(--th-primary)' }}
      >
        <h2 className="text-[34px] uppercase tracking-[0.14em] font-display font-bold leading-none">
          {action}
        </h2>
        <ActionIcon action={action} />
        {opinion && (
          <span
            className="text-[11px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              color: 'var(--th-text-secondary)',
              backgroundColor: 'color-mix(in srgb, var(--th-text-secondary) 18%, transparent)',
            }}
          >
            Opinion
          </span>
        )}
      </div>
    </div>
  );
}

function ActionIcon({ action }: { action: Action }) {
  switch (action) {
    case 'DISCUSS':
      return (
        // Person with sound-wave arcs — "person talking"
        <svg
          width={ICON_SIZE}
          height={ICON_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="9" cy="7" r="3" />
          <path d="M3 21v-1.5A4.5 4.5 0 0 1 7.5 15h3A4.5 4.5 0 0 1 15 19.5V21" />
          <path d="M16 9a3 3 0 0 1 0 6" />
          <path d="M18.5 6a6 6 0 0 1 0 12" />
        </svg>
      );
    case 'LEARN':
      return (
        // Lightbulb
        <svg
          width={ICON_SIZE}
          height={ICON_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2z" />
        </svg>
      );
    case 'FIND':
      return (
        // Magnifying glass
        <svg
          width={ICON_SIZE}
          height={ICON_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'RESPOND':
      return (
        // Pen on paper
        <svg
          width={ICON_SIZE}
          height={ICON_SIZE}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L13 14l-4 1 1-4 8.5-8.5z" />
        </svg>
      );
  }
}
