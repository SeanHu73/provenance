/**
 * Prepare authored text to be spoken aloud. Two jobs:
 *
 * 1. Strip inline-markup the renderer uses but a listener shouldn't hear —
 *    [photo:N] placeholders, **bold** / *italic* asterisks, and {{#hex}}…{{/}}
 *    colour tags (keeping the words) — then collapse the leftover whitespace.
 *
 * 2. Expand common abbreviations that end in a period so the speech engine
 *    doesn't mistake them for the end of a sentence and insert a long pause
 *    (e.g. the "Jr." in "Leland Stanford Jr. University").
 *
 * Newlines are preserved (as single breaks) so paragraphs still separate.
 */
export function ttsSanitize(text: string | null | undefined): string {
  return expandAbbreviations(
    (text || '')
      .replace(/\[photo:\d+\]/gi, ' ')                     // photo placeholders
      .replace(/\{\{\s*#?[0-9a-fA-F]{3,8}\s*\}\}/g, '')    // colour open tag {{#hex}}
      .replace(/\{\{\s*\/\s*\}\}/g, '')                     // colour close tag {{/}}
      .replace(/\*\*/g, '')                                 // bold markers
      .replace(/\*/g, '')                                   // italic markers
      .replace(/[ \t]+/g, ' ')                              // runs of spaces/tabs
      .replace(/[ \t]*\n[ \t]*/g, '\n')                     // trim around newlines
      .replace(/\n{3,}/g, '\n\n'),                          // cap blank runs
  ).trim();
}

/** Replace period-bearing abbreviations with their spoken form so the "." isn't
 *  read as a sentence boundary. Multi-letter forms (e.g., i.e.) go first. */
function expandAbbreviations(text: string): string {
  return text
    .replace(/\be\.g\.\s*/gi, 'for example, ')
    .replace(/\bi\.e\.\s*/gi, 'that is, ')
    .replace(/\betc\./gi, 'et cetera')
    .replace(/\bvs\.?/gi, 'versus')
    .replace(/\bJr\./g, 'Junior')
    .replace(/\bSr\./g, 'Senior')
    .replace(/\bDr\./g, 'Doctor')
    .replace(/\bProf\./g, 'Professor')
    .replace(/\bMrs\./g, 'Missus')
    .replace(/\bMr\./g, 'Mister')
    .replace(/\bMs\./g, 'Miss');
}

/**
 * Break prepared text into short chunks (~one sentence each, combined up to
 * `maxLen`) so each can be spoken as its own short utterance. This sidesteps the
 * Chrome bug where a single long utterance falls silent after ~15 seconds, while
 * keeping the gaps between chunks small enough to sound continuous.
 */
export function ttsChunks(text: string, maxLen = 120): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [clean];
  const chunks: string[] = [];
  let cur = '';
  const flush = () => { const t = cur.trim(); if (t) chunks.push(t); cur = ''; };

  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > maxLen) {
      // A single very long sentence — split it at word boundaries.
      flush();
      let w = '';
      for (const word of s.split(' ')) {
        if (`${w} ${word}`.trim().length > maxLen) { if (w.trim()) chunks.push(w.trim()); w = word; }
        else w = w ? `${w} ${word}` : word;
      }
      if (w.trim()) chunks.push(w.trim());
    } else if (`${cur} ${s}`.trim().length > maxLen) {
      flush();
      cur = s;
    } else {
      cur = cur ? `${cur} ${s}` : s;
    }
  }
  flush();
  return chunks;
}
