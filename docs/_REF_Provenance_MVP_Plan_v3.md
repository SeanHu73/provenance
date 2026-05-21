# Provenance — MVP Plan (v3)

*Sean Hu · LDT Project · Stanford*
*Updated: April 2026 · Living document*

**Status Key:** **[BUILD FIRST]** = MVP core · **[PHASE 2]** = add after core works · **[PHASE 3]** = long-term vision · **[NEEDS RESOLUTION]** = open question

---

## Guiding Principles

Provenance is a place-based, social learning tool built on two complementary journeys — one for storytellers, one for explorer groups. Everything in the platform exists to serve these principles.

### For Storytellers

**1. A seamless journey to craft a group learning experience.** Contributing should feel engaging and meaningful, not like filling out a form. The storyteller is building something they're proud of — an experience that helps a group of people see a place differently. The prompt tree should feel like a guided conversation, not a data entry workflow.

**2. Community archiving through personal connection.** Storytellers don't just document places — they add their perspective, their community's history, their family's connection. A railroad station isn't just an architectural landmark; it's also a site of inequity, a place where someone's grandparents arrived, a symbol of a particular era. Multiple storytellers can layer their perspectives on the same place — each with a different guide avatar — creating a richer, more contested, more honest record.

**3. Becoming curators of historical interpretation through perspective.** Storytellers use public places as "archives" and choose a guide — a historical figure, a composite character, or themselves — through whose perspective the exploration is framed. This transforms storytellers from information providers into experience designers who craft perspective-taking encounters for explorer groups.

### For Explorers (Groups)

**1. Deeper engagement with history through physical place and social conversation.** The platform directs attention outward — toward the building, the stone, the inscription, the landscape — and then inward to the group. The phone is a campfire the group gathers around, not a private screen. When the group is reading, it should be in service of looking up and discussing what they see.

**2. Contextual understanding that connects to the larger picture.** A single place isn't isolated. It connects to other places nearby, to a broader architectural movement, to an era, to a community's experience. The platform makes these connections visible — through tags, era filtering, linked pins, and topic pages — so the group sees the web of relationships, not just a point on a map.

**3. Inquiry-based experience that invites conversation with the place and with a perspective.** The explorer group isn't just reading — they're being asked to notice, to discuss, to theorise, to take on a perspective that isn't their own. Questions come from a guide character rooted in a specific time, place, and position. The group is in conversation with the guide's perspective, with the physical environment, and with each other.

---

## The Core Design Test

For every feature, ask:

**Storyteller side:** Does this help them build a better group experience, or does it just collect more data?

**Explorer side:** Does this draw attention toward the place and toward each other, or toward the screen?

If the answer to either is the wrong one, redesign it.

---

## The Storyteller Journey: Backwards Design

The storyteller flow uses backwards design — starting with the intended understanding and working backward to the observations and questions that build toward it. This ensures every pin has narrative coherence, not just accumulated information.

### Step 1: Choose your context

The storyteller selects the type of story they want to tell. This determines the question journey they'll be guided through.

**Context types:**
- **Architectural / Physical** — "I want to explain what you can see in this building/structure/landscape"
- **Historical event** — "Something happened here that people should know about"
- **Community / Cultural** — "This place matters to a community and here's why"
- **Personal / Memory** — "I have a personal connection to this place"
- **Mystery / Inquiry** — "There's something here I find fascinating and want others to explore"

Each context type unlocks a tailored set of question prompts in Step 4.

### Step 2: Create your guide

The storyteller chooses who will lead the exploration — the perspective through which questions are posed and the experience is framed.

**"Who will guide this exploration?"**
- **"A real person from history"** → name, role, era, one-sentence relationship to the place. Example: *"Ah Ling, railroad worker, 1865 — He built this station with his own hands."*
- **"A character I'm creating"** → same fields, plus a note that this is a composite based on real experiences. Example: *"Maria Gonzalez, cannery worker, 1940s — A composite based on the experiences of Latina women who worked the Monterey canneries."*
- **"Myself"** → uses the storyteller's own name and profile. Default suggestion for Personal / Memory context type. Example: *"James Whitfield, Stanford class of '74 — I studied under the oak trees that used to stand right here."*

