# Build State — Provenance

*Handoff document for the next Claude Code session. Last updated 2026-06-29
(latest: **Context authoring Stage 2 + 3** — admin "Add Context" items
positioned after stops in the tour editor, a reusable AddContextFlow shared by
learner + admin, and the learner sequence ending in "Add to Context Journal".
See the Stage 2/3 entry in §15. Prior same-day: a new self-contained
**Context Journal** module — Mapbox map +
draggable timeline + tappable P.A.S.T. lenses + an Add-context flow — replacing
the old footer "Journal" entry. See §15. Prior: a multi-part **explorer simplification + end-of-act redesign** for
Context-Prototype mode — see the 2026-06-27 entries in §8. In short: the tour
background photo + the floating "card" chrome were removed (content sits
directly on the page); the pin-tap peek became a full **NPS-style Tour Overview**
with a live pin map; the per-stop **Background+Find merged into one "FIND" page**;
the opening "Share what you think" was dropped so context tours **start on the
stop map**, and tapping a pin shows a **thumbnail confirm**; and the **end of each
Act** became a guided chain — **Context → Context questions (AI, stubbed) →
"Share What You Think" reflection (text + photos + a map pin) → "Hear from the
Community" (upvote + comment) → re-share prompt**, replacing the old
`act_closing → community_forum`).
Prior context preserved — see §8 entries + §13: the **Context-Prototype**
third tour mode — Acts,
act intro splash, per-stop "walk to" map, Community Forum, Suggested
Resources, and audio-synced photo highlights; plus the durable
`memorial-church-tour-sessions` backup + `/admin/sessions` viewer/CSV export in
§4 — **whose `buildRows()` must be updated whenever a new response type is
collected**. Read this instead of re-discovering the codebase.*

---

## 0. Architecture Overview

Next.js 16.2.3 App Router + TypeScript + Tailwind CSS 4 + Framer Motion.
Firebase Firestore + Firebase Storage. Google Maps. Deepgram (voice input).
Deployed on Vercel, auto-deploys from GitHub master.
Two switchable visual themes (Red / Teal) — see §9.

**Three tour modes** (admin picks per tour, top of the editor): **Linear**,
**Unstructured** (§10), and **Context-Prototype** (§13) — a sequential mode
with no essential question (Opening Frame only), no per-stop discussion/bridge,
stops grouped into **Acts**, a per-stop "walk to your next stop" map, a
moderated **Community Forum**, and end-of-tour **Suggested Resources**. Mode is
resolved by `getTourMode(tour)` in `tours-store.ts`.

**Repo:** `github.com/SeanHu73/provenance`

---

## 1. What's Built — Tour System (v2)

The app is now a **tour-based experience**. The old v1 pin-based inquiry
flow (InquirySheet, AskSheet, seed pins) is removed from the learner page.
Tours are authored in `/admin/tours` and played back on the main page.

### Explorer Flow

A tour runs in one of two modes, set by the `unstructuredMode` toggle in
admin (see §10).

**Linear mode (default):**

```
Map (tour pin) → Journal Peek → Intro screens → [Meet Your Guide] →
  Setting the Scene → Question for you! → Written prompts → [Additional Q] →
  Stop 1: Background+Notice → [Discussion] → Context → [Extra rounds] →
    [Reflect] → What's Next → ... →
  Stop N (final) → Closing Discuss → Closing Written → Final Reflect →
  Any Remaining Questions → Question List → [Last words] → End Card
```

**Unstructured mode:** the explorer chooses stop order from a full-screen
map overlay (see §10).

```
Map (tour pin) → Journal Peek → Intro screens → [Meet Your Guide] →
  Setting the Scene → Question for you! → Written prompts → [Additional Q] →
  Unstructured Map (tap any stop pin) →
    Stop: Background+Notice → [Discussion] → Context → [Extra] → [Reflect] →
      [What's Next] → back to Unstructured Map →
  [Midway check-in once half the logical stops are done] →
  ... repeat until all logical stops complete →
  Unstructured Closing (Closing Discuss → Closing Written → Final Reflect →
    Any Remaining Questions → [Last words] → End Card)
```

### Key Components

| Component | File | Purpose |
|---|---|---|
| SplashScreen | `src/components/SplashScreen.tsx` | First-load brand intro (pin drop + wordmark + fade-out). `sessionStorage`-gated. See §11 |
| Journal | `src/components/tour/Journal.tsx` | Main tour playback overlay — phases, transitions, footer |
| TourFooter | `src/components/tour/TourFooter.tsx` | Shared Journal + Ask (?) bar plus their overlays. Used by `Journal.tsx` and by `page.tsx` for map/midway/closing phases |
| ProgressBar | `src/components/tour/ProgressBar.tsx` | Stop pills + amber fill bar + swipeable tracker |
| ActionTitle | `cards/ActionTitle.tsx` | Shared page-level action header (DISCUSS / LEARN / FIND / RESPOND) — bronze 44px label, right-aligned icon, optional "The Investigation" black subtitle and grey "Opinion" pill. Exports `SectionSubtitle` (theme-primary 22px secondary line) and `InstructionsTitle` (italic alt). See 2026-05-27 entry in §8 |
| OpinionDial | `cards/OpinionDial.tsx` | Semicircular SVG dial used in rooms when an opinion question has admin-authored spectrum labels. Pick → reveal → average-distance comparison with similar/different verdict. Fires `onResolved` so the parent can log the round. See 2026-05-28 entry in §8 |
| UserChoicePanel | `cards/UserChoicePanel.tsx` | Picker UI for User Choice Questions — list of authored options plus an italic "Propose Your Own Question" button that opens a textbox + mic. Custom questions are banked to the picker's Inquiries via `bankQuestion`. See 2026-05-28 entry in §8 |
| SpotlightOverlay | `cards/SpotlightOverlay.tsx` | Generic darken-and-spotlight overlay for the onboarding flow. Queries a target by data-attribute selector, four pointer-events-auto dim panels surrounding the rect so the target stays clickable, optional `dim={false}` ring-only mode (keeps underlying UI visible), message + arrow stacked above the target. See 2026-05-29 entry in §8 |
| IntroMapMockup | `cards/IntroMapMockup.tsx` | Onboarding map embed — real `@vis.gl/react-google-maps` stack with `gestureHandling="none"` + `disableDefaultUI` so it reads like a satellite screenshot but is the live Google Map. `fill` prop drops the aspect-ratio constraint for the take-over How-It-Works layout. Pin replicates the live `TourParentPin` (CSS-mask `LogoGlyph` on a disc with animate-ping ring). See 2026-05-29 entry in §8 |
| JournalOverlay | `src/components/tour/JournalOverlay.tsx` | Stops/Questions/Theory tabs |
| TourOverview | `src/components/tour/TourOverview.tsx` | Full-screen NPS-style "table of contents" on map pin tap — live pin-map banner + stop list + Begin tour (replaced the `JournalPeek` bottom sheet; `JournalPeek.tsx` kept but unused). See 2026-06-27 in §8 |
| SeedCard | `cards/SeedCard.tsx` | The merged **"FIND"** page (find instructions + photo on top, Background below; single scroll, no snap). See 2026-06-27 in §8 |
| WonderCard | `cards/WonderCard.tsx` | "Chance to discuss..." / "What's your opinion?" |
| RevealCard | `cards/RevealCard.tsx` | Context with collapsible text when audio present |
| ReflectCard | `cards/ReflectCard.tsx` | Slider + follow-up chips + What's Next |
| WhatsNext | `cards/WhatsNext.tsx` | Bridge + continue + artefacts |
| BranchCard | `cards/BranchCard.tsx` | Question input (AI disabled, banks all) |
| EqSceneCard | `cards/EqSceneCard.tsx` | "Setting the scene..." with photo/description/audio |
| EqDiscussCard | `cards/EqDiscussCard.tsx` | "Question for you! Please discuss..." |
| EqOpeningCard | `cards/EqOpeningCard.tsx` | Written theory + reasoning prompts |
| EqAdditionalCard | `cards/EqAdditionalCard.tsx` | Optional follow-up discussion/opinion question |
| EqClosingCard | `cards/EqClosingCard.tsx` | Combined closing arc (header + framing/audio + restated question + opening echo + midway echo + "Where are you now?" prompts). Replaces the old discuss→written two-step. |
| EqFinalReflectCard | `cards/EqFinalReflectCard.tsx` | Final sliders + chips |
| EqQuestionsCard | `cards/EqQuestionsCard.tsx` | Final questions + question list |
| EndCard | `cards/EndCard.tsx` | Learning arc + explore on your own |
| IntroScreens | `cards/IntroScreens.tsx` | Onboarding sequence — 7 screens (Set Up / Welcome / How it works / What you do / Your thinking matters / Audio / One last thing). How-it-works and What-you-do early-return as take-over layouts with `FloatingProgressDots` over them. Spotlights target the real footer buttons by `data-*` attribute. See 2026-05-29 entry in §8 |
| MeetGuideCard | `cards/MeetGuideCard.tsx` | "Meet Your Guide" — photo, name, title, audio, intro |
| GuideOutroCard | `cards/GuideOutroCard.tsx` | "Last words from &lt;guide&gt;" — closing photo + audio + message |
| DetourFlow | `cards/DetourFlow.tsx` | Artefact side-paths |
| UnstructuredMapOverlay | `cards/UnstructuredMapOverlay.tsx` | Unstructured-mode map UI — stop overlay card, stop gallery, exported `MidwayCheckinCard` |
| UnstructuredClosingView | `cards/UnstructuredClosingView.tsx` | Full-screen closing sequence for unstructured tours (rendered by `page.tsx`, not Journal) |
| ThemeColorMeta | `src/components/ThemeColorMeta.tsx` | Syncs the browser `<meta theme-color>` chrome to the active theme |
| AudioButton | `cards/AudioButton.tsx` | Audio player with timeline |
| BackButton | `cards/BackButton.tsx` | Back navigation (olive border) |
| PhotoContent | `cards/PhotoContent.tsx` | Text + [photo:N] markers + fullscreen |
| FormattedText | `cards/FormattedText.tsx` | **bold** *italic* {{color}} rendering |
| FullscreenPhoto | `cards/FullscreenPhoto.tsx` | Portal-based fullscreen with pinch zoom |
| NoticeMapDisplay | `cards/NoticeMapDisplay.tsx` | Indoor "where to go" map on the Notice screen; pulsing pin markers, optional "Tap for hint" reveal |
| PhotoAnnotations | `cards/PhotoAnnotations.tsx` | Runtime overlay layer — renders admin-authored text / outlined-circle / outlined-rect annotations on any StopPhoto |
| PhotoOverlayEditor | `src/components/admin/PhotoOverlayEditor.tsx` | Admin modal — toolbar, color picker, click-to-place, drag-to-move, corner-resize for photo overlays |
| MicButton | `src/components/tour/MicButton.tsx` | Deepgram voice-to-text |
| VoiceInput | `src/components/tour/VoiceInput.tsx` | Standalone voice input (prominent mode) |
| ThemeSwitcher | `src/components/ThemeSwitcher.tsx` | Red/Teal toggle on the map (§9) |
| QuestionText | `cards/QuestionText.tsx` | Themed discussion-question text — body serif, bronze (`--th-accent-dark`), left-aligned. Strips `[photo:N]` markers since the question section is photo-free. |
| SnapScrollHint | `cards/SnapScrollHint.tsx` | "Keep scrolling" pill + chevron embedded at the bottom of the first snap section on every snap-scroll card |
| EqClosingAdditionalCard | `cards/EqClosingAdditionalCard.tsx` | Legacy per-additional-question card; new closings collapse these into `EqClosingCard` (kept for in-flight sessions) |
| RoomLobby | `src/components/room/RoomLobby.tsx` | Full-screen waiting room shown while a group is set up but not yet started (§12) |
| RoomEntrySheet | `src/components/room/RoomEntrySheet.tsx` | Host / Join bottom sheet — collects name (+ code for join) (§12) |
| RoomMenu | `src/components/room/RoomMenu.tsx` | Bottom sheet opened by the footer ROOM pill — members + idle status + remove + copy code + leave (§12) |
| RoomBarrierIndicator | `src/components/room/RoomBarrierIndicator.tsx` | "Waiting for X to arrive / be ready" surface used by the discussion-barrier hook (§12) |
| RoomStopProposalOverlay | `src/components/room/RoomStopProposalOverlay.tsx` | Floating card shown whenever the host has proposed a stop transition (§12) |
| useRoomBarrier | `src/components/room/useRoomBarrier.tsx` | Hook that turns any discussion-question continue button into a barrier-aware Ready vote when the device is in a room (§12) |

### Data Layer

| File | Purpose |
|---|---|
| `src/lib/types.ts` | Tour, Stop, Detour, TourSession, all phase types |
| `src/lib/tours-store.ts` | Firestore CRUD for `memorial-church-tours` |
| `src/lib/tour-session.ts` | Session state machine, phase transitions, history |
| `src/lib/tour-question-router.ts` | Question routing (AI disabled, banks all) |
| `src/lib/tour-logger.ts` | Google Sheets logging via sendBeacon |
| `src/lib/tour-sessions-store.ts` | Firestore session persistence (backup) |
| `src/lib/photo-sync-tour.ts` | Auto-registers tour uploads in photo library |
| `src/lib/device-capability.ts` | Detects low-end devices for blur fallback |
| `src/context/TourContext.tsx` | React context for all tour state + actions |
| `src/context/ThemeContext.tsx` | Theme state (Red/Teal) + localStorage persistence (§9) |
| `src/context/RoomContext.tsx` | Multi-device group room state, heartbeat, host-failover (§12) |
| `src/lib/room-store.ts` | Firestore CRUD for `memorial-church-rooms` (§12) |

### Phase Types (TourPhase)

```
intro → meet_guide → eq_scene → eq_discuss → eq_opening → eq_additional →
seed → notice → wonder → reveal → reflect → whats_next → branch → off_path →
eq_closing_discuss → eq_closing → eq_closing_additional → eq_final_reflect →
eq_questions → guide_outro → end
```

The closing redesign (2026-05-27) collapsed `eq_closing_additional` and
`eq_final_reflect` into the new combined `eq_closing` card; both phase
identifiers still exist for in-flight legacy sessions but new sessions
go `eq_closing → eq_questions` directly.

`meet_guide` and `guide_outro` are the optional guide bookends — shown
only when the tour's guide has the relevant content (see §8).

Plus two unstructured-mode phases: `unstructured_map` (the stop-picker
overlay) and `midway_checkin` (the optional halfway prompt). Both are
rendered by `page.tsx` outside the `Journal` overlay — see §10.

Plus the **Context-Prototype** phases (all rendered inside `Journal`, since
context mode keeps `unstructuredMode === false`): `opening_frame`,
`act_intro` (the "Act N: Title" splash), `stop_map` (the per-stop "walk to"
map), `resources` (end-of-tour), and — added 2026-06-27, the **end-of-act
chain** — `act_context` (read-only Context section), `act_context_questions`
(ask + AI lookup, currently stubbed), `act_reflection` ("Share What You Think"
reflection), and `community_share` ("Hear from the Community"). The old
end-of-act phases `act_opening`, `act_closing`, `community_forum` (and
`act_questions`) are **deprecated** — new sessions never route to them, but they
still render for in-flight sessions parked on them. See §13.

### Transitions

- **Within a stop** (same stopIndex): slide right-to-left, 120ms
- **Between stops** (different stopIndex): fade, 400ms
- Detection: compares `phaseHistory` previous entry's stopIndex

### Visual Design

*Colours, fonts, and corner radii are theme-driven — see §9. The hex
values below describe the original Ledger-era look; the live values
come from `--th-*` tokens and change with the active theme.*

