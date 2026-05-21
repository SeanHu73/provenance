# Provenance — Design Update: Social Learning & Guide Avatars

*Sean Hu · April 2026*
*This document captures two major design changes and their implications. Add to docs/ folder.*

---

## Change 1: Social, Collaborative Learning by Default

### What changed

The platform assumes explorers are in groups — friends, classmates, families, travel companions. The phone is a shared object that sparks conversation between people, not a private screen for solo consumption. Solo use still works, but the language, prompts, and interaction design all assume multiple people are looking, talking, and theorising together.

### What this changes in the explorer experience

**Questions become discussion prompts.** Instead of "What do you notice about the colours?" the guide asks "Look at the mosaic together — does everyone see the same thing? What's different about the left and right sides?" The shift is from internal reflection to group conversation.

**"Look moments" become group activities.** Instead of "Put your phone down and look" it becomes "Everyone look up. Find the cornerstone. Before you read on — does anyone want to guess the date?" The phone goes in someone's pocket while the group talks.

**The screen is a gathering point, not a personal device.** One person holds the phone (or it sits on a railing, a bench). Everyone clusters around it between moments of looking outward. The UI should assume it's being read aloud or passed around — text should be large enough to read from a slight distance, prompts should be short enough to say out loud.

**Discussion pauses replace individual response fields.** Instead of a text box where one person types an answer, the app shows: "Discuss this with your group" with a timer or a "We've discussed it — continue" button. No one has to type anything. The conversation is the learning.

### What this changes in the storyteller flow

Storytellers are now designing a **group experience**, not an information card. The question journey prompts should coach them to think: "What would make a group of friends argue productively about this?" rather than "What information should I share?"

The prompt tree should include guidance like:
- "Imagine 3–4 friends standing here. What question would get them debating?"
- "Is there something here where people might see different things or reach different conclusions? That's your best discussion prompt."
- "The best moments are when the group disagrees — then discovers why."

### What this changes in the UI

- Text should be at least 15px body, 18px for prompts/questions — readable when held at arm's length
- "Discuss with your group" buttons replace text input fields for explorer responses
- Timer option on discussion pauses (30 seconds, 1 minute, or "We're ready")
- Questions should be phrased in second person plural or directed at groups: "Can you find..." / "Does your group agree..." / "Talk about this..."
- Consider a "Read aloud" button that uses text-to-speech so the group can listen together without huddling over one screen

### What this does NOT change

- Solo explorers can still use the app — they just skip the discussion pauses or use them for personal reflection
- The storyteller flow itself is still individual (one person creates a pin)
- The map, tags, connections, and community features are unchanged
- Upvotes and contributions remain individual actions

---

## Change 2: Guide Avatars (Perspective Characters)

### What changed

Storytellers can create a **guide character** — a perspective through which the exploration is narrated and questions are posed. This could be:

- **A real historical figure** — "Ah Ling, a Chinese railroad worker who helped build the transcontinental railroad, 1865"
- **A composite character** — "Maria, a Mexican-American resident of this neighbourhood in the 1940s"
- **The storyteller themselves** — "James, Stanford class of '74, who studied under the oak trees that used to be here"
- **An unnamed perspective** — "A stonemason who worked on this building" (when the specific person is unknown)

### Why this matters pedagogically

**1. Perspective-taking is embedded by design.** When the guide is a Chinese railroad worker, every question comes from that perspective. "Look at this station. My hands helped build it. My family was not allowed to ride in the passenger cars. What do you see when you look at it now?" The explorer cannot engage neutrally — they must reckon with a specific human position.

**2. Presentism is naturally disrupted.** A guide from 1865 doesn't think like a person from 2026. Their questions, their values, their concerns are rooted in their time. "What would this person have thought about X?" is a fundamentally different question from "What do we think about X?" — and the gap between those two answers is where historical thinking lives.

**3. Multiple guides on the same place create dialogue.** If one storyteller creates a guide who is the architect of a building, and another creates a guide who is a labourer who built it, the same location now has two perspectives an explorer can engage with. The platform doesn't tell them which is "right" — it lets them sit with the complexity.

**4. It helps storytellers.** "What question should I ask?" is vague. "What would Ah Ling want visitors to understand?" is specific and actionable. The avatar gives the storyteller a character to inhabit, which makes the creative process easier, not harder.

### How it works in the storyteller flow

**After choosing context type and before writing the takeaway, the storyteller creates their guide:**

1. **"Who will guide this exploration?"** — three options:
   - "A real person from history" → name, role, era, one-sentence description
   - "A character I'm creating" → name, role, era, one-sentence description, note that this is a composite
   - "Myself" → uses the storyteller's own profile

2. **"In one sentence, what is this person's relationship to this place?"**
   Examples: "He built it with his own hands." / "She protested here in 1968." / "He worshipped here every Sunday for 40 years." / "I grew up on this block."

3. **"What does this person want visitors to understand that they might not see on their own?"**
   This replaces the previous "takeaway" prompt. It's now voiced through the guide's perspective.

**The guide appears throughout the exploration:**

- A small avatar (initials + name + era) appears at the top of the exploration
- Questions are attributed to the guide: *Ah Ling asks: "Look at the tracks. Who do you think laid each of these rails?"*
- The guide's perspective statement appears at the end as the culmination
- If the storyteller is the guide themselves, it reads as personal testimony

### How it changes the question journeys

Every question in the journey trees should be reframed as coming from the guide's perspective. The platform does this automatically based on the guide's name and role:

**Before (generic):** "What happened here? Tell it simply."
**After (with guide):** "If [Ah Ling] were standing here with your group, what story would he tell? What happened here — from his perspective?"

