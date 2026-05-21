# Provenance v2 — Design Iteration Summary & Build Handoff

*Sean Hu · LDT Project · Stanford*
*April 30, 2026*
*Purpose: Import into a new conversation to begin building the updated system*

---

## How to Use This Document

This document describes the updated Provenance learning mechanism and what needs to be built. It synthesises decisions made across multiple design conversations and user testing sessions. Read it alongside:

- `Memorial_Church_Build_Guide.md` — the existing build guide (covers the current tech stack, knowledge database architecture, AI response protocol, and photo retrieval system)
- `Memorial_Church_Knowledge_Database.md` — the knowledge content
- `Provenance_Compass_Design_Brief.md` — the learning mechanism research and rationale (called "The Compass" during brainstorming — do NOT use this name in the product)
- `design_handoff_provenance/` — the v2 UI design prototype (React/HTML mockups showing the field journal metaphor, card types, and visual language)

The existing codebase has a working AI response pipeline, photo library, admin interface, and map. The task is NOT to scrap and rebuild. It is to restructure the explorer experience around the new tour-based learning mechanism while preserving the AI infrastructure that already works.

---

## Part 1: What Provenance Is

Provenance is a place-based learning tool that scaffolds historical thinking through guided inquiry at physical sites. Small groups (2–4 people) visit a site with one shared phone. The phone is a shared object the group gathers around — a campfire, not a personal screen. The learning happens between the people, not between the people and the machine.

The tool pairs groups with an authored tour that follows a repeating rhythm: receive context → observe something real → discuss an interpretive question → discover how reality complicates expectations. Between these authored stops, learners can ask their own questions, which the AI handles by either directing them to upcoming stops or answering from the knowledge base.

The current research prototype focuses on Stanford Memorial Church.

---

## Part 2: The Updated Learning Mechanism

### The core rhythm: Seed → Notice → Wonder → Reveal → Reflect

The exploration follows a single authored path through 5–7 stops. Each stop has five phases that always appear in the same order, creating a predictable rhythm the group learns within the first cycle.

#### Phase 1 — Seed (context card)

A short context card (2–3 sentences, human-authored) delivers the minimum knowledge the group needs before they can observe meaningfully. Displayed as a vintage postcard with a photo and text. The group reads it aloud together or taps a speaker icon for text-to-speech.

One tap to continue.

Example: "Jane Stanford lost her only son at age 15 in Florence. She and her husband founded this university in his memory."

#### Phase 2 — Notice (observation prompt)

A specific, physical observation task sends the group away from the screen. Displayed as a torn notebook page — informal, urgent, temporary. Always actionable, always answerable by looking at the real place. No photo on this card — the point is to look up.

A 30-second timer runs, then the button activates: "We've looked — continue."

Example: "Now read the inscription above the entrance together. Who is this church dedicated to? Take 30 seconds."

#### Phase 3 — Wonder (discussion prompt)

An interpretive question prompts the group to talk with each other. Displayed as a sealed envelope. The screen explicitly directs conversation: "Talk together about this before continuing." This is NOT a multiple-choice question with selectable positions. It is a conversation prompt. The group discusses out loud, then taps "We've talked — show us" to proceed to the reveal.

Example: "Wonder together: The inscription says 'in loving memory of her husband.' But the church was originally planned as a memorial for their son. Why do you think it changed? Talk about it."

The wonder card does NOT show the answer. The answer is on the next page. The separation between question and answer is critical — it forces the group to commit to their own thinking before seeing the authored interpretation.

#### Phase 4 — Context Reveal

The envelope opens. The authored context appears with a blur-to-sharp transition, visually treated as an uncovering. This is the human-authored insight that complicates or enriches whatever the group discussed. It never says "correct" or "incorrect." It always expands thinking.

Example: "The church was always meant to honour both — but the inscription tells a specific story. Leland Sr. died in 1893. The estate was locked in probate. Jane spent six years funding the university from her personal allowance. When the estate was finally released in 1898, she turned immediately to building this church. By then, it had become a memorial for her husband too — not just her son. The inscription reflects the moment she commissioned it, not the original vision."

