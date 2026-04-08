# Provenance — Build Guide

*Step-by-step: from prototype to live web app*
*Sean Hu · April 2026*

---

## What you're building

A mobile-friendly web app at a URL like `provenance-app.vercel.app` that shows a Google Map of Stanford campus with history pins. Visitors tap pins to explore guided looks, stories, and memories. Storytellers can add new pins through the prompt tree. No app store needed — it works in any phone browser.

**Tech stack:** Next.js (React framework) + Google Maps JavaScript API + Firebase (database, auth, image storage) + Claude API (storyteller AI assistance) + Vercel (hosting)

**Cost at thesis scale:** $0. Every service has a free tier that covers your needs.

---

## Phase 0: Accounts and tools (do this first, ~30 minutes)

### 0.1 — Install Node.js

You need this to run any JavaScript project locally.

1. Go to https://nodejs.org
2. Download the LTS version (should be 22.x)
3. Install it
4. Open your terminal (Terminal on Mac, Command Prompt or PowerShell on Windows)
5. Verify it works:
```bash
node --version
npm --version
```
Both should print version numbers. If they do, you're good.

### 0.2 — Install Claude Code

This is the AI coding agent that will do most of the heavy lifting.

1. Make sure you have a Claude Pro or Max subscription (check at claude.ai/settings)
2. In your terminal, run:
```bash
npm install -g @anthropic-ai/claude-code
```
3. Verify it works:
```bash
claude --version
```
4. Run `claude` once to authenticate — it will open a browser window for you to log in

For full docs: https://docs.anthropic.com/en/docs/claude-code

### 0.3 — Get a Google Maps API key

1. Go to https://console.cloud.google.com
2. Sign in with your Google account (your Stanford one works)
3. Create a new project — name it "Provenance"
4. Go to APIs & Services → Library
5. Enable these three APIs:
   - Maps JavaScript API
   - Places API (New)
   - Geocoding API