**Before:** "What's one thing about this event that most people don't know?"
**After:** "[Ah Ling] says: 'There's something about this place that the history books leave out.' As a group, can you guess what it might be?"

**Before:** "How did this event change this place?"
**After:** "What changed for people like [Ah Ling] after this happened? And what changed for everyone else? Are those the same story?"

The platform should template these transformations: `[GUIDE_NAME] asks:` or `From [GUIDE_NAME]'s perspective:` — so the storyteller writes the raw content and the platform frames it through the character.

### Data model additions

```javascript
{
  // ... existing pin fields ...
  guide: {
    name: string,           // "Ah Ling"
    role: string,           // "Railroad worker"
    era: string,            // "1865"
    relationship: string,   // "He built this station with his own hands"
    perspective: string,    // "What visitors might not see on their own"
    type: "historical" | "composite" | "self",
    avatarInitials: string  // "AL" (auto-generated from name)
  }
}
```

### Important constraints

- **No AI-generated dialogue for historical figures.** The storyteller writes what the guide says. The platform frames it ("Ah Ling asks:") but never generates words and puts them in a real person's mouth. The storyteller is responsible for representing the guide faithfully.
- **Composite characters should be labeled.** If the guide is a composite ("based on the experiences of Chinese railroad workers"), the explorer should see this noted somewhere — perhaps a small "composite character" tag under the avatar. Honesty about sources is core to the platform's values.
- **"Myself" guides are the simplest path.** For personal/memory context type, the storyteller is almost always the guide. This should be the default suggestion for that context type.

---

## Revised Question Language Examples

Here's how the social framing + guide avatar changes the feel of key questions across context types. These are examples, not exhaustive rewrites.

### Architectural / Physical (Guide: the architect)

**Stop 1:** "[Architect's name] designed this with a specific intention. As a group, look at the facade for 30 seconds. What do you think they were trying to make you feel?"

**Stop 2:** "Now look at [specific detail]. [Architect] chose this deliberately — but it wasn't cheap or easy. Why would someone fight for this detail? Discuss."

**Stop 3:** "[Architect] wouldn't recognise this anymore. Something has changed — can your group find what's different from the original? Hint: look at the [material/area]."

### Historical Event (Guide: a participant or witness)

**Stop 1:** "[Guide name] was here when it happened. Before you read their account — does your group know anything about what took place here? Share what you know, then continue."

**Stop 2:** "[Guide] says: 'This is what it looked like.' Look around — what physical evidence of that day can your group find?"

**Stop 3:** "[Guide] says: 'The official story leaves out what happened to people like me.' What do you think that might be? Discuss before reading on."

### Community / Cultural (Guide: a community member)

**Stop 1:** "[Guide name] considers this place home. As outsiders looking in, what can your group see that might tell you why?"

**Stop 2:** "[Guide] says: 'There's something about this place that only we know.' Can your group guess what an insider would want you to understand?"

### Personal / Memory (Guide: the storyteller themselves)

**Stop 1:** "[Storyteller name] stood right where you're standing, [X years] ago. They remember it differently. Before you hear their memory — what do you see right now?"

**Stop 2:** "What [Storyteller] remembers is gone now. But they say there's still a trace. Can your group find it?"

### Mystery / Inquiry (Guide: could be anyone — or "the question itself")

**Stop 1:** "Nobody knows the answer to this one — not even the person who made this pin. Look at [detail]. As a group, come up with at least two theories."

**Stop 2:** "Here are the clues [Guide] found. With your group, decide: which theory fits best? Can you find any clues they missed?"

---

## Updated Claude Code Brief

*Replace docs/Next_Claude_Code_Session.md with this section.*

### What to tell Claude Code:

```
Read all files in docs/ for context.

Major design update — two changes to implement:

1. SOCIAL LEARNING FRAMING
The app assumes explorers are in groups. Update all explorer-facing UI:
- Replace individual text input response fields with "Discuss with your group"
  buttons that have a timer option (30s, 1min, or "We're ready — continue")
- Increase body text to 15px minimum, question/prompt text to 18px
- Rephrase all explorer-facing copy to address groups: "your group," "discuss
  together," "does everyone agree"
- Add a "Read aloud" button (Web Speech API synthesis) on each question so
  groups can listen together
- "Look moments" should say "Everyone look up" rather than "Look at..."
- After "look moments," show "Has everyone looked? Continue" instead of
  "I've looked"

2. GUIDE AVATARS
Add a guide creation step in the storyteller flow, after context type selection
and before the takeaway:
- Three options: "A real person from history" / "A character I'm creating" /
  "Myself"
- Fields: name, role, era, relationship to place (one sentence), what they
  want visitors to understand
- For "composite" characters, add a "composite character" label
- Store in Firestore as a guide object on the pin document
- In the explorer view, show the guide as a small card at the top:
  avatar initials in a circle + name + role + era
- Attribute questions to the guide: "[Name] asks: ..." 
- Show the guide's perspective statement at the end of the exploration
  as the culmination

Update the Firestore pin schema to include the guide object
(see docs/Design_Update.md for the data model).

For the question journeys, questions should be templated so they can
be reframed through the guide's perspective. Store the raw question
and use the guide's name to format: "[GUIDE_NAME] asks: [question]"

Build mobile-first. Test at 390px width.
```

---

## Build Priority

1. Guide avatar creation in storyteller flow (new step between context type and takeaway)
2. Guide display in explorer view (avatar card + attributed questions)
3. Social framing updates to explorer UI (group discussion buttons, text sizing, "read aloud")
4. Update seed pins with sample guides
5. Preview flow updated to show guide and social framing

---

*Add this file to docs/ as Design_Update.md. Tell Claude Code to read it alongside the MVP plan.*