#### Phase 5 — Reflection

A sliding scale asks the group to reflect: "How close was your theory?" The scale runs from "Not what we expected" to "Exactly what we thought" — no intermediate labels. The gesture of sliding to a position IS the reflection. This captures data about the gap between expectation and reality, which is where learning lives.

After the reflection, the group sees a bridge sentence pointing forward ("You've seen what Jane built for her family. But someone disagreed with what she was doing here. You'll meet them at the next stop.") and two options:

1. **"Ask our own question"** — branches to learner-generated inquiry (see below)
2. **"Continue the tour"** — advances to the next stop's seed card

### Learner-generated inquiry (branching, not open mode)

There is no "open mode." The authored path is continuous. But at the branch point after each reflection, learners can ask their own question. When they do, the AI performs one of three responses:

**Response A — "It's coming up."** The AI checks whether the question will be addressed at a later stop in the planned path. If so: "Great question. You'll encounter something about that soon. Hold onto it." The learner returns to the tour.

**Response B — "Let me show you."** The question is not on the planned path but IS answerable from the knowledge base. The AI responds using the existing response pipeline: directs them to observe something specific, gives a narrative answer (80–120 words), surfaces a relevant photo. When the group is done, they tap "Ready to return to tour" to rejoin the authored path at the next stop.

**Response C — "I don't know, but let's save it."** The question cannot be answered from the knowledge base. The AI is honest: "I don't have information about that, but it's a great question." It offers to add the question to the group's **question bank** — a list of unanswered questions that accumulates through the session and is presented at the end.

### End of tour

After the final stop's reflection, the group sees:

1. **The connection web** — a visual summary of their investigation (all completed nodes, connections lit up)
2. **Their question bank** — any questions that were saved during the tour because the AI couldn't answer them
3. **An invitation to share** — the group can post their banked questions to a communal question board visible to future groups. This board becomes a living record of collective curiosity about the place. Future groups see what others wondered about, which validates their own curiosity and creates community across time.

The question bank also serves as a feedback loop for the author: if many groups ask about the same thing, that's a signal to author a new stop.

---

## Part 3: The Connection Web

A growing visual diagram of what the group has observed, learned, and interpreted. Lives on the "inside front cover" of the journal — accessible by swiping left or tapping a tab. Abstract conceptual layout (not a floor plan).

**Node types:**
- Seed nodes: small dots (muted olive `#7A7A5E`)
- Notice nodes: medium dots (deep teal `#2B4C5E`)
- Wonder nodes: larger dots (warm amber `#C4923A`), glow when completed

**Connections:** Lines between related nodes. When a wonder is completed, its connections light up: "This context + this observation → this interpretation."

**Upcoming nodes:** Ghosted outlines — visible as destinations but unlabelled. The group sees progress without completion pressure.

**Purpose:** Wayfinding (where have we been), visible contextualisation (the connections ARE the contextualisation), and takeaway artifact (screenshot or revisit at the end).

---

## Part 4: The AI's Role (Reduced and Specific)

The AI is NOT a conversation partner. It is a concierge within an authored experience. Its behaviours are:

1. **Text-to-speech** for seed cards and reveals (when the group taps the speaker icon)
2. **Question routing** during learner-generated inquiry: check upcoming stops, answer from knowledge base, or bank the question
3. **Off-path responses** when the learner asks something answerable but not on the tour: generate observation + narrative answer using the existing pipeline (system prompt, knowledge base, photo matcher)
4. **Optionally:** dynamic shaping of the wonder reveal text based on what the group discussed (future enhancement — not required for initial build)

The existing AI response protocol (system prompt, response format, validation, session memory) is preserved for off-path responses. The authored content (seeds, notices, wonders, reveals, bridges) is human-written and stored in Firestore — not generated by the AI.

---

## Part 5: What Needs to Be Built

### Explorer Side

#### New data model: Tours and Stops