6. Go to APIs & Services → Credentials
7. Click "Create Credentials" → "API Key"
8. Copy the key and save it somewhere safe (you'll need it soon)
9. Optional but recommended: click "Edit API Key" and restrict it to your domains (localhost for now, add your Vercel domain later)

Google gives you $200/month in free Maps API credits. At thesis scale you'll use maybe $2–5 total.

### 0.4 — Set up Firebase

1. Go to https://console.firebase.google.com
2. Click "Create a project" — name it "provenance"
3. Disable Google Analytics (you don't need it for the MVP)
4. Once the project is created, click "Web" (the </> icon) to add a web app
5. Name it "provenance-web"
6. It will show you a config object with apiKey, authDomain, projectId, etc. — copy this entire block and save it
7. In the left sidebar, go to "Build" → "Firestore Database"
8. Click "Create database"
9. Choose "Start in test mode" (this lets anyone read/write — fine for prototyping, lock it down before real users)
10. Choose a location (us-central1 is fine)
11. In the left sidebar, go to "Build" → "Storage"
12. Click "Get started" — accept defaults
13. In the left sidebar, go to "Build" → "Authentication"
14. Click "Get started"
15. Enable "Google" as a sign-in provider (easiest for Stanford users)

### 0.5 — Set up Vercel (for deployment)

1. Go to https://vercel.com and sign up with your GitHub account
2. That's it for now — you'll connect your project later

### 0.6 — Install Git (if you don't have it)

```bash
git --version
```
If this prints a version, you're good. If not, download from https://git-scm.com.

Create a GitHub account at https://github.com if you don't have one.

---

## Phase 1: Scaffold the project (~1 hour with Claude Code)

### 1.1 — Create the Next.js project

In your terminal, navigate to where you want the project to live, then:

```bash
npx create-next-app@latest provenance
```

When it asks questions, choose:
- TypeScript: No (keep it simple for now)
- ESLint: Yes
- Tailwind CSS: Yes (useful for quick styling)
- src/ directory: Yes
- App Router: Yes
- Import alias: Yes (keep the default @/)

Then:
```bash
cd provenance
```

### 1.2 — Install dependencies

```bash
npm install @vis.gl/react-google-maps firebase
```

This gives you the official Google Maps React wrapper and the Firebase SDK.

### 1.3 — Set up environment variables

Create a file called `.env.local` in the project root:

```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key_here
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Replace the placeholder values with the real keys you saved in Phase 0.

### 1.4 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial scaffold"
```

Go to GitHub, create a new repository called "provenance", then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/provenance.git
git push -u origin main
```

### 1.5 — Deploy to Vercel

1. Go to vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. In the "Environment Variables" section, add all the variables from your `.env.local`
5. Click "Deploy"

Within a minute you'll have a live URL. It won't show anything useful yet — just the Next.js default page. But you now have a full deployment pipeline: push code to GitHub → Vercel auto-deploys.

---

## Phase 2: Build with Claude Code (~3–4 sessions)

This is where the real building happens. Open your terminal, navigate to the project folder, and start Claude Code:

```bash
cd provenance
claude
```

### 2.1 — Session 1: Map + seed pins

Copy the brief below into Claude Code. Also share the MVP plan markdown and the prototype files we built (download them from our conversation).

**Starter brief for Claude Code — paste this:**

```
I'm building Provenance, a place-based history exploration app. It's a mobile-friendly
web app built with Next.js, Google Maps, and Firebase.

Here's what I need built first:

1. A full-screen Google Maps view centered on Stanford campus (37.4275, -122.1700, zoom 15)
   using @vis.gl/react-google-maps. The map should fill the viewport on mobile.

2. A Firebase/Firestore integration with a "pins" collection. Each pin document has:
   - title (string)
   - type (enum: "guided", "story", "memory", "request", "observation")
   - description (string)
   - lat, lng (numbers)
   - era (string, e.g. "1900s")
   - contributor: { name, role }
   - tags (array of strings)
   - upvotes: { accurate: number, helpful: number }
   - annotations (array of { x, y, note, question, insight })
   - resources (array of { label, type })
   - createdAt (timestamp)

3. Custom map markers for each pin, styled by type. When tapped, a bottom sheet
   slides up showing the pin detail view.

4. The pin detail view should show:
   - Photo placeholder (we'll add real photos later)
   - Title, contributor, role badge, era tag
   - Description text
   - For "guided" type: a "Start guided exploration" button that activates
     the annotation walkthrough (Flow C from my prototypes — scaffolded
     understanding with question → reveal → building insight)
   - Tags as tappable chips
   - Upvote buttons (accurate / helpful) — just increment the Firestore count
   - "Go deeper" resources section
   - "Add your observation" prompt at the bottom

5. A header with "Provenance" branding and an Explorer/Storyteller mode toggle.
   In Explorer mode, the "Add to map" button is hidden.
   In Storyteller mode, a floating "Add to map" button appears.

6. Mobile-first responsive design. Max width 480px centered on desktop.
   Bottom navigation bar with Map, Search (placeholder), Saved (placeholder),
   Profile (placeholder) tabs.

7. Seed the Firestore database with 5 initial pins around Stanford campus.
   I'll provide the real content later — for now use placeholder text about
   Memorial Church, the Cactus Garden, Rodin Sculpture Garden, Main Quad,
   and Hoover Tower.

The Google Maps API key is in .env.local as NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
Firebase config is also in .env.local.

Start by setting up the Firebase configuration file, then build the map view,
then the pin detail bottom sheet. Make sure everything works on mobile viewport.
```

### 2.2 — Session 2: Storyteller prompt tree

Once the map and pin details are working, start a new Claude Code session:

```
Now I need the Storyteller flow — the prompt tree for creating new pins.

When a user is in Storyteller mode and taps "Add to map", they should enter
a full-screen flow with these phases:

ORIENT: A quick 3-step walkthrough showing what an explorer will experience
from their contribution (question → reveal → building insight). Takes 10 seconds.
Ends with "You don't need to be a teacher. Just tell it like you'd tell a friend."

BUILD (merged tap + describe):
- User sees their photo (camera capture or upload) on the map location
- They tap on the photo to place annotation points
- After each tap, a describe panel opens immediately for that point
- They write what's there and why it matters (text or voice input via
  Web Speech API)
- For point 2+, a "connection check" prompt appears asking how this
  relates to the previous point (optional)
- They can navigate between points, remove points, or tap to add more
- Points show checkmarks when described

CONNECT (AI-assisted shaping):
- The platform reads their notes and generates:
  - A question for explorers at each point
  - A key insight revealed after each question
  - A "big picture" statement connecting everything
  - Suggested sequence with rationale
  - Connections spotted between points
- All suggestions are editable
- For MVP, call the Claude API (/v1/messages endpoint) to generate these
  suggestions from the storyteller's raw notes. The API key should be
  server-side only (use a Next.js API route, not client-side).

PREVIEW: The storyteller experiences their pin as an explorer would —
the Flow C scaffolded understanding format.

On publish, save to the Firestore "pins" collection.

Reference the storyteller_flow_v2.jsx prototype I'm sharing for the
detailed UX. Match that interaction pattern.
```

### 2.3 — Session 3: Polish and seeding tools

```
Final round of features for the MVP:

1. Tag system: tapping a tag on a pin detail view should filter the map
   to show only pins with that tag. Add a tag search/filter UI.

2. Era filtering: add an era selector (pill buttons or dropdown) that
   filters pins on the map by era.

3. Photo upload: when creating a pin, the user should be able to take
   a photo (using the device camera via <input type="file" capture>)
   or upload from gallery. Store images in Firebase Storage. Display
   them in the pin detail view.

4. Photo annotation: on the pin detail view for guided pins, overlay
   numbered dots on the actual photo at the annotation coordinates.
   Tapping a dot triggers the guided exploration flow.

5. Connected pins: after finishing a guided exploration, show nearby
   pins that share tags. Highlight them on the map when the user
   returns to map view.

6. Google sign-in: use Firebase Auth with Google provider so
   storytellers are identified. Explorers can browse without signing in.
   Only signed-in users can switch to Storyteller mode.

7. PWA setup: add a manifest.json and service worker so the app can
   be "installed" on mobile home screens with an icon.
```

---

## Phase 3: Seed content on Stanford campus

Once the app is live and functional:

1. Walk the campus with your phone
2. Open the app in Storyteller mode
3. Start with 5 locations you know well:
   - Memorial Church (guided look — perfect for testing the annotation flow)
   - A building with visible architectural details
   - A spot with a personal/community story
   - Something most people walk past without noticing
   - A place where you have a question you can't answer (to test the request pin type)
4. For each, go through the full prompt tree: photo, annotations, descriptions, let the AI shape it, preview, publish
5. Recruit 3–5 classmates or friends to add their own pins — observe where they get stuck in the storyteller flow

---

## Phase 4: Thesis pilot prep

Once you have ~20 pins with decent geographic density:

1. Recruit 10–15 explorers (people who don't know the campus well — visiting students, new admits, non-Stanford friends)
2. Have them open the app on their phones and walk around campus for 30 minutes
3. Pre/post survey measuring:
   - How many pins they engaged with
   - Whether they completed any guided explorations
   - Self-reported understanding of the places they visited
   - Whether they followed any tag/connection to a second pin
4. Interview 5 of them about the experience
5. Separately, interview your storyteller contributors about the prompt tree experience

---

## File structure you'll end up with

```
provenance/
├── src/
│   ├── app/
│   │   ├── layout.js          # App shell, fonts, metadata
│   │   ├── page.js            # Main map view
│   │   └── api/
│   │       └── shape-pin/
│   │           └── route.js   # Server-side Claude API call for storyteller AI
│   ├── components/
│   │   ├── Map.js             # Google Maps wrapper
│   │   ├── PinMarker.js       # Custom map markers by type
│   │   ├── PinDetail.js       # Bottom sheet pin detail view
│   │   ├── GuidedExploration.js  # Flow C annotation walkthrough
│   │   ├── StorytellerFlow.js    # Full prompt tree
│   │   ├── OrientStep.js         # Storyteller orientation
│   │   ├── BuildStep.js          # Tap + describe merged step
│   │   ├── ConnectStep.js        # AI shaping step
│   │   ├── PreviewStep.js        # Explorer preview
│   │   ├── ModeToggle.js         # Explorer/Storyteller switch
│   │   ├── PhotoAnnotation.js    # Numbered dots on photos
│   │   ├── TagChip.js            # Tappable tag pills
│   │   └── BottomNav.js          # Tab bar
│   ├── lib/
│   │   ├── firebase.js        # Firebase config and initialization
│   │   ├── pins.js            # Firestore read/write helpers
│   │   └── storage.js         # Firebase Storage helpers for photos
│   └── styles/
│       └── globals.css        # Tailwind + custom styles
├── public/
│   ├── manifest.json          # PWA manifest
│   └── icons/                 # App icons for PWA
├── .env.local                 # API keys (never commit this)
├── next.config.js
└── package.json
```

---

## Quick reference: key commands

```bash
# Start development server (localhost:3000)
npm run dev

# Start Claude Code in your project
claude

# Deploy to Vercel (after connecting GitHub)
git add . && git commit -m "description" && git push

# Vercel auto-deploys on every push to main
```

---

## Troubleshooting

**Google Maps shows grey box:** Your API key is wrong or the Maps JavaScript API isn't enabled in Google Cloud Console. Check the browser console for error messages.

**Firebase permission denied:** Your Firestore security rules are too restrictive. For prototyping, go to Firestore → Rules and set:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
Lock this down before any public launch.

**Claude Code can't access the Claude API for the storyteller shaping feature:** You need an Anthropic API key (separate from your Claude.ai subscription). Get one at console.anthropic.com. Add it to `.env.local` as `ANTHROPIC_API_KEY` (without the NEXT_PUBLIC_ prefix — this one stays server-side only).

**Phone camera doesn't open:** Make sure you're accessing the app over HTTPS (Vercel handles this) or localhost. Camera APIs don't work on plain HTTP.

**Vercel deploy fails:** Check the build logs in the Vercel dashboard. Most common issue is a missing environment variable — make sure all your `.env.local` variables are also added in Vercel's project settings.

---

*Download the prototype files from our conversation (Provenance_MVP_Plan.md, situ_prototype.jsx, explorer_flow_iterations.jsx, storyteller_flow_v2.jsx) and keep them in a reference folder. Share them with Claude Code when starting each build session.*
