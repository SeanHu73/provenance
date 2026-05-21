# Unstructured Exploration Mode — Claude Code Prompt

*May 2026*
*Paste this prompt into Claude Code (desktop app or terminal via `claude`). Add this file to docs/ folder. Tell Claude Code to read alongside the files specified below.*

---

## Context

The current tour structure is linear: stops 1–8 in a fixed sequence. This contradicts the platform's guiding principle — that history is not a prescribed narrative but a construction. The linear sequence tells explorers what to look at and in what order, which undermines the very thing Provenance is trying to teach.

This change introduces an **unstructured exploration mode** — a toggle on the admin side that, when active, removes the fixed sequence on the explorer side and lets groups choose which stops to explore and in what order. The linear mode is preserved and remains the default; unstructured mode is opt-in per tour.

The pedagogical logic: when the explorer decides what to investigate and in what order, the resulting understanding is *their* construction — not a narrative handed to them. The Essential Question at the start and the Closing Framing at the end remain fixed bookends, but everything in between is the group's own path.

---

## What to tell Claude Code:

```
BEFORE MAKING ANY CHANGES:
Commit everything first as a checkpoint:
git add -A && git commit -m "checkpoint: pre-unstructured-mode"
Confirm the commit succeeded before proceeding.

Read all files in docs/ for context. If there is a conflict
between documents, trust in this order:
1. Build_State.md (current codebase state)
2. Design_Spec_v2_1.md (current design spec)
3. Everything else is background context — useful for
   understanding intent but not authoritative for
   implementation details.

Major new feature: UNSTRUCTURED EXPLORATION MODE

This is a tour-level toggle. When active, the explorer experience
changes from a linear stop sequence to a choose-your-own-path model.
The admin side retains the stop numbering for convenience, but the
explorer sees no prescribed order.

========================================
ADMIN SIDE CHANGES
========================================

TOUR-LEVEL TOGGLE
- Add a toggle on the tour editor: "Unstructured exploration"
  with helper text: "When active, explorers choose which stops
  to visit in any order. The Essential Question and Closing
  Framing remain as fixed bookends."
- Store as: unstructuredMode: boolean on the Tour document
- Default: false (linear mode, current behaviour preserved)

CATEGORIES
- Add a "Categories" management section in the tour editor
- The storyteller can create, rename, reorder, and delete
  categories (e.g. "Architecture," "People," "Symbolism,"
  "History")
- Store as: categories: string[] on the Tour document
- Each Stop gets a new field: category: string | null
  (dropdown selecting from the tour's categories list)
- Categories are used to organise the gallery view on the
  explorer side

STOP MERGING
- In unstructured mode, add the ability to merge stops into
  a sequence group
- UI: a "Merge with next stop" toggle on each stop, or a
  drag-to-group interface — whichever is simpler to build
- Store as: mergeGroup: string | null on each Stop
  (stops with the same mergeGroup value form a sequence)
- Within a merge group, the existing stop order determines
  the internal sequence
- On the explorer side, a merge group appears as a SINGLE
  pin/card. Tapping it plays through all the merged stops
  in their internal order, just like the current linear flow.
  The other pins in the merge group are hidden — only the
  first stop's pin is visible. After completing the sequence,
  the explorer returns to the map/gallery.
- Example: Stops 1, 2, 3 are merged. The explorer sees one
  pin at Stop 1's location. Tapping it takes them through
  stops 1 → 2 → 3 in order, then back to the map.

MIDWAY CHECK-IN QUESTION
- Add a "Midway Check-In Question" text field on the tour
  editor, with a toggle to enable/disable it
- Label the toggle: "Include midway check-in"
- Helper text: "If enabled, this question is shown to
  explorers once they've completed half the stops. Use it
  to prompt reflection on what they've seen so far."
- Store as: midwayQuestion: string | null on the Tour
  document (null when disabled or empty)
- Store as: midwayEnabled: boolean on the Tour document
  (default false)
- The platform calculates the halfway point dynamically:
  Math.ceil(totalStops / 2), where totalStops counts merge
  groups as one stop each (not their individual sub-stops)
- If midwayEnabled is false or midwayQuestion is null,
  no check-in is shown — the explorer continues freely

========================================
EXPLORER SIDE CHANGES
========================================

TOUR FLOW (UNSTRUCTURED MODE)
The explorer journey when unstructuredMode is true:

1. Essential Question stage (unchanged — same as current)
2. → Map view with pins (new — described below)
3. Explorer taps a pin → enters that stop's flow
   (seed → notice → wonder → reveal → reflect)
4. Stop completes → returns to map view
5. After completing half the stops → Midway Check-In
   Question appears as an interstitial before the next stop
6. After completing ALL stops → automatic redirect to
   Closing Framing (regardless of which stop was last)

PIN VISIBILITY
- Pins do NOT exist on the map until the explorer starts
  the tour. Tapping "Start" after the Essential Question
  makes the pins appear.
- Pins disappear when the tour is closed/completed
- Show the explorer's current location on the map (use
  existing geolocation — the Geolocation API is already
  in the stack)
- Completed stops: pin shrinks to roughly 60% of its
  original size AND changes to a muted/checked style
  (greyed out with a small checkmark). The size reduction
  visually de-emphasises completed stops so uncompleted
  ones stand out.
- For merge groups: only the first stop's pin is visible.
  The other stops in the group have no pin.

PIN TAP BEHAVIOUR
- When an explorer taps a pin, show a hovering overlay
  card above the pin (not a full bottom sheet — a compact
  floating card anchored to the pin). The overlay shows:
  - Stop title
  - Category label (if assigned)
  - Seed photo thumbnail (if available)
  - A brief description or the first line of the seed text
  - A "Begin this stop" button
- Tapping "Begin this stop" enters the stop's flow
- Tapping elsewhere on the map dismisses the overlay
- This overlay replaces the simple tooltip — the explorer
  gets enough context to decide whether to visit this stop

MAP VIEW
- Full-screen map with the tour's pins plotted
- Pin tap shows the hovering overlay card (described above)
- Bottom of screen: a toggle bar to switch between
  "Map" and "Gallery" views
- The map uses the existing Google Maps JavaScript API
  integration

GALLERY VIEW
- An alternative to the map — a scrollable panel showing
  all available stops as cards
- Organised by category: category headers with stop cards
  below each
- Each card shows: stop title, a thumbnail (seed photo if
  available), and category label
- Completed stops are visually muted (same shrunk/checked
  style as the map pins)
- Tapping a gallery card does NOT enter the stop directly.
  Instead, it switches to the map view, centres on that
  stop's pin, and highlights the pin with a pulsing halo
  animation (reuse the existing fading in/out halo effect
  from the tour pin on the opening map). The explorer then
  taps the highlighted pin to see the overlay and begin
  the stop. This ensures every stop entry goes through the
  map pin — reinforcing the connection between the content
  and the physical place.
- If a stop has no category assigned, group it under
  "Other" at the bottom

PROGRESS BAR
- In unstructured mode, the progress bar no longer reflects
  the authored stop order
- Instead, it fills based on the ORDER the explorer
  completed stops: their stop 1 is whatever they tapped
  first, their stop 2 is whatever they tapped second, etc.
- Show: [completed] / [total stops] with a fill bar
- Merge groups appear as ONE pill/segment in the progress
  bar. But if the explorer taps that pill, it expands to
  show all the sub-stops within the merge group (e.g.
  tapping a merged pill reveals "Stop A → Stop B → Stop C"
  as smaller connected segments). Tapping again or tapping
  elsewhere collapses it back to one pill.

JOURNAL
- The journal records stops in the order the explorer
  completed them, NOT the authored order
- Each journal entry shows the stop's content (seeds,
  observations, reveals) as it does currently
- For merge groups: the journal shows ALL sub-stops as
  separate entries in their internal sequence — not
  collapsed into one. The merge group is a navigation
  concept (one pin, one progress pill), but in the journal
  each stop's content stands on its own so nothing is lost.
- The journal becomes the explorer's personal narrative
  of their investigation — the order IS their construction

MIDWAY CHECK-IN
- Only triggers if midwayEnabled is true AND midwayQuestion
  is not null on the Tour document
- Triggered when completedStops.length >= Math.ceil(
  totalStops / 2)
- Show as a full-screen interstitial card (same card
  styling as other phases)
- Display the storyteller's midwayQuestion text
- Input: text area (or voice input if the Deepgram
  feature is active) for the group's response
- One button: "Continue exploring"
- Store the response on the TourSession document
- This only triggers ONCE per session
- If exactly half are completed in a merge group sequence,
  show the check-in after the merge group completes, not
  mid-sequence

CLOSING FRAMING
- Currently the closing framing connects from the last
  authored stop (stop 8). In unstructured mode, it
  connects from WHATEVER stop the explorer completes last
- When the final stop is completed (all stops checked off),
  instead of returning to the map, the flow redirects
  directly to the Closing Framing
- The Closing Framing content and experience is unchanged

QUESTION ROUTING (ADAPTATION)
- The current question routing checks "upcoming stops" by
  looking at remaining stops in the authored sequence
- In unstructured mode, "upcoming stops" means ALL stops
  the explorer has NOT yet completed (since there's no
  fixed order, any uncompleted stop could be "next")
- The AI should still say "you'll encounter something
  about that" if an uncompleted stop covers the topic,
  but should NOT name which stop or imply an order

========================================
SESSION STATE CHANGES
========================================

Update the TourSession interface:

  interface TourSession {
    id: string;
    tourId: string;
    currentStopIndex: number;        // Still used for linear mode
    currentPhase: string;
    completedStops: string[];        // Stop IDs in completion order
    completionOrder: string[];       // NEW — ordered array of stop IDs
                                     // recording the sequence the
                                     // explorer chose (this IS their
                                     // narrative construction)
    midwayResponseText: string | null;  // NEW
    midwayShownAt: number | null;       // NEW — index in completion
                                        // order when midway was shown
    reflectionScores: { ... }[];
    bankedQuestions: BankedQuestion[];
    startedAt: Timestamp;
    completedAt: Timestamp | null;
  }

========================================
FIRESTORE SCHEMA CHANGES
========================================

Tour document — new fields:
  unstructuredMode: boolean          // Default false
  categories: string[]               // Author-defined category list
  midwayEnabled: boolean             // Default false
  midwayQuestion: string | null      // Shown at halfway point
                                     // (only if midwayEnabled is true)

Stop document — new fields:
  category: string | null            // From tour's categories list
  mergeGroup: string | null          // Stops with same value form
                                     // a sequence; null = standalone

========================================
WHAT TO PRESERVE
========================================

- LINEAR MODE IS UNCHANGED. When unstructuredMode is false,
  everything works exactly as it does now. This toggle adds
  a parallel path, it does not replace the existing one.
- The Essential Question and Closing Framing are fixed
  bookends in BOTH modes
- The internal stop flow (seed → notice → wonder → reveal →
  reflect) is identical in both modes — unstructured mode
  only changes HOW the explorer navigates BETWEEN stops,
  not what happens WITHIN a stop
- The AI response pipeline, knowledge base, photo matcher,
  and question routing all continue to work — the only
  adaptation is that "upcoming stops" means "uncompleted
  stops" in unstructured mode
- The connection web, if implemented, still grows as stops
  are completed — the order just reflects the explorer's
  chosen path

========================================
DO NOT
========================================

- Do not remove the linear mode — it must remain available
  and be the default
- Do not show stop numbers to explorers in unstructured
  mode — there IS no number from their perspective
- Do not change what happens inside a stop — the phases
  are the same
- Do not show all pins of a merge group — only the first
  stop's pin is visible; the others are hidden
- Do not trigger the midway check-in mid-sequence within
  a merge group — wait until the group completes
- Do not assume a fixed number of stops for the midway
  calculation — compute it dynamically from the tour's
  actual stop count (counting merge groups as one)
```