```typescript
interface Tour {
  id: string;
  title: string;                    // "Memorial Church"
  subtitle: string;                 // "Stanford University · Main Quad"
  guide: {
    name: string;                   // "Prof. Elena Ruiz"
    role: string;                   // "Art History · Stanford"
    initials: string;               // "ER"
  };
  description: string;              // Brief intro shown on journal peek
  coverPhotoUrl: string;            // Photo for the journal peek
  stops: Stop[];                    // Ordered array of stops
  connectionWeb: WebNode[];         // Pre-authored node/connection structure
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Stop {
  id: string;
  order: number;                    // Position in the tour sequence
  
  // Seed phase
  seed: {
    text: string;                   // 2–3 sentences of context
    photoUrl: string | null;        // Photo for the postcard card
    photoCaption: string | null;
    ttsText: string | null;         // Optional override for TTS
  };
  
  // Notice phase
  notice: {
    prompt: string;                 // Observation directive
    timerSeconds: number;           // Default 30
  };
  
  // Wonder phase
  wonder: {
    question: string;               // Discussion prompt
    // No positions/options — this is a conversation prompt, not multiple choice
  };
  
  // Reveal phase
  reveal: {
    text: string;                   // The authored insight
    photoUrl: string | null;        // Optional archival/contextual photo
    photoCaption: string | null;
    bridgeText: string;             // Forward-pointing sentence to next stop
  };
  
  // Metadata
  physicalLocationTag: string;      // Where in the site this stop is
  relatedEntryIds: string[];        // Knowledge base entries this stop draws from
  upcomingTopics: string[];         // Keywords describing what this stop covers
                                    // (used by AI for question routing — 
                                    // "is the learner's question about something 
                                    // an upcoming stop will address?")
}

interface WebNode {
  id: string;
  type: 'seed' | 'notice' | 'wonder';
  label: string;                    // Short label shown after completion
  stopId: string;                   // Which stop this node belongs to
  connections: string[];            // IDs of connected nodes
  x: number;                       // Position in the web layout
  y: number;
}
```

#### New data model: Question Bank

```typescript
interface BankedQuestion {
  id: string;
  tourId: string;
  sessionId: string;               // Which group's session
  questionText: string;
  askedAfterStopId: string;        // Which stop they had just completed
  aiResponse: 'coming_up' | 'answered_off_path' | 'banked';
  timestamp: Timestamp;
}

interface CommunalQuestion {
  id: string;
  tourId: string;
  questionText: string;
  askedBySessionCount: number;      // How many groups asked this
  responses: CommunalResponse[];    // Future groups' responses
  createdAt: Timestamp;
}

interface CommunalResponse {
  sessionId: string;
  responseText: string;
  timestamp: Timestamp;
}
```

#### Session state

```typescript
interface TourSession {
  id: string;
  tourId: string;
  currentStopIndex: number;
  currentPhase: 'seed' | 'notice' | 'wonder' | 'reveal' | 'reflect' | 'branch' | 'off_path' | 'end';
  completedStops: string[];
  reflectionScores: { stopId: string; score: number }[];  // 0–1 scale
  bankedQuestions: BankedQuestion[];
  startedAt: Timestamp;
  completedAt: Timestamp | null;
}
```

#### Explorer UI screens (in order)

1. **Map** — warm, hand-drawn feel with terracotta pins (see design prototype)
2. **Journal Peek** — slides up when pin tapped. Shows tour title, guide avatar, "Begin exploration" button
3. **Seed Card** — postcard material. Photo + context text + TTS button + continue
4. **Notice Card** — torn notebook page. Observation prompt + 30s timer + "We've looked — continue"
5. **Wonder Card** — sealed envelope. Discussion prompt + explicit instruction to talk with each other + "We've talked — show us"
6. **Reveal Card** — opened envelope. Authored insight with blur-to-sharp transition + optional photo + bridge text
7. **Reflection** — sliding scale "How close was your theory?" + bridge sentence + two buttons: "Ask our own question" / "Continue the tour"
8. **Off-Path Inquiry** — when learner asks a question the AI can answer. Shows AI response (observation + answer + photo) + "Ready to return to tour"
9. **Question Banked** — confirmation when a question is saved. "We'll come back to this at the end."
10. **Connection Web** — accessible via swipe or tab throughout. Updates as stops are completed.
11. **End of Tour** — connection web summary + question bank + share to communal board