- Card screens with rounded-2xl corners, shadow-lg, sandstone bg visible around edges
- Background photo: tour-level default + per-stop override
- Card opacity: 70% (most screens) / 85% (context/reveal) with backdrop-blur
- Question boxes: faded cardinal red (#7A1A1A at 56% opacity), amber border (#C4923A, 3px), light text (#FFF8EE)
- Progress bar: "N of M explored" count + filled/empty pills; current
  stop pill expands to number + name; tappable to open the swipeable
  stop tracker. Completed pills fill amber `#F59E0B` (matches map pin
  rings). Linear mode also shows the amber fill bar; unstructured mode
  omits the fill bar (order is not fixed).
- Footer: Journal button + ? button, olive borders (#7A7A5E)
- Back button: olive border, 2px, matches footer
- Scroll indicator: large arrow, sandstone scrollbar
- Map pins: themed circular discs with the Provenance logo glyph inside
  (white pin + speech-bubble "P"), built from CSS-mask assets; see §8

### Discussion Question Types

Each wonder (main, extra rounds, additional EQ) has a `questionType`:
- `'discuss'` → explorer shows "Chance to discuss..."
- `'opinion'` → explorer shows "What's your opinion?"

---

## 2. Admin System

### Routes

| Route | Purpose |
|---|---|
| `/admin` | Legacy pin editor + bulk import |
| `/admin/tours` | Tour list + create |
| `/admin/tours/[id]` | Full tour editor |
| `/admin/photos` | Photo library |
| `/admin/photos/new` | Upload new photo |
| `/admin/photos/[id]` | Edit photo metadata |
| `/admin/community` | Community Forum + Suggested Resources moderation (§13) |
| `/admin/sessions` | Session-backup viewer + CSV export of collected responses (§4) |

### Tour Editor Structure

Tour metadata: title, subtitle, guide (name/role/initials, photo with
focal-point + zoom framing, intro text + audio, closing "Last words"
message + audio), description, cover photo, peek audio, tour-level
background photo (with **contrast slider** 50–200%), map pin location,
**default map zoom** (13–20 slider, used when unstructured mode starts),
**unstructured mode toggle**, **midway check-in** (toggle + question),
essential question (with scene photo/description/audio, opening framing,
theory/reasoning prompts, additional question, closing framing/audio,
final prompts).

Per stop: title, isFinalStop toggle, **merge group** (stops sharing a
value form one sequential unit in unstructured mode), background photo
override, seed (text/photos/audio/timer), notice (prompt/photos/audio/timer),
discussion question (toggle + discuss/opinion type + photos/audio),
reveal (text/photos/audio with [photo:N] markers), extra rounds
(discussion + context, each toggleable), bridge (toggle + text/photos),
reflection (toggle + slider labels + follow-up type + custom options + photos),
detours/artefacts, map pin (optional), metadata (location tag, entries, topics).

### Photo Editing

Every photo list (`PhotoListEditor`) supports per-photo display modes:
**Auto** (fit), **Crop** (fill — 4:3 preview with click-to-set focal
point + 1×–3× zoom slider), and **Full** (letterbox with black bars).
A separate **thumbnail crop** control (3:1 preview matching the map
overlay card) sets `thumbnailFocalPoint` for the small thumbnails shown
on map overlay cards, the stop gallery, and the journal. Stored on the
`StopPhoto` type; the explorer honours all of it.

### Rich Text

Admin textareas have B/I/Color toolbar. Text renders via FormattedText:
`**bold**`, `*italic*`, `{{#hex}}colored{{/}}`.

### Photo System

Photos uploaded via tour editor auto-register in `memorial-church-photos`.
Photos can be placed inline via `[photo:N]` markers in text fields.
Explorer photos are tappable for fullscreen (portal, pinch-zoom, close button at bottom).

---

## 3. Firestore Collections

| Collection | Purpose |
|---|---|
| `memorial-church-tours` | Tour documents with stops array |
| `memorial-church-tour-sessions` | **Full session backup** — `persistTourSession` writes the entire `TourSession` (incl. `actResponses`, `reflections`, `essentialQuestionResponses`, `bankedQuestions`, `completionOrder`, …) on every change. The durable record of collected responses (independent of the Google Sheet), read + exported by `/admin/sessions`. **Needs its own rule block** (`match /memorial-church-tour-sessions/{doc} { allow read, write: if true; }`) — if missing, the backup silently fails and the collection never appears. |
| `memorial-church-pins` | Legacy pins (still used by admin) |
| `memorial-church-photos` | Photo library |
| `memorial-church-contributions` | Learner contributions |
| `memorial-church-questions` | Legacy question log |
| `memorial-church-migrations` | Migration receipts |
| `memorial-church-rooms` | Multi-device group rooms (§12) — code, members, transition + barrier state. Now also carries `opinionDials` (per-question position + revealedBy maps) and `userChoiceSelections` (per-question `{ chosenBy, question, isCustom }`) for the 2026-05-28 gamification. |
| `memorial-church-community-questions` | Context-Prototype Community Forum (§13) — explorer-submitted questions `{ tourId, text, sessionId, name?, about?, likes?, status, createdAt }`, moderated in `/admin/community`. `likes` is an atomic-increment counter (per-device liked-set tracked in localStorage). |
| `memorial-church-community-responses` | Forum responses `{ questionId, tourId, text, sessionId, name?, status, createdAt }`, moderated. (Legacy: the per-act question forum was retired by the 2026-06-27 redesign in favour of shares below; old data is still read-only in `/admin/community`.) |
| `memorial-church-community-resources` | Suggested Resources (§13) — `{ tourId, title, description, photos[], links[], source: 'admin'\|'user', status, ... }`, admin-curated or explorer-submitted + moderated. |
| `memorial-church-community-shares` | **"Hear from the Community"** (§13, added 2026-06-27) — explorer-shared "Share What You Think" reflections `{ tourId, actId, text, photos[], pin?:{lat,lng,title?,note?}, sessionId, name?, about?, upvotes?, status, createdAt }`. Created `status: 'approved'` (appear immediately); `upvotes` is an atomic-increment counter (per-device upvoted-set in localStorage `provenance-share-upvoted`). Admin can hide/remove in `/admin/community` (Shares tab). |
| `memorial-church-community-comments` | Comments on shares (§13, added 2026-06-27) — `{ shareId, tourId, text, sessionId, name?, status, createdAt }`, created `approved`. |

### Security Rules

All collections: `allow read, write: if true;` (test mode).
Storage: `memorial-church/{allPaths=**}` allow read, write.

**New collections must be added explicitly** — the rules are
per-collection, not a catch-all. `memorial-church-rooms` needed its
own block added in the Firebase console for the rooms feature to
work (one-line `match /memorial-church-rooms/{doc} { allow read,
write: if true; }`). The three `memorial-church-community-*`
collections (§13) likewise each need their own `match` block in the
console, or forum/resource reads & writes fail silently. The two
2026-06-27 collections (`memorial-church-community-shares` and
`memorial-church-community-comments`) each need their own block too —
they were added to the console on 2026-06-27 (verified live: without
them, sharing throws `Missing or insufficient permissions`, handled
gracefully as an empty state).

---

## 4. Logging

All tour events log to Google Sheets via `/api/log-tour` → `SHEETS_WEBHOOK_URL`.
Uses `navigator.sendBeacon` for mobile reliability.

Events: reflection, question_banked, question_routed, eq_opening, eq_closing,
eq_final_reflect, stop_entered, tour_complete, **opinion_dial**,
**user_choice_picked**, and (Context-Prototype) **act_question**. Each row
includes `sessionId` for grouping and (as of 2026-05-29) `roomCode` / `isHost`
/ `memberCount` for joining rows by group session — `tour-logger.ts` keeps a
module-level log context that `RoomContext` updates whenever the room state
changes. (Community Forum questions/responses and Suggested Resources are
**not** Sheet events — they live in Firestore and are moderated in
`/admin/community`; see §13.)

Apps Script columns (40 — original 24, 12 added 2026-05-29, 4 added 2026-06-09):
- **Original (1–24)**: Logged At, Timestamp, Session ID, Source, Event/Type,
  Tour Title, Stop Title, Stop #, Reflection Score, Follow-Up Response,
  Question, Question Routing, Stops Completed, Duration (min),
  EQ Initial Theory, EQ Initial Reasoning, EQ Final Reflection,
  EQ Final Reasoning, EQ Cognitive Slider, EQ Perceptual Slider,
  EQ What Changed, EQ Why Changed, Observation, Answer.
- **Added 2026-05-29 (25–36)**: Room Code, Is Host, Member Count,
  Question Key, Opinion Left Label, Opinion Right Label, Opinion My
  Position, Opinion Other Positions, Opinion Similarity, Opinion Avg
  Distance, User Choice Question, User Choice Is Custom.
- **Added 2026-06-09 (37–40)**: Act Title, Act Question Kind
  (`opening`/`closing`), Act Question, Act Response — populated by the
  Context-Prototype `act_question` event. Re-run `addHeaders()` once and
  redeploy the Apps Script as a new version to pick these up.

Two adoption docs accompany the 2026-05-29 logging update:
`docs/Sheets_Logging_Update.md` (per-field reference + cross-referencing
guidance) and `docs/sheets-apps-script.gs` (the full Apps Script — paste
in, run `addHeaders()` once, redeploy as new version of the existing
Web App; `SHEETS_WEBHOOK_URL` does not change).

### Two collection layers (and where data can be lost)

Responses are captured in **two independent places**:

1. **Google Sheets** (this section) — fire-and-forget event rows via
   `tour-logger.ts` → `/api/log-tour` → webhook. Delivery uses
   `navigator.sendBeacon` (fetch-with-retry fallback). Best-effort: if a device
   powers off / drops network the instant after an answer is submitted, that
   beacon can be lost (this is how end-of-tour Act answers went missing once).
2. **Firestore `memorial-church-tour-sessions`** (§3) — the **durable backup**.
   `persistTourSession` writes the whole `TourSession` server-side on every
   change, so it survives lost beacons. Viewed + CSV-exported at
   **`/admin/sessions`** (`src/app/admin/sessions/page.tsx`). Requires its rule
   block (§3) or it silently records nothing.

> ⚠️ **MAINTENANCE — keep `/admin/sessions` in sync with what we collect.**
> Whenever you add or change a **type of response** stored on `TourSession`
> (e.g. a new `actResponses` shape, a new reflection field, a new
> question/answer kind), you MUST update the `buildRows()` flattener in
> `src/app/admin/sessions/page.tsx` (and the `HEADER`/CSV columns) so the new
> data shows up in the viewer and the export. Otherwise the backup will hold
> the data but the admin page won't surface it. (Likewise add a matching
> column + `act_question`-style event in `tour-logger.ts` + the Apps Script if
> it should also reach the Google Sheet.)

---

## 5. Voice Input (Deepgram)

`/api/transcribe` route sends audio to Deepgram Nova-2 REST API.
`MicButton` component on every text input field.
Requires `DEEPGRAM_API_KEY` env var.

---

## 6. Environment

### .env.local / Vercel env vars

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=provenance-b6c20
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=provenance-b6c20.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
ANTHROPIC_API_KEY=...
SHEETS_WEBHOOK_URL=...
DEEPGRAM_API_KEY=...
```

### Dependencies

Next.js 16.2.3, React 19.2.4, firebase ^12.12.0, framer-motion,
Tailwind CSS 4, TypeScript 5, @vis.gl/react-google-maps 1.8.3.

---

## 7. Known Issues / Watch Out For

- **AI question routing disabled** — all questions bank immediately. To re-enable, uncomment the Step 2 block in `tour-question-router.ts`.
- **Background photo override**: old stops may have `backgroundPhotoUrl` (legacy field name). The code checks both `backgroundPhotoOverride` and legacy. When `backgroundPhotoOverride` is `undefined` (never set) it falls back to legacy; when `null` (explicitly cleared) it respects the null.
- **Firestore field migrations**: stops created before various features were added may be missing fields. The admin StopEditor has defensive defaults that normalize on load.
- **No authentication** on admin routes.
- **No automated tests** — verification is manual.
- **Viewport**: `maximumScale` and `userScalable` removed from layout.tsx to enable pinch-to-zoom on photos.
- **Theming**: `layout.tsx` wraps the app in `ThemeProvider` and runs a pre-paint inline script that sets `data-theme` on `<html>`. Admin pages are not in theme scope — see §9.
- **CSS token names**: only `--th-primary`, `--th-secondary`, `--th-surface`, `--th-border` etc. exist as `--th-*`. Palette aliases like `--aged-gold`, `--text-primary`, `--text-secondary` live in `:root` *without* the `--th-` prefix. `var(--th-aged-gold)` resolves to nothing (caused transparent progress pills once).
- **`animate-ping` / `animate-bounce` + `transform`**: these Tailwind keyframes animate `transform`, clobbering any inline `transform` (e.g. `translate(...)`) on the *same* element. Put positioning transforms on a wrapper div and the animation class on an inner child (see the selected-pin ring in `Map.tsx` and the onboarding `?` cue arrow).
- **Google Maps `mapId` + vector rendering**: the map uses `mapId="b8f339c02d8c7d5bd3f12d1b"` (Cloud Console). This is required for `AdvancedMarker` in `@vis.gl/react-google-maps` 1.8.3 — removing it breaks the map. However, `mapId` forces vector rendering, which silently ignores both the `styles` prop and `map.setOptions({styles})` at runtime. POI / transit pin hiding **must** be configured via Google Cloud Console → Map Styles linked to the map ID. A `PoiStyler` component exists in `Map.tsx` but is a no-op with the current setup.
- **`panTo()` range limit**: Google Maps only animates `panTo()` smoothly when the destination is within roughly one screen's width/height. For larger distances it jumps immediately. The fly animation therefore uses a `requestAnimationFrame` loop with `setCenter()` each frame for phase 1 (pan), and `setZoom()` each frame for phase 3 (zoom out). See `MapFlyer` in `Map.tsx`.
- **`isFinalStop`** only governs linear tours. In unstructured mode `advanceToNextStopUnstructured` ignores it; the final stop is whichever logical stop the explorer completes last. Code that branches on `isFinalStop` must also check `!tour.unstructuredMode`.
- **Logical stops**: in unstructured mode count `getLogicalStops(tour)` (standalone stops + the leader of each merge group), not `tour.stops.length`. `completionOrder` holds *logical* stop IDs and is populated only when a stop is completed.
- **Full-screen dim with a clickable target**: `box-shadow: 0 0 0 9999px rgba(0,0,0,X)` paints the dim *visually* but the dim is **not** a hit region — the element's own bounding box is. So putting a `pointer-events-auto` `fixed inset-0` parent around the spotlight will swallow every click before it reaches the target. `SpotlightOverlay` instead uses four `pointer-events-auto` panels surrounding the target rect (with the parent `pointer-events-none`) so taps on the target pass straight through; only the visual ring sits on top, and it's `pointer-events-none`. Same lesson applies to any "modal that leaves a hole".
- **CSS token `--th-text-primary` does not exist**: text colours are aliased *without* the `--th-` prefix (`--text-primary`, `--text-secondary`). Using `var(--th-text-primary)` silently falls back to inherited colour — caused the SHARE callout to render cream-on-cream during onboarding. Use `var(--text-primary)` or the Tailwind `text-text-primary` utility (exposed via `@theme inline`).
- **Static Maps API requires its own enablement** in the GCP project. The live Map's API key works for Maps JavaScript API but not necessarily Static Maps. The onboarding map embeds `@vis.gl/react-google-maps` with `gestureHandling="none" + disableDefaultUI` instead — looks static, uses the existing enablement.

---

## 8. Recent Session Work (May 2026)

### v2 tour system (earlier session)

An earlier session built the complete v2 tour system from scratch:
- Tour data model + admin authoring (Priority 1)
- Explorer playback with all card types (Priority 2)
- Question routing at branch points (Priority 3)
- Essential question bookend (opening + closing)
- Reflection system with configurable follow-ups
- Related artefacts / detour system
- Rich text formatting (bold/italic/color)
- Multi-photo support with [photo:N] inline placement
- Audio narration on all phases
- Voice input via Deepgram
- Intro screens
- Progress bar with stop pills + fill bar + swipeable tracker
- Journal overlay (stops/questions/theory tabs)
- Slide transitions (within stop) + fade transitions (between stops)
- Background photos with frosted glass cards
- Fullscreen photo viewer with pinch-to-zoom
- Discussion Question / Discuss Opinion question types
- Session history for back navigation
- Google Sheets logging with sendBeacon
- Device capability detection for blur fallback

### Theme system — Red & Teal (2026-05-20)

Added the dual-theme system (full reference in §9). Shipped to
production `master` over several commits.

- New `--th-*` themeable token layer in `globals.css`; two themes
  selected by the `data-theme` attribute on `<html>` — **Red**
  (default) and **Teal** — switchable with no reload.
- `ThemeContext` + `ThemeProvider` and a `ThemeSwitcher` control at the
  top-right of the map; the choice persists in `localStorage`, with a
  pre-paint inline script in `layout.tsx` to avoid a theme flash.
- Migrated ~514 hardcoded hex values across 30 explorer-side files onto
  theme tokens (Tailwind colour tokens + `var(--th-*)`); no per-component
  colour hexes remain in the explorer UI.
- Fonts moved to `next/font/google` (self-hosted): **Newsreader** for
  all content/body text in both themes, **DM Serif Display** (Red) and
  **Cormorant Garamond** (Teal) for titles via a new `font-display`
  utility. This replaced a CSS `@import url()` that Tailwind v4's build
  was silently stripping (the original font bug).
- Themeable corner radius; buttons made rounder.
- Teal theme made genuinely teal-dominant — its `--th-primary` is teal,
  with cranberry demoted to the secondary accent.
- Coloured the journal title bar, the journal footer, and the map's
  bottom bar with the active theme's primary colour.
- Enlarged titles (section headings `text-2xl`→`text-3xl`, essential-
  question hero text 28px→34px, tour titles bumped a step).
- Themes renamed Ledger→Red, Folio→Teal.

Admin pages were intentionally left out of theme scope (see §9). Build
and TypeScript pass; verified structurally (compiled CSS + dev server),
not pixel-reviewed in a browser.

### Palo Alto recolour & title trim (2026-05-20)

A follow-up pass on the theme system:

- **Teal theme → Palo Alto palette.** The second theme keeps its
  `data-theme='teal'` id but now uses the Palo Alto colour scheme
  (`docs/Style Guide - Palo Alto.png`): primary `#175E54` Palo Alto
  teal, secondary `#8F993E` olive (the old cranberry secondary is
  gone), Palo Verde `#279989` for the "?" accent. Only the
  `[data-theme='teal']` block in `globals.css` changed.
- **Both themes share DM Serif Display for titles.** The Teal theme's
  Cormorant Garamond was dropped — `--th-font-display` resolves to DM
  Serif Display in both blocks, and Cormorant is no longer loaded in
  `layout.tsx`.
- **Red theme limited to three colours** — cranberry, amber and
  neutrals/ink (per an "accents + text colour" counting rule). The
  only green token, `--th-olive` (`#A6A67C`), is now dark amber
  `#7E5320`; the brown `--th-journal` is now deep cranberry `#3E1620`.
  No blue or green hues remain in the Red palette. Exception: the
  Google-style "my location" dot in `Map.tsx` is still blue — kept as
  a deliberate, functional map convention.
- **Titles trimmed one step** — section headings `text-3xl`→
  `text-[26px]`, essential-question hero `text-[34px]`→`text-[30px]`,
  tour titles down a step (Journal/JournalPeek `text-xl`→`text-lg`,
  EndCard `text-2xl`→`text-xl`).
- **SeedCard's two section headings** now share one colour
  (`text-accent-dark`); EndCard's hardcoded `rgba(196,146,58)`
  reflection-bar colour was tokenised to `var(--th-secondary)`.
- **Tour (map) pin enlarged** 44→60px with a pulsing `animate-ping`
  ring and a "Tap to start" label (`TourParentPin` in `Map.tsx`), to
  make it obvious as the tour entry point.

### Unstructured Exploration Mode + UI polish (2026-05-21 → 2026-05-22)

A long multi-part session. All work is committed and live on `master`
(commits `c79490d` → `09cf81a`).

**Unstructured Exploration Mode — new major feature.** A tour-level
mode where the explorer picks stop order instead of following a fixed
sequence. Full reference in §10. Shipped with admin authoring (mode
toggle, midway check-in, per-stop merge groups), the `unstructured_map`
stop-picker overlay, the `midway_checkin` halfway prompt, and the
`UnstructuredClosingView` closing sequence. Several follow-up commits
fixed crashes and ordering bugs (see §10).

**Progress bar redesign.** Replaced the old pill strip with a
"N of M explored" count, filled/empty circular pills, and a current-stop
pill that expands to show number + name. Tapping it opens the swipeable
stop tracker. Completed pills fill amber `#F59E0B` (matching the map pin
rings). Unstructured mode drops the fill bar.

**Photo display modes & cropping.** New `StopPhoto` type
(`displayMode`, `focalPoint`, `zoom`, `thumbnailFocalPoint`) replacing
the old inline `{ url, caption }` photo shape across the `Stop` type.
Admin `PhotoListEditor` gained Auto / Crop / Full display modes, a 4:3
crop preview with click-to-set focal point and a 1×–3× zoom slider, and
a separate 3:1 thumbnail-crop control. The explorer's `PhotoContent` and
all three thumbnail surfaces (map overlay card, gallery, journal) honour
the new fields.

**Map dynamic zoom.** The map now `fitBounds` to center the user with
the nearest tour pin in frame: distances in **miles**, nearest pin
shown within a 5-mile radius, a navigation prompt when the user is far,
and up to 25% center drift to keep the zoom comfortable. Enlarged,
circle-anchored pin labels ("Tap to start").

**UI polish.** EQ discussion question box went through many fade
iterations and ended as a sharp rounded rectangle with a drop shadow
(no blur). Softer footer Journal / `?` buttons. Larger MicButton.
Scene/discuss copy tweaks ("Are you looking at this:"). Browser chrome
`<meta theme-color>` now tracks the active theme via `ThemeColorMeta`.
Admin: stop editor scrolls to the top of a stop when expanded.

**Lessons captured** in §7: the `--th-aged-gold` non-existent-token bug,
the `animate-ping` / `transform` collision, and `isFinalStop` only
applying to linear tours.

### App identity, logo map pins & guide bookends (2026-05-22)

A session of branding and guide-experience work. All committed and live
on `master` (commits `4506087` → `26484cc`).

**App identity / PWA.** The installable app now uses the Provenance pin
logo: PWA icons (`icon-192/512` + a maskable variant), `apple-icon`, and
favicon are generated from `docs/Logo.png`. `manifest.json` and the iOS
`appleWebApp` metadata name the installed app **"Provenance"**;
`theme_color` corrected from a stale blue to the red theme.

**Map pins → logo glyph.** Tour-entry and stop pins are now themed
circular discs with the Provenance logo inside. The tour-entry disc
shows the full logo glyph (white pin + recessed "P"); stop discs show
just the white speech-bubble "P" with theme-coloured dots. Built from
CSS-mask assets (`public/pin-glyph-base|p|bubble.png`) so the glyph
recolours with the theme. New `LogoGlyph`, `BubbleGlyph`, `DiscMarker`
components in `Map.tsx`; stop discs carry a number / completed-check
corner badge, pulsing ring when active/selected, dim when done.

**Meet Your Guide.** New `meet_guide` phase + `MeetGuideCard`, shown
after the intro screens when the tour has a named guide — round photo,
name, italic title, audio, then intro text. The guide photo has admin
focal-point + zoom framing (`guidePhotoStyle` helper in
`src/lib/guide-photo.ts`); it also replaces the initials avatar on the
journal peek.

**Last words.** New `guide_outro` phase + `GuideOutroCard` — an optional
"Last words from <guide>" closing screen (photo + audio + message) shown
after the final questions and before the end card. `finishTour` routes
through it when the guide has a closing message or audio. Rendered by
both `Journal` and `UnstructuredClosingView`.

**Onboarding rewrite.** `IntroScreens` got new copy across all five
screens, an animated arrow (pinned inside the footer `?` button via an
`onPointAtQuestion` callback) cueing question-asking on screen 3, and an
interactive "Who has a phone?" choice on the Set Up screen that gates
the Next button.

**Smaller fixes.** The discussion-question button reads "We've talked —
what's next?" instead of "show us" when no context follows (extra rounds
whose reveal is empty).

