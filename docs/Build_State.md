# Build State — Memorial Church Tool (Provenance v2)

*Handoff document for the next Claude Code session. Last updated 2026-05-20.
Read this instead of re-discovering the codebase.*

---

## 0. Architecture Overview

Next.js 16.2.3 App Router + TypeScript + Tailwind CSS 4 + Framer Motion.
Firebase Firestore + Firebase Storage. Google Maps. Deepgram (voice input).
Deployed on Vercel, auto-deploys from GitHub master.

**Repo:** `github.com/SeanHu73/memorial-church-tool`

---

## 1. What's Built — Tour System (v2)

The app is now a **tour-based experience**. The old v1 pin-based inquiry
flow (InquirySheet, AskSheet, seed pins) is removed from the learner page.
Tours are authored in `/admin/tours` and played back on the main page.

### Explorer Flow

```
Map (tour pin) → Journal Peek → Intro screens →
  Setting the Scene → Question for you! → Written prompts → [Additional Q] →
  Stop 1: Background+Notice → [Discussion] → Context → [Extra rounds] →
    [Reflect] → What's Next → ... →
  Stop N (final) → Closing Discuss → Closing Written → Final Reflect →
  Any Remaining Questions → Question List → End Card
```

### Key Components

| Component | File | Purpose |
|---|---|---|
| Journal | `src/components/tour/Journal.tsx` | Main tour playback overlay — phases, transitions, footer |
| ProgressBar | `src/components/tour/ProgressBar.tsx` | Stop pills + amber fill bar + swipeable tracker |
| JournalOverlay | `src/components/tour/JournalOverlay.tsx` | Stops/Questions/Theory tabs |
| JournalPeek | `src/components/tour/JournalPeek.tsx` | Bottom sheet on map pin tap |
| SeedCard | `cards/SeedCard.tsx` | Merged Background + Look Around screen |
| WonderCard | `cards/WonderCard.tsx` | "Chance to discuss..." / "What's your opinion?" |
| RevealCard | `cards/RevealCard.tsx` | Context with collapsible text when audio present |
| ReflectCard | `cards/ReflectCard.tsx` | Slider + follow-up chips + What's Next |
| WhatsNext | `cards/WhatsNext.tsx` | Bridge + continue + artefacts |
| BranchCard | `cards/BranchCard.tsx` | Question input (AI disabled, banks all) |
| EqSceneCard | `cards/EqSceneCard.tsx` | "Setting the scene..." with photo/description/audio |
| EqDiscussCard | `cards/EqDiscussCard.tsx` | "Question for you! Please discuss..." |
| EqOpeningCard | `cards/EqOpeningCard.tsx` | Written theory + reasoning prompts |
| EqAdditionalCard | `cards/EqAdditionalCard.tsx` | Optional follow-up discussion/opinion question |
| EqClosingDiscussCard | `cards/EqClosingDiscussCard.tsx` | Closing verbal discussion with audio |
| EqClosingCard | `cards/EqClosingCard.tsx` | Closing written response |
| EqFinalReflectCard | `cards/EqFinalReflectCard.tsx` | Final sliders + chips |
| EqQuestionsCard | `cards/EqQuestionsCard.tsx` | Final questions + question list |
| EndCard | `cards/EndCard.tsx` | Learning arc + explore on your own |
| IntroScreens | `cards/IntroScreens.tsx` | Onboarding intro sequence |
| DetourFlow | `cards/DetourFlow.tsx` | Artefact side-paths |
| AudioButton | `cards/AudioButton.tsx` | Audio player with timeline |
| BackButton | `cards/BackButton.tsx` | Back navigation (olive border) |
| PhotoContent | `cards/PhotoContent.tsx` | Text + [photo:N] markers + fullscreen |
| FormattedText | `cards/FormattedText.tsx` | **bold** *italic* {{color}} rendering |
| FullscreenPhoto | `cards/FullscreenPhoto.tsx` | Portal-based fullscreen with pinch zoom |
| MicButton | `src/components/tour/MicButton.tsx` | Deepgram voice-to-text |
| VoiceInput | `src/components/tour/VoiceInput.tsx` | Standalone voice input (prominent mode) |

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

### Phase Types (TourPhase)

```
intro → eq_scene → eq_discuss → eq_opening → eq_additional →
seed → notice → wonder → reveal → reflect → whats_next → branch →
eq_closing_discuss → eq_closing → eq_final_reflect → eq_questions → end
```

### Transitions

- **Within a stop** (same stopIndex): slide right-to-left, 120ms
- **Between stops** (different stopIndex): fade, 400ms
- Detection: compares `phaseHistory` previous entry's stopIndex

### Visual Design

- Card screens with rounded-2xl corners, shadow-lg, sandstone bg visible around edges
- Background photo: tour-level default + per-stop override
- Card opacity: 70% (most screens) / 85% (context/reveal) with backdrop-blur
- Question boxes: faded cardinal red (#7A1A1A at 56% opacity), amber border (#C4923A, 3px), light text (#FFF8EE)
- Progress bar: sandstone bg with amber pills, amber fill bar
- Footer: Journal button + ? button, olive borders (#7A7A5E)
- Back button: olive border, 2px, matches footer
- Scroll indicator: large arrow, sandstone scrollbar

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

### Tour Editor Structure

Tour metadata: title, subtitle, guide (name/role/initials), description,
cover photo, peek audio, tour-level background photo, map pin location,
essential question (with scene photo/description/audio, opening framing,
theory/reasoning prompts, additional question, closing framing/audio,
final prompts).

Per stop: title, isFinalStop toggle, background photo override,
seed (text/photos/audio/timer), notice (prompt/photos/audio/timer),
discussion question (toggle + discuss/opinion type + photos/audio),
reveal (text/photos/audio with [photo:N] markers), extra rounds
(discussion + context, each toggleable), bridge (toggle + text/photos),
reflection (toggle + slider labels + follow-up type + custom options + photos),
detours/artefacts, map pin (optional), metadata (location tag, entries, topics).

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
| `memorial-church-tour-sessions` | Session persistence (backup) |
| `memorial-church-pins` | Legacy pins (still used by admin) |
| `memorial-church-photos` | Photo library |
| `memorial-church-contributions` | Learner contributions |
| `memorial-church-questions` | Legacy question log |
| `memorial-church-migrations` | Migration receipts |

### Security Rules

All collections: `allow read, write: if true;` (test mode).
Storage: `memorial-church/{allPaths=**}` allow read, write.

---

## 4. Logging

All tour events log to Google Sheets via `/api/log-tour` → `SHEETS_WEBHOOK_URL`.
Uses `navigator.sendBeacon` for mobile reliability.

Events: reflection, question_banked, question_routed, eq_opening, eq_closing,
eq_final_reflect, tour_complete. Each row includes sessionId for grouping.

Apps Script columns (24): Logged At, Timestamp, Session ID, Source, Event/Type,
Tour Title, Stop Title, Stop #, Reflection Score, Follow-Up Response,
Question, Question Routing, Stops Completed, Duration (min),
EQ Initial Theory, EQ Initial Reasoning, EQ Final Reflection,
EQ Final Reasoning, EQ Cognitive Slider, EQ Perceptual Slider,
EQ What Changed, EQ Why Changed, Observation, Answer.

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

---

## 8. Recent Session Work (May 2026)

This session built the complete v2 tour system from scratch:
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

*End of handoff. Latest commit on master: `8d2d75d`.*