#### Question routing logic

When the learner taps "Ask our own question" and types/speaks a question:

1. **Check upcoming stops.** Compare the learner's question text against the `upcomingTopics` keywords on all remaining stops. If there's a strong match → Response A ("It's coming up"). Return to tour.

2. **Check knowledge base.** If no upcoming stop matches, send the question through the existing AI response pipeline (system prompt + knowledge base). If the AI can generate a substantive response → Response B ("Let me show you"). Show the response. "Ready to return to tour" button.

3. **Bank the question.** If the AI cannot answer (no relevant knowledge entries) → Response C ("I don't know, let's save it"). Add to the session's banked questions. Return to tour.

The AI should never say "I can't help with that" without offering to bank the question. Every unanswered question has value — it's data about what learners want to know.

### Admin Side

#### New route: /admin/tours

A tour authoring interface where Sean can create and edit the full authored path. This is the primary content creation tool.

**Tour list view:**
- Grid/list of existing tours
- Each shows title, number of stops, guide name, last updated
- "Create new tour" button

**Tour editor:**
- **Tour metadata** at the top: title, subtitle, guide name, guide role, guide initials, cover photo upload, description
- **Stops list** below: ordered list of stops, drag-to-reorder
- "Add stop" button at the bottom
- Each stop shows a summary card: seed text preview, notice prompt preview, wonder question preview
- Tapping a stop opens the stop editor

**Stop editor:**
Full-screen editor for a single stop. All fields that appear in the explorer experience should be editable here. Organised by phase:

- **Seed section:**
  - Text area for seed content (2–3 sentences)
  - Photo upload (camera/gallery → Firebase Storage) with preview
  - Photo caption field
  - Character/word count indicator
  
- **Notice section:**
  - Text area for observation prompt
  - Timer duration selector (default 30 seconds)
  - Physical location tag dropdown (exterior_facade, narthex, nave, crossing, dome, chancel, transepts, side_chapel, organ_loft, general)

- **Wonder section:**
  - Text area for the discussion question
  - Guidance text (non-editable): "Write a question that prompts group conversation. There are no right or wrong answers — the reveal will complicate their thinking."

- **Reveal section:**
  - Text area for the insight/context reveal
  - Photo upload (optional — for archival/contextual photos)
  - Photo caption field
  - Bridge text field (forward-pointing sentence to next stop)
  - Character/word count indicator

- **Metadata section:**
  - Physical location tag (auto-filled from notice section)
  - Related knowledge entry IDs (multi-select from knowledge base entries)
  - Upcoming topics (comma-separated keywords — used for question routing)

**Preview mode:**
A "Preview this stop" button that shows the stop as it would appear to the explorer — cycling through seed → notice → wonder → reveal → reflect — using the same card UI components. This lets Sean see exactly what the group will experience.

**Connection web editor:**
After all stops are created, a simple interface to position nodes and draw connections. Could be as simple as:
- Auto-generated nodes from stops (each stop creates 3 nodes: seed, notice, wonder)
- Drag to position nodes on a canvas
- Click two nodes to draw a connection between them
- Or: auto-layout with manual adjustment

#### Update existing route: /admin/photos

No changes needed — the existing photo library works as-is. Tour stop photos are uploaded through the stop editor and stored in Firebase Storage alongside existing photos.

#### Update existing route: /admin (if it exists as a dashboard)

Add a link to /admin/tours alongside existing /admin/photos.

---

## Part 6: What to Preserve From the Current Build

The following systems are already built and working. They should NOT be scrapped or rewritten. The new tour structure integrates with them.