**"In one sentence, what does this person want visitors to understand that they might not see on their own?"**
This is the guide's perspective statement — the thing that drives the whole exploration. It replaces the generic "takeaway" with a voiced, perspectival claim.

### Step 3: Capture the place

- Take or upload a photo (camera capture or gallery upload)
- Option to upload a historical/old photo ("Have an old photo of this place? Add it here")
- Auto-detect location via GPS or adjust pin on map
- Title for the pin
- Era selector (decade pills)

### Step 4: Answer the guided questions

Based on the context type chosen in Step 1, the platform presents a curated set of questions — a "question journey." Questions are framed through the guide's perspective. The storyteller answers them one at a time.

**The storyteller can also create their own questions** if the suggested ones don't fit. The platform says: "These are suggestions — if none of them capture what [guide name] would want to share, write your own question."

Each question answer can include:
- Text (typed or voice-to-text)
- A photo annotation (tap on the photo to point at what you're describing)
- An old/historical photo uploaded alongside the current one
- A "look moment" flag (see Step 5)

**The minimum is one question answered. Two is encouraged. More than four is discouraged** — the platform gently warns: "Groups tend to lose focus after 4 stops. Can any of these be combined?"

**See the Question Journey Trees document for the full question sets by context type.**

### Step 5: Mark the "look moments"

After answering their questions, the storyteller reviews their answers and marks which ones should include a **group observation pause**. The platform asks: "At which points should the group put the phone away and look at the real thing before reading [guide name]'s answer?"

Not every point needs this. A historical backstory might be pure reading. But an architectural detail — "look at the cornerstone" — should prompt the group to observe and discuss before the guide's perspective is revealed.

**The storyteller toggles "look first" on or off for each answer.** When toggled on, the explorer group will see a prompt like: "[Guide name] says: 'Before I tell you what I see — everyone look at [the detail]. What do you notice? Discuss.'" followed by a "We've discussed it — continue" button that reveals the guide's observation.

This is the mechanism that keeps attention directed outward and keeps the group talking. The storyteller is designing these moments, coached by the platform.

### Step 6: Arrange and preview

The storyteller can drag their answered questions into their preferred order. The platform suggests an order based on the backwards design principle — building from observation toward the guide's perspective statement — but the storyteller has final say.

They then preview the entire pin as an explorer group would experience it, including:
- The guide avatar card (initials, name, role, era)
- The photo with annotation points
- The question/reveal sequence with guide attribution
- The group "look first" pauses
- The guide's perspective statement as the culmination
- Connected pins and "go deeper" resources

### Step 7: Add connections and resources

- Tag the pin with themes, era, and location context
- Link to other nearby pins
- Add "go deeper" resources (museums, books, libraries, guides, websites)
- Upload historical photos if available

### Step 8: Publish

Pin goes live on the map.

---

## The Explorer Journey: Social Scaffolded Understanding

When an explorer group taps a pin, they experience the storyteller's designed sequence as a group activity:

1. **Guide introduction** — the guide avatar card: initials circle, name, role, era, and their relationship to the place. "You're about to explore this place with [Guide name], a [role] from [era]."
2. **Photo with annotation points** — numbered dots showing where to look
3. **Sequential group walkthrough:**
   - For each point: the guide's name and question, attributed: "[Guide name] asks your group: ..."
   - If "look first" is flagged: group sees "[Guide name] says: 'Everyone look at [X]. Talk about what you see.'" → "We've discussed it — continue" button → guide's observation and insight revealed
   - If not flagged: the guide's observation and insight are shown directly
   - Previous insights accumulate as small pills, showing the building understanding
   - Discussion prompts are addressed to the group, not the individual
   - Text is sized for group reading (15px body, 18px prompts)
   - "Read aloud" button available on each question (text-to-speech)
4. **The guide's perspective statement** — revealed at the end as the culmination: "[Guide name]'s message: '[perspective statement]'"
5. **Connections** — nearby pins with shared tags highlighted on the map. If another pin at the same location has a different guide, it's highlighted: "See this place through different eyes — [Other guide name], a [role] from [era], has a different perspective."
6. **Go deeper** — resources for continued learning
7. **"Add your group's observation"** — lightest contribution path: the group adds one sentence or reaction to someone else's pin

---

## What Changed From v2

- **Social learning is the default** — the app assumes groups of explorers, not individuals. Discussion pauses replace individual text inputs. Questions address groups. UI is sized for shared viewing.
- **Guide avatars** are a core feature, not an add-on. Every pin has a guide character whose perspective frames the entire exploration. Storytellers create guides as part of the prompt tree (historical figure, composite character, or themselves).
- **Perspective-taking is embedded by design.** The guide's perspective disrupts presentism and forces explorers to engage with a specific human position, not a neutral information source.
- **Multiple perspectives per place** are explicitly supported. Different storytellers can create different guides at the same location, creating dialogue between perspectives.
- **Questions are reframed through the guide** — "[Guide name] asks your group:" rather than generic prompts.

---

## Technical Architecture

Next.js + Google Maps JavaScript API + Firebase (Firestore, Auth, Storage) + Claude API + Vercel

### Updated Firestore pin schema

```javascript
{
  title: string,
  type: "guided" | "story" | "memory" | "request" | "observation",
  contextType: "architectural" | "historical" | "community" | "personal" | "mystery",
  guide: {
    name: string,
    role: string,
    era: string,
    relationship: string,
    perspective: string,
    type: "historical" | "composite" | "self",
    avatarInitials: string
  },
  description: string,
  lat: number,
  lng: number,
  era: string,
  contributor: { name: string, role: string, uid: string },
  tags: string[],
  upvotes: { accurate: number, helpful: number },
  annotations: [{
    x: number,
    y: number,
    question: string,
    answer: string,
    insight: string,
    lookFirst: boolean,
    lookPrompt: string,
    historicalPhotoUrl: string | null,
    order: number
  }],
  resources: [{ label: string, type: string }],
  photoUrl: string,
  historicalPhotoUrl: string | null,
  createdAt: timestamp
}
```

### Current build status

- [x] Project scaffolded (Next.js + Tailwind + TypeScript)
- [x] Google Maps integration — map centered on Stanford campus
- [x] Firebase Firestore — pins collection with seed data
- [x] Pin markers on map, styled by type
- [x] Pin detail bottom sheet with guided exploration (Flow C)
- [x] Explorer/Storyteller mode toggle
- [x] Storyteller prompt tree (v1 — needs update to v3 design)
- [x] Photo annotation (tap to annotate)
- [x] AI-assisted shaping (Claude API, with placeholder fallback)
- [x] Deployed to Vercel
- [ ] **Guide avatar creation in storyteller flow — NEXT**
- [ ] **Guide display in explorer view — NEXT**
- [ ] **Social framing: group discussion pauses, text sizing, read aloud — NEXT**
- [ ] **Storyteller flow v3 (backwards design + guide + context types) — NEXT**
- [ ] **Question journey trees integrated into storyteller flow**
- [ ] Era filtering on map
- [ ] Tag filtering on map
- [ ] Connected pins highlighting after exploration
- [ ] Multiple guides per location
- [ ] Real photo upload (camera/gallery → Firebase Storage)
- [ ] Historical photo support (before/after)
- [ ] Topic pages
- [ ] Google sign-in for storytellers
- [ ] PWA manifest

---

## Competitive Positioning

Clio tells you what happened here. Provenance lets someone who was here tell your group why it mattered — and helps you see it through their eyes.

---

## Key Metrics for MVP Success

- **Contribution completion rate:** % of storytellers who start the prompt tree and publish (target: >60%)
- **Time to contribute:** minutes from "Add to map" to published pin (target: <10 min)
- **Look-moment compliance:** % of groups who tap "We've discussed it" vs. skipping (measures whether attention is actually being directed outward)
- **Cross-pin navigation:** % of groups who follow a connection to a second pin
- **Perspective engagement:** % of groups who explore a second guide at the same location (when available)
- **Explorer engagement depth:** % who complete the full guided exploration vs. abandoning mid-flow
- **Group discussion duration:** average time on discussion pauses (measures whether real conversation is happening)
- **Content density:** pins per square kilometre in pilot area

---

*This document is maintained by Claude Code. Update it at the end of each build session.*
