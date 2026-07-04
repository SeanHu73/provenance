# Context Detective — Build State

_Scoped checkpoint (the project-wide handoff is `docs/Build_State.md`; per-item
status lives in `Context_Detective_Build_Tracker.md`). Last updated 2026-07-04:
steps 1 & 2 of the tracker are built and live; the admin review console is next._

## Done

- **Housekeeping** — every `⚙ back-end note` and `⚑` flag moved out of the six
  skill files into `docs/Skill_TODOs.md`; the skills read clean.
- **Step 1 — knowledge base**: `KnowledgeEntry`, `src/lib/knowledge-store.ts`,
  `/api/embed` (OpenAI `text-embedding-3-small`), `KnowledgeBaseEditor` in the
  tour admin view. Entries live in a `knowledge-entries` **subcollection under
  the tour**; embedded on save, re-embedded only when the text changes.
- **Step 2 — the pipeline** (`/api/context-answer`, the design's `/api/ask`
  renamed so the old inquiry route isn't clobbered): embed → cosine retrieval
  over knowledge entries **+ authored Add-Context items** → research+draft
  (Opus 4.8 + `web_search_20260209`, domains prioritised-not-enforced,
  structured `submit_answer`) → voice (Opus 4.8) → parse (Haiku 4.5, structured
  JSON) → full payload + Firestore log (`memorial-church-detective-responses`).
  Route stamps framing question + entry lens. Skills+exemplars read from `docs/`
  into the cached system block per pass (`src/lib/context-detective/`). Failures
  degrade to a banked answer. Smoke-tested live end-to-end (correct Detective
  voice, `branch: live`, real web sources with verified/unverified + check-this).
- **Ask UX** — `ContextAskLoading` (magnifier scanning documents + provenance
  Notice) shown while the Detective researches.

## Action items for Sean

1. **Firestore rules** — add blocks for the two new collections, or reads/writes
   fail silently (same per-collection rule pattern as every other collection):
   ```
   match /memorial-church-tours/{tourId}/knowledge-entries/{doc} { allow read, write: if true; }
   match /memorial-church-detective-responses/{doc} { allow read, write: if true; }
   ```
2. Confirm `ANTHROPIC_API_KEY` is set in **Vercel** env (already in `.env.local`).

## Next

1. **Admin review console** (`/admin/detective`) — review queue over the response
   log (rate / edit / comment / approve / reject), a sources tab, a read-only
   skills + exemplars viewer. Designed with Sean; not built.
2. **Approval flow** → approved responses/contexts become verified sources.
3. Deferred later steps: grounding (visited stops + spoiler map), deterministic
   lint (em-dash etc.) + style ledger, the gate, corrections + Skill Maintainer.

## Known tuning items

- Latency ~1–3 min (Opus + web search); `maxDuration = 300` set for Vercel.
  Dials: research effort (`medium`), `web_search` `max_uses` (`3`), or a faster
  research model.
- Voice pass still emits em dashes (banned) — the later lint step catches it.
- In-tour the answer renders as narrative text; wiring the full handout through
  the `ActContextCard` edit-flow is a follow-up.
- The ask UI has no lens picker; v1 derives the lead lens in the research pass.
