/**
 * Server-side loader for the Context Detective's skills + exemplars. The docs/
 * markdown files are the git-versioned source of truth; this reads them at
 * runtime and assembles the (stable, prompt-cacheable) system block for each
 * pass. Each pass sees only the skills it needs — plus the exemplars behind the
 * content firewall. The Gate (later) deliberately gets none of this.
 */

import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'docs', 'context_detective_skills_exemplars');

function read(file: string): string {
  try {
    return fs.readFileSync(path.join(DIR, file), 'utf8');
  } catch (err) {
    console.error('[detective/prompts] could not read', file, err);
    return '';
  }
}

let cache: {
  past: string; voice: string; research: string; grounding: string; parse: string; exemplars: string;
} | null = null;

function skills() {
  if (cache) return cache;
  cache = {
    past: read('Context_Detective_PAST_Skill.md'),
    voice: read('Context_Detective_Narrative_Voice_Skill.md'),
    research: read('Context_Detective_Research_Skill.md'),
    grounding: read('Context_Detective_Grounding_Skill.md'),
    parse: read('Context_Detective_Parse_Skill.md'),
    exemplars: read('Stanford_Wealth_Context_Entries.md'),
  };
  return cache;
}

const FIREWALL =
  '\n\n---\n\n# EXEMPLAR ENTRIES — STYLE ONLY (CONTENT FIREWALL)\n\n'
  + 'These approved entries are the calibration standard for register, depth, and structure. '
  + 'Learn HOW they answer, never WHAT they answer. No fact, date, name, or claim from them may '
  + 'appear in an answer unless it also arrives through the research channel with its own citation.\n\n';

const join = (...parts: string[]) => parts.filter(Boolean).join('\n\n---\n\n');

/** Research pass: P.A.S.T. + Research + Grounding + exemplars. */
export function researchSystem(): string {
  const s = skills();
  return join(s.past, s.research, s.grounding) + FIREWALL + s.exemplars;
}

/** Voice pass: Narrative Voice + exemplars. */
export function voiceSystem(): string {
  const s = skills();
  return s.voice + FIREWALL + s.exemplars;
}

/** Parse pass: Parse + P.A.S.T. (for lens) + exemplars. */
export function parseSystem(): string {
  const s = skills();
  return join(s.parse, s.past) + FIREWALL + s.exemplars;
}

/**
 * Framing Coach pass (fast, Haiku): a quick screen that runs BEFORE the heavy
 * research pipeline. It reorients the learner, decides whether their question is
 * already a good *contextual* question, and — only when it is too narrow, factual,
 * or off-topic — offers a short tip plus a few tap-to-use reframes toward a P.A.S.T.
 * contextual question. It never answers the question. Gets the P.A.S.T. skill (so
 * it knows what a contextual question looks like) plus optional author guidance.
 */
export function frameSystem(coaching?: string): string {
  const s = skills();
  const rules =
    '# FRAMING COACH SKILL\n\n'
    + 'You are the Context Detective\'s fast "framing coach". You run in a couple of seconds, BEFORE any research, '
    + 'to help a learner ask a strong *contextual* question. You NEVER answer the question or state facts about it.\n\n'
    + 'A strong contextual question probes the forces around a topic through a P.A.S.T. lens (Place, Affairs, '
    + 'Society, Technology) — the conditions, causes, values, systems, or changes of a time and place. A weak one is '
    + 'a narrow fact lookup ("what year did X open?", "who designed Y?"), a yes/no, or something with no historical '
    + 'context to explore.\n\n'
    + 'Given the learner\'s question and their chosen lens, return via the tool:\n'
    + '- reorientation: ONE warm, short sentence that mirrors what they seem curious about and ties it to the lens. '
    + 'Never reveal or hint at the answer.\n'
    + '- ok: true if the question is already a good contextual question worth researching as-is.\n'
    + '- needsReframe: true ONLY when it is too narrow/factual/off-topic to yield a rich context. If ok is true, '
    + 'needsReframe MUST be false.\n'
    + '- reframeTip: when needsReframe, one plain sentence on HOW to widen it into a contextual question (empty otherwise).\n'
    + '- suggestedQuestions: when needsReframe, 1–3 concrete rewritten questions the learner could ask instead — each '
    + 'a full contextual question in their voice, staying close to their interest (empty array otherwise).\n\n'
    + 'Be encouraging and brief. Prefer to pass a decent question through (ok:true) rather than nit-pick; only reframe '
    + 'when it genuinely would not research well.';
  const authorNote = coaching && coaching.trim()
    ? `\n\n# TOUR-SPECIFIC COACHING (from the author — weight this heavily)\n\n${coaching.trim()}`
    : '';
  return join(rules + authorNote, s.past);
}
