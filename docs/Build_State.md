# Build State — Memorial Church Tool (Provenance v2)

*Handoff document for the next Claude Code session. Last updated 2026-05-20.
Read this instead of re-discovering the codebase.*

---

## 0. Architecture Overview

Next.js 16.2.3 App Router + TypeScript + Tailwind CSS 4 + Framer Motion.
Firebase Firestore + Firebase Storage. Google Maps. Deepgram (voice input).
Deployed on Vercel, auto-deploys from GitHub master.
Two switchable visual themes (Red / Teal) — see §9.

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
| ThemeSwitcher | `src/components/ThemeSwitcher.tsx` | Red/Teal toggle on the map (§9) |

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

*Colours, fonts, and corner radii are theme-driven — see §9. The hex
values below describe the original Ledger-era look; the live values
come from `--th-*` tokens and change with the active theme.*

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
- **Theming**: `layout.tsx` wraps the app in `ThemeProvider` and runs a pre-paint inline script that sets `data-theme` on `<html>`. Admin pages are not in theme scope — see §9.

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

### Theme system — Red & Teal (this session, 2026-05-20)

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

---

## 9. Theme System

Two switchable visual themes, added 2026-05-20. Toggled via a
**ThemeSwitcher** at the top-right of the map. Only colours, fonts,
and corner radii change — all functional structure (cards, frosted
glass, transitions, background photos, progress bar) is shared.

### Themes

| | Red (default) | Teal |
|---|---|---|
| Persona | 1970s New Journalism | 1950s Mid-Century |
| Title font (serif) | DM Serif Display | Cormorant Garamond |
| Content font | Newsreader (shared) | Newsreader (shared) |
| Primary (dominant accent) | #8B2538 cranberry | #3A8D89 teal |
| Secondary accent | #B8752B amber | #A73848 cranberry |
| Corner radius | softer (lg 1rem / 2xl 1.25rem) | crisper (lg .65rem / 2xl .9rem) |

Each theme is named for its dominant accent. The dominant colour drives
buttons, the progress bar, headings, map pins, and the title/footer bars
(`--th-primary`); the secondary accent appears on essential-question box
borders etc. Content text uses one shared, highly legible serif
(Newsreader) in both themes; only titles take the per-theme display serif.

Source style guides: `docs/Style_Guide_Ledger.md` → Red theme,
`docs/Style_Guide_Folio.md` → Teal theme (screenshots:
`docs/Style Guide - Red.png` / `Style Guide - Teal.png`).

### How it works

- `globals.css` defines a `--th-*` token layer in two blocks:
  `:root, [data-theme='red']` and `[data-theme='teal']`. Switching
  the `data-theme` attribute on `<html>` re-resolves every token
  instantly — no reload.
- Fonts are loaded with `next/font/google` in `layout.tsx` (self-hosted,
  no external request). Content/body text uses **Newsreader** in both themes
  (`--th-font-body`, reached via the `font-serif`/`font-sans` utilities
  and `body`); titles use the per-theme serif (`--th-font-display`, via
  the `font-display` utility). (An earlier CSS `@import url()` was
  dropped — Tailwind v4's build strips external font imports.)
- Legacy palette names (`--sandstone`, `--aged-gold`, etc.) plus four
  new ones (`--olive`, `--accent-dark`, `--journal`, `--question-red`)
  are aliased onto `--th-*` and exposed as Tailwind tokens via
  `@theme inline`. Colour utilities, `font-serif`/`font-sans`, and
  `rounded-lg/xl/2xl` all flow through these.
- `ThemeContext.tsx` holds the active theme, persists it to
  `localStorage` (`provenance-theme`), and mirrors it to `<html>`.
- An inline script in `layout.tsx` applies the stored theme before
  first paint to avoid a flash of the default theme.

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

*End of handoff. The theme system (§9) is live on `master`.*
