# Provenance — MVP Plan

*Sean Hu · LDT Project · Stanford*
*Last updated: April 2026 · Living document*

**Status Key:** **[BUILD FIRST]** = MVP core · **[PHASE 2]** = add after core works · **[PHASE 3]** = long-term vision · **[HONEST PROBLEM]** = needs resolution before building

---

## The Pivot in One Sentence

Provenance is no longer a classroom tool for students learning archival skills. It is a **place-based history platform where locals contribute contextual knowledge about the places around them, and travellers consume that knowledge while physically present** — with the map as the primary interface and the phone as a lens into the historical layers of a place.

---

## What Survives the Pivot

Not everything from the original design transfers. Here is what carries over and what gets dropped or transformed.

**Carries over directly:**
- The foundational design principle — technology directs attention outward, not toward the screen
- Photo annotation as a documentation method
- The insight that personal/community connection is the strongest motivator for engaging with history
- The "access problem is solved; the engagement problem is not" framing
- The need for active facilitation, not passive platforms (from your interview research)
- Place-based, mobile-first design

**Transforms significantly:**
- DIG lenses → a lighter contribution scaffold (the prompt tree). The full four-lens academic workflow is too heavy for casual local contributors. The pedagogical rigour needs to be embedded in the scaffold's design, not imposed as a visible framework
- Teacher/facilitator agency → community organisation and local expert agency. Same concept (giving power to the people who shape investigations), different user
- Archiving Challenges → contribution prompts and calls for local knowledge. Same mechanism, reframed for a non-academic audience
- Peer corroboration → community verification and the voting/reputation system
- Narrative Threads → the connection/tagging system (#/@ linking between pins, topic pages, and architectural styles)

**Gets dropped (for now):**
- The explicit DIG lens labels (sourcing, close reading, contextualisation, corroboration). The thinking behind them should inform the prompt tree, but exposing the academic framework to casual contributors will kill engagement
- The sequential unlock / levelling mechanic
- The "supports / complicates / surprises" evidence log
- Knowledge Building Community in the Scardamalia & Bereiter sense. Too academic for this audience at this stage

---

## Honest Assessment: What Works and What Probably Doesn't

### What works about this pivot

**1. The traveller use case is immediately legible.** "I'm standing in front of this building and I want to know its story — from someone who actually lives here, not a Wikipedia page" is a desire everyone has felt. You don't need to explain it. The original Provenance required explaining what historical thinking skills are and why you should care. This version doesn't.

**2. The two-sided value proposition is genuine.** Locals want their stories told and preserved. Travellers want stories that guidebooks miss. This is a real exchange of value, not a pedagogical intervention disguised as a product.

**3. Clio validates the demand but leaves room.** Clio (theclio.com) is the closest existing product — a free, crowdsourced, geo-located history platform with 35,000+ entries and 1,000+ walking tours. It proves the market exists. But Clio's contributions are essentially encyclopedia entries written by academics and students. They read like textbook summaries. There is no conversational layer, no local voice, no mechanism for a grandmother to share what she remembers about the corner store. Clio is scholarly; Provenance should be personal.

**4. Your interview research still applies.** Marie's insight that "the secret sauce is relationship" and John's HistoryPin finding that "the digital is just the remnant of what is happening in the actual world" are even more relevant in a traveller-facing product. The platform needs to feel like overhearing a local who knows things, not reading a plaque.

**5. Google Maps integration is technically viable and strategically smart.** The Maps JavaScript API supports custom markers, info windows, custom styling, and geolocation — everything you need. Building on Google Maps rather than building your own map means users start with a familiar interface and you skip enormous infrastructure costs. More on this below.

### What probably doesn't work (or needs serious rethinking)

**1. The cold start problem is severe.** A map with no pins is useless. A traveller opens the app in a new city and sees nothing — they leave and never return. Clio solved this over a decade by partnering with hundreds of universities. HistoryPin got to 200,000+ assets through institutional partnerships. You cannot launch a map-based product without content. **This is the single biggest risk to the entire project.**

Possible mitigations:
- Seed one city (San Francisco?) deeply before expanding. 50–100 high-quality pins in one neighbourhood is better than 10 pins scattered across a country
- Partner with SeeStories (Marie), SFHistory (Beth), and the Santa Clara County Historical Commission to pre-populate with existing stories
- Consider whether you can ingest and re-present existing open datasets (historical markers databases, Wikipedia geolocated articles) as a base layer that community contributions enrich. This is what Clio did — started with existing historical marker data and built on top
- Your thesis pilot with Stanford students could serve double duty: they contribute the seed content while you study their experience

**2. "Contribution from locals" sounds easy but is operationally hard.** Your own interview research proves this. John (HistoryPin): only ~125 power users return consistently out of 4,000 contributing organisations. Marie (SeeStories): "community members won't self-initiate contribution; someone has to go out and collect their stories." Charlotte (Stanford Historical Society): engaged members skew older and are already history enthusiasts. Building a product that depends on a steady stream of community contributions means you need a contributor acquisition strategy that is at least as developed as your product strategy. For the MVP, don't count on organic contributions. Actively recruit and support a small group of seed contributors.

**3. The prompt tree is a strong idea but the execution is everything.** The concept — a guided flow where answering one question triggers the next — is sound. It avoids the wall-of-fields problem and can embed historical thinking without labelling it. But the questions need to feel like a conversation, not an interrogation. And the tree needs to accommodate wildly different contribution types: a 70-year-old sharing a memory about a demolished building is a completely different flow from a history teacher documenting a civil rights landmark. One size will not fit all. You'll need at minimum 2–3 prompt templates for different contribution types (personal memory, historical documentation, architectural observation, etc.).

**4. Voice-to-text as a contribution method is promising but fragile.** The idea of letting people narrate rather than type is exactly right for the audience (especially older community members). But speech-to-text quality varies enormously, the output needs editing, and the synthesised result needs to feel polished, not like a raw transcript. For the MVP, I'd recommend supporting voice input but having the contributor review and edit the transcribed text before publishing. Fully automated "narrate and publish" is Phase 3.

**5. The connection/tagging system (#/@/topic pages) is the most conceptually exciting feature — and the hardest to build well.** Connecting a pin on Memorial Church to a topic page on Mission Revival architecture which then links to other buildings in the style is exactly what makes this more than "Yelp for history." But this kind of relational knowledge graph requires either heavy manual curation or genuinely good AI-assisted linking. Neither is simple. For MVP, implement manual tagging only (contributor adds tags like "Mission Revival" or "1906 Earthquake") and defer algorithmic connection-surfacing to Phase 2.

**6. The voting/reputation system needs careful design to avoid toxic dynamics.** Stack Overflow's model works because code either runs or it doesn't — there's a ground truth. Historical interpretation is inherently contested. A "downvote" on someone's grandmother's memory of a neighbourhood feels different from a downvote on an incorrect code snippet. Consider: upvotes only (no downvotes), separate "helpful" and "accurate" ratings, and a flag-for-review system rather than community punishment. The traveller/local split in voting is smart — a local saying "this is accurate" carries different weight from a traveller saying "this was interesting."

**7. Geo-based notifications are table stakes for engagement but a consent minefield.** Push notifications when near a pin are standard in location-based apps (Clio is adding them, Autio uses them). They work. But they require always-on location tracking, which many users won't grant. Implement as opt-in with clear value proposition: "Turn on discovery mode to get notified when you're near a story." Don't make it the default.

---

## Competitive Positioning

| | **Clio** | **HistoryPin** | **Humap** | **Autio/VoiceMap** | **Provenance** |
|---|---|---|---|---|---|
| **Content source** | Academics, students, institutions | Institutions, some public | Institutions (managed projects) | Professional storytellers | Locals, community orgs, students |
| **Content tone** | Encyclopedic | Archival (photo + caption) | Scholarly/curatorial | Polished audio narrative | Conversational, personal |
| **Mobile-first** | Yes (app) | Web (app discontinued) | Web | Yes (app) | Yes |
| **Geo-triggered** | Basic | Map-based browse | Map-based browse | GPS-triggered audio | Geo-notifications + map browse |
| **Contribution scaffold** | Structured form | Minimal (pin + caption) | CMS (requires training) | Professional production | Guided prompt tree |
| **Content connections** | Links to books/articles | None between entries | Collections/trails | Linear tour sequence | Tag-based knowledge graph |
| **Community layer** | Moderated comments | Discussion (limited) | None for public | None | Upvotes, replies, verification |
| **Cost** | Free (nonprofit) | Institutional licensing | Institutional licensing | $5–15/tour | Free (or freemium TBD) |
| **Differentiator** | Breadth (35K entries) | Historical photo overlay | Heritage project infrastructure | Production quality | Local voice + contextual connections |

**Your one-line positioning:** Clio tells you what happened here. Provenance lets the people who were here tell you why it mattered.

---

## Deep Dive: What Clio Gets Right and Wrong

Clio (theclio.com) is your closest competitor and the most instructive case study. It has a 4.9 rating on the iOS App Store — but only 101 reviews, which signals a small, self-selected user base of enthusiasts rather than mainstream adoption. A historian's detailed review (Sean Morey Smith, Yale) and the app's update history reveal more than the star rating does.

**What Clio gets right:**
- The core promise — "discover history near you" — is immediately understood and genuinely useful
- GPS-based discovery works: users report serendipitous encounters with history they didn't know was around them
- The walking tour feature is the most praised element. Users love structured routes through historical sites
- Free and nonprofit positioning builds trust and lowers the barrier to entry
- Institutional contributor model (universities, historical societies) produces reliable, sourced content
- One reviewer captured the core appeal perfectly: the app changed how they see buildings they walk past every day

**What Clio gets wrong — and where your opportunity lives:**

*1. Information delivery, not exploration.* Clio entries read like encyclopedia articles. They tell you what happened, when, and who was involved — but they don't help you *see* the place differently. There's no mechanism for directing your gaze ("look at the cornerstone — see the date?"), no annotation on images, no guided observation. The content could be read from a couch. Your platform should be unusable from a couch — it should only make sense when you're standing there.

*2. No contextual connections between entries.* Each Clio entry exists in isolation. There's no way to see how one site relates to another, no thematic threading, no era-based filtering. If you're looking at a Mission Revival building, Clio won't tell you about the three other Mission Revival buildings within walking distance, or link you to a broader page on the architectural movement. This is the single biggest gap and your strongest differentiator.

*3. The UX is cluttered and unintuitive.* The historian review documents: search results limited to 10 items with no pagination, "Search Here" button that inexplicably jumps to Manhattan, walking tours page that doesn't default to local results, and the Android app crashing repeatedly. The version history shows mostly "bug fixes" with infrequent feature updates (roughly quarterly). The app is essentially a web wrapper, not a purpose-built mobile experience.

*4. Passive consumption only.* There's no mechanism for a visitor to ask a question, request more information, or contribute their own observation. It's a one-way broadcast from experts to the public. The "modified crowdsourcing" model means all contributions go through academic gatekeepers — good for accuracy, bad for local voice and timeliness.

*5. No temporal dimension.* You can't filter by era, see how a place changed over time, or understand where something sits in a historical arc. Everything is presented as a flat, timeless entry. Your "era" feature addresses this directly.

*6. No storytelling structure.* Entries are informational blobs. There's no narrative arc, no guided sequence of observations, no questions posed to the reader. Compare this to your idea of annotation-based storytelling where a contributor walks you through a photo point by point, asking questions along the way.

**The takeaway for your design:** Clio proves the demand and validates the geo-located history format. But it stops at information delivery. Your platform should start where Clio stops — at understanding, connection, and guided observation.

---

## Key Design Evolution: The Explanation Tree

Your insight about scaffolding the *explorer* experience — not just the contributor experience — is a significant design advance from the previous version of the MVP plan. This deserves its own section because it changes the core product.

**The idea:** Contributors don't just upload information — they build a guided exploration experience. Each pin isn't a static entry; it's a structured walk-through that directs attention, asks questions, and connects to other pins.

**How it works in practice:**

A contributor documenting Stanford Memorial Church doesn't write a paragraph about it. Instead, they create an annotated photo sequence:

1. *Photo of the full facade.* Annotation pin on the mosaic → "Before you read about it, look at the mosaic above the entrance. What do you notice about the colours? Do they look uniform, or can you spot areas that seem newer?" (This is close reading, embedded invisibly.)
2. *User responds or reflects, then taps to continue.*
3. *Annotation pin on the cornerstone* → "Now look down and to the right. The cornerstone tells you when this version of the building was completed. Given that Stanford was founded in 1891, what does a 1903 date suggest?" (This is contextualisation as a question, not a lecture.)
4. *Annotation pin linking outward* → "The architectural style here is called Mission Revival. Tap to see three other buildings within a mile that share this style — can you spot the common features?" (This is the connection system in action.)

**What this changes about the product:**
- The pin is no longer a static entry. It's a **guided micro-experience** — closer to a short interactive tour than a plaque
- The contributor becomes a guide, not just an informant. This is a higher bar, but the prompt tree scaffolds it
- The explorer is active, not passive. They're asked to look, think, and respond — not just read
- Every pin naturally points outward to other pins through the connection/question structure

**The Claude-inspired "build your own question" element:** At the end of a guided pin exploration, the explorer could be prompted: "Is there something else you noticed that the contributor didn't mention? Add your own observation." This turns consumption into contribution. The best explorer observations could become new annotation points on the same photo, credited to the explorer. This is the lightest possible contribution pathway — you're already looking at the thing, you just add one sentence.

**Honest concern:** This makes the contributor's job significantly harder. Creating a guided exploration with questions and connections takes more thought than writing a paragraph. The prompt tree needs to be exceptionally smooth — almost like having a conversation with someone who helps you structure your knowledge. More on this in the revised prompt tree section below.

---

## The Era/Timeline Dimension

Your instinct about temporal context is important. A building isn't just a point on a map — it's a point on a timeline. The era feature should work like this:

**For contributors:** When creating a pin, they tag it with a time period. This could be a specific year, a decade, or a named era (e.g., "Gold Rush Era," "Post-1906 Earthquake Rebuilding," "Civil Rights Movement"). The system offers both a date picker and named-era suggestions based on what other contributors in the area have used.

**For explorers:** A timeline slider on the map lets you filter pins by era. Slide to "1900–1920" and see only the pins from that period. This makes temporal patterns visible — you can literally watch a neighbourhood change across decades.

**For connections:** Era becomes a connection dimension alongside tags and geography. Two pins in different locations but the same era might be linked: "This building was constructed the same year as [other pin] — both were part of the post-earthquake rebuilding boom."

**MVP scope:** Start with contributor-applied era tags and basic filtering. The timeline slider visualisation is Phase 2. Named-era topic pages (like tag topic pages) are Phase 2.

---

## Directing Attention to Local Resources

Your instinct to point people toward libraries, museums, guides, and books is exactly right — and it connects to your original design principle of directing attention outward. The platform shouldn't try to be the complete source of knowledge. It should be the *entry point* that sends people deeper.

**How to implement:**
- Every pin can include a "Go Deeper" section where contributors link to local resources: a museum that covers the topic, a book that tells the full story, an archive where original documents live, a walking tour offered by the local historical society
- Topic pages should have a curated "Resources" section
- When an explorer finishes a guided pin exploration, the closing prompt could be: "Want to learn more? The [Local History Museum] has an exhibit on this topic, and [Book Title] by [Author] covers the full story"

This also solves a strategic problem: it positions your platform as complementary to existing institutions rather than competitive with them. Libraries and museums become allies, not threatened parties. They might even contribute pins that direct people to their own collections — a genuine value exchange.

---

## Revised Prompt Tree (Contributor Flow v2)

The prompt tree needs to accommodate the new "guided exploration" format. Here's the revised flow:

**Step 1: What are you sharing?**
- "A story about this place"
- "Something I noticed here" (observation)
- "A personal memory"
- "A guided look at this place" ← NEW: the full explanation-tree format
- "I have a question about this place" (request mode)
- "Write your own" ← NEW: the Claude-inspired freeform option, for when none of the above fit

**Step 2: Anchoring (all paths)**
- Take or upload photos (multiple allowed)
- Confirm/adjust pin location
- Give it a title
- Tag an era (date, decade, or named period)

**Step 3: Guided prompts (branching by type)**

*For "A guided look at this place" (the explanation tree — your flagship contribution type):*
1. "Upload your best photo of this place"
2. "Tap on the first thing you want visitors to notice" → annotation pin
3. "What should they look for here? Write what you'd say if you were standing next to them" → text or voice
4. "Now ask them a question about what they're seeing" → text (this is the pedagogical core — contributors learn to prompt thinking, not just deliver information)
5. "Want to add another point of interest on this photo?" → loop back to step 2, or continue
6. "Does this connect to anywhere else nearby? Tag another pin or create a link" → connection interface
7. "Is there a place visitors should go to learn more? (A museum, library, book, website)" → resource links
8. "Add tags to help connect this to related stories" → tag input with suggestions

*For all other types:* same as previous MVP plan, but with era tagging added at step 2 and a "Go Deeper / Resources" prompt added at the end.

**The "Write your own" path:** The contributor sees a minimal form — photo, location, title, and a single open text box — with a gentle prompt: "Tell us about this place in whatever way feels right to you. You can always add annotations, connections, and questions later." This catches edge cases and reduces the "none of these options fit" abandonment.

---

## Platform Name Workshop

The name needs to work for both audiences (explorers and storytellers), evoke place and discovery, and not be already taken by a major product. Here are options across several directions:

**Direction 1: Place and seeing**
- **Situ** — from "in situ" (in its original place). Short, memorable, works as a verb ("I Situ'd that building"). Risk: might sound too academic
- **Locus** — Latin for "place." Clean, simple. Risk: used by some other apps (Locus Map, a hiking GPS app)
- **Vantage** — a point of view, a place from which to see. Implies perspective, which is what the platform provides. "Check the Vantage on this building"
- **Siteline** — a line of sight to a place's story. Play on "sight line." Clean, evocative

**Direction 2: Layers and depth**
- **Palimpsest** — a manuscript where old writing shows through new layers. Perfect metaphor for places where history shows through the present. Risk: hard to spell, hard to say, too academic
- **Strata** — geological layers. Implies depth, time, and the idea that every place has layers of meaning beneath the surface
- **Underlayer** — what's beneath the surface of a place. Conversational, accessible
- **Sediment** — what accumulates over time. Interesting but might sound negative

**Direction 3: Discovery and exploration**
- **Fieldwork** — what you do when you go out and look at the world. Accessible, active, implies learning by doing
- **Drift** — from the Situationist concept of the *dérive* — an unplanned journey through a landscape, guided by curiosity. Evocative but vague
- **Wayfind** — finding your way through a place's stories. Active, clear
- **Groundwork** — the foundational work of understanding a place. Also implies being on the ground, physically present

**Direction 4: Voice and story**
- **Hearsay** — what you hear from people who were there. Playful, implies oral tradition and local knowledge. Risk: legal connotation ("hearsay evidence"), might suggest unreliability
- **Earshot** — within hearing distance. Implies the intimacy of local knowledge, being close enough to hear the story. "I found this on Earshot"
- **Told** — simple, direct. "The stories this place has told." Risk: too simple, hard to search for
- **Footnote** — the hidden context beneath the main text. Every place has footnotes. Playful, academic-but-accessible

**Direction 5: Keeping "Provenance" or evolving it**
- **Provenance** — still works. It means the history of ownership and origin of an object or place. It's a real word that educated travellers would recognise. Risk: slightly formal, might not signal "community" or "local voice"
- **Provenances** — pluralising it emphasises that every place has multiple origins and stories, not just one official history
- **Prov** — shortened, more casual. "Check the Prov on this"

**My top 3 recommendations:**
1. **Situ** — shortest, most memorable, works in conversation, directly evokes place-based learning
2. **Vantage** — clearest metaphor for what the platform provides (a perspective on a place), works for both explorers and contributors
3. **Strata** — best metaphor for the layered, temporal, contextual design of the platform (eras, connections, depth). "Peel back the Strata" as a tagline

**Keep "Provenance" if:** you want to signal rigour and authenticity to institutional partners and academic audiences. It's a strong word. But it doesn't immediately say "explore" or "discover" to a casual traveller.

---

## The MVP: What to Build First

### Core Architecture Decision: Build on Google Maps

**Recommendation: Use the Google Maps JavaScript API as your map layer, not build your own.**

Reasons: Users already know how to navigate Google Maps. The API supports custom markers, info windows, clustering, and custom styling. The free tier (10,000 calls/month for most SKUs) is sufficient for MVP scale. The Maps SDK for Android/iOS handles mobile natively. You skip months of map infrastructure work. The Places API can auto-populate location data (addresses, photos, place types) when contributors pin a location.

You cannot build the platform "on" Google Maps in the sense of it living inside the Google Maps app — Google doesn't allow that kind of embedding. But you build a web app (progressive web app for mobile) that uses Google Maps as its map layer. To users, it will feel like Google Maps with a history layer on top.

**Alternative worth noting:** Mapbox offers more visual customisation and is popular with design-forward startups. It's more work to set up but gives you historical map overlays more easily than Google Maps. If the aesthetic of layering old maps over modern ones matters to you (it matters to Humap), consider Mapbox. For MVP, Google Maps is faster to ship.

---

### [BUILD FIRST] Feature 1: The Map (Explorer View)

The primary interface. A traveller opens the app and sees a map populated with pins. Each pin represents a contributed story, observation, or documented place.

**Pin types (visually distinct on map):**
- **Place story** — a contributed narrative about a specific location (building, corner, park, monument)
- **Memory** — a personal recollection attached to a place ("my grandfather's shop was here")
- **Observation** — a documented architectural, historical, or cultural detail with photo annotation
- **Request** — a traveller's "I'm looking at this, can anyone tell me about it?" pin (this is the "request explanations from locals" feature)

**Pin detail view includes:**
- Title, contributor name and role (local / historian / organisation / visitor)
- Photos (with annotation layer if annotations exist)
- The contribution text (output of the prompt tree)
- Tags linking to other pins and topic pages
- Upvote counts (separated: "locals found this accurate" / "travellers found this helpful")
- Related pins (nearby + same tags)

**Filtering:**
- By type (stories, memories, observations, requests)
- By era (if tagged with a time period)
- By theme/tag
- By contributor type (local, organisation, historian)

**MVP scope:** Web-based progressive web app. Works on mobile browsers. Native app is Phase 2.

---

### [BUILD FIRST] Feature 2: The Prompt Tree (Contributor Flow)

See the **Revised Prompt Tree (Contributor Flow v2)** section above for the full flow. The key changes from the original plan:

- The flagship contribution type is now "A guided look at this place" — a structured, annotation-based exploration experience that contributors build for explorers
- All contribution types include era tagging and a "Go Deeper / Resources" prompt
- A "Write your own" freeform option catches edge cases (the Claude-inspired element you liked)
- Voice input available on every text field
- One question per screen, progress indicator, "Skip" on optional fields
- The minimum viable contribution remains: pin + photo + one sentence. Everything else enriches

**The pedagogical core lives in one specific prompt:** "Now ask them a question about what they're seeing." This single moment — where a contributor is coached to pose a question rather than deliver a fact — is where historical thinking gets embedded without being labelled. It transforms the contributor from information provider to guide. It transforms the explorer from reader to thinker. It's the most important UX element in the entire platform.

---

### [BUILD FIRST] Feature 3: Photo Annotation

Contributors (and later, other users) can tap on regions of an uploaded photo to attach notes. This is crucial for the "direct attention outward" principle — annotations tell the traveller exactly where to look when they're standing in front of the thing.

**MVP implementation:**
- Tap on photo → place a numbered pin → type or speak a note
- Annotations display as numbered dots on the photo; tapping a dot reveals the note
- Mobile-optimised: pinch-to-zoom on the photo, then tap to annotate
- Keep it simple: dots + text. Circles, highlights, and freehand drawing are Phase 2

**Tech options to explore:** Annotorious (open source, designed for this), or a lightweight custom implementation with canvas overlay. Annotorious has IIIF support which could matter later if you integrate with institutional archives.

---

### [BUILD FIRST] Feature 4: Tags and Connections

The tagging system is what makes Provenance more than a pin board. Tags connect individual pins to each other and to topic pages.

**How it works:**
- Contributors add tags during the prompt tree (with auto-suggestions based on existing tags in the area)
- Tags link to topic pages. If a tag has no topic page yet, it exists as a bare tag. Once enough pins share a tag, a topic page can be created
- Topic pages are short wiki-like entries: a paragraph or two explaining the theme (e.g., "Mission Revival Architecture," "1906 Earthquake," "Japantown Displacement"), plus a map view showing all pins with that tag
- Pins can also @-mention other specific pins ("See also: the cornerstone inscription at @First-Baptist-Church")

**MVP scope:**
- Manual tagging by contributors with auto-complete suggestions
- Topic pages created manually (by you, by community org partners, or by high-reputation contributors)
- Simple "related pins" display: other pins within 500m that share at least one tag
- No algorithmic connection surfacing yet — that's Phase 2

**Why this matters:** A traveller looking at Memorial Church sees a pin about the mosaics. That pin is tagged "Mission Revival" and "Leland Stanford." Tapping "Mission Revival" takes them to a topic page that explains the style and shows a map of other Mission Revival buildings in the Bay Area. They've gone from one building to an architectural movement to a regional pattern. That's contextual learning — and it's what no competitor does well.

---

### [BUILD FIRST] Feature 5: Upvotes and Basic Community Trust

**Upvote system:**
- Two separate upvote types displayed on every contribution: "Accurate" (intended for locals/experts who can verify) and "Helpful" (intended for travellers who found it useful)
- Any user can give either type, but the display groups them: "12 locals found this accurate · 47 travellers found this helpful"
- No downvotes. If something is inaccurate, users can flag it for review or post a reply/correction
- Flagging triggers a review queue (initially managed by you; later by community moderators)

**Contributor profiles:**
- Display name, self-identified role (local resident, historian, student, organisation, visitor)
- Contribution count and total upvotes received
- Location (neighbourhood/city level, not specific)
- No formal verification at MVP stage. "Verified local" badges are Phase 2

---

## [PHASE 2] Features to Add After Core Works

### 2a. Geo-Based Discovery Mode
Opt-in push notifications when within range of a pin. "You're 50m from a story about the 1906 earthquake. Want to hear it?" Requires native app (not achievable in PWA alone without significant limitations).

### 2b. Topic Pages as a Community-Editable Layer
Allow high-reputation contributors or partner organisations to create and edit topic pages. Add an editorial workflow: draft → review → publish.

### 2c. Curated Trails / Walking Routes
Let organisations or experienced contributors assemble pins into a walking sequence with suggested routes. This is where you compete with VoiceMap/WalknTours, but with crowdsourced rather than professional content.

### 2d. Audio Contributions
Contributors record audio stories (2–3 minutes). Auto-transcribed with review. Travellers can listen while walking. This is the most natural format for personal memories and the strongest "direct attention outward" medium — audio lets you keep the phone in your pocket.

### 2e. Algorithmic Connection Surfacing
"You're looking at this pin — you might also be interested in these 3 related pins." Based on tag overlap, geographic proximity, temporal overlap, and user behaviour patterns.

### 2f. Organisation Dashboards
Partner organisations (historical societies, schools, museums) get a dashboard to manage their contributions, issue "calls for stories" about specific themes or locations, and see engagement analytics.

### 2g. Historical Map Overlays
Layer historical maps (Sanborn fire insurance maps, old city plans) under the modern Google Maps layer so users can see what was here before. This is Humap's strongest feature — you don't need to build it at MVP but it's a powerful addition.

### 2h. Verified Contributor Badges
"Verified Local," "Historian," "Community Organisation" badges with a lightweight verification process (e.g., link to professional profile, organisational email confirmation).

---

## [PHASE 3] Long-Term Vision

- Full native apps (iOS + Android)
- AI-assisted connection surfacing and content recommendation
- Integration with institutional archives (Omeka, Mukurtu export/import)
- Multi-language support for international travel
- Offline mode (download a neighbourhood's content before visiting)
- Revenue model (partnerships with tourism boards? premium curated trails? organisation subscriptions?)
- Knowledge Building Community in the full academic sense — but only once there's critical mass

---

## [HONEST PROBLEM] Things That Need Resolution Before Building

### 1. Who seeds the content?
You cannot launch with an empty map. Before writing a line of code, you need 50–100 high-quality pins in one geography. Options: recruit Stanford students (thesis pilot double-duty), partner with SFHistory/SeeStories/Santa Clara Historical Commission, or personally document a neighbourhood. This is not a nice-to-have — it is a prerequisite.

### 2. What's the contributor's incentive?
Travellers consume; locals contribute. What do locals get? Options: community pride and visibility (name on contributions), helping preserve their neighbourhood's stories, organisational branding for partner orgs, social validation (upvotes). For power users, consider: featured contributor spotlights, ability to create trails, topic page editing rights. The genealogy market insight applies here — people contribute when it's connected to their identity and their place.

### 3. How do you handle contested or inaccurate contributions?
Someone posts a memory that another local says is wrong. A contribution has political overtones. A story involves living people who don't want it shared. You need a moderation policy before you need a moderation system. Draft a content policy that covers: factual disputes (allow competing accounts, flag both), privacy (no identifying living individuals without their consent), offensive content (standard community guidelines), and contested history (allow multiple perspectives, require "how do you know this?" sourcing on all claims).

### 4. How does this remain a thesis project?
The pivot broadens the audience from students to the general public, which is great for the product but risky for the thesis. Your research questions need to evolve. Possible reframes:
- "Can a guided prompt tree elicit contributions that demonstrate historical thinking skills — even from contributors who don't identify as historians?"
- "Do travellers who engage with crowdsourced local stories report deeper understanding of a place compared to reading standard guidebook/Wikipedia content?"
- "What contribution formats (text, voice, annotation) produce the most contextually rich place-based documentation?"

These are testable at thesis scale with a seeded prototype and 15–30 users.

### 5. PWA vs. native app for MVP?
A progressive web app is faster to build and works on all devices via browser. But it has limitations: no reliable background geolocation (needed for geo-notifications), no push notifications on iOS without workarounds, and a less polished feel. For thesis MVP, a PWA is sufficient — you're testing the core loop, not the notification system. Plan for native in Phase 2.

### 6. Google Maps API costs at scale
The free tier (10K calls/SKU/month for Essentials) covers MVP and pilot testing easily. At scale, costs grow. A map load is one call; each geocode, place detail lookup, or directions request is additional. Monitor usage from day one. If the product grows, Mapbox may be more cost-effective at volume.

---

## Suggested Build Sequence

| **Week** | **Focus** | **Deliverable** |
|---|---|---|
| 1–3 | Map interface | Google Maps integration with custom pins, pin detail view, filtering, basic mobile-responsive PWA |
| 3–5 | Prompt tree v1 | Contributor flow: contribution types, guided prompts, photo upload, era tagging |
| 5–6 | Photo annotation | Tap-to-annotate on uploaded photos, numbered pins with notes |
| 6–7 | Guided exploration format | The "guided look" contribution type: ordered annotations with questions, connection prompts |
| 7–8 | Tags, connections, and era | Tagging system, auto-suggestions, basic topic pages, related pins, era filtering |
| 8–9 | Community layer | Upvotes (accurate/helpful), replies, contributor profiles, explorer observations ("add your own"), flag-for-review, "Go Deeper" resource links |
| 9–10 | Content seeding on Stanford campus | You and recruited contributors populate 50+ pins on campus using the live platform |
| 10–12 | Thesis pilot | User testing with explorers and contributors, data collection |

---

## What to Name the User Roles

You mentioned "explorers" — that's strong for the traveller side. Consider:

- **Explorers** — people discovering and consuming content (travellers, curious locals, students)
- **Storytellers** — people contributing content (locals, community members, historians)
- **Keepers** — organisations or verified experts who curate topic pages and moderate (Phase 2)

Avoid "contributor" (too generic) and "curator" (too academic). "Storyteller" captures the personal, conversational tone you want and signals that this isn't a database — it's a place for human voices.

---

## Key Metrics for MVP Success

- **Content density:** pins per square kilometre in pilot area (target: enough that a 30-minute walk encounters 5+ pins)
- **Contribution completion rate:** % of people who start the prompt tree and publish (target: >60%)
- **Time to contribute:** minutes from "Add to map" to published pin (target: <5 min for basic, <10 for rich)
- **Explorer engagement:** average pins viewed per session, time spent reading/listening
- **Return rate:** % of explorers who open the app more than once in the pilot area
- **Cross-pin navigation:** % of explorers who tap a tag or related pin to discover a second piece of content (this measures whether the connection system is working)

---

*This document is a living plan. Update it as design decisions are made and as pilot data comes in.*
