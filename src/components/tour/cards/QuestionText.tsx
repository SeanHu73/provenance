'use client';

/**
 * Styled discussion question text — body serif (Newsreader), larger
 * than the surrounding body text, left-aligned, themed to bronze
 * (--th-accent-dark) so it sits distinct from the page title (which
 * uses the theme primary). Used across all discussion-question cards
 * (per-stop wonder, EQ discuss, EQ additional, EQ closing echo,
 * midway check-in).
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
      className={`${sizeClass} leading-snug font-serif text-left ${className}`}
      style={{ color: 'var(--th-accent-dark)' }}
    >
      <FormattedText text={text} />
    </p>
  );
}