---

## Build Priority

**Admin Side**
1. Tour-level unstructuredMode toggle
2. Categories management (create, edit, delete, reorder)
3. Category assignment on each stop
4. Stop merging UI and mergeGroup field
5. Midway Check-In Question field

**Explorer Side — Navigation**
6. Map view with pins (appear on tour start, disappear on close)
7. Pin states (active, completed/muted, merge group visibility)
8. Gallery view with category grouping
9. Map/Gallery toggle bar

**Explorer Side — Flow**
10. Unstructured tour flow (Essential Question → map → choose stops → closing)
11. Progress bar based on completion order
12. Journal ordered by completion sequence
13. Midway Check-In interstitial (trigger, display, response storage)
14. Auto-redirect to Closing Framing on final stop completion

**Session & Data**
15. TourSession schema updates (completionOrder, midway fields)
16. Question routing adaptation for unstructured mode

**Testing**
17. Test linear mode still works identically (regression)
18. Test unstructured mode end-to-end
19. Test merge groups (single pin, internal sequence, progress counting)
20. Test midway trigger at correct threshold
21. Test on mobile (390px)

---

*This feature is additive — it introduces a parallel navigation mode behind a toggle. The linear mode is preserved as the default. The internal stop experience (seed → notice → wonder → reveal → reflect) is identical in both modes. The change is entirely about how explorers navigate between stops and how their journey is recorded.*
