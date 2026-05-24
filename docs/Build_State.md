# Build State — Provenance

*Handoff document for the next Claude Code session. Last updated 2026-05-23
(later in the day — see §8 final entry).
Read this instead of re-discovering the codebase.*

---

## 0. Architecture Overview

Next.js 16.2.3 App Router + TypeScript + Tailwind CSS 4 + Framer Motion.
Firebase Firestore + Firebase Storage. Google Maps. Deepgram (voice input).
Deployed on Vercel, auto-deploys from GitHub master.
Two switchable visual themes (Red / Teal) — see §9.

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
| EqClosingCard | `cards/EqClosingCard.tsx` | Combined closing arc (header + framing/audio + restated question + opening echo + midway echo + "Where are you now?" prompts). Replaces the old discuss→written two-step. |
| EqFinalReflectCard | `cards/EqFinalReflectCard.tsx` | Final sliders + chips |
| EqQuestionsCard | `cards/EqQuestionsCard.tsx` | Final questions + question list |
| EndCard | `cards/EndCard.tsx` | Learning arc + explore on your own |
| IntroScreens | `cards/IntroScreens.tsx` | Onboarding sequence (5 screens, ? cue arrow, phone-setup choice) |
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
intro → meet_guide → eq_scene → eq_discuss → eq_opening → eq_additional →
seed → notice → wonder → reveal → reflect → whats_next → branch → off_path →
eq_closing_discuss → eq_closing → eq_final_reflect → eq_questions →
guide_outro → end
```

`meet_guide` and `guide_outro` are the optional guide bookends — shown
only when the tour's guide has the relevant content (see §8).

Plus two unstructured-mode phases: `unstructured_map` (the stop-picker
overlay) and `midway_checkin` (the optional halfway prompt). Both are
rendered by `page.tsx` outside the `Journal` overlay — see §10.

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
| `memorial-church-tour-sessions` | Session persistence (backup) — `TourSession` now also carries `completionOrder`, `midwayShownAt`, `midwayResponseText` for unstructured tours |
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
eq_final_reflect, stop_entered, tour_complete. Each row includes sessionId
for grouping.

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
- **CSS token names**: only `--th-primary`, `--th-secondary`, `--th-surface`, `--th-border` etc. exist as `--th-*`. Palette aliases like `--aged-gold`, `--text-primary`, `--text-secondary` live in `:root` *without* the `--th-` prefix. `var(--th-aged-gold)` resolves to nothing (caused transparent progress pills once).
- **`animate-ping` / `animate-bounce` + `transform`**: these Tailwind keyframes animate `transform`, clobbering any inline `transform` (e.g. `translate(...)`) on the *same* element. Put positioning transforms on a wrapper div and the animation class on an inner child (see the selected-pin ring in `Map.tsx` and the onboarding `?` cue arrow).
- **Google Maps `mapId` + vector rendering**: the map uses `mapId="b8f339c02d8c7d5bd3f12d1b"` (Cloud Console). This is required for `AdvancedMarker` in `@vis.gl/react-google-maps` 1.8.3 — removing it breaks the map. However, `mapId` forces vector rendering, which silently ignores both the `styles` prop and `map.setOptions({styles})` at runtime. POI / transit pin hiding **must** be configured via Google Cloud Console → Map Styles linked to the map ID. A `PoiStyler` component exists in `Map.tsx` but is a no-op with the current setup.
- **`panTo()` range limit**: Google Maps only animates `panTo()` smoothly when the destination is within roughly one screen's width/height. For larger distances it jumps immediately. The fly animation therefore uses a `requestAnimationFrame` loop with `setCenter()` each frame for phase 1 (pan), and `setZoom()` each frame for phase 3 (zoom out). See `MapFlyer` in `Map.tsx`.
- **`isFinalStop`** only governs linear tours. In unstructured mode `advanceToNextStopUnstructured` ignores it; the final stop is whichever logical stop the explorer completes last. Code that branches on `isFinalStop` must also check `!tour.unstructuredMode`.
- **Logical stops**: in unstructured mode count `getLogicalStops(tour)` (standalone stops + the leader of each merge group), not `tour.stops.length`. `completionOrder` holds *logical* stop IDs and is populated only when a stop is completed.

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

*End of handoff. The unstructured exploration mode (§10), theme
system (§9), and the parallel `unstructuredStops` authoring path are
all live on `master`.*
