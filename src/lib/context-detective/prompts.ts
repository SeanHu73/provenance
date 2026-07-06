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
  past: string; voice: string; research: string; grounding: string; parse: string; frameCoach: string; exemplars: string;
} | null = null;

function skills() {
  if (cache) return cache;
  cache = {
    past: read('Context_Detective_PAST_Skill.md'),
    voice: read('Context_Detective_Narrative_Voice_Skill.md'),
    research: read('Context_Detective_Research_Skill.md'),
    grounding: read('Context_Detective_Grounding_Skill.md'),
    parse: read('Context_Detective_Parse_Skill.md'),
    frameCoach: read('Context_Detective_Framing_Coach_Skill.md'),
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
 * research pipeline. It reorients the learner and, only when the question is
 * off-topic or a bare fact lookup, models a better contextual direction. Gets the
 * Framing Coach skill + the P.A.S.T. skill (for the lens definitions). Tour-specific
 * relevance comes from the TOUR CONTEXT block in the user message, not the system.
 */
export function frameSystem(): string {
  const s = skills();
  return join(s.frameCoach, s.past);
}
