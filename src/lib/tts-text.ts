/**
 * Strip inline-markup so text reads cleanly aloud. Removes the things the
 * renderer treats as markers but a listener shouldn't hear:
 *   - [photo:N] photo placeholders
 *   - **bold** / *italic* asterisks (keeping the words)
 *   - {{#hex}}…{{/}} colour tags (keeping the words)
 * and collapses the leftover whitespace. Newlines are preserved (as single
 * breaks) so the speech engine still pauses between paragraphs.
 */
export function ttsSanitize(text: string | null | undefined): string {
  return (text || '')
    .replace(/\[photo:\d+\]/gi, ' ')                     // photo placeholders
    .replace(/\{\{\s*#?[0-9a-fA-F]{3,8}\s*\}\}/g, '')    // colour open tag {{#hex}}
    .replace(/\{\{\s*\/\s*\}\}/g, '')                     // colour close tag {{/}}
    .replace(/\*\*/g, '')                                 // bold markers
    .replace(/\*/g, '')                                   // italic markers
    .replace(/[ \t]+/g, ' ')                              // runs of spaces/tabs
    .replace(/[ \t]*\n[ \t]*/g, '\n')                     // trim around newlines
    .replace(/\n{3,}/g, '\n\n')                           // cap blank runs
    .trim();
}
