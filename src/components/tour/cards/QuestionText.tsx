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
  // Question text has no associated photos at the rendering layer
  // (photos belong on the question's background section), so any
  // [photo:N] markers in the authored text should be hidden rather
  // than rendered literally.
  const stripped = text.replace(/\[photo:\s*\d*\s*\]/gi, '').replace(/\s{2,}/g, ' ').trim();
  return (
    <p
      className={`${sizeClass} leading-snug font-serif text-left ${className}`}
      style={{ color: 'var(--th-accent-dark)' }}
    >
      <FormattedText text={stripped} />
    </p>
  );
}
