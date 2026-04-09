import type { ContextType } from "./types";

// Each "stop" has a primary question + alternatives. The storyteller picks
// one (or writes their own) and answers it. Templates use [GUIDE] and [ERA]
// which are replaced at render time with the guide's name/era.

export interface QuestionStop {
  id: string;
  label: string; // shown above the question, e.g. "Stop 1 — The hook"
  purpose: string; // helper text for the storyteller
  primary: string;
  alternatives: string[];
  // Whether the platform should suggest toggling lookFirst on for this stop
  suggestLookFirst?: boolean;
}

export interface QuestionJourney {
  contextType: ContextType;
  arc: string; // pedagogical arc summary
  guideHint: string; // suggested guide types
  stops: QuestionStop[];
}

export const QUESTION_JOURNEYS: Record<ContextType, QuestionJourney> = {
  architectural: {
    contextType: "architectural",
    arc: "Group observation → Interpretation through perspective → Hidden complexity → Connection to the larger world",
    guideHint:
      "The architect, the builder, a craftsperson, a preservationist, a resident who watched it change, or yourself.",
    stops: [
      {
        id: "arch-1",
        label: "Stop 1 — The hook",
        purpose: "Get everyone looking at the same thing, then noticing different things about it.",
        primary:
          "What's the first thing you'd point to if you were standing here with friends?",
        alternatives: [
          "If a group walked past this in 30 seconds, what would they all miss?",
          "What detail here would make [GUIDE] proud — or angry, or sad?",
          "What would [GUIDE] point to first, and why?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "arch-2",
        label: "Stop 2 — The meaning",
        purpose: "Move from observation to interpretation, grounded in the guide's perspective.",
        primary:
          "Why does this detail matter to [GUIDE]? What would they want people to understand about it?",
        alternatives: [
          "If [GUIDE] could overhear a tour group being told about this, what would they want to correct or add?",
          "What does this detail reveal about [GUIDE]'s time — something a person from today might not immediately grasp?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "arch-3",
        label: "Stop 3 — The hidden layer",
        purpose: "Reward deeper knowledge — the thing only someone with the guide's experience can see.",
        primary:
          "What would [GUIDE] notice here that a casual visitor never would?",
        alternatives: [
          "Is there something here that contradicts the obvious story — a repair, a seam, an alteration?",
          "What surprised you most when you first learned about this place?",
          "If your group could peel back one layer, what would [GUIDE] want them to see underneath?",
        ],
      },
      {
        id: "arch-4",
        label: "Stop 4 — The connection",
        purpose: "Zoom out. Connect the specific to the general, through the guide's world.",
        primary:
          "What was [GUIDE]'s world like beyond this place? What else were they connected to?",
        alternatives: [
          "This place belongs to a style or movement. What are its siblings? Where should a group go next?",
          "What would [GUIDE] want this group to do after they leave here?",
          "If [GUIDE] could see this place today, would they recognise it? Would they be proud, heartbroken, or confused?",
        ],
      },
    ],
  },

  historical: {
    contextType: "historical",
    arc: "The event through a witness → Physical evidence the group can find → The untold dimension → The ripple effects",
    guideHint:
      "A participant, a witness, someone affected, someone who resisted, someone excluded from the official story, or yourself.",
    stops: [
      {
        id: "hist-1",
        label: "Stop 1 — The story",
        purpose: "Tell what happened from the guide's first-person position.",
        primary:
          "Tell it as [GUIDE] would tell it. Not the textbook version — their version. What did they see, hear, experience?",
        alternatives: [
          "If [GUIDE] had 60 seconds to tell strangers what happened here, what would they say?",
          "Start with the moment — what did it look, sound, or feel like right here when it happened?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "hist-2",
        label: "Stop 2 — The evidence",
        purpose: "What physical traces can the group still find?",
        primary:
          "What can a group still see, touch, or stand on here that connects to what [GUIDE] experienced?",
        alternatives: [
          "If [GUIDE] returned today, what would they recognise — and what would be unrecognisable?",
          "Point at something here that was a witness. What would [GUIDE] say it 'saw'?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "hist-3",
        label: "Stop 3 — The untold dimension",
        purpose: "Surface what's usually left out of the official story.",
        primary:
          "What part of [GUIDE]'s experience is usually left out of the official story?",
        alternatives: [
          "If [GUIDE] could add one sentence to every plaque about this event, what would it say?",
          "What's the version of this story [GUIDE] told their family — and how is it different from the version in history books?",
          "If you could interview [GUIDE], what question would you ask that no one else has asked?",
        ],
      },
      {
        id: "hist-4",
        label: "Stop 4 — The ripple",
        purpose: "Why this still matters now.",
        primary:
          "How did this event change things for people like [GUIDE] — not just here, but broadly?",
        alternatives: [
          "Is [GUIDE]'s story finished, or is it still unfolding?",
          "Who today considers themselves part of [GUIDE]'s story? Is it celebrated, mourned, contested, or forgotten?",
          "If [GUIDE] could send a message forward in time to your group, what would they want them to do with this knowledge?",
        ],
      },
    ],
  },

  community: {
    contextType: "community",
    arc: "Who it matters to → The insider view → The living tradition → Change and continuity",
    guideHint:
      "A community elder, a long-time resident, a business owner, a cultural practitioner, a young person carrying tradition forward, or yourself.",
    stops: [
      {
        id: "com-1",
        label: "Stop 1 — The people",
        purpose: "Belonging, not ownership. Who calls this place theirs?",
        primary:
          "Who considers this place theirs — and what would [GUIDE] say makes it theirs?",
        alternatives: [
          "If this place disappeared tomorrow, what would [GUIDE] grieve most — the building, or something else?",
          "Is there a name for this place that only [GUIDE]'s community uses?",
          "When [GUIDE] brings someone new here, what's the first thing they show them?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "com-2",
        label: "Stop 2 — The insider view",
        purpose: "What outsiders don't see.",
        primary:
          "What would [GUIDE] want visiting groups to understand that no guidebook would tell them?",
        alternatives: [
          "Is there an unwritten rule about this place — something [GUIDE]'s people just know?",
          "What smell, sound, or feeling does [GUIDE] associate with this place?",
          "What's the thing [GUIDE] is tired of explaining — and what's the thing they never tire of sharing?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "com-3",
        label: "Stop 3 — The living story",
        purpose: "What gets passed down. Oral tradition and lived memory.",
        primary:
          "Is there a story about this place that gets told and retold in [GUIDE]'s community?",
        alternatives: [
          "Who's the person who knows the most about this place? What have they told [GUIDE]?",
          "Has this story ever been told 'wrong' by outsiders? What did they get wrong?",
          "Is there a disagreement within the community about this place?",
        ],
      },
      {
        id: "com-4",
        label: "Stop 4 — Change and continuity",
        purpose: "What's changed, what's stayed the same, what's at stake.",
        primary:
          "What has changed here in [GUIDE]'s lifetime — and what has somehow stayed the same?",
        alternatives: [
          "Is this place under threat? What would it mean to lose it?",
          "Are young people still connected here, or is [GUIDE] part of the last generation who remembers?",
          "What does [GUIDE] hope a group standing here in 20 years will find?",
        ],
      },
    ],
  },

  personal: {
    contextType: "personal",
    arc: "The memory → The physical trace → The change → The meaning",
    guideHint:
      "Default: yourself. This context type is personal testimony — the guide IS you.",
    stops: [
      {
        id: "pers-1",
        label: "Stop 1 — The memory",
        purpose: "Sensory, specific, cinematic.",
        primary:
          "Close your eyes for a second. What's the first thing you remember about this place?",
        alternatives: [
          "Tell us a specific moment — not a summary. Who was there, what happened, what did it feel like?",
          "If you could take a group back in time to experience this place as you knew it, what would they see, hear, smell?",
          "What brought you here the first time — or the time that mattered most?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "pers-2",
        label: "Stop 2 — The physical trace",
        purpose: "What's still here that connects to your memory?",
        primary:
          "Is there anything a group can still find here that connects to your memory?",
        alternatives: [
          "Stand where you used to stand. Look where you used to look. What's the same?",
          "If a group had never heard your story, would anything here hint at it?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "pers-3",
        label: "Stop 3 — The change",
        purpose: "What's gone, what's new.",
        primary:
          "What was here then that isn't now — or what's here now that wasn't?",
        alternatives: [
          "What would surprise you most if you went back?",
          "Is the change for the better, worse, or just different?",
        ],
      },
      {
        id: "pers-4",
        label: "Stop 4 — The meaning",
        purpose: "Why are you sharing this, and what should the group take away?",
        primary:
          "Why does this place still matter to you — and why are you sharing it with strangers?",
        alternatives: [
          "What do you want this group to feel when they stand here and hear your story?",
          "If your memory were lost — if no one ever told it — what would be missing from the story of this place?",
        ],
      },
    ],
  },

  mystery: {
    contextType: "mystery",
    arc: "The hook → The clues → The theory → The group investigation",
    guideHint:
      "Yourself as investigator, 'the question itself', or a historical figure who might have known the answer.",
    stops: [
      {
        id: "myst-1",
        label: "Stop 1 — The hook",
        purpose: "What made you stop and look? What doesn't quite make sense?",
        primary:
          "What made you stop and look? What's the thing here that doesn't quite make sense?",
        alternatives: [
          "You've walked past this how many times? What made you finally notice it?",
          "If this place were a puzzle, what's the piece that doesn't fit?",
          "What question does this place ask — even if nobody can answer it?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "myst-2",
        label: "Stop 2 — The clues",
        purpose: "What can the group find right now to investigate?",
        primary:
          "What clues can a group find — on the spot, right now — that might help explain this?",
        alternatives: [
          "Have you tried to find out the answer? Where did the trail go cold?",
          "What does the context tell you? What's nearby, what era, what kind of place is this?",
          "What would a group need to look at, measure, compare, or photograph to start solving this?",
        ],
        suggestLookFirst: true,
      },
      {
        id: "myst-3",
        label: "Stop 3 — The theory",
        purpose: "Permission to speculate. Your best guess and why.",
        primary:
          "What's your best theory? You don't need to be right — tell the group what you think and why.",
        alternatives: [
          "If you had to bet, what's the explanation — and what's the one piece of evidence?",
          "Are there competing theories? What would someone who disagrees say?",
        ],
      },
      {
        id: "myst-4",
        label: "Stop 4 — The investigation",
        purpose: "Send the group on an active task.",
        primary:
          "What should this group look at, find, or investigate right now to test the theories?",
        alternatives: [
          "What question should this group carry with them to the next place they visit?",
          "If they come back in a year, what should they check? What might change?",
          "Who should they talk to? Is there a person, a museum, a book with the missing piece?",
        ],
      },
    ],
  },
};

// Replace [GUIDE] / [ERA] / [ROLE] in a question template with guide values.
export function fillTemplate(
  template: string,
  guide: { name: string; era: string; role: string } | null | undefined
): string {
  if (!guide) return template;
  return template
    .replace(/\[GUIDE\]/g, guide.name || "the guide")
    .replace(/\[ERA\]/g, guide.era || "their time")
    .replace(/\[ROLE\]/g, guide.role || "guide");
}