---

## 9. Theme System

Two switchable visual themes, added 2026-05-20. Toggled via a
**ThemeSwitcher** at the top-right of the map. Only colours, fonts,
and corner radii change — all functional structure (cards, frosted
glass, transitions, background photos, progress bar) is shared.

### Themes

| | Red (default) | Teal — Palo Alto |
|---|---|---|
| Persona | 1970s New Journalism | Palo Alto palette |
| Title font (serif) | DM Serif Display | DM Serif Display (shared) |
| Content font | Newsreader (shared) | Newsreader (shared) |
| Primary (dominant accent) | #8B2538 cranberry | #175E54 Palo Alto teal |
| Secondary accent | #B8752B amber | #8F993E olive |
| Corner radius | softer (lg 1rem / 2xl 1.25rem) | crisper (lg .65rem / 2xl .9rem) |

Each theme is named for its dominant accent. The dominant colour drives
buttons, the progress bar, headings, map pins, and the title/footer bars
(`--th-primary`); the secondary accent appears on essential-question box
borders etc. Content text uses one shared, highly legible serif
(Newsreader); titles use one shared display serif (DM Serif Display).
Both fonts apply in both themes.

Source style guides: `docs/Style_Guide_Ledger.md` → Red theme,
`docs/Style_Guide_Folio.md` → Teal theme. Palette references:
`docs/Style Guide - Red.png` (Red), `docs/Style Guide - Palo Alto.png`
(Teal). The older `Style Guide - Teal.png` is superseded.

### How it works

- `globals.css` defines a `--th-*` token layer in two blocks:
  `:root, [data-theme='red']` and `[data-theme='teal']`. Switching
  the `data-theme` attribute on `<html>` re-resolves every token
  instantly — no reload.
- Fonts are loaded with `next/font/google` in `layout.tsx` (self-hosted,
  no external request). Content/body text uses **Newsreader**
  (`--th-font-body`, reached via the `font-serif`/`font-sans` utilities
  and `body`); titles use **DM Serif Display** (`--th-font-display`, via
  the `font-display` utility). Both fonts are shared across the two
  themes. (An earlier CSS `@import url()` was dropped — Tailwind v4's
  build strips external font imports.)
- Legacy palette names (`--sandstone`, `--aged-gold`, etc.) plus four
  new ones (`--olive`, `--accent-dark`, `--journal`, `--question-red`)
  are aliased onto `--th-*` and exposed as Tailwind tokens via
  `@theme inline`. Colour utilities, `font-serif`/`font-sans`, and
  `rounded-lg/xl/2xl` all flow through these.
- `ThemeContext.tsx` holds the active theme, persists it to
  `localStorage` (`provenance-theme`), and mirrors it to `<html>`.
- An inline script in `layout.tsx` applies the stored theme before
  first paint to avoid a flash of the default theme.
- `ThemeColorMeta` keeps the browser's `<meta name="theme-color">`
  (mobile address-bar / status-bar tint) in sync with the active theme.

### Adjusting colours/fonts

Edit the two theme blocks in `globals.css` only — that is the single
source of truth. Explorer components reference tokens (`var(--th-*)`
in inline styles, Tailwind classes like `bg-aged-gold` / `text-olive`
elsewhere); no per-component colour hexes remain in the explorer UI.

### Out of scope

Admin pages (`/admin/**`) were intentionally not migrated. They
inherit themed Tailwind tokens, but their remaining hardcoded hexes
and the `RichTextarea` content-colour picker (whose hexes are saved
into tour content, not UI chrome) are deliberately left untouched.

---

## 10. Unstructured Exploration Mode

Added 2026-05-21. A tour-level mode (`Tour.unstructuredMode`) where the
explorer chooses which stop to visit next instead of following the
authored sequence. The essential-question opening and closing bookends
are unchanged — only the per-stop middle becomes explorer-driven.

### Authoring

- **Mode toggle** on the tour: `unstructuredMode`.
- **Midway check-in** (`midwayEnabled` + `midwayQuestion`): an optional
  reflection prompt shown once the explorer has completed half the
  logical stops.
- **Merge groups** (`Stop.mergeGroup`): stops sharing a non-null
  `mergeGroup` string form a *cluster* that plays as a mini-linear tour
  inside the unstructured one. The main map shows the leader pin only
  (with a sub-stop count badge); tapping it opens a swipeable
  "Stop cluster" carousel. After each sub-stop completes the explorer
  returns to a **mini-map** that filters down to just that group's pins
  with the next sub-stop enlarged and flashing. When the final sub-stop
  is done, the main map returns with every group member shown as a
  small toured indicator (no leader). Locked sub-stops are tappable
  with a "Please complete prior stops first" overlay whose
  "Show me next stop" button pans the map to the flashing pin. A
  standalone stop has `mergeGroup: null`. See §8's final entry for
  details and the cluster-rendering helpers (`getActiveGroupId`,
  `getNextStopInGroup`, `getStopsInGroup` in `tour-session.ts`).

### Logical stops

`getLogicalStops(tour)` (in `tour-session.ts`) returns the pickable
units: every standalone stop plus the *leader* (first authored stop) of
each merge group. Counts and progress are measured in logical stops,
**not** `tour.stops.length`.

### Session state

- `completionOrder: string[]` — logical stop IDs in the order the
  explorer completed them. Populated on completion, not on entry. Drives
  journal ordering and "Stop N" visit-number labels.
- `midwayShownAt: number | null` — `completionOrder` length when the
  midway check-in fired.
- `midwayResponseText: string | null` — the explorer's midway answer.

### Phases & rendering

- `unstructured_map` — the stop-picker. Renders `UnstructuredMapControls`
  + `UnstructuredMapOverlay`. The overlay card auto-switches between
  three variants based on the selected pin: `GroupClusterOverlayCard`
  (group leader, un-started), `LockedStopOverlayCard` (locked sub-stop
  on the mini-map), or the standard `StopOverlayCard` (everything else).
  The same phase covers both the main map and the mid-group mini-map —
  the distinction is derived from `getActiveGroupId(tour, session)`.