- **AI response pipeline** (src/app/api/ask/route.ts) — used for off-path learner questions (Response B). System prompt, knowledge base injection, response format, validation all preserved.
- **Knowledge database** (Memorial_Church_Knowledge_Database.md) — feeds both authored content and AI off-path responses.
- **Photo library** (memorial-church-photos Firestore collection + /admin/photos interface) — used for seed card photos, reveal photos, and AI off-path response photos.
- **Photo matcher** (src/lib/photo-matcher.ts) — used for off-path responses. Not needed for authored stops (those have explicit photo assignments).
- **Session memory** — adapted to track tour progress instead of free-form conversation coverage.
- **Map integration** — updated visually but same underlying Google Maps infrastructure.
- **Firebase/Firestore infrastructure** — new collections added (tours, tour-sessions, communal-questions), existing collections preserved.
- **Vercel deployment** — same deployment pipeline.

---

## Part 7: Design Language (From v2 Prototype)

The v2 design prototype establishes the visual language. Key elements:

**The field journal metaphor.** The UI has two layers: the map (the world) and the journal (the investigation). The journal slides up over the map when a pin is tapped. Inside the journal, different card types are distinct physical materials.

**Card types and their materials:**
- Seed = vintage postcard (warm cardstock, photo, dog-ear corner, foxing spots)
- Notice = torn notebook page (ragged top edge, notebook lines, left margin, lighter paper)
- Wonder = sealed envelope (kraft paper, triangular flap, heavier stock)
- Reveal = opened envelope (same kraft, open flap, amber-accented reveal text)

**Colour palette (Stanford-derived):**
- Ground: `#F0E0C8` (sandstone)
- Seed accent: `#7A7A5E` (muted olive)
- Notice accent: `#2B4C5E` (deep teal)
- Wonder accent: `#C4923A` (warm amber)
- Text primary: `#2C2418`
- Pin: `#B8694A` (terracotta)

**Typography:** Crimson Pro for narrative (serif), DM Sans for interface (sans-serif). Body 17px minimum. Prompts 19–20px.

**Interactions:** Page-turn transitions between cards. Card entry animations (fade + slide). Wonder reveal blur-to-sharp. 30-second timer on notice cards.

**What this should NOT look like:** Not a chat interface. Not white-background-blue-buttons. Not gamified. Not a museum audio guide. Everything should feel like it has mass and material.

See `design_handoff_provenance/README.md` for complete design specifications, and `design_handoff_provenance/design_prompt.md` for the full creative brief.

---

## Part 8: Guiding Principles (Non-Negotiable)

These apply to every feature, every screen, every interaction:

1. **The place is the focus. The app is the mediator.** Every design decision passes this test: does it draw attention toward the place and toward each other, or toward the screen?

2. **Context before observation, observation before interpretation.** Seeds precede notices. Notices precede wonders. Always.

3. **The learning happens between people.** The wonder prompt explicitly asks the group to talk with each other. The AI is not the conversation partner — the group members are.

4. **Epistemic honesty.** The AI never invents. Reveals never say "correct/incorrect." The AI admits when it doesn't know something and banks the question.

5. **Engaging tension.** The authored wonders are designed to surface historical tensions. The reveals complicate all positions rather than confirming one.

6. **Every question has value.** Questions the AI can't answer aren't failures — they're data. The question bank captures them for the group, for the author, and for future visitors.

7. **The phone is a shared object.** Text sized for group reading (17px+ body). Discussion prompts address groups ("Talk together"). Timer-gated observation pauses. The person holding the phone taps without blocking others' view.

---

## Part 9: What to Build First

Priority order for implementation:

1. **Admin: Tour authoring interface** (/admin/tours) — Sean needs to be able to create the authored content before anything else can be tested.
2. **Explorer: Tour playback** — the seed → notice → wonder → reveal → reflect flow with the new card UI.
3. **Explorer: Question routing** — the branch point where learners can ask their own question, with the three AI response types.
4. **Explorer: Connection web** — the visual progress diagram.
5. **Explorer: End-of-tour** — question bank review and communal sharing.
6. **Admin: Connection web editor** — positioning nodes and drawing connections.

The map redesign (warm, hand-drawn pins) and the material textures (paper grain, torn edges, envelope kraft) can be refined after the core flow works. Get the interaction logic right first, then polish the surfaces.

---

*This document reflects the state of the project as of April 30, 2026. Import it into a new conversation alongside the existing build guide, knowledge database, and design prototype files to begin implementation.*
