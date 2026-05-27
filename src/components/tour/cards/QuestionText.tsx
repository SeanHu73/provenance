'use client';

/**
 * Styled discussion question text — Marigold Sans, larger than the
 * surrounding body text, left-aligned, themed to --th-secondary so it
 * sits distinct from the page title (which uses --th-primary). Used
 * across all discussion-question cards (per-stop wonder, EQ discuss,
 * EQ additional, EQ closing echo, midway check-in).
 */

import FormattedText from './FormattedText';

interface Props {
  text: string;
  /** Tailwind size override. Defaults to text-[30px]. */
  sizeClass?: string;
  className?: string;
}

export default function QuestionText({ text, sizeClass = 'text-[30px]', className = '' }: Props) {
  return (
    <p
      className={`${sizeClass} leading-snug font-marigold-sans text-left ${className}`}
      style={{ color: 'var(--th-secondary)' }}
    >
      <FormattedText text={text} />
    </p>
  );
}