- `midway_checkin` — renders `MidwayCheckinCard` (exported from
  `UnstructuredMapOverlay.tsx`). Now a scrollable arc: visited-stop
  thumbnails, divider + deliberate gap, then the question with an
  optional textbox + mic (see §8's final entry).
- Closing — `UnstructuredClosingView` runs the combined-closing →
  final-reflect → questions → end sequence full-screen. The legacy
  `eq_closing_discuss` phase still renders the new combined card as
  a fallback for in-flight sessions.

All three are rendered by `src/app/page.tsx` **outside** the `Journal`
overlay (Journal early-returns on these phases caused the original
"This page couldn't load" `AnimatePresence` crash).

### Advancement

`advanceToNextStopUnstructured` (in `tour-session.ts`) runs after a stop
completes: completing any sub-stop in a group **always** returns to
`unstructured_map` (the mini-map is derived from session state). Only
when the last group member is completed does it append the leader ID to
`completionOrder`, fire the midway check-in if due, and either return
to the main map or advance to the closing once
`completionOrder.length >= getLogicalStops(tour).length`. Standalone
stops `finishLogicalStop` immediately. `isFinalStop` is ignored in this
mode.

### Bug-fix history (follow-up commits)

- `unstructured_map`/`midway_checkin` transitions crashed Journal's
  `AnimatePresence` — moved rendering to `page.tsx`.
- Map cut off at the bottom during the tour — fixed overlay covered the map.
- Journal/progress order corrected to *visit* order (`completionOrder`),
  with merge-group siblings kept in authored order.
- Selected-pin pulse ring re-centered (`animate-ping`/`transform` fix).
- Transparent progress pills fixed (`--th-aged-gold` → `--aged-gold`).
- "Oval" stop blank `whats_next` screen — caused by `isFinalStop: true`
  in its data; guarded with `!tour.unstructuredMode`.
- "Finish the tour" button shown only on the genuine last logical stop.

---

### Project rename + map overhaul + bg contrast (2026-05-23)

**Project renamed to Provenance.** `package.json` name, app `<title>`,
admin heading, `PhotoDisplay` alt text, `manifest.json` description, and
GitHub repo all changed to "Provenance". Firestore collection names and
Firebase Storage paths were intentionally left unchanged (live data).
Vercel project renamed; domain is `provenance-history.vercel.app`.

**Card opacity tightened.** Standard cards 70%→80%, reveal/context
cards 85%→90%; no-blur fallbacks bumped proportionally (`Journal.tsx`
lines ~230–235).

**Audio files committed.** `public/audio/Meet Your Guide.m4a` and
`public/audio/Setting the Scene.m4a` added to the repo.

**Map improvements — all in `src/components/Map.tsx`:**

- `MEMORIAL_CHURCH` constant renamed `CHURCH_LOCATION`.
- `mapId="b8f339c02d8c7d5bd3f12d1b"` — real Cloud Console ID (see §7 note on POI hiding).
- **Admin-adjustable default zoom.** `Tour.defaultZoom?: number` (13–20).
  `MapZoomer` fires once when unstructured mode starts, centering on the
  user at this zoom. Slider in the tour editor.
- **Off-screen direction arrows.** `OffScreenArrows` / `DirectionArrow`
  — 8-sector grouping (N/NE/E/SE/S/SW/W/NW), amber `#F59E0B`,
  `animate-pulse`, 46px, with a counter badge when multiple stops share a
  sector. Rendered as absolute divs over the map, outside `GoogleMap`.
- **Gallery → map fly animation.** `MapFlyer` component, three phases driven
  by `requestAnimationFrame`:
  - Phase 1 (900 ms): RAF `setCenter` loop, `easeInOutCubic`, pans from
    current center to selected stop. (Native `panTo()` was tried but jumps
    for distances > ~one screen width.)
  - Phase 2 (400 ms): `setTimeout` pause so the user sees the pin centred.
  - Phase 3 (1 400 ms): RAF `setZoom` loop, zooms out in place (stop stays
    centred). Zoom target computed by `fitZoomCenteredOnStop` — Mercator
    math to find the maximum zoom where the user's location dot is visible
    with the stop pinned at screen centre.
  - Triggered by `flyTarget` prop in `page.tsx`; cleared via `onFlyComplete`.
  - `handleStopSelectedFromGallery` in `page.tsx` sets `flyTarget`; gallery
    passes the full `Stop` object (not just ID) to `onStopSelectedFromGallery`.
- **`OverlayAwarePanner`.** When a stop overlay card appears (after
  animation completes), projects the stop pin to screen Y via Mercator
  math and calls `panBy(0, n)` to lift it above the overlay card. Capped
  at 180 px. Only considers the stop pin, not the user dot (including user
  caused excessive panning at high zoom). Resets on overlay dismiss so
  re-tapping the same pin re-triggers it.

**Background photo contrast.** `Tour.backgroundPhotoContrast?: number`
(50–200, default 100 = unchanged). Admin: contrast slider below the bg
photo preview, with live preview on the image. Explorer: `filter:
contrast(N%)` applied to the bg photo `<img>` in `Journal.tsx`. Admin
preview also fixed from a narrow `h-20` cropped strip to full photo
(`object-contain`, `max-h-72`).

---

### Independent unstructured authoring, cluster mini-tour, rich text, redesigned midway + closing (2026-05-23, later)

A long evening session — seven commits (`2895b90` → `0461aa8`), all
live on `master`.

**Independent stops authoring for unstructured mode.** New
`Tour.unstructuredStops?: Stop[]` parallel array, so the writing for a
tour's linear and unstructured modes can diverge without touching each
other. Toggling unstructured on for the first time deep-clones the
linear stops (with newly minted stop and detour IDs) into the parallel
array; both arrays persist after that, so flipping the toggle later
keeps your unstructured edits. Admin and explorer both go through
new helpers in `tours-store.ts`:

- `getActiveStops(tour)` — returns `unstructuredStops` when mode is on
  (and present), else `stops`. Falls back to `stops` for legacy tours
  that pre-date the parallel array.
- `setActiveStops(tour, stops)` — writes to the right array.
- `duplicateStopsForUnstructured(stops)` — deep clone + new IDs.

All `tour.stops` reads in admin, `TourContext`, `tour-session`,
`tour-question-router`, `Journal`, `JournalOverlay`, `JournalPeek`,
`ProgressBar`, `UnstructuredMapOverlay`, and `page.tsx` were routed
through `getActiveStops`. The two remaining literal `tour.stops`
references (admin tour list count and the unstructured toggle's
"is there anything to copy?" check) are intentional.

**Mini-tour flow for merge groups.** Merge groups stopped behaving as
one tap-and-walk sequence and became a true mini-linear tour with its
own map in between sub-stops (see §10 for the full description).
Implementation:

- `tour-session.ts` gained `getStopsInGroup`, `getActiveGroupId`, and
  `getNextStopInGroup`. `advanceToNextStopUnstructured` was rewritten:
  completing any sub-stop in a group always returns to
  `unstructured_map`; only the last sub-stop calls `finishLogicalStop`.
  No new session fields — the mini-map is derived from
  `completedStops` and the active stop list.
- `TourStopMarkerData` (in `Map.tsx`) gained `isGroupLeader`,
  `subStopCount`, `isNextInGroup`, `isLockedInGroup`. `TourStopPin` was
  redone with role-driven sizing: main-map standalone and leader pins
  share a unified 42 px (count badge on the leader); mini-map next-in-
  group is 56 px with the amber animated ring; locked sub-stops are
  30 px in the normal primary colour (not dim); completed sub-stops
  stay 28 px dim with a check badge. Locked pins are clickable; their
  selected state deliberately does NOT promote them past the flashing
  next pin (no size bump, no ring).
- White text labels under unstructured pins were removed across the
  board. Titles and categories moved into the overlay cards in larger
  type.
- `page.tsx` `tourStopMarkers` was rewritten: main map shows leader
  pins for un-started groups and every sub-stop as a small toured
  indicator for fully done groups (no leader pin). Mid-progress groups
  trigger mini-map mode and the standard markers are filtered to that
  group only.
- New overlay variants in `UnstructuredMapOverlay.tsx`:
  - `GroupClusterOverlayCard` — "STOP CLUSTER" banner with the group's
    own name, a swipeable carousel of sub-stop cards with peek
    (`scrollbar-hide` utility added to `globals.css`), locked cards
    greyed with a lock icon, "Up next" outlined for the active one.
    Single footer "Begin first stop" button (per-card Begin removed
    after iteration).
  - `LockedStopOverlayCard` — desaturated thumb with a large white-
    bordered lock badge, "Please complete prior stops first" in red,
    and an outlined "Show me next stop" button. The handler dismisses
    the overlay and pans the map to the flashing pin via the existing
    `flyTarget` mechanism (wired through a new `onFlyToStop` prop on
    `UnstructuredMapControls`).
  - `StopOverlayCard` got bigger title (text-xl) with category bold-
    uppercase above it.

**Rich text on essential question and midway fields.** Admin inputs
for `essentialQuestion.{question, sceneDescription, openingFraming,
closingFraming, additionalQuestion.question}` and `tour.midwayQuestion`
were swapped to `RichTextarea` so authors get the B/I/Color toolbar.
Explorer renders (`EqDiscussCard`, `EqOpeningCard`, `EqClosingDiscussCard`-now-deleted,
`EqClosingCard`, `EqAdditionalCard`, `EqSceneCard`, `MidwayCheckinCard`,
`JournalOverlay` theory tab, `EndCard` learning arc) all switched to
`FormattedText` so the markup is interpreted at display.

**Mid point check-in redesign.** `MidwayCheckinCard` is now a vertical
scrollable arc: "Mid point check-in" header, intro line "So these are
the stops you have seen so far…", a vertical list of thumbnail cards
for each visited logical stop (from `completionOrder`), a divider, a
deliberate 128 px gap, then the question with a textbox whose
placeholder reads "Discuss this, but optional to write down". The
Continue button always fires `onComplete` regardless of whether the
explorer typed anything (response is optional). Renamed "Continue
exploring" → "Continue tour". The card now takes a `session` prop —
threaded from `page.tsx`.

**Combined closing arc.** The two-step closing (`eq_closing_discuss`
verbal-only → `eq_closing` written) became a single scrollable
`EqClosingCard`:

1. "TOUR COMPLETE" header + admin `closingFraming` + closing audio
2. The essential question restated
3. "This is where you started" — read-only echo of `initialTheory`
   and `initialReasoning` (each in a small panel with its original
   prompt)
4. "This is what you thought during the tour…" — read-only echo of
   `midwayResponseText`, only rendered if it's non-empty
5. "Where are you now?" — final reflection + final reasoning inputs
   with `MicButton`s (still required to enable Continue)

Single page so the explorer can scroll back to revisit any earlier
answer while drafting the final one. State machine routes directly to
`eq_closing` now (`advanceToNextStop` + `finishLogicalStop`); the
`eq_closing_discuss` phase still renders the new combined card as a
fallback for in-flight sessions sitting on it. `EqClosingDiscussCard`
was deleted and `completeEqClosingDiscuss` was removed from
`tour-session`, `TourContext`, `Journal`, and `UnstructuredClosingView`.
`EqClosingCard` now takes a `session` prop.

**Lessons / gotchas captured this session**

- `scrollbar-hide` is not a Tailwind v4 default. Added a tiny utility
  in `globals.css` for the carousel.
- Legacy phases live in in-flight session storage. When collapsing a
  phase out of the flow, also handle the case where an existing
  session is parked on it (render the new card on the old phase too).

---

### Splash, persistent footer, branded opening bar, bridge-skip (2026-05-25)

Five-part session. Live on `master` (commits `a002972` → `8e0078c`).

**Splash screen — new component.** First-load brand intro at
`src/components/SplashScreen.tsx`, wrapping `{children}` in
`layout.tsx` (inside `ThemeProvider`). Plays once per browser tab via
`sessionStorage.getItem('splash_seen')`; second-load skips entirely.
Full reference in §11. Mount uses an isomorphic `useLayoutEffect`
shim so the overlay covers the children on the first hydration
paint instead of after a tick. Animations are CSS `@keyframes` with
`animation-fill-mode: both` (Framer Motion was leaving the pin
briefly visible at center on delayed mounts — the bug captured in
§7). Montserrat Medium added to `next/font/google` in `layout.tsx`
and exposed as the `font-montserrat` Tailwind utility via
`@theme inline` in `globals.css`.

**PWA launch-screen mitigation.** Installed PWAs were showing the
OS-drawn "icon-on-white" splash before the JS splash could mount.
Two side-channel fixes:

- iOS: 11 solid-cream `apple-touch-startup-image` PNGs generated with
  sharp at modern iPhone + iPad Pro 11"/12.9" portrait resolutions
  (`public/splash/*`, ~140 KB total). Wired into
  `appleWebApp.startupImage` metadata in `layout.tsx`, each with a
  `device-width` / `device-height` / `-webkit-device-pixel-ratio` /
  `orientation: portrait` media query. iOS falls back to its default
  whenever a media query doesn't match exactly — coverage = modern
  iPhones + iPad Pro portrait only.
- Android: replaced `public/icon-192.png` and `public/icon-512.png`
  (`purpose: "any"`) with solid `#E9E4E2` PNGs so Chrome's
  auto-generated splash icon visually disappears against the cream
  background. The maskable icon (`icon-maskable-512.png`) is
  unchanged so launchers still render the real glyph on the home
  screen. The app-name text Chrome draws below the icon can't be
  suppressed via the manifest — accepted as a limitation.

Manifest `background_color` corrected from `#FBF8F2` to `#E9E4E2` to
match `--th-bg`. Logo source PNGs (`logo_transparent.png`,
`logo_title_transparent.png`) committed to `docs/` and copied to
`public/`.

**Stop tracker / midway check-in — individual stop names.** The
swipeable `StopTrackerOverlay` in `ProgressBar.tsx` and the
`VisitedStopThumb` in `UnstructuredMapOverlay.tsx` were both falling
back to `mergeGroup` for the card title, so visited cluster sub-stops
all read as the group name. Switched to `stop.title` as the primary
line with `stop.mergeGroup` rendered in italics below when present.

`MidwayCheckinCard` was also building its visited list straight from
`session.completionOrder` (which holds one logical-stop ID per
cluster), so a 3-stop cluster appeared as one thumb. Rewrote the
loop to expand leader entries via `getStopsInGroup(tour, mergeGroup)`
in authored order — visited clusters now list every sub-stop the
explorer actually saw.

**TourFooter extraction + always-on map.** The Journal + Ask buttons
used to live inside `Journal.tsx`, so any phase that `page.tsx`
rendered outside the Journal overlay (`unstructured_map`,
`midway_checkin`, the unstructured closing) lost the footer.
Extracted `src/components/tour/TourFooter.tsx` — self-contained
button bar plus the `JournalOverlay` mount and Ask-a-question modal
(`QuestionInputPanel` moved with it). `Journal.tsx` now uses
`<TourFooter />` (dropped ~120 lines of duplicate JSX/state) and
`page.tsx` mounts it for the three map/midway/closing phases that
were missing it.

**Branded opening bottom bar.** Pre-tour bottom bar replaced from
"Memorial Church / Provenance / Tap a pin to begin" to:

- Bar background: `var(--th-primary)` (theme red/teal)
- Pin glyph: `InvertedLogoGlyph` helper in `page.tsx` built from two
  CSS-masked layers — `pin-glyph-base.png` filled with `var(--cream)`
  and `pin-glyph-p.png` filled with `var(--th-primary)`. The "P"
  layer matches the bar, so the speech-bubble area reads as
  bar-colored negative space and the cream dots show through the
  dot-shaped cutouts in the P mask
- Wordmark "Provenance" in cream Montserrat Medium

Same theme-aware approach as the map pins (May 22 entry), just with
cream + primary instead of white + primary.

**Skip WhatsNext when bridge is unselected.** Authors who turn the
admin bridge toggle off were still seeing the "What's next..." screen
between stops. Added two helpers in `tour-session.ts`:

- `hasBridgeContent(stop)` — true if `bridgeText` or `bridgePhotos`
  carry content.
- `nextPhaseWouldBeWhatsNext(stop, phase, round)` — simulates the
  state machine to predict whether the next `advancePhase` call would
  land on `whats_next`.

`TourContext.advancePhase` intercepts the transition: if the
computed next phase is `whats_next` and `hasBridgeContent` is false,
it calls `advanceStop()` instead. The URL state never enters
`whats_next` in that case.

`WonderCard`, `RevealCard`, `ReflectCard` take a new `isFinalInStop`
prop and relabel their continue button:

- Wonder: "We've talked — show us" → **"We've talked — continue tour"**
- Reveal: "Continue" → **"Continue Tour"**
- Reflect: "Continue" → **"Continue Tour"**, and `handleSubmit` /
  `handleSkip` short-circuit to `onContinue()` after logging the
  reflection so the embedded `<WhatsNext />` post-submit view is
  bypassed.

`Journal.tsx` computes `isFinalInStop` per card via the new helpers.

**Lessons / gotchas captured this session**

- Framer Motion's `initial` doesn't always apply at first paint for
  delayed animations — the element can be visible at its target
  position for one frame before the animation engages. Use CSS
  `@keyframes` with `animation-fill-mode: both` for splash-style
  effects where any flash is unacceptable.
- Android Chrome's PWA launch splash icon can only be suppressed via
  the cream-on-cream trick on `purpose: "any"` icons; the manifest
  `name` text Chrome draws below the icon can't be hidden by any
  manifest setting.
- iOS `apple-touch-startup-image` selection is strict — the media
  query must match the device's logical resolution exactly. Unmatched
  devices fall back to iOS's default icon-on-white screen.
- Cards rendered by the state machine were embedding `WhatsNext` (e.g.
  `ReflectCard` post-submit), so suppressing the `whats_next` phase
  alone isn't enough — the embed has to skip too. Pattern: gate the
  embed on the same condition (`isFinalInStop` here).

---

### Autoplay system, cover-photo framing, indoor maps, photo overlays, scroll-snap (2026-05-25 → 2026-05-26)

A long multi-part session — eighteen commits (`b9b58fd` → `d39de46`),
all live on `master`. Touches the explorer footer, onboarding, the
journal peek, every audio surface, notice screens, every `StopPhoto`,
the unstructured map and progress bar, and the admin tour editor.

**Footer label.** The bare `?` button on the footer was relabelled to
`? Inquiries` (icon-glyph at `text-xl font-bold` plus the word) to
match the Journal button's `[icon, label]` rhythm. Same chunky
pill style for both main buttons.

**Audio autoplay.** Every audio surface — peek, guide intro, guide
thank-you, EQ scene, EQ closing, stop seed/notice/wonder/reveal, and
the extra-round wonder/reveal — gained an `audioAutoplayDisabled`
sibling on its data and a `Don't autoplay on this screen` checkbox on
`AudioUpload`. A new `useAudioAutoplay()` hook in
`src/lib/audio-autoplay.ts` exposes a `localStorage`-backed
preference; `AudioButton` accepts an `autoplay` prop and calls
`audio.play().catch(...)` on mount when allowed (browsers may still
block — the promise is swallowed and the button falls back to its
idle state). The per-audio admin flag is a hard veto: even with the
user preference on, a screen flagged as "no autoplay" never starts
audio automatically. The combined Seed+Notice screen suppresses
notice autoplay whenever seed audio is also present so the two
streams don't collide.

Footer toggle for the preference started as a generic speaker icon
but read as "mute / volume," not autoplay. Replaced with a compact
`Auto ▶` pill: `rounded-full px-3 py-2`, uppercase `text-[11px]`,
subtler `bg-black/15` + `border-white/20` so it sits visibly
subordinate to the chunky Journal / Inquiries buttons. When on, the
*entire* pill lights up — `bg-warm-white text-journal border-warm-white shadow` — instead of just filling the play triangle, which
was too subtle a cue.

`IntroScreens`' Set Up step now also asks "When a screen has audio,
should it play automatically?" with `Auto-play ▶` / `Tap to play ▷`
buttons matching the existing phone-question style; picking one writes
the preference. Advancing past Set Up is gated on both phone and
autoplay choices. The moment a choice is made, the same bouncing arrow
used for the `?` button appears over the footer's Auto pill so the
reader sees where the setting lives. Threaded via a new
`onPointAtAutoplay` callback through `IntroScreens` → `Journal` →
`TourFooter` (mirrors the existing `onPointAtQuestion` pattern).

**Tour cover photo framing.** `Tour.coverPhotoFocalPoint` and
`Tour.coverPhotoZoom` joined the existing guide-photo framing pair.
Admin: the tiny 128×80 thumbnail in the tour editor became a
phone-width preview that mirrors the learner view exactly — same
`h-36` crop, 60 % opacity, same `to-journal` top-down gradient — with
click-to-set focal point and a 1×–3× zoom slider. `JournalPeek`
honours both via `objectPosition` + matching `transform-origin scale`
(same approach as `guidePhotoStyle`).

While in the peek: enlarged the tour title (`text-lg` → `text-[26px]`),
promoted the stops + estimated time to its own clock-iconed row right
under the title so groups know what they're committing to before
reading the description, and capped the sheet at `max-h: 75vh` with a
`shrink-0` cover photo + `flex-1 overflow-y-auto` content area. Larger
text now scrolls *inside* the sheet instead of pushing the photo
off-screen, and the sheet never grows past three quarters of the
viewport.

**Top-bar exit X removed.** Both title bars (`Journal.tsx` for linear
tours, `page.tsx` for unstructured map / midway / closing) carried an
`×` that ended the tour with a single tap — easy to hit accidentally
mid-flow. Removed; the empty `w-8` placeholder keeps the centred
title centred. The natural-end `EndCard`'s Exit button still works.
Dropped the now-unused `endTour` from each file's `useTour()`
destructure.

**Onboarding affordances.** Three small reads-better-on-first-run
fixes:

- `EqOpeningCard` shows a gold left-bordered note ("You'll only be
  asked to record an answer here and at the end of the tour. That way
  you can look back and see how your thinking has evolved.") so the
  writing prompt isn't a surprise on first run.
- `UnstructuredMapControls` shows a bouncing pin-iconed pill ("Tap a
  pin to begin") at the top-centre of the map when the group has
  completed no stops and no pin is selected. Clears as soon as they
  tap or once any stop is in `completedStops`.
- The bottom-of-screen "Keep scrolling" indicator was a faint
  `opacity: 0.5` chevron with `animate-gentle-pulse` (0.15 → 0.5
  opacity) that people were missing on busier content. First bumped
  to a bouncing `Keep scrolling` pill + 36×36 chevron in the primary
  color with drop shadow; then softened from `animate-bounce` to a
  new `animate-gentle-fade` keyframe (1.0 → 0.55 → 1.0 over 2.4 s) so
  the cue stays loud-but-calm instead of yanking attention.

### Indoor notice map (2026-05-26)

Two related authoring features arrived in this part of the session,
both for visual emphasis at the stop level.

**`NoticeMap` data type.** Each stop's notice phase gained an optional
`NoticeMap = { url, caption, markers: NoticeMapMarker[], isHint }`.
Markers carry `{ id, x, y, label? }` in 0–100 percent coordinates.
Used for stops inside a building where the outdoor GPS pin isn't
enough — the admin uploads a floorplan or interior photo and drops
"this is where you go" pins on it.

**Runtime.** `NoticeMapDisplay` renders a `WHERE TO GO` banner + the
uploaded photo + pulsing pins for each marker. Tap to fullscreen.
The marker glyph is anchored to a 0×0 div at `(x%, y%)` of the image
wrapper; the pin SVG and label are absolutely positioned relative to
that anchor, so the pin tip lands exactly on the pinned coordinate
*regardless of whether a label is present* — the earlier flex-column
approach drifted the pin upward by the label's height whenever a
label was set. The pulsing halo is two nested spans (outer owns the
positioning transform, inner owns the `animate-ping` scale) so the
keyframe's `transform: scale(2)` doesn't clobber the centering
translate (this is the same `animate-ping` lesson recorded in §7
applied freshly).

When the map is flagged `isHint`, the runtime hides it behind a
dashed-border `Tap for hint` pill so the group has to actively reveal
it; once revealed, the banner reads `Hint — where to go`. Rendered
in both `NoticeCard` (standalone Notice phase) and the
`SeedCard` "Look around" section (combined seed+notice) — the latter
is the more common surface in practice, so wiring only `NoticeCard`
would have left the map invisible on most stops.

**Admin.** New inline `NoticeMapEditor` in the tour-editor's Notice
fieldset: URL / Upload row, caption, the `Treat as a hint` checkbox,
a click-to-drop preview, and a list below the preview where each
marker gets an optional label and a delete button. Markers in the
preview anchor to the image bounds (not the outer container or
button) so the click-to-place coordinates and the rendered pin lay
on the same point on both sides of the editor — the first cut
positioned markers against an outer card/button and they drifted
relative to the image whenever the photo was letterboxed or the
container had different padding.

### Photo overlay annotations (2026-05-26)

Every `StopPhoto` gained an optional `overlays: PhotoOverlay[]`
field. `PhotoOverlay` is a tagged union of `text` (with `text`,
`color`, optional `fontSize`), `circle`, and `rect` (each with
`{ x, y, w, h, color }`). Coordinates are percent-of-photo so they
scale at any rendered size.

**Type-name note.** The legacy v1 inquiry annotation type
`PhotoAnnotation` is still referenced from the v1 admin code — the
new system uses `PhotoOverlay` (field: `overlays`) to avoid colliding
with that. Don't conflate the two.

**Runtime.** `PhotoAnnotations` renders the overlays as
absolutely-positioned HTML elements (not SVG with
`preserveAspectRatio='none'` — that distorts text and stroke widths
on non-square photos). Each annotation independently positions itself
by `left: x%, top: y%` and (for shapes) `width: w%, height: h%`,
which keeps text and outlines un-distorted regardless of the photo's
aspect ratio. Wired into `PhotoContent` (inline photo blocks — each
`PhotoBlock` wraps the `<img>` in a relative container with the
overlay layered on top) and into `FullscreenPhoto` (the fullscreen
viewer wraps the `<img>` in an `inline-block` sized to the rendered
image, so the overlay tracks the image edges exactly even when
`object-fit: contain` letterboxes the image).

**Admin.** `PhotoOverlayEditor` is a full-screen modal that opens
from every `PhotoListEditor` row via an `Annotate (N)` button.
Toolbar: Select / Text / Circle / Rectangle plus a 7-color palette.
Pick a tool then click on the photo to place a new overlay; click an
existing overlay to select it; drag to move; four corner handles to
resize shapes; side panel hosts text / font-size / numeric position
fields and a list of all overlays for fast selection + delete. `Esc`
cancels; `Delete` / `Backspace` removes the selected overlay. Out of
scope for now: overlays on non-`StopPhoto` images (cover, guide, EQ
scene, legacy `photoUrl` strings).

### Map zoom-on-return + unstructured progress reorder (2026-05-26)

**`MapZoomer`.** Used to fire once per map mount via a `fired` ref —
which meant the configured default zoom only applied on the very
first entry into the unstructured map. Replaced with a
`wasUnstructured` ref tracking the previous value of
`isUnstructuredMap`; now fires on every `false → true` transition.
Returning from a stop snaps the map back to the admin-configured
default zoom centred on the user, every time.

**`MapFlyer`.** Phase 3 used to zoom out to a computed "fit user and
stop in view" value (`fitZoomCenteredOnStop`) that left explorers
slightly further out than the default. Threaded `tourDefaultZoom`
into MapFlyer and use it as the end zoom instead. Removed the
unused `userLocation` prop / dependency and dropped the
`fitZoomCenteredOnStop` helper entirely.

**Unstructured progress bar (inline pills).** Reordered so completed
stops are in `completionOrder` (click) order; current; then upcoming
(in authored order so the count stays meaningful). An earlier pass
dropped the upcoming pills entirely; the user pulled them back —
they liked seeing how many stops were left.

**Unstructured progress bar (expanded tracker).** The thumbnail
panel that opens when the bar is tapped (`StopTrackerOverlay`) used
to iterate `getActiveStops(tour)` in authoring order, so starting on
stop 6 lit up the sixth card from the left rather than the
leftmost. For unstructured mode it now sorts completed sub-stops by
their group's index in `completionOrder` (with `getActiveStops`
index as the tiebreaker so a merge group's sub-stops stay
contiguous), then the current stop, then upcoming in authored order.
Linear mode short-circuits to `getActiveStops` since authoring order
*is* the journey. Also fixed an `isCurrent` check inside the loop
(was `i === session.currentStopIndex`, only correct when iterating
in active-stop order; now compares stop IDs).

### Scroll-snap reveals + admin text-size (2026-05-26)

**Two transition points with snap + haptic + fade reveal:**

1. `SeedCard`: Background → Look Around
2. `MidwayCheckinCard`: stops summary → question

Pattern: each card owns its own `scrollSnapType: y mandatory` scroll
container. The first cut used the card frame parents (Journal's
`motion.div`, page.tsx's midway flex div) as the snap container — but
`min-h-screen` (100 vh) overshoots the visible card area because the
title bar / progress strip / footer slice the viewport, so sections
were taller than what's actually visible and the user saw "weird
gaps" and an over-scrolled jump between sections. Final design:

- The card's outer wrapper is `absolute inset-0 overflow-y-auto`
  inside a card frame marked `relative`, so it fills the actual
  visible card area exactly. Card frame's `px-5 py-6` padding gets
  overlapped by the absolute wrapper, so each section restores
  `px-5 py-6` internally for the visual margin.
- Sections use `min-h-full` (not `h-full` or `min-h-screen`) +
  `flex flex-col justify-center` + `scrollSnapAlign: start` +
  `scrollSnapStop: always`. Short content stays centred in the
  visible area; long content grows the section so `justify-center`
  has no slack to push the top off-screen — after the snap, the top
  of the content lands at the viewport top and the reader can scroll
  down through the section.
- The second section starts at `opacity 0 + translateY 20px`. An
  `IntersectionObserver` (default root = viewport, threshold 0.1)
  fires `navigator.vibrate(10)` (where supported) and after a delay
  flips a `revealed` state that drives a CSS transition.
- Background → Look Around: 400 ms delay, 400 ms transition.
- Midway: 100 ms delay, 250 ms transition.

When the stop has no notice content, `SeedCard` falls back to the
original single-section centred layout — no point forcing a snap
with nothing to snap to.

**Midway question styling.** Was `font-display` (DM Serif Display)
`font-bold` at 24 px — both too heavy and too big for mid-tour.
Moved into the same storyteller question box used by the EQ /
discussion cards (cream text on the dark question fill) but in
`font-serif` (Newsreader, the body serif) at `text-[20px]` without
bold. Lighter and more readable mid-flow than the EQ hero.

**Admin text-size control.** Tour editor header now has a small
A / A / A pill with `small` / `normal` / `large` choices. Selection
writes to `localStorage` as `admin-text-size` and toggles
`data-admin-text-size` on the page root; a CSS rule in `globals.css`
scales every `textarea` and text-typed `input` inside that subtree
to `12px` / inherit / `17px`. Labels, buttons, and layout stay at
their original sizes — just field text scales.

**Lessons / gotchas captured this session**

- Tailwind's `animate-ping` keyframe sets `transform: scale(2)`,
  which clobbers any positioning translate on the same element.
  Already documented in §7; reapplied here for the notice-map halo
  (split into outer-positioning + inner-animating spans).
- `min-h-screen` / 100 vh > the actual visible card area inside the
  Journal because the title bar, progress strip, and footer slice the
  viewport. For "fits one screen" sections within a sub-area, use
  `min-h-full` of an absolutely-positioned scroll container that
  fills the actual sub-area, not viewport-height units.
- `scroll-snap-type: y mandatory` is the right strictness for
  "always land on a section top," but plan for sections that grow
  beyond the visible area: `min-h-full` + `justify-center` handles
  short content gracefully *and* lets long content cluster from the
  section's top so the reader can scroll through.
- `preserveAspectRatio='none'` on an SVG overlay distorts text and
  stroke widths on non-square photos. For positioned annotations
  over an image, use absolutely-positioned HTML elements with
  percent `left/top` (and `width/height` for shapes) so each
  annotation independently tracks the rendered photo at its native
  aspect ratio.
- Pin / marker layers anchored to an outer container (card, button)
  drift relative to the image whenever the image is letterboxed or
  the container has padding/borders. Position annotation layers
  against an inline-block wrapper sized to the image itself, and
  zero out any UA-default `<button>` padding/border if the click
  target is a button.

---

### Question background pattern + closing redesign + multi-device rooms (2026-05-26 → 2026-05-27)

The biggest session of the project. All commits live on `master`.

**Discussion-question redesign.** Every discussion-question card got
a unified treatment:

- The red cardinal question box is gone. Question text now renders as
  plain themed copy via a new `QuestionText` atom (`cards/QuestionText.tsx`)
  — body serif (Newsreader), `--th-accent-dark` (bronze), left-aligned,
  larger than body. Page section titles ("Chance to discuss…",
  "Question for you!", "Discuss", "Closing questions") use
  `text-aged-gold` (theme primary) so colour distinguishes title from
  question.
- New optional **question background** for every discussion-question
  shape (per-stop wonder, extra-round wonder, EQ main, EQ additional,
  closing additional, midway): `questionBackground` text +
  `questionBackgroundAudioUrl/Title/AutoplayDisabled` + a
  `questionBackgroundPhotos: StopPhoto[]`. Authoring lives in the
  tour editor right above each question's existing "The question"
  field.
- When a background is authored the card splits into two
  `scroll-snap` sections — Section 1: title + audio + background text
  rendered through `PhotoContent` (so `[photo:N]` markers inline at
  position) + question photos; Section 2 (snap-snap, fades in on
  arrival): "Discuss" heading + the question text. When no background
  is authored the card falls back to its single-section layout.
- A `SnapScrollHint` pill + chevron (`cards/SnapScrollHint.tsx`,
  `animate-gentle-fade`) is anchored at the bottom of section 1 on
  every snap-scroll card (Seed, Wonder, EqDiscuss, EqAdditional,
  EqClosingAdditional, MidwayCheckin, and the new EqClosing) so the
  explorer always knows there's more below. `QuestionText` strips
  `[photo:N]` markers from its text since the question section is
  photo-free by design.

**Additional closing questions.** The EQ can now author an array of
`additionalClosingQuestions` (discuss / opinion type, full
background + audio + photos). In the admin they live *after* the
final reflection / reasoning prompt fields so the closing block
reads top-to-bottom in the order the explorer encounters it. The
new `EqClosingCard` (see below) lists every additional question with
its own response textbox under the main EQ question. The standalone
`EqClosingAdditionalCard` and `eq_closing_additional` /
`eq_final_reflect` phases are retained for in-flight legacy sessions
but new sessions skip them.

**Closing redesign (`EqClosingCard`).** Rewritten as a two-section
snap-scroll:

1. **Tour Complete** — title + admin-authored closing framing +
   closing audio + a primary "Open your theory journal" button.
   Tapping mounts `JournalOverlay` in a new `closingPeek` mode that
   defaults to the Your Theory tab and renders a bottom "Return when
   ready" button. The button is *only* present in this mode. On
   close the closing card auto-scrolls to section 2.
2. **Closing questions** — heading + main EQ restated + the existing
   `finalReflectionPrompt` / `finalReasoningPrompt` textboxes, then
   each `additionalClosingQuestions[i]` as its own textbox, then a
   Continue button. Submitting writes `finalReflection`,
   `finalReasoning`, and `additionalClosingResponses[]` (new field on
   `essentialQuestionResponses`) in one transition and advances
   directly to `eq_questions`. "Where are you now?" / sliders / chip
   sets are gone from the flow.

**Bridge audio.** `Stop.reveal` gained `bridgeAudioUrl / Title /
AutoplayDisabled`; admin's bridge fieldset has an AudioUpload next
to the bridge photo list; `WhatsNext` renders an AudioButton above
the bridge text when set.

**Multi-device group rooms — full reference in §12.** New
`memorial-church-rooms` Firestore collection coordinates 2–4 people
walking a tour together. Host proposes stop transitions, members
approve; discussion-question screens become group-ready barriers;
sleeping phones still block (must wake to advance); after 2 min
idle any member can Remove an idle member from the room menu; host
failover at 5 min via an atomic transaction. Onboarding reordered
so Set Up runs first, with Host / Join buttons inline when
"Everyone" has a phone; autoplay moved to a later "Audio" screen.
Linear tours in a room drop everyone onto the map between stops
(host taps the next pin to propose). Reload mid-tour re-subscribes
from `sessionStorage` and aligns the local session to the room's
current stop. Per-device responses persist via the existing
`TourSession` sessionStorage mechanism.

**"Find pin" map peek.** Local-only "where am I supposed to be"
overlay anchored on the Look Around section of the Notice page
(top-right "Find pin" button when `stop.location` is set). Flips a
`mapPeek` flag in `page.tsx` that filters `tourStopMarkers` down to
the current stop only and replaces the journal area with the map.
A full-width "Return to tour" bar at the bottom flips it back. No
room writes, no end-of-stop transition, no barrier — host and
participant can each peek independently.

**Map polish during the tour.**

- Linear pin number badges (`index + 1`) removed. Numbers are
  reserved for cluster sub-stop count badges on group leaders.
- Off-screen direction arrows (`computeOffScreenArrows`) skip
  completed stops so the arrows only point at work the group still
  has to do.
- Map markers in unstructured rooms read `room.completedStopIds` as
  the source of truth instead of stale local `session.completedStops`.
- `RoomStopProposalOverlay`'s display title prefers `stop.title`
  over `mergeGroup` so a proposed cluster sub-stop shows its own
  name (cluster leaders without a title still fall through to the
  group name).
- Non-host members in a room see the stop overlay card with the
  Begin button hidden (they can browse thumbnails but only the host
  advances). When the host proposes, members' overlay auto-replaces
  with the proposed stop's thumbnail.

**State-machine guards / fixes.**

- `finishLogicalStop` checks whether `logicalStopId` is already in
  `completionOrder` and skips the append if so. A double-call
  (which could happen at edge cases) was otherwise pushing the
  count past `logicalTotal` and firing closing early — and stealing
  the midway check-in slot.
- `recordHostAdvance` no longer overwrites `barriers` in its
  Firestore update; the host's local persist re-renders into the
  new phase and fires `arriveAtBarrier` synchronously, so clearing
  barriers in the async transaction was wiping the host's arrival
  (the "Waiting for X to arrive…" stall on midway in rooms).
- `canGoBack` blocks back navigation that would cross a stop
  boundary or back out of a group-level / closing phase in room
  mode, but allows it within a stop (wonder → seed to re-read
  context, etc.).
- Slide animation in `Journal.tsx` reverses direction when
  `phaseHistory.length` shrinks (back navigation now visibly
  slides the opposite way).
- Sync effect in `TourContext` consolidated so room → local updates
  (currentStopId, groupPhase, completedStopIds, completionOrder)
  all happen in one `persist()` call. The earlier pair of effects
  could race-overwrite each other.

**Lessons captured this session**

- Firestore rules are per-collection in this project — adding a new
  collection requires adding its `match` block in the console
  (recorded in §3).
- Firestore `runTransaction` writes that include an unconditional
  field overwrite (e.g. `barriers: {}`) can wipe parallel writes
  that landed between the transaction's read and commit. Drop the
  field from the update if you don't actually need to clear it.
- React `useEffect`s that both call `persist({...session, ...})`
  can race if they fire on the same render — each captures the
  same stale `session` reference, so the second clobbers the first.
  Consolidate related sync effects into one.
- For "host drives the group" patterns, push the result of running
  the existing local state machine to a shared doc (rather than
  trying to reimplement the state machine remotely). Members
  mirror; cluster sub-stops / midway / closing transitions Just
  Work because the same state machine produced them.

---

### Action titles, gamification, onboarding overhaul, Sheets logging (2026-05-27 → 2026-05-29)

A two-day session, the biggest since the v2 build. Six interlocking
threads, all live on `master` (commits `ec5c192` → `5e6b973`).

**Inquiry reminder polish.** The every-third-stop reminder used to
render `fixed inset-0` inside `RevealCard`, which sits under a
framer-motion transformed ancestor — `position: fixed` was being
scoped to the card area only, so the dim never covered the footer
and the arrow ended up floating mid-card. Portal-to-`document.body`
moves the overlay above any transformed ancestors. The reminder now
spotlights the *real* Inquiries button: 9999px box-shadow on a
transparent rect over the button (found by `data-inquiries-button`),
white halo ring, 32 px headline "SHARE: Do you have any inquiries?",
big bouncing arrow in `--th-secondary`. Hold extended 2 s → 5.5 s
total (7%/93% keyframes for short fades).

**Action titles — DISCUSS / LEARN / FIND / RESPOND.** New shared
`ActionTitle` component drives the page-level header on every learner
card. Final styling:

- 44 px bronze label (`--th-accent-dark`) on the left of the row.
- 64 px matching icon on the right with `pr-2` margin from the card
  edge. Icons: speech-with-sound-waves (DISCUSS), lightbulb (LEARN),
  magnifying-glass (FIND), pen-on-paper (RESPOND).
- Optional dark-grey + white "Opinion" pill (`bg #3F3F46`).
- Optional "The Investigation" subtitle in pure black, 22 px,
  uppercase display — rendered BELOW the action label on every EQ
  card except `EqSceneCard` and `EqOpeningCard` section 1 (the
  framing screen). Kept on `EqOpeningCard` section 2 so RESPOND +
  Investigation appears again when the explorer scrolls to the
  recording form.
- Legacy per-screen subtitles ("Background", "Context", "Setting the
  scene…", "Tour complete", "Closing questions", "Mid point
  check-in", "Share your discussion…") are no longer attached to
  ActionTitle. Each card renders the exported `SectionSubtitle`
  helper (theme-primary, 22 px, uppercase) DIRECTLY ABOVE the text /
  question it labels, with a tight `mb-2`, so the subtitle visually
  pairs with its content instead of the action header.
- `InstructionsTitle` is an italic theme-primary alternative used in
  place of ActionTitle when an admin flips a question background
  into "Instructions mode" (see below).

`QuestionText` switched from bronze to theme-primary so EQ-style
questions now read in the dominant theme colour. Admin checkbox
"Show this as Instructions" added under all six question-background
blocks (EQ main, EQ additional, EQ closing additional[i], midway,
per-stop wonder, extra-round wonder) — when on, the explorer sees
the italic *Instructions* title instead of LEARN + "Background".
`NoticeMapDisplay`'s reveal text changed from "Tap for hint" to
"Tap for specific location".

**Opinion-dial gamification (group only).** Every opinion-type
question can now be authored with a left/right spectrum (admin: text
inputs that appear when `questionType === 'opinion'` in per-stop
wonder, extra-round wonder, EQ additional, EQ closing additional).
In rooms when both labels are present, the regular continue-row is
replaced by `OpinionDial`:

- 180° SVG arc with a draggable handle (pointer-events captured for
  touch + mouse). Left/right labels at the ends.
- "Find out where your friend is" button unlocks once a position is
  set; while waiting for partners: "Waiting for the group to
  reveal…".
- Once every member has revealed, other members' positions render as
  contrasting `--th-secondary` dots. Message picks "Quite similar!"
  when average distance from this member to others is < 0.25, else
  "Wow, quite different. Why's that?". A Continue button + the
  parent's BackButton complete the round.
- State lives in the room doc under `opinionDials[key]` (positions
  map + revealedBy list, keyed identically to barriers as
  `${stopId}:wonder:${round}` or `eq:additional:0`). Two
  transactional writers in `room-store.ts` — `setOpinionDialPosition`
  (idempotent + clamped; locked once a member reveals) and
  `revealOpinionDial` (appends to revealedBy iff that member has
  already picked).
- `onResolved` callback fires exactly once per round (guarded with a
  `useRef` so effect re-runs don't double-fire); parent cards
  forward to `logOpinionDial` (see logging below).

**User-Choice Questions.** New admin toggle on per-stop wonder and
extra-round wonder ("User Choice Question"). When on, the admin
authors a list of question options. The originally-typed `question`
field is automatically prepended to the picker's list at runtime
(dedup + blank-trim), so admins don't have to retype the question
they already wrote.

Explorer: `WonderCard` renders two snap-scroll sections — choice on
top, question revealed below as soon as a choice arrives. On pick,
the parent calls `scrollIntoView` on the question section. The
chosen question replaces `wonder.question` for the rest of the round
via an `effectiveQuestion` derived value, so audio / photos / barriers
work unchanged.

Group: picker = first non-host member by `joinedAt`. Picker sees
`UserChoicePanel` (each option a tappable button + italic
"Propose Your Own Question" at the bottom that opens a textbox + mic).
Host + other non-hosts see a centred italic *"Your friend is
choosing a question…"*. Source of truth is `room.userChoiceSelections[key]`,
written via `selectUserChoiceQuestion` (transactional first-write-wins).
Custom questions are also banked to the picker's Inquiries via
`TourContext.bankQuestion`.

**Onboarding overhaul.** `IntroScreens` rebuilt as a 7-screen flow
(was 6) with two screens that take over the entire card. New
supporting components:

- `SpotlightOverlay` — generic portal-based dim. Outer is
  `pointer-events-none`; four dim panels surround the target rect
  with `pointer-events-auto` (so the target stays clickable through
  the hole); visual ring is `pointer-events-none`. Polling every
  250 ms latches onto targets that mount after the overlay (e.g.
  the Inquiries close X). `dim={false}` mode draws only the circle
  ring — used for the close-X cue so the modal stays readable. The
  message + arrow stack sits in a single block ABOVE the target
  (`bottom: calc(100vh - holeTop + 12px)`), 96vw wide.
- `IntroMapMockup` — real `@vis.gl/react-google-maps` embed,
  `gestureHandling="none" + disableDefaultUI`, `mapTypeId="satellite"`,
  same `mapId` the live tour uses. `fill` prop drops the aspect-ratio
  constraint so the map covers the whole card on the take-over
  layout. Pin replicates the live `TourParentPin` exactly — CSS-mask
  `LogoGlyph` (white `pin-glyph-base.png` + theme-primary
  `pin-glyph-p.png`) inside a 60 px disc with white border, drop
  shadow, animate-ping outer ring. (An earlier Static Maps cut
  failed silently because Static Maps API wasn't enabled in the
  project — see §7.)
- `FloatingProgressDots` — absolute-top z-30 overlay used by the
  take-over screens so the progress chrome stays visible above the
  full-card content.

The 7 screens:

1. **Set Up** — solo vs group with "best experience" bolded.
   Dropped the earlier per-choice helper paragraphs ("We suggest
   everyone use earphones…" for Everyone, "When you see information
   and questions…" for Only Me). Earphones tip moved to the Audio
   screen.
2. **Welcome** — text bumped, otherwise unchanged.
3. **How it works** — take-over satellite map with the
   pulsing-ring pin centred. "You will find pins on this map" as a
   translucent dark capsule on top → 3 s → `SpotlightOverlay`
   highlights the pin with "Click on the pin to explore the stop!"
   → tap → `MockJournalPeek` slides up from the bottom (uses the
   tour's actual first stop's title + a snippet of `seed.text`, not
   "Sample stop"). Group host sees the host copy + Begin → goes to
   a new `host-waiting` step (auto-advances after 2.5 s mocking the
   participant tapping I'm In). Group participant sees Begin
   disabled and a separate "I'm in — let's go" button in the same
   sheet so they have a way to advance (fixes the earlier lockout
   where only the host could move forward). Solo: Begin →
   onContinue.
4. **What you do** (NEW) — take-over snap-scroll. Section 1 reveals
   FIND on first tap (regular text below: *"Look for something in
   the area."*), then LEARN + DISCUSS on second tap (each with
   their own descriptions), with italic "Each stop will have you"
   / "Then you will" connectors at 32 px and a smaller "or"
   between LEARN and DISCUSS. Third tap snaps via `scrollIntoView`
   to section 2 — "Through this tour, be able to…" italic
   subtitle plus the 30 px display "Develop your own historical
   explanation as you question and discuss together!" + Next.
5. **Your thinking matters** — "Together, build on ideas or
   disagree!" on first tap → `SpotlightOverlay` highlights the real
   Inquiries button with a bouncing down-arrow and the
   `ShareCallout` textbox (cream surface, secondary-coloured
   border, 22 px bold SHARE header + 19 px body, explicit `#1f1410`
   text because `var(--th-text-primary)` doesn't exist). Polling
   detects `[data-question-close]` mounting → swap to a circle
   `SpotlightOverlay` with `dim={false}` so the inquiry modal stays
   visible while the X is circled. Modal close removes the X from
   the DOM → auto-advance.
6. **Audio** — autoplay choice (Auto-play / Tap to play). After
   picking: `SpotlightOverlay` highlights the real `data-auto-button`
   in the footer with "You can toggle at anytime. Tap anywhere
   else to continue." (no arrow). Outside-tap → second pass of the
   Audio screen with an earphone glyph + "Use earphones if you can!
   Or read to each other. Be respectful indoors."
7. **One last thing** — "Don't forget to LOOK UP!" (uppercase +
   bold), "see more" and "think together" bolded.

`TourFooter` gained `data-auto-button` on the Auto pill and
`data-question-close` on the modal X (with the X bumped from
w-8/text-lg to w-10/text-2xl so the circle spotlight reads well).

**Sheets logging update.** `tour-logger.ts` got a module-level
`logContext` slot (roomCode, isHost, memberCount) updated by
`RoomContext` whenever the room state changes, merged onto every
event row in `fire()`. Two new event types:

- `opinion_dial` — fired by each member's device once everyone has
  revealed; carries `questionKey`, `questionText`, both spectrum
  labels, this member's `opinionMyPosition`, comma-separated
  `opinionOtherPositions`, `opinionSimilarity`
  (`'similar'` | `'different'`), and `opinionAvgDistance`. Wired in
  via `OpinionDial.onResolved` from `WonderCard`, `EqAdditionalCard`,
  and `EqClosingAdditionalCard`.
- `user_choice_picked` — fired by the picker only (solo or first
  non-host) when they commit a User Choice Question. Carries
  `userChoiceQuestion` and `userChoiceIsCustom`. Custom picks also
  fire the existing `question_banked` event (two separate facts).

API route `TourLogEntry` shape extended with the new optional fields
so the Next.js endpoint forwards them unchanged to the Sheets
webhook. Sheet now expects 36 columns (24 original + 12 new — see
§4). Two adoption docs added: `docs/Sheets_Logging_Update.md` (field
reference, cross-referencing guidance) and `docs/sheets-apps-script.gs`
(full Apps Script — paste in, run `addHeaders()` once, redeploy
existing Web app as new version; `SHEETS_WEBHOOK_URL` unchanged).

**Lessons captured this session (added to §7)**

- Full-screen dim + clickable target: box-shadow paints visually but
  doesn't extend the hit area, so an inset-0 parent with
  pointer-events-auto swallows every click. Split the dim into four
  panels around the target rect, parent pointer-events-none.
- `var(--th-text-primary)` doesn't exist (text colours are aliased
  without the `--th-` prefix). Silent inheritance fallback caused
  white-on-cream onboarding text.
- Static Maps API needs its own GCP enablement; embedding the live
  Map with `gestureHandling="none"` reads as a static screenshot
  without the dependency.

---

### Context-Prototype mode + forum + resources + audio cues (2026-06-08 → 2026-06-09)

A long multi-day session. Everything live on `master`. Full reference for the
mode in §13; this is the session log.

**Three-way mode selector + Context-Prototype.** Replaced the buried
"unstructured" checkbox with a 3-way selector at the **top** of the tour
editor: Linear / Unstructured / **Context-Prototype**. New `tourMode` field
(`getTourMode(tour)` derives from legacy `unstructuredMode` for old tours).
Context mode is **sequential** (`unstructuredMode` stays false, so it runs the
linear Journal path), with its own parallel `contextStops` array (cloned on
first switch) and an `acts` array. It drops the essential question (keeps only
an **Opening Frame** = the "Setting the Scene" screen), drops per-stop
discussion (`wonder`) and bridge (`whats_next`), and **skips extra rounds**
entirely (they're hidden in the admin there — fixed "two contexts" bug).

**Acts.** Stops are dragged (native HTML5 DnD) into ordered Acts in the editor;
every stop belongs to exactly one act (self-healing `ensureActsCoverStops`).
Each act has an optional opening + closing question (voice/typed answer). Flow:
`act_intro` splash (2.5s) → `act_opening` → per stop: `stop_map` → seed →
context → [reflect] → next stop; at act end → [`act_closing`] →
`community_forum` (the act's forum + "additional questions", merged) → next act;
after the last act → guide outro → `resources` → end. (`act_questions` was
merged into the per-act Community Forum.)

**Per-stop map (`StopMapCard`).** Satellite `@vis.gl/react-google-maps`,
full-bleed. Numbered pins: target enlarged with white border + amber pulse,
completed faded blue, upcoming bronze. **Tap the highlighted pin** to enter the
stop. The **first stop's** map plays a one-time 2.5s darken/spotlight on the
target pin ("Walk to your next stop. Tap pin when you are there."); later stops
open straight to the map.

**Act question UI (`ActQuestionCard`, `ResponseInput`).** Header "Share what you
think" + talking-person icon; act title shows on the footer bar (stacked "Act N"
+ italic title). New `ResponseInput`: choose **Type** (pencil) or **Record**
(softened red, circular morph while recording) → textbox + small mic. Recording
lifecycle extracted to `useVoiceRecorder` (MicButton uses it too). Closing
question opens with a "Thank you for completing Act N" snap-scroll.

**Community Forum (§13).** A **per-act** `community_forum` screen shows at the
end of each act (after the closing question), scoped to that act (questions
carry an `actId`). It also serves as the act's "additional questions" step
(merged), so it always appears; it lists that act's approved questions with
responses inline + per-question + bottom "Add question" composers; all
submissions go to a moderated queue reviewed in `/admin/community`. A per-device
**identity** (Name + "anything we should know", revealed on name focus) is saved
once and reused.

**Suggested Resources (§13).** End-of-tour `resources` screen: approved
resources (photos + hyperlinks) + a "Submit Resources" form (photo upload +
links). `/admin/community` Resources tab authors curated resources (tour picker,
photos, links) and moderates/edits submissions.

**Audio-synced photo highlights (§13).** Admin authors `photoCues`
(timestamp → photo) under any narration audio (Background/seed, Look
Around/notice, Context/reveal) via the reusable `PhotoCueEditor`; at runtime
`usePhotoCues` glows the cued photo (+ gentle haptic) until the next cue. A
"keep the last photo highlighted after the audio ends" toggle (`photoCuesHoldLast`)
holds the final photo past the end (default clears on end).

**Smaller fixes / lessons.**
- **Admin audio Remove was a no-op** — the Remove handler fired two batched
  parent updates (clear URL + clear title) and the second re-read the **stale**
  tour/stop snapshot, restoring the old URL. Fix: clear the URL only in one
  update. (Lesson: two `setState`-via-spread calls in one handler clobber — the
  second reads the same render's snapshot.)
- Audio title now ping-pong **marquees** when it overflows (`AudioButton`).
- Collapsed context photos order by `[photo:N]` position in the text, not upload
  order.
- New Firestore collections need their own console rule blocks (see §3).

---

### Community Forum redesign — post blocks, likes, click-to-respond (2026-06-13)

A focused pass on the per-act **Community Forum** card
(`CommunityForumCard.tsx`) so it reads as a calm board of posts instead of a
form demanding a response. Live on `master`.

- **Question = a self-contained post block.** The always-visible "Add a
  response" composer under every question was removed. Default state is just
  the question text + author + a footer.
- **Click INTO a question to respond.** Tapping a block toggles it open
  (`expanded` is a `Set<string>`), revealing the approved responses and the
  response composer. Collapsed by default keeps the screen clean.
- **Per-block footer** = a **like** control (left) + **response count** (right,
  e.g. "2 responses ▾"; the count also toggles the block open).
- **Question likes.** New optional `ForumQuestion.likes?: number`.
  `setQuestionLike(id, liked)` in `community-store.ts` writes an atomic
  Firestore `increment(±1)`; per-device liked-state lives in localStorage
  (`provenance-forum-liked`, via `getLikedQuestionIds` /
  `saveLikedQuestionIds`) so one device can't double-count and can un-like.
  Like updates are **optimistic** (local count + persisted set update first,
  Firestore write is best-effort). Heart glyph fills + turns `--th-primary`
  when liked. Moderators see **♥ N** in each question's metadata line in
  `/admin/community`.
- **Heading + subtitle.** "Community Forum" bumped 22→26px; subtitle replaced
  with "Here are what others have been asking. You can respond or add to the
  inquiries!" (slightly larger at 15px). Continue + Add question stay at the
  bottom; a small empty-state line shows when an act has no questions yet.

No new Firestore collection (the count is a field on the existing
`memorial-church-community-questions`), so no new rule block. This is forum
data, not `TourSession` data, so the `/admin/sessions` `buildRows()` rule
(§4) doesn't apply. Likes write with no auth (consistent with the project's
test-mode rules + no admin auth, §7) — fine for the prototype.

---

### Explorer simplification — no card, NPS overview, merged FIND, map-first start (2026-06-27)

A multi-part pass simplifying the Context-Prototype explorer. All live on
`master`, verified in the running app.

**Background photo + card chrome removed.** The tour-level background photo
behind every card read as too visually busy, so it's gated off behind
`SHOW_TOUR_BACKGROUND_PHOTO = false` in `Journal.tsx` (admin authoring
untouched; flip the flag to restore the photo + frosted-glass card opacity).
With the photo gone the floating **card frame is also gone** — `Journal.tsx`
dropped the inner `rounded-2xl shadow-lg bg-warm-white` panel + outer `p-4`
gutter + the `canUseBlur` infrastructure, so phase content now sits **directly
on the page** (`--th-bg`). "If I want the card back I'll let you know."

**NPS-style Tour Overview.** Tapping a map pin now opens a full-screen
`TourOverview.tsx` (replacing the bottom-sheet `JournalPeek`, which is kept but
unused). Modeled on the National Park Service self-guided-tour layout
(`docs/NPS_Sample.png`): a **live satellite map banner with every stop as a
numbered pin** (fit-to-all-pins via `LatLngBounds`/`fitBounds`, zoom-capped),
title, guide, "N stops · ~X min", description with Read more, and a numbered
**stop list with thumbnails** that expand a teaser; sticky "Begin tour" → into
onboarding the first time.

**Map-first start + pin confirm.** `completeActIntro` routes straight to
`stop_map` — the opening "Share what you think" (`act_opening`) was retired so
context tours drop learners onto the tappable pins immediately. In
`StopMapCard.tsx`, tapping the target pin now opens a **small thumbnail confirm
card** ("Stop N · title" + "I'm here — explore this stop" / "Not yet") before
the stop opens.

**Merged "FIND" page (no snap).** `SeedCard.tsx` is now one continuous-scroll
page labelled **FIND**: the find instructions (notice prompt + photo) sit on
top, with the **Background reading below**. The two-section snap-scroll +
IntersectionObserver reveal are gone; the Journal's "Keep scrolling" indicator
cues there's more below.

### End-of-act redesign — Context → Reflect → Community (2026-06-27)

Replaced the end of each Act in Context-Prototype mode (`last stop →
act_closing → community_forum`) with a guided chain. Full reference folded into
§13; details:

**New flow.** `last stop in act → [act_context] → act_context_questions →
[act_reflection] → community_share → next act`, each step skipped when its
content isn't authored. State machine + completers in `tour-session.ts`
(`completeActContext` / `completeActContextQuestions(asked)` /
`completeActReflection(resp)` / `completeCommunityShare`, plus
`reflectionPromptOf` / `actHasContext` / `setActReflection` /
`addContextQuestion`); wrappers in `TourContext.tsx`; rendered in `Journal.tsx`.

**The four screens** (`src/components/tour/cards/`):
- `ActContextCard` — **read-only Context** (no pin): an admin-framed question +
  the context/answer the admin provides (+ optional photos/audio).
- `ContextQuestionsCard` — "Have a question?": type or record→edit a question →
  `POST /api/context-answer` → answer or banked "Saved — I'll help you find
  this"; ask-another loop. Each ask appends a `ContextQuestionEntry`.
- `ActReflectionCard` — **"Share What You Think"**: the reflection prompt
  (`reflectionQuestion`, falling back to the legacy `closingQuestion`) +
  `ResponseInput` (type/record) + photo upload + a **labelled map pin** ("design
  their own stop", a `@vis.gl` satellite map, tap to place) + a "Share to
  community" checkbox.
- `HearFromCommunityCard` — **"Hear from the Community"**: others' shared
  reflections (text + photos + pin) with **upvote** + expandable **comments**;
  on Continue, if the learner wrote a reflection but didn't share, a
  **re-share prompt** appears before advancing.

**Community model repurposed.** The old per-act question forum is **replaced**
by reflection-sharing. New `community-store.ts` helpers + collections
`memorial-church-community-shares` / `-comments` (§3) — created `approved` so
they **appear immediately** (no moderation gate; admin can still remove). New
**Shares** tab in `/admin/community`. Upvotes mirror the forum-like pattern
(atomic increment + localStorage `provenance-share-upvoted`). The legacy
Questions tab + collections remain read-only for old data.

**Data + logging.** `Act` gained `context` (`ActContext`) + `reflectionQuestion`
(keeping legacy `openingQuestion`/`closingQuestion` for fallback);
`TourSession.actResponses` widened with `reflection` (`ActReflectionResponse`:
text + photos + pin + sharedToCommunity + shareId) and `contextQuestions`
(`ContextQuestionEntry[]`). Admin tour editor authors per-act **Context** +
**Reflection** (opening-question field removed). Per the §4 rule,
`/admin/sessions` `buildRows()` now flattens reflections + context questions;
`tour-logger.ts` logs them as `act_question` events reusing the existing Act
columns (`actQuestionKind` = `context` / `reflection` / `reflection (shared)`)
— **no Apps Script column change needed**.

**AI is stubbed (deferred).** `/api/context-answer` banks the question and
returns `{ answer: null, status: 'banked' }`; a top-of-file TODO documents the
intended SKILL — search `knowledge-db.ts` first (reuse the `/api/ask` Claude
pattern + `hint-matcher`), then the web prioritising **academic → official/gov,
strictly no discussion forums (Reddit etc.)**, in a warm tour-guide voice. A
pass-through `cleanTranscript()` hook sits in `/api/transcribe` for the future
voice-dictation cleaner (one-spot change later). Both are the only deferred
pieces; everything else ships.

**Lessons / gotchas.**
- The new `memorial-church-community-shares` / `-comments` collections each need
  their own Firebase console rule block (§3) — verified live: without them,
  `submitShare`/`getShares` throw `Missing or insufficient permissions`, handled
  gracefully as an empty state.
- `react-hooks/set-state-in-effect` flags the `useEffect(() => { reload(); })`
  data-load pattern, but it's the established pattern in `/admin/community` (3
  instances) and doesn't block `next build` (lint isn't a build gate here).

---

### Context intro splash + first-open onboarding (2026-06-27 → 2026-06-28)

**End-of-act "Context" intro splash (2026-06-27).** A new `act_context_intro`
phase runs before the Context page each act (when Context is authored):
`ContextIntroCard.tsx` — a portal splash that fades in (~2s, inverted dark
`--th-journal` surface) presenting "So what context do we need?" (snap-scroll-
ready for a future onboarding-authored framework). `ActContextCard.tsx` was
restructured so the admin-framed question is SEEN first (full snap section) and
scrolling snaps to the full context description. State machine:
`completeContextIntro` → `act_context`; last-stop routes to `act_context_intro`.

**First-open contextualization onboarding (2026-06-28).** A snap-scroll teaching
intro shown on **every page load** (in-memory only, no persistence — a refresh
re-shows it; in-session navigation does not). Replaces the splash mount in
`layout.tsx` (`<ContextOnboarding>` wraps children; `SplashScreen.tsx` kept,
unused, for a future account-based "skip → brief fade"). ~10 Provenance-styled
slides (DM Serif Display / Newsreader / Montserrat) on a **warm canvas** (soft
top light + a fine SVG paper grain, both `background-attachment: fixed`), with
big editorial type and varied placement (low/high/right/centre columns, an amber
accent rule), the **CONTEXT** chip, colour-coded emphasis, and a "reconstruct"
anagram — teaching what context / contextualisation is and the **P.A.S.T.**
framework. Logo bounces in on the Welcome slide (reuses the `.splash-*`
keyframes); **Skip** top-right; "Begin →" / Skip dismiss to the map. Content from
`docs/contextualization-onboarding-instructions.docx`; style/techniques adapted
(toned calmer) from `docs/contextualization-intro.html`.

**P.A.S.T. slide** (`PastFramework.tsx`): four lenses, each a row with the WORD
pinned left (enlarged first letter) and its descriptor to the right as a tinted
**cover over the example question**. Dragging the row **left reveals** the
question, **right re-covers** it (reversible; pointer handlers on the whole
reveal row, transform managed inline, snap past a 45% threshold). A
**double-sided arrow grab tab** is pinned to the cover's right edge (a child of
the cover), so it travels with the box as it slides — its opaque lens-coloured
fill blocks the text underneath instead of floating over it, and it tucks fully
off-screen when the box is open so no stray arrow hovers over the revealed,
left-aligned question. The descriptor reserves right padding so its text never
runs under the tab (matters most for the wide "Technology" word).
Colour-coded per lens — Place `#347C4A` green, Attitudes `--th-secondary` amber,
**Society `#7B4EA3` plum** (deliberately NOT the cranberry `--th-primary`, which
the CONTEXT chip uses), Technology `#2C6488` blue; the same letters are
colour-coded in the "P.A.S.T." caption. Lens colours live as `--onb-place /
-time / -society` on `.onb-screen`. `.onb-*` styles are all in `globals.css`.
Verified live end-to-end. Future: account-based remembered-skip.

---

## 11. Splash Screen

Added 2026-05-25. First-load brand intro that plays once per browser
tab. Lives at `src/components/SplashScreen.tsx`, mounted in
`layout.tsx` inside `ThemeProvider` so it sits above all routes.

### Behavior

- Reads `sessionStorage.getItem('splash_seen')`. If set, splash is
  never mounted — visits 2+ get the app immediately.
- Otherwise sets the flag, mounts a fixed `z-[1000]` overlay covering
  `{children}`, runs the timeline, then unmounts.
- Mount uses an isomorphic `useLayoutEffect` shim so the overlay
  covers the first hydration paint (no flash of the page underneath).

### Timeline (total 3.1s)

| t (s) | Event |
|---|---|
| 0 → 0.5 | Hold (pin held off-screen at `translateY(-120vh)`) |
| 0.5 → 1.5 | Pin drops (1.0s) with `cubic-bezier(0.22, 1.8, 0.36, 1)` overshoot/settle. Soft elliptical shadow grows from `scale(0)` synchronously |
| 1.2 → 2.1 | "Provenance" wordmark fades in + slides `8px → 0` over 0.9s (Montserrat Medium, `#8B2D2D`, 32px, `mt-4` below logo) |
| 2.1 → 2.3 | 0.2s hold of the fully revealed splash |
| 2.3 → 3.1 | Overlay opacity 1 → 0 over 0.8s, then unmount |

Logo is `/logo_transparent.png` rendered at `w-60` (240px wide). The
animation keyframes live in `globals.css` (`.splash-pin`,
`.splash-shadow`, `.splash-wordmark`, `.splash-overlay`); the JS only
schedules the fade-out and unmount via the mirrored `ANIM_END_MS` /
`FADE_OUT_MS` constants.

### PWA launch-screen integration

Installed PWAs show an OS-drawn launch screen *before* any JS runs,
so the JS splash alone can't be the whole story:

- iOS uses `apple-touch-startup-image` link tags. We provide 11
  solid-cream PNGs at modern iPhone + iPad Pro 11"/12.9" portrait
  resolutions in `public/splash/`, wired via
  `appleWebApp.startupImage` in `layout.tsx`. Unmatched devices fall
  back to iOS's default white screen with the app icon.
- Android Chrome auto-draws an icon centered on `background_color`.
  `public/icon-192.png` and `public/icon-512.png` (`purpose: "any"`)
  are intentionally solid cream so the icon visually disappears
  against the cream background. The maskable icon is unchanged for
  the home-screen launcher. The app-name text below the icon is
  drawn by Chrome and can't be suppressed via the manifest.

### Files

| File | Purpose |
|---|---|
| `src/components/SplashScreen.tsx` | Wrapper component |
| `src/app/globals.css` | `@keyframes splashPinDrop / splashPinShadow / splashWordmark` + `.splash-overlay` transition |
| `src/app/layout.tsx` | Mount inside ThemeProvider; load Montserrat; `appleWebApp.startupImage` array |
| `public/logo_transparent.png` | The dropping pin image |
| `public/splash/iphone-*.png`, `public/splash/ipadpro-*.png` | iOS startup images (cream) |
| `public/icon-192.png`, `public/icon-512.png` | Cream icons for Android PWA splash (see §7) |
| `public/icon-maskable-512.png` | Real glyph — used for home-screen launcher only |
| `public/manifest.json` | `background_color: #E9E4E2` matching the in-app cream |

---

## 12. Multi-device Group Rooms

Added 2026-05-27. Lets a small group (2–4 people) walk a tour
together from their own devices. Per-device written responses persist
exactly as in single-player; the room only coordinates two things:
stop transitions and discussion-question barriers.

### Firestore model

Stored at `memorial-church-rooms/{code}` (4-char alphanumeric, lookalike
chars excluded). See `src/lib/types.ts` (`Room`, `RoomMember`,
`BarrierState`) for the full shape. Key fields:

- `members: RoomMember[]` — `sessionId`, `name`, `joinedAt`, `lastSeenAt`
- `started: boolean` — flipped by the host's "Begin tour" in the lobby
- `currentStopId: string | null`
- `completedStopIds: string[]`
- `completionOrder?: string[]` — logical stops in visit order; drives
  the progress-bar count + midway threshold
- `groupPhase?: TourPhase | null` — outer phase (unstructured_map,
  midway_checkin, eq_closing*, eq_questions, …) that members mirror
- `pendingStopId / pendingApprovals` — in-flight transition vote
- `barriers: Record<key, { arrivals, readys, resolvedAt }>` — keyed
  by `${stopId}:${phase}:${round}` (or `midway:checkin`, `eq:discuss`,
  `eq:additional`, `eq:closing_additional:${idx}`)

### Coordination model

**Stop transitions** — host taps a pin (unstructured) or completes
the last in-stop screen (linear): `proposeStop(stopId)` writes the
target to `pendingStopId`. Every member sees the
`RoomStopProposalOverlay` and taps "I'm in — let's go" to add
themselves to `pendingApprovals`. When everyone's in, the same
transaction commits — `currentStopId` updates and every device's
sync effect advances locally to the new stop's seed. Linear rooms
have a "map interlude" between stops: completing a stop clears
`currentStopId` (via `markCurrentStopCompleted`), every device
lands on the map view (`unstructured_map` phase) with the next
sequential pin highlighted, host taps to propose.

**Unstructured advance** — host's `advanceStop` runs
`advanceToNextStopUnstructured` locally and publishes the result to
the room via `recordHostAdvance({ completedStopIds, completionOrder,
groupPhase })`. The local state machine handles cluster sub-stops,
midway threshold, and final-stop → closing transitions; members
mirror.

**Discussion-question barriers** — `useRoomBarrier(key, onResolve)`
hook on every continue button. On mount each device calls
`arriveAtBarrier`. The card surfaces a status pill ("Waiting for K to
arrive…") and the continue label changes to "Waiting for the group…"
→ "Ready to continue". Pressing Ready calls `readyAtBarrier`; when
every member is ready the same transaction sets `resolvedAt`, every
device's hook fires `onResolve` (which calls the card's original
continue handler) and the local state machine advances. Members
must always arrive — sleeping phones still block.

### Liveness, host failover, kicking

- **Heartbeat** every 30 s via `RoomContext`, paused while the tab is
  hidden (Page Visibility API). `RoomMember.lastSeenAt` is the
  authority.
- **Status tiers**: `online` (<60 s), `idle` (≥60 s), `stale`
  (≥15 min). Idle members can be **kicked** by any other member from
  the room menu after 2 min of inactivity (`memberStatus()` /
  `canKick()` in `RoomContext`).
- **Host failover** at 5 min host silence — any member's watchdog
  fires `claimHostIfStale` (atomic Firestore transaction) that
  promotes the oldest remaining member if the host is still stale at
  commit time.
- **Reload-rejoin** — the room code lives in `sessionStorage`
  (`provenance-room-code`). On mount the provider re-subscribes via
  `onSnapshot`. The sync effect in `TourContext` aligns the local
  `TourSession` to whatever stop / phase the room is on.

### Onboarding entry

`IntroScreens` runs `Set Up` first. "Who has a phone?" → Only Me
skips room setup; Everyone reveals **Host a group** / **Join a
group** buttons that open `RoomEntrySheet` (name + code for join,
just name for host). After the sheet submits, `RoomLobby` overlays
the journal at full-screen — shows the 4-char code (big), the live
member list with online/idle dots, and a host-only "Begin tour for
everyone" button. When the host taps Begin, `room.started` flips
true and every device's `IntroScreens` auto-advances past Set Up
into the rest of the intro flow.

### Room menu

Tap the persistent ROOM pill in the footer (below the Journal / ? /
Auto row, only mounted while in a room). Opens a bottom sheet with
the member list (online/idle/stale indicators + host badge), a
"Copy code" button, a "Remove" button next to each idle member
(enabled after 2 min), and a "Leave room" button.

### Closing in rooms

The closing redesign (Tour Complete → journal peek → closing
questions section, see §8) is per-device. The host's `advanceStop`
on the final stop fires `recordHostAdvance` with
`groupPhase='eq_closing'` so members align to closing. After that
each member traverses the closing card and lands on `eq_questions`
independently.

### Files

| File | Purpose |
|---|---|
| `src/lib/room-store.ts` | Firestore CRUD: create / join / leave / heartbeat / proposeStop / approveStop / arriveAtBarrier / readyAtBarrier / recordHostAdvance / setGroupPhase / claimHostIfStale / kickMember |
| `src/context/RoomContext.tsx` | Subscription, heartbeat, host-failover watchdog, action wrappers |
| `src/components/room/RoomLobby.tsx` | Full-screen waiting room |
| `src/components/room/RoomEntrySheet.tsx` | Host / Join bottom sheet |
| `src/components/room/RoomMenu.tsx` | Members + kick + leave + copy code |
| `src/components/room/RoomBarrierIndicator.tsx` | "Waiting for X to arrive / be ready" pill |
| `src/components/room/RoomStopProposalOverlay.tsx` | Pending transition card |
| `src/components/room/useRoomBarrier.tsx` | Hook used by discussion cards to gate Continue |

### Out of scope (yet)

- Cross-device response recovery without auth — full app close on a
  fresh device loses local responses. Solving would require a
  "claim my membership by name" flow on join (or actual auth).
- No automatic kick at any threshold — kicks are manual.
- Linear tours without `location` on every stop won't surface a
  useful map interlude (the host has no pin to tap).

---

## 13. Context-Prototype Mode

Added 2026-06-08 → 2026-06-09. A third tour mode (`tourMode: 'context'`),
chosen from the **3-way selector at the top** of the tour editor. Sequential
like Linear but stripped down and Act-structured. Resolve the mode anywhere via
`getTourMode(tour)` (`tours-store.ts`); it derives from the legacy
`unstructuredMode` boolean for tours predating `tourMode`.

### Data model

- `Tour.tourMode?: 'linear' | 'unstructured' | 'context'` — source of truth.
  Context keeps `unstructuredMode === false`, so it plays through the **linear
  Journal path** (no `page.tsx` map/closing views).
- `Tour.contextStops?: Stop[]` — parallel stops array (mirrors
  `unstructuredStops`), cloned from the unstructured/linear set on first switch.
  `getActiveStops` / `setActiveStops` are mode-aware.
- `Tour.acts?: Act[]` — `{ id, title, stopIds[], openingQuestion, closingQuestion,
  context?: ActContext, reflectionQuestion? }`. `context` = the end-of-act
  read-only Context section (`{ question, context, photos?, audio* }`);
  `reflectionQuestion` = the "Share What You Think" prompt (falls back to legacy
  `closingQuestion` via `reflectionPromptOf`). `openingQuestion`/`closingQuestion`
  are legacy (act_opening/act_closing retired). 2026-06-27.
- `Tour.openingFrame?: OpeningFrame | null` — the "Setting the Scene" fields
  (scene photo/description/audio + framing), independent of `essentialQuestion`.
- `TourSession.actResponses?: Record<actId, { opening?, closing?, reflection?:
  ActReflectionResponse, contextQuestions?: ContextQuestionEntry[] }>` —
  `reflection` = `{ text, photos?, pin?, sharedToCommunity?, shareId? }`;
  `contextQuestions` = the questions the explorer asked (+ AI answer/status).
  2026-06-27.

### Flow (per stop / act)

`opening_frame` → for each act: `act_intro` (dark "Act N: Title" splash, ~2.5s,
tap to skip) → `stop_map` → for each stop: `seed` (the merged "FIND" page) →
`reveal` → [`reflect`] → next stop; at act end the **end-of-act chain** runs
(2026-06-27): `[act_context]` → `act_context_questions` → `[act_reflection]` →
`community_share` → next act (bracketed steps skipped when unauthored/empty).
After the last act → guide outro → `resources` → `end`. The old `act_opening`
(the start-of-act "Share what you think") was dropped — `completeActIntro` goes
straight to `stop_map`. `act_opening`, `act_closing`, `community_forum`,
`act_questions` are all **deprecated** (kept for in-flight sessions only).

State machine helpers in `tour-session.ts`: `getActs`, `getContextOrderedStops`,
`findActOfStop`, `hasOpeningFrameContent`, `positionAtAct`, `enterFirstContextAct`,
`advanceToNextStopContext`, `advanceToNextActOrClosing`, `finishContextTour`,
`reflectionPromptOf`, `actHasContext`, and
`complete{OpeningFrame,ActIntro,StopMap,ActContext,ActContextQuestions,ActReflection,CommunityShare,Resources}`
(legacy `completeActOpening`/`completeActClosing`/`completeCommunityForum` kept).
At an act's last stop, `advanceToNextStopContext` routes to `act_context` (if
the act has a Context authored) else `act_context_questions`; each completer
then walks the chain. `advanceFromReveal`/`nextPhaseAndRound` take a `skipWonder`
flag (true in context) that skips the wonder phase **and** all extra rounds.

### Key components

| Component | File | Purpose |
|---|---|---|
| ActIntroCard | `cards/ActIntroCard.tsx` | Portal full-screen "Act N: Title" splash (amber number + white title), ~3s hold |
| ActContextCard | `cards/ActContextCard.tsx` | End-of-act **Context** (no pin): read-only framed question + admin-provided context (+ optional photos/audio). 2026-06-27 |
| ContextQuestionsCard | `cards/ContextQuestionsCard.tsx` | "Have a question?" — ask (type/record) → `/api/context-answer` (AI stub: banked) → answer/"Saved" + ask-another loop. 2026-06-27 |
| ActReflectionCard | `cards/ActReflectionCard.tsx` | **"Share What You Think"** reflection: prompt + ResponseInput + photo upload + a labelled `@vis.gl` map pin ("design their own stop") + share-to-community. 2026-06-27 |
| HearFromCommunityCard | `cards/HearFromCommunityCard.tsx` | **"Hear from the Community"**: others' shared reflections (text/photos/pin) + upvote + comments; re-share prompt on Continue if not shared. 2026-06-27 |
| StopMapCard | `cards/StopMapCard.tsx` | Per-stop satellite map; numbered pins (target white+amber, completed faded blue, upcoming bronze); tap the pin → **thumbnail confirm card** before the stop opens (2026-06-27); first stop gets a one-time spotlight |
| ActQuestionCard | `cards/ActQuestionCard.tsx` | **Legacy** — old act opening/closing "Share what you think" question; replaced by ActReflectionCard, kept for in-flight sessions |
| CommunityForumCard | `cards/CommunityForumCard.tsx` | **Legacy** — old per-act question forum; replaced by HearFromCommunityCard, kept for in-flight sessions |
| ResourcesCard | `cards/ResourcesCard.tsx` | End-of-tour suggested resources + submit form |
| ResponseInput | `cards/ResponseInput.tsx` | Type/Record chooser → textbox + small mic |
| EqSceneCard | `cards/EqSceneCard.tsx` | Reused for `opening_frame` via its `scene`/`openingVariant` props |
| usePhotoCues | `tour/usePhotoCues.ts` | Audio-synced photo highlight hook (see Audio cues below) |
| PhotoCueEditor | `admin/PhotoCueEditor.tsx` | Admin cue editor (timestamp → photo + hold-last toggle) |

Admin authoring lives in the tour editor: a 3-way mode selector, an Opening
Frame section, and an **Acts organizer** (native HTML5 drag-and-drop to move
stops between acts; `ensureActsCoverStops` keeps every stop in exactly one act).
`StopEditor` hides the discussion/extra-rounds/bridge fieldsets in context mode.

### "Hear from the Community", Suggested Resources, & legacy forum

Data layer in `src/lib/community-store.ts` (submit/list/approve/remove/edit,
photo upload via Firebase Storage, localStorage identity `provenance-forum-identity`).
Moderation UI at **`/admin/community`**, now three tabs: **Shares** (default),
**Questions** (legacy), **Resources**.

**Shares ("Hear from the Community", 2026-06-27)** — replaces the per-act
question forum. Collections `memorial-church-community-shares` / `-comments`
(§3), each needs its own console rule block. Shares are created `approved` so
they **appear immediately** (no moderation gate; admin can hide/remove). The
explorer flow: `ActReflectionCard` posts a share (`submitShare`) when the
learner ticks "share"; `HearFromCommunityCard` lists `getShares(tourId, actId)`
with **upvotes** (`upvoteShare` atomic increment + localStorage
`provenance-share-upvoted`) and **comments** (`submitComment`/`getComments`).

**Resources** — unchanged (`memorial-church-community-resources`, admin-curated
or explorer-submitted + moderated; `pending` until approved).

**Legacy forum** — `memorial-church-community-{questions,responses}` +
`CommunityForumCard.tsx` are retired (new sessions never write forum questions);
old data stays read-only in the admin Questions tab. See the 2026-06-27 entry in §8.

### Audio-synced photo highlights

Any narration audio with photos (Background/seed, Look Around/notice, Context/
reveal) can carry `photoCues: { time, photoIndex }[]` (+ `photoCuesHoldLast`).
Admin authors them with `PhotoCueEditor` under the AudioUpload. At runtime
`usePhotoCues(cues, photos, holdLast)` returns `{ onTimeUpdate, onEnded,
highlightedUrl }`; the card feeds `onTimeUpdate`/`onEnded` to `AudioButton` and
`highlightedUrl` to `PhotoContent` (matched by URL). The cued photo gets the
`.photo-glow` amber pulse + a one-shot `navigator.vibrate(15)` on change. By
default the highlight clears when audio ends (`AudioButton` fires `onEnded`);
with `photoCuesHoldLast` the last photo stays lit.

### Out of scope / notes

- Cues are wired for the three narration screens; question-background / EQ-scene
  audios could be added via the same `usePhotoCues` + `PhotoCueEditor` drop-in.
- Community Forum appears at the **end of each act**, scoped to that act
  (questions carry an `actId`), and always shows (it's the act's ask point,
  merging the old "additional questions" step).
- iOS Safari doesn't fire `navigator.vibrate`, so haptics are Android/Chrome.

---

*End of handoff. The latest work is the **Community Forum redesign**
(2026-06-13, §8 + §13) — post blocks, per-question likes, click-to-respond.
The Context-Prototype mode (§13) — Acts, act intro splash, per-stop "walk to"
map, Community Forum, Suggested Resources, and audio-synced photo highlights —
remains the surrounding feature set, all live on `master`. The room system
(§12), splash screen (§11), unstructured exploration mode (§10), and theme
system (§9) remain in place. Two adoption steps require manual console work:
the Sheets logging columns (run `addHeaders()` once — see §4) and the three
`memorial-church-community-*` Firestore rule blocks (see §3 / §13).*

---

## 15. Context Journal (2026-06-29)

A new **self-contained module** at `src/features/context-journal/` — a place's
context explored through a map, a timeline, and the four P.A.S.T. lenses. It
**replaces the old footer "Journal" entry** (which opened the `JournalOverlay`
study panel). Route: **`/context-journal`** (`src/app/context-journal/page.tsx`).

**Removal / nav swap.** The tour's `JournalOverlay` was poorly named — the
component `Journal.tsx` is actually the *tour playback engine* (left untouched),
and `JournalOverlay.tsx` is the study panel, **still used by `EqClosingCard`**
(the tour's closing "theory journal"), so it was **kept**. Only the footer entry
changed: `TourFooter.tsx`'s "Journal" button (which opened `JournalOverlay`) is
now a **`<Link>` to `/context-journal` labelled "Context Journal"**; its
`showJournal` state + the footer's `JournalOverlay` render were removed. The
deprecated, unused `JournalPeek.tsx` was deleted. The tour flow + Google Maps
tour are otherwise untouched.

**Two map libraries, isolated.** The tour keeps **Google Maps**
(`@vis.gl/react-google-maps`). The Context Journal uses **Mapbox GL JS v3**
(`satellite-streets-v12` style; `mapbox-gl`, `@mapbox/mapbox-gl-draw`,
`mapbox-gl-draw-freehand-mode`),
**dynamically imported `ssr:false`** via `ContextMapLoader` so mapbox **only
ships on this route, never in the tour bundle**. Needs `NEXT_PUBLIC_MAPBOX_TOKEN`
(already set); if absent, `ContextMapLoader` short-circuits to a placeholder and
never loads mapbox at all.

**Layout (mobile-first, 390px):** header (back + Add context) → **Map** (top,
`ContextMap`, BROWSE mode) → **Timeline** (`ContextTimeline`) → **P.A.S.T.
panel** (`PastPanel`, remaining space, scrolls).

- **ContextMap** — BROWSE = the calm **default** light basemap (`MAP_STYLES`:
  `default` = light-v11, `satellite` = satellite-streets-v12). A **Map/Satellite
  toggle** lets the viewer switch freely (live `setStyle`); focusing a context
  also switches to the basemap it was authored on. (Saved geometry deliberately
  NOT drawn on the browse map yet.) ADD mode enables
  a toolbar: **Pin** (`draw_point`) or **Highlight** (freehand "colour in" via
  `mapbox-gl-draw-freehand-mode`, dynamically imported with a **polygon
  fallback**), filled in the active lens colour at low opacity, plus **Clear**.
  Emits `{ geometry, camera }` (GeoJSON + centre/zoom). Two gotchas handled:
  `mapbox-gl.css` forces `.mapboxgl-map{position:relative}` (so the container is
  sized with `h-full`, **not** `absolute inset-0`, which would collapse to 0
  height), and a **`ResizeObserver` calls `map.resize()`** so the flex-settled
  size is picked up (else zero tile coverage → blank map).
- **ContextTimeline** — domain (the two ends) starts from a **per-stop
  admin-set** prop but is **editable by the viewer**: tap either end to nudge
  (− / +, step scales with the grain) or type a year (negative = BC). It may span
  anywhere within `TIMELINE_BOUNDS` (**1000 BC → present**, BC shown as "N BC",
  the upper bound as "Present"), keeping a `MIN_DOMAIN_SPAN`. Moving an end re-fits
  the selection via `clampRange()`. `DEFAULT_DOMAIN` is the initial placeholder
  (1600 → present) until the admin UI exists. A **dropdown** (labelled "…range")
  picks the snap grain (1 / 10 / 100y) — **any grain at any span** (no cap on the
  choice; `floorGranularity()` only seeds the initial default). **Gridlines follow
  the chosen grain** (10y grain → 10y lines), coarsening the tick step ×10 only
  past `MAX_TICKS` (500) so an extreme grain×span (1-year over 1000 BC → present)
  can't render thousands of divs. Tick elements are **memoised** so dragging the
  selection never re-reconciles them — smooth at any count. (Caveat: at a very fine
  grain over a very wide span the one-segment selection is sub-pixel and the
  handles overlap — a precision trade, not lag.) A **dropdown** picks the segment
  size (1 / 10 / 100y); sizes that would exceed **`MAX_SEGMENTS` (30)** are
  **disabled** ("too many"), so the grain auto-coarsens (1 → 10 → 100) for long
  domains — `floorGranularity()` is the floor, 100y the cap. A draggable
  selector (one segment wide, defaulting to a mid-domain segment via
  `defaultRange()`): drag body to move, drag either handle to resize; edges
  **snap**. The track is **inset ~34px from the screen edges** so an edge handle
  clears the phone's back-swipe zone. Selected `{start, end}` is **lifted to
  `ContextJournal` as the single source of truth**.
- **PastPanel / PastLens** — four colour-coded lenses (Place `#347C4A`,
  Attitudes `#B8752B`, Society `#7B4EA3`, Technology `#2C6488`), names only,
  collapsed. **No tap delay:** tapping the **name** (carries a dotted-underline +
  ⓘ cue) toggles a short **definition shown to its right**; tapping anywhere else
  on the row (or the chevron) toggles the dropdown of in-range contexts. A
  context shows when `pastCategory` matches and `start <= selEnd && end >=
  selStart`. Open = horizontally-scrolling **thumbnails**; tap → compact summary
  card; tap again / "Read more" → **full-screen reader** (`ContextFullScreen`).
  Empty state: "No context here yet." Framer Motion animates dropdown, summary,
  and overlay.
- **AddContextFlow** — the single shared "Add context" form (designer- and
  learner-side entry points wire in later): title / summary / explanation /
  lens / optional photo / a **dedicated year-range picker** (separate from the
  browse timeline) / a **required** map step (pin or highlight). On save it
  writes a `ContextEntry` and (live subscription) it appears in its lens the
  moment its range overlaps the selection.

**Admin config + map behaviours (2026-06-29 pt.2/3).** Config is **per tour**:
**`context-journal-config/{tourId}`** (`PlaceConfig`) holds the timeline domain
+ default map view (`defaultCenter`/`defaultZoom`), edited **inside the tour
editor** (`/admin/tours/[id]` → "Context Journal" section, the reusable
`features/context-journal/admin/ContextJournalConfig` component) so adding tours
doesn't mean visiting a separate page. (The standalone `/admin/context-journal`
page was removed; the viewer `/context-journal` route is reserved for a future
**global context-entry library** — browse/import-into-a-tour.) The viewer route
takes **`?tour=<id>`**
(the TourFooter "Context Journal" link passes it); `ContextJournal` scopes its
config + contexts + saves to that tour (`scopeId = tourId ?? DEFAULT_PLACE_ID`;
per-stop scoping slots in here later). **No constrain box** — viewers can pan/zoom
freely to look around. The browse map has a **GPS `GeolocateControl`** (locate dot
+ recenter) and **focus-to-context** — tapping a context thumbnail lifts a
`focused` entry and the map **flies to fit its geometry** (`fitBounds` for a
region, `flyTo` for a point) **and switches to the basemap it was authored on**
(`ContextEntry.mapType`); deselecting (collapsing the lens) returns to the default
view. **Basemap toggle:** default light ↔ satellite, via the on-map button (live
`setStyle`) for viewers, and in the **Add flow** (keyed remount that re-seeds the
drawn geometry, so satellite/default doesn't fight mapbox-gl-draw) — the chosen
type is stored on the context. `ContextMap` emits `onViewportChange` (moveend) for
the admin view-capture. The first-open **onboarding is suppressed on `/admin`**.
(`context-journal-config` needs its own Firestore rule block too.)

**Tour map type menu (2026-06-29 pt.5).** The tour's Google Map (`Map.tsx`) has a
bottom-right **map-type menu** with three options: **3D** (hybrid + 45° tilt — the
default, the "slant"), **Satellite** (hybrid, flat), **Map** (roadmap, flat).
`mapType` is stateful; a `TiltController` child applies the tilt imperatively on
change (so two-finger gesture-tilt within a mode isn't fought). `fitToNearestTourPin`
now **restores the tilt** after its `fitBounds` (locating no longer flattens the
view). Google's default UI is off (`disableDefaultUI`, no `rotateControl`) so its
tilt widget doesn't clutter the corner. (The earlier Mapbox `/admin/map-preview`
3D experiment was removed — compass-follow was too jittery; rotate-with-fingers is
the model. A 2D⇄3D path for Mapbox can revisit later.)

**Context authoring overhaul — Stage 1 of 4 (2026-06-29 pt.6).** Richer contexts:
`ContextEntry` now has a **`question`** (framing question, shown italic under the
title on cards + the page), **`media: ContextMedia[]`** (photos *and* audio, each
titled — replaces the single `photoUrl`), and **`thumbnailMediaId`** (which photo
is the card thumbnail). `AddContextFlow` (shared by learner + admin) gained the
question field (below the lens), a **multi-upload media manager** (Add photo / Add
audio, per-item title, star-to-pick-thumbnail, remove), and stores it all.
`PastLens` now shows **richer cards** (photo / title / question-italic / short
summary; tap = focus map, "Read more" = open). `ContextFullScreen` shows the
question, a **photo gallery** (swipeable when >1, captioned), audio players, and
the long explanation via **`ReadAloud`** — free **Web Speech API** TTS with
e-reader **word highlighting** (`boundary` events; desktop Chrome/Edge reliable,
some mobile voices don't fire boundaries → audio plays without highlight; premium
voice e.g. ElevenLabs can swap in behind the same component later). `uploadContextPhoto`
→ `uploadContextMedia`.

**Context authoring — Stage 2 + 3 (2026-06-29 pt.7).** Admin-authored, positioned
rich contexts plus the learner playback sequence. ⚠️ *Built but not yet verified
live or committed in the session that wrote it (machine closed mid-work); the
code compiles (tsc + `next build` pass). Needs a live QA pass.*

- **Data model (`lib/types.ts`).** New **`ActContextItem`** — a rich context
  authored on a tour and **positioned after a stop** (`afterStopId`) within an
  act: `{ pastCategory, question, title, shortSummary, longExplanation,
  timeRange, geometry, camera, mapType, media: ContextMediaItem[],
  thumbnailMediaId }`. It mirrors the journal's `ContextEntry` so an item can be
  **cloned into a learner's Context Journal**. `Act` gains **`contexts?:
  ActContextItem[]`** (an act can hold several, after different stops); the old
  single `Act.context` (`ActContext`) is now **legacy**, still read for old tours
  via `getActContexts()`. `TourSession` gains **`currentContextId`** (which
  positioned context is showing during the `act_context*` phases).
- **Shared form (`AddContextFlow`).** Refactored from journal-only to **reusable**:
  props are now `onSubmit(draft: ContextDraft) => Promise<void>`, `initial`
  (pre-fill for edit), and `heading`; the caller decides where it's stored.
  **`ContextDraft = Omit<NewContextEntry, 'placeId'>`** (the authored content,
  minus where it lives). The learner journal and the admin tour editor both use it.
- **Stage 2 — admin (`/admin/tours/[id]`).** Each act has an **"Add Context"**
  section: add / edit (pre-filled via `initial`) / remove items, and a per-item
  **"plays after \<stop\>"** selector (`afterStopId`). Handlers
  `upsertActContextItem`, `removeActContextItem`, `setActContextItemAfter`.
  Module-level **`makeCtxId()`** (crypto.randomUUID + Date.now/Math.random
  fallback) — *was the render-purity bug fixed as the last edit before the
  machine closed; it now lives at module scope, not in render.*
- **Stage 3 — learner sequence + state machine (`tour-session.ts`).**
  `getActContexts(act)`, `contextsAfterStop(act, stopId)`,
  `currentContextItem(tour, session)`. After a stop, any contexts positioned
  there play in order (`act_context_intro → act_context`), then
  `resumeAfterContexts` advances to the next stop / `completeActContext` steps to
  the next positioned context or on to `act_context_questions`. **`ActContextCard`**
  shows the item and a learner-only **"+ Add to Context Journal"** button
  (`addToJournal`) that clones it into the journal — never auto-saves.

**Still to come — Stage 4 (premium TTS + AI-response read-along).** REMINDER (from
the user): **work on Stage 4 when we get to the AI-response function.** Swap the
free Web Speech API behind `ReadAloud` for a premium voice with word-level
timestamps (e.g. ElevenLabs / Polly / Azure) so read-along highlighting works on
mobile too, and apply the same read-along to the AI-generated response. The
`ReadAloud` component is already structured so the premium voice drops in behind
the same interface.

**NOTE for next session:** Stage 2 + 3 above still need a **live QA pass** (author
a positioned context in the tour editor, run the tour, confirm the after-stop
sequence and "Add to Context Journal" cloning) — they were never exercised in the
browser.

**Geometry save fix + richer map authoring (2026-06-29 pt.8).**

- **Save bug (fixed).** Drawn regions are GeoJSON Polygons whose `coordinates`
  are nested arrays — **Firestore rejects nested arrays**, so saving a region
  silently failed (pins, being flat Points, saved fine). Geometry is now stored
  as a **JSON string** at the Firestore boundary and parsed back on read, via
  `lib/geo-serialize.ts` (`geometryToStore` / `geometryFromStore`). Wired into
  the journal store (`context-journal/store.ts` add + both read paths) and the
  tour store (`tours-store.ts`, `Act.contexts[].geometry`, via
  `mapTourContextGeometry`). Legacy raw-Point objects still load.
- **Add-Context map — two new tools** (`ContextMap.tsx`, `DrawTool` now
  `pin | highlight | circle | place`):
  - **Circle** — tap drops a circle (radius ≈ 1/6 of the view; `circlePolygon`
    equirectangular approximation), which immediately enters `direct_select` so
    its vertices/midpoints can be dragged to reshape into any polygon.
  - **Place** — search a **state/country** by name (`places.ts` → OpenStreetMap
    **Nominatim**, `polygon_geojson=1&polygon_threshold=0.008` to keep the stored
    boundary small); pick a result to drop its boundary as an editable region and
    fit to it. **MultiPolygons collapse to their largest (mainland) polygon** —
    islands/exclaves are dropped (draw can't reliably edit MultiPolygons; note for
    later). Nominatim is free/no-key but external — low-volume authoring only,
    © OpenStreetMap contributors.

  ⚠️ *Built + compiles (tsc + `next build` pass) but the circle reshape and the
  Nominatim boundary search were NOT exercised in a browser — needs live QA
  (drop+reshape a circle; search e.g. "California" and confirm it saves & reloads).*

**Map-tool revision + save still failing (2026-06-29 pt.9).** Feedback after
pt.8: the **circle tool was confusing** and the typed-only place search was
limiting. Revised the Add-Context map to three tools — `DrawTool` is now
`pin | highlight | place`:

- **Circle tool removed.**
- **Paint (`highlight`)** restyled as a **translucent highlighter brush** (wider
  soft stroke + ~0.32 see-through fill in `drawStyles`), and the freehand path is
  now **auto-smoothed into a clean shape** on completion — Douglas–Peucker
  `simplify` (tolerance scales with shape size) + two passes of `chaikin`
  corner-cutting, in `ContextMap.tsx`. (Real paper/marker *texture* isn't feasible
  in mapbox-gl — this is an opacity/stroke approximation.)
- **Place** now supports **tap *and* type**: tapping the map reverse-geocodes the
  point (`placesAtPoint` → Nominatim `/reverse`) into **city / state / country**
  chips you pick from; the typed search box remains.

⚠️ *Verified with `tsc --noEmit` (clean); the full `next build` couldn't run
locally (transient `next/font/google` fetch failure — environment, not code).
Map interactions still need a live QA pass.*

**Save bug — root cause confirmed = Storage rules (2026-06-29 pt.10).**
Saving **without** media succeeds; **with** a photo/audio it fails — so the cause
is **Firebase Storage rules**: `uploadContextMedia` writes to
`context-journal/media/**`, which existing Storage rules don't cover (other
upload paths do, which is why tour/stop photos work). Fix is console-side — add a
`match /context-journal/media/{file=**}` rule with read+write scoped like the
other paths. **Not a code bug.** (The geometry-serialization fix from pt.8 is
still correct and needed for region/boundary saves.)

**Map-tool follow-ups (2026-06-29 pt.10).**
- "Paint" relabelled **"Highlight"** (behaviour unchanged — the freehand
  highlighter the user is happy with; smoothing retained).
- Add-Context **map enlarged** `h-64 → h-96` so the place-search panel no longer
  hides most of the map.
- **Tap-to-select (place tool) reported not working** — handler logic looks
  correct (map `click` → `placesAtPoint` reverse-geocode → city/state/country
  chips). Added `console.debug('[context-journal] place tap', …)` + error logging
  to tell apart "click never fires" (likely mapbox-gl-draw `simple_select`
  swallowing it → switch to a canvas/unproject listener) from "Nominatim reverse
  fails" (network/policy). **Needs a console check on the next QA pass.**

**Place tool rearchitected — search lifted out of the map, click-a-name to
select (2026-06-29 pt.11).** Per feedback (search bar covered the map; tap
should select by *name*, not reverse-geocode a point):
- The **place search bar now lives in `AddContextFlow` ABOVE the map**, not as an
  overlay inside it. `ContextMap` gained props `onToolChange` (reports the active
  tool up so the parent shows the bar only for `place`), `onTapName` (reports a
  tapped basemap *label* name), and `boundary` (`{geometry, nonce}` the parent
  pushes down to display). The map no longer imports `searchPlaces`/`placesAtPoint`.
- **Tap = click a place name.** `onTapName` reads the label under the tap via
  `map.queryRenderedFeatures` (filters layer ids matching `/label/`), reports the
  name; `AddContextFlow` resolves it through `searchPlaces` and pushes the
  boundary back via `boundary`. Map **pan/drag stays available** (a click ≠ a
  drag); a selected boundary sits in `simple_select` so it can be dragged to move.
- `placesAtPoint` (reverse-geocode) is now **unused** (kept in `places.ts` for now).

⚠️ *tsc clean; full `next build` still blocked locally by the `next/font/google`
fetch (environment). Place tap (click-a-name) + the lifted search bar need live QA.*

**Context interaction redesign — plan + Phase A data model (2026-06-29 pt.13).**
Big reshape of the question→context interaction (questions and contexts become
many-to-many; one question can yield several contexts across lenses, e.g. Gilded
Age → Society + Technology). Decisions: **defer the generative AI** (free-form
learner questions keep the `/api/context-answer` stub; *preloaded tour-guide
questions need no AI* — the "response" is the designer's authored contexts);
**build data model + designer side first**; **fold the mobile place-tap fix into
the learner-flow rebuild**.

Planned phases: **A** data model · **B** designer authoring (tour editor) ·
**C** learner flow (4-lens "What context questions do you have?", preloaded
pulse/lock + Learn more, Add-Context pills one-at-a-time + no X-out, collapsible
Full Explanation, question section w/ thumbnails; mobile tap fix folds in here) ·
**D** wire the real AI.

**Phase A (done, additive — nothing rewired yet):**
- `lib/types.ts`: new `PastLens` alias; new **`ContextQuestion`** (id, afterStopId,
  lens, text, `contextInfo`, media[], thumbnailMediaId) — a designer-posed
  question carrying the context info + optional media. `Act` gains
  **`questions?: ContextQuestion[]`**. `ActContextItem` gains
  **`questionIds?: string[]`** (tags → questions; designer-created auto-tags its
  origin) and its `afterStopId`/`question` are now **deprecated/optional** (legacy
  reads only); `longExplanation` is now the optional/collapsible "Full Explanation".
- `context-journal/types.ts`: new **`TaggedQuestion`** snapshot + optional
  **`ContextEntry.taggedQuestions?`** so a saved context shows "the questions you
  asked" with their info + thumbnail.
- `tour-session.ts`: accessors `getActQuestions`, `questionsAfterStop`,
  `contextsForQuestion`, `questionsForContext`. Old `contextsAfterStop` kept for
  the still-live legacy learner flow.
- tsc clean. **Next: Phase B** — designer authoring UI in the tour editor.

**Phase C learner flow — revised spec (lighten listening, add choice)
(2026-06-30 pt.14).** After advisor feedback the learner context experience is
reworked around *choosing* questions, not passively listening. The learner-facing
view IS the **Context Journal page** (`ContextJournal.tsx`), reached from a new
intro. Full spec to build:

1. **Context intro** (first time the learner hits context on the tour): a screen
   reading "Now that we have learned a bit about this place…\n let's ask about
   some context using the P.A.S.T." with an **"Ask about context"** button → opens
   the Context Journal page.
2. **Context Journal page layout** *(✅ slice done this commit)*: Map + timeline
   **collapse from the top, collapsed by default**; the **P.A.S.T. framework** is
   the main space with **bigger text**; prompt line "Tap on a lens to find the
   question you want to ask, or add your own!".
3. **Lens → question** *(todo)*: tapping a lens opens to show its **question(s)**
   (not a ready-made context card), clearly tappable to select. Tap a question →
   opens the **context overlay**.
4. **Context overlay** *(todo)*: X top-right (X returns to the question form).
   Auto-plays (if autoplay on; else a TTS play button): reads the **Title**, then
   **pauses ~1s**, then reads the **Full Explanation**. Top of overlay shows the
   designer's **map + timeline** for this context; **photos** underneath; the
   **expand-text-to-read-along** button sits **between the map and the photos**.
   *(Photo slideshow = LATER — ⏰ REMINDER: build the photo slideshow for the
   context overlay.)*
5. **Add → thumbnail** *(todo)*: after listening, prompt **"Add Context"**; on add,
   the **thumbnail appears** (photo + title + short explanation) and the **question
   disappears** (saved for them). Re-tapping the thumbnail → **no autoplay**, opens
   the full context overlay **with the asked question visible**.
6. **Across acts** *(todo)*: earlier-act thumbnails keep showing, but **below the
   current act's pre-prepared questions** (prompt new questions first, still see
   prior learning).
7. **Ask your own** *(todo)*: a button beneath the P.A.S.T. → pick a lens → dictate
   or type → AI returns a context in the **human structure** (title, question,
   short explanation, long explanation; **no** photo/map/timeline — the learner is
   asked to add map/timeline, photo optional). AI itself = **Phase D**.

Model note: Phase A already supports this (lens→`ContextQuestion`→`contextsFor
Question`; media/geometry/timeRange live on the context). Designer side (Phase B)
must let the designer author the question + context answer + map/timeline +
optional photos; the AI mirrors that structure minus media/map.

**Mobile tap fix + context moderation (2026-06-29 pt.12).**
- **Place tap on mobile:** finger taps rarely land on the tiny label, so the
  click-a-name `queryRenderedFeatures` box was widened (6→16 px) and now **falls
  back to reverse-geocoding** the tapped point (`placesAtPoint`) when no label is
  hit — so a tap *near* a place still resolves it. (`placesAtPoint` is in use
  again.)
- **View/delete submitted contexts:** new `deleteContextEntry(id)` in the store,
  and a **"Submitted contexts" list** added to `ContextJournalConfig` (admin tour
  editor → "Context Journal" section): live list of every context on the tour
  (thumbnail, title, lens, framing question) with a two-step **Delete**. Deleting
  needs the `context-entries` Firestore rule to allow delete (covered by
  `allow write`).

**Data — `store.ts`.** Collections **`context-entries`** (live `onSnapshot`,
scoped by `placeId`, default `memorial-church`) and **`saved-contexts`**
(bookmarks keyed by an anonymous `provenance-context-viewer-id`; structured so a
real user id drops in later). Photos upload to Storage under
`context-journal/photos/`. Timestamps use `serverTimestamp()`.

> **⚠ Manual step (required):** like every collection in this project, the two
> new collections need their own Firestore console rule blocks
> (`match /context-entries/{id} { allow read, write: if true; }` and the same
> for `saved-contexts`) — until then reads/writes **fail silently** with
> "Missing or insufficient permissions" and the journal stays empty. **No seed
> data** ships; the Add-context flow is the only way to create entries.

**Verification.** `tsc`, `eslint`, and `next build` all pass; `/context-journal`
prerenders. Live structural check at the route confirmed the layout, the map
mounting (controls, attribution, valid token, style 200), the timeline, and the
lenses. Two notes from the automated browser: the map **basemap tiles and Framer
Motion tweens don't paint there because the tab is backgrounded** (`document.hidden`,
so `requestAnimationFrame` is paused — both are rAF-driven); they render normally
on a real device. And the expected "missing permissions" errors confirm the
Firestore rules step above is still pending.
