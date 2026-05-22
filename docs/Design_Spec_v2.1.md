# Provenance v2 — Current Design Spec

*Last updated 2026-05-22. This supersedes the original
`Provenance_v2_Iteration_Summary.md` for any features that have changed.*

---

## Explorer Flow (what learners experience)

A tour plays in one of two modes, set per-tour in admin:
**Linear** (default — the authored sequence below) or
**Unstructured** (the explorer picks stop order — see *Unstructured Mode*
at the end of this section). The essential-question opening and closing
are identical in both modes; only the per-stop middle differs.

### Pre-tour
1. Map with a single terracotta pin per tour
2. Tap pin → **Journal Peek** slides up (leather-textured bottom sheet with guide info, tour description, audio, "Begin exploration")
3. **Intro screens** — sequence of onboarding cards

### Essential Question Opening (3 screens)
4. **"Setting the scene..."** — photo of starting location, description text, optional audio, collapsible framing ("Tap to read along"), "What's the question?" button
5. **"Question for you! Please discuss..."** — essential question in cardinal red box (28px, faded #7A1A1A90, amber border #C4923A 3px), instruction to discuss verbally, "Discussed! What's next?"
6. **Written prompts** — question in same box, theory input + "Propose theory" (solid amber), reasoning input + "Confirm your explanation", then "Let's find the first stop..." (or "Continue" if additional question follows)
7. **Additional question** (optional) — discuss or opinion type, same box styling, "Let's find the first stop..."

### Per Stop
8. **Background + Look Around** (merged) — seed text/photos/audio + divider + notice prompt/photos/audio + timer ring, "We've looked — continue"
9. **Chance to discuss...** / **What's your opinion?** (optional, toggleable type) — discussion prompt + photos/audio, "We've talked — show us"
10. **Context** — reveal text with [photo:N] inline placement, blur-to-sharp animation, collapsible text when audio present ("Tap to read along"), photos always visible, 85% card opacity
11. **Extra rounds** (optional) — additional discussion + context pairs, each independently toggleable
12. **Reflect** (optional) — "How much did that change your thinking?" slider, configurable follow-up chips (what changed / why changed, multi-select with stop attribution), "Skip reflection" link
13. **What's Next** — bridge text/photos + "Continue the tour" + related artefacts row

### Final Stop
- Marked with `isFinalStop` toggle in admin
- After reflect/context, skips What's Next, goes directly to closing flow

### Essential Question Closing (mirrors opening)
14. **"Going back to the discussion question..."** — closing framing text + audio + question in cardinal box, "Discussed! What's next?"
15. **Written response** — question in box + final interpretation + reasoning fields
16. **Final reflections** — cognitive slider + perceptual slider + all 4 follow-up chip sets (multi-select)
17. **"Any remaining questions?"** — text/voice input to add final questions + full question list + "Complete tour"

### End
18. **End card** — learning arc artifact (before/after), reflection summary, banked questions, "Explore on your own"

### Unstructured Mode

When a tour has unstructured mode enabled, steps 8–13 (the per-stop
loop) are replaced by an explorer-driven flow:

- After the EQ opening, the explorer lands on a **full-screen map
  overlay** — every stop is a pin; tapping one opens a stop card and
  begins that stop.
- Each stop still runs Background+Notice → [Discussion] → Context →
  [Extra rounds] → [Reflect] → [What's Next], then returns to the map.
- **Merge groups** — stops the author has grouped play as one
  sequential unit (tapped once, walked in order).
- **Midway check-in** (optional) — once the explorer has completed half
  the stops, a full-screen reflection question appears before they
  continue picking.
- Once every stop is done, the EQ closing sequence (steps 14–18) runs
  as normal. "Finish the tour" appears only on the genuinely last stop
  the explorer chooses.
- Progress is shown in *visit* order, not authored order — "Stop 1" is
  the first stop the explorer picked.

---

## Visual Design

### Card System
- Every screen is a rounded-2xl card with shadow-lg
- Sandstone background (#E8D8C0) visible around card edges (16px padding)
- Card opacity: 70% for most screens, 85% for context/reveal
- backdrop-blur: 12px (most) / 10px (context), with low-end device fallback

### Background Photos
- Tour-level default (`Tour.backgroundPhotoUrl`)
- Per-stop override (`Stop.backgroundPhotoOverride`) — applies from that stop onward
- Shows behind ALL screens when set
- Stays fixed during transitions

### Transitions
- Within a stop: slide right-to-left, 120ms ease-out
- Between stops: fade, 400ms ease-in-out
- Detection: compares phaseHistory stopIndex

### Colours
| Token | Hex | Usage |
|---|---|---|
| Sandstone | #F0E0C8 | Progress bar bg, card edge bg |
| Card interior | #FFF8EE | Card background (at opacity) |
| Card edge bg | #E8D8C0 | Behind cards |
| Amber | #C4923A | Progress pills, buttons, borders |
| Olive | #7A7A5E | Completed stops, back/footer borders |
| Cardinal (faded) | #7A1A1A90 | Question boxes |
| Text primary | #2C2418 | Body text |
| Text secondary | #6B5D4F | Labels, secondary |
| Pin terracotta | #B8694A | Map pin |
| Journal cover | #5C4A35 | Peek bottom sheet |
| Question red | #8B3A3A | ? button |

### Typography
- Body: 21px serif
- Prompts: 23px serif
- Secondary: 20px
- Titles: text-2xl uppercase tracking
- Question boxes: 28px serif bold
- Buttons: text-base (16px) font-semibold
- Audio title: 18px

### Persistent UI
- **Title bar**: centered tour title, back chevron (left), exit × (right)
- **Progress bar**: "N of M explored" count + filled/empty circular pills; the current stop's pill expands to show its number + name and is tappable to open the swipeable stop tracker. Completed pills fill amber `#F59E0B`. Linear mode adds an amber fill bar; unstructured mode omits it.
- **Footer**: Journal button + ? button (olive borders, centered)
- **Scroll indicator**: large arrow above footer, sandstone scrollbar on right

---

## Photo Display Modes

Each photo carries an admin-set display mode that the explorer honours:

- **Auto (fit)** — photo shown whole, scaled to fit its slot.
- **Crop (fill)** — photo fills its slot; the author sets a focal point
  (click-to-place) and an optional 1×–3× zoom so the important part
  stays in frame.
- **Full (letterbox)** — photo shown whole on a black background.

A separate **thumbnail focal point** controls the small, wide (3:1)
thumbnails used on map overlay cards, the stop gallery, and the journal
— cropped independently of the main display since the aspect ratio
differs. Authored in the admin photo editor; the crop previews there use
the same CSS the explorer renders with, so the preview is accurate.

---

## Discussion Question Types

Each discussion question (wonder) has a `questionType` field:
- `'discuss'` → "Chance to discuss..." title
- `'opinion'` → "What's your opinion?" title

Available on: main wonder, extra round wonders, additional EQ question.
Set via radio toggle in admin.

---

## Reflection System

### Per-stop (optional, toggled in admin)
- Slider: configurable prompt/labels (default "How much did that change your thinking?")
- Follow-up: "What changed?" (multi-select) or "Why did it change or not?" (multi-select), admin-selectable per stop
- Custom options editable per stop
- "From stops" attribution when "Something we just learned on the tour" is selected
- "Skip reflection" link
- Photos optional

### Final (always shown at closing)
- Cognitive slider + perceptual slider
- All 4 follow-up chip sets shown (multi-select)

---

## Audio System

- Admin: AudioUpload component with URL input, upload button, title field, preview player
- Explorer: AudioButton with waveform-style timeline, play/pause, title display
- Available on: seed, notice, wonder, reveal, extra rounds, EQ scene, EQ closing discuss, tour peek
- On context cards with audio: text is collapsible ("Tap to read along"), photos always visible

---

## Voice Input (Deepgram)

- MicButton on every text input (theory, reasoning, questions, closing)
- Records via MediaRecorder API (webm/mp4)
- Sends to /api/transcribe → Deepgram Nova-2 REST
- Smart format, no filler words, paragraphs
- Transcript appends to existing field text
- 2-minute max recording, 15-second API timeout

---

## Journal Overlay

Accessed via the Journal button in footer. Three tabs:
- **Stops**: expandable stop list, tap to see context text with proper [photo:N] rendering + per-stop questions
- **Questions**: full bank of all questions with stop attribution
- **Your Theory**: EQ initial theory/reasoning/final reflection + per-stop slider values

---

## Admin Naming Convention

| Admin Label | Explorer Title |
|---|---|
| Background (seed — context card) | BACKGROUND... |
| Notice (observation prompt) | LOOK AROUND... (merged into seed card) |
| Discussion Question | Chance to discuss... / What's your opinion? |
| Context (reveal) | CONTEXT |
| Reflection | REFLECT... |
| Bridge | (italic bridge text on What's Next) |
| Discussion Question (EQ) | Discussion Question |
| Additional Discussion Questions + Context | (per extra round) |

---

## What's NOT Built Yet

- Connection web (Priority 4 from original spec)
- End-of-tour communal question sharing
- Material textures (SVG feTurbulence grain, torn edges, kraft paper)
- Custom fonts (Crimson Pro, DM Sans) — using system serif/sans
- TTS "Read aloud" via Web Speech API
- Contributor photo mode
- Photo swiping/carousel
- AI question answering (disabled, code preserved)
- Detour "Copy to another stop" feature
- Connection web editor (admin)

---

*This document reflects the built state as of 2026-05-22.
For the original design vision, see `Provenance_v2_Iteration_Summary.md`.
For technical implementation details, see `Build_State.md`.*
