# Context Detective — Build Tracker

**Purpose:** Everything agreed in the design conversation that must exist in the app for the Context Detective to work. Lives in `docs/` alongside `Build_State.md`. Update as pieces land.

**Status key:** ✅ designed, ready to build · 🔧 designed, depends on something else first · ❓ needs a decision or content from Sean before build

---

## 1. Prompt assets (text files in the repo, versioned in git)

| Item | Status | Notes |
|---|---|---|
| P.A.S.T. skill | ✅ | Drafted, v1.3 (`Context_Detective_PAST_Skill.md`). Definitions, four lenses with exemplar pointers, boundary map, parsimony, lead-and-notice, anchoring, weighting, screening protocol, interfaces, maintenance note. |
| Exemplar entries companion block | ✅ | The five approved Stanford wealth entries, shipped in the system prompt on every call, behind the content firewall (style/depth/structure only; facts must arrive via research channel). |
| Narrative Voice skill | ✅ | Drafted, v1.0 (`Context_Detective_Narrative_Voice_Skill.md`). Register, sentence craft, banned patterns, scene-painting, word choice, claims/confidence, difficult-content template, rationed devices + style ledger, ending rules, boundaries, self-check, interfaces. Two flagged parameters awaiting Sean's ruling: register assumption (exemplar entries' voice adopted as spoken voice) and length (placeholder: shorter than an entry, 300-word ceiling). |
| Grounding skill | ✅ | Drafted, v1.1 minimal (`Context_Detective_Grounding_Skill.md`). Inputs, four jobs (locate the question across visited stops, model what the learner carries, thread the subject of inquiry, protect the reveals with a conservative rule until the content map exists), grounding notes output, interfaces. Contains ⚙ back-end notes for Sean (visited-stops record, stop content as second retrieval target, subject-of-inquiry field per act/stop (no tour-wide EQ), later-stops map). Grows when the content map lands. |
| Research skill | ✅ | Drafted, v1.0 (`Context_Detective_Research_Skill.md`). v1.1. Source ladder (verified base [entries + approved answers, one rung] → recommended resources → open live search with prioritised domains), banking as a rule not a rung, fit-not-presence gate at every rung, live-search rules, verification & confidence, structural citations, exemplar firewall, pass outputs, interfaces. Contains a ⚙ back-end notes section for Sean to strip before deployment. |
| Parse skill | ✅ | Drafted, v1.1 (`Context_Detective_Parse_Skill.md`). Handout shape (shared passthrough fields: framing question + entry lens, stamped by code) containing context cards (lens, title, summary, explanation, sources with check-this marking; anchoring written into the prose, no separate field), fidelity checks, interfaces. ⚙ back-end notes: JSON schema, passthrough stamping, check-this UI affordance, journal write, Gate cluster E switch-on. Two ⁑ awaiting Sean: short-summary exemplars, multi-card structure confirm. Anchor ruling resolved: in prose, not a field. First calibration exemplar still owed (break one approved entry into a handout). |
| Final Gate skill (checklist) | ✅ | Drafted, v1.1 (`Context_Detective_Final_Gate_Skill.md`). Three verdicts (pass / minimal edits with edit list / regenerate with reason), five active checklist clusters (Voice, Epistemics, Pedagogy & boundary, Structure, Parse conformance), code-lint relationship, never-do list. ⚙ back-end notes: empty-headed gate-call plumbing, regeneration cap (proposed: one retry then bank + log), edit-list logging, cluster E switch-on. |

## 2. The ask route (`/api/ask`) — pipeline per question

| Item | Status | Notes |
|---|---|---|
| Multi-pass architecture | ✅ | Pass 1 research + draft → Pass 2 voice rewrite (voice is the only task) → Pass 3 parse to fields → lint → model gate. Routing lives in code, not in the model. |
| Retrieval | ✅ | Embed question, cosine compare against site entries in plain JS (no vector DB at this scale), top handful to the model. |
| Fit judgement | ✅ | Model judges whether best matches *directly answer* the question; explicit permission to say no. Threshold is a tuning dial. |
| Web supplement | ✅ | Open web search with prioritised domains (approved list + retrieved entries' source links); results marked unverified; label carried through voice pass and citation UI. |
| Bank-the-question fallback | ✅ | When base and whitelist both come back thin. |
| Grounding inputs | 🔧 | Visited-stops array passed into the call; retrieval also runs against visited stop content (two targets: sources that answer, content the learner already carries). |
| Style ledger + permission tokens | ✅ | Session state records recent devices (ending question, scene, exclamation). Code grants/denies device permission per call (~1 in 5 for ending questions); model never counts. |
| Correction retrieval | 🔧 | Embed question, retrieve 1–2 most similar approved correction triples (question + corrected answer + lesson), inject as examples. Depends on corrections collection existing. |
| Deterministic lint | ✅ | String checks: em dashes, banned phrases, American spellings, length bounds, ungranted rationed devices. Hard fail → regenerate. Free, no model call. |
| Model gate call | 🔧 | Receives only candidate answer + checklist + grounding data (visited stops, later-stop map — needed for spoiler/repetition checks). Pass, minimal edit, or flag regeneration. |
| Logging | ✅ | Every answer logged to Firestore: question, lens, answer, retrieved entries, branch (base/web/banked), devices used. |
| Prompt caching | ✅ | Static block (skills + exemplars) cached; only retrieved entries + question are fresh tokens per call. |
| Response payload flags | ❓ | **New (from Research skill):** branch label, verified/unverified marks per source, and the Case 2 relevance flag must travel through all passes to the app for citation styling and the parsed handout. |
| Citation assembly | ✅ | App builds "Where this comes from" panel from source IDs returned with the answer — model never composes citations. Verified vs unverified styled differently. Footnote-style, bottom of response. |

## 3. Session state

| Item | Status | Notes |
|---|---|---|
| Visited-stops array | ✅ | Client state mirrored to Firestore; stop IDs (optionally card-level). Feeds grounding. |
| Style ledger | ✅ | Last few answers' devices; feeds permission tokens. Same infrastructure pattern as visited stops. |

## 4. Knowledge base (curator side)

| Item | Status | Notes |
|---|---|---|
| Entry form | ✅ **BUILT** (2026-07-04) | Fields: title, short summary, long explanation, trusted source links, P.A.S.T. lens tag (one tap). Source link required. `KnowledgeBaseEditor` in the tour admin view; entries live in a `knowledge-entries` subcollection under the tour doc (`memorial-church-tours/{tourId}/knowledge-entries/{id}`) — attached to the tour, not global. **Firestore rule needed** for the subcollection. |
| Recommended-resources plumbing | ❓ | **New (from Research skill):** route must collect source links of every retrieved entry and inject them into search instructions as prioritised domains for that call. |
| Embedding on save | ✅ **BUILT** (2026-07-04) | `/api/embed` (OpenAI `text-embedding-3-small`, server-side key); embeds summary + explanation; vector + model + text-hash stored on the entry; re-embeds only when the text changes. In-code cosine (`cosineSimilarity` in `knowledge-store`). |
| Approved Q&A → answer bank (retrieval rung 2) | 🔧 | Loop one: approved question/answer pairs from the review queue are embedded and retrieved alongside knowledge entries, treated as verified. **Decide:** same collection as entries or parallel collection merged at query time. |
| Priority domain list | ❓ | Search is now open; approved domains are *prioritised*, not enforced. Per-site priority list still worth curating, but no longer blocks live search. |
| Stop-by-stop content map | ❓ | What each tour stop covers, in project knowledge / Firestore — required for spoiler checks (Grounding + Gate). Proposed in the editing session (Round 28); not yet built. |

## 5. Admin (Provenance's own admin pages — nothing lives in the Claude Console)

| Item | Status | Notes |
|---|---|---|
| Review queue page | ✅ | Lists logged answers; admin rates, edits, leaves a comment (comment field mirrors the editing-session workflow), approves/rejects. |
| Metacognition step | ✅ | On approval of an edited answer: one small model call gets original + correction + comment, writes the *lesson* (what changed and why, generalised). Shown to admin for yes/no before saving. |
| Corrections collection | ✅ | Approved triples (question, corrected answer, lesson) stored with embeddings; feeds correction retrieval in the route. |
| Skill Maintainer agent | 🔧 | The one true agent in the design; runs offline on a batch of new corrections, not at answer time. Reads corrections + current skill files, synthesises (not accumulates): one-offs → retrievable examples; recurring patterns → proposed skill-file diffs (must prefer amending existing rules over adding new ones, justify any growth); contradictions with existing guidelines → flagged to admin, never self-resolved. Proposes, never commits — diffs + rationale land in the admin queue for approval; skills in git make every change reversible. Use the strongest model (runs rarely; batch judgement is not small-model work). **v1 = a recurring Claude Code ritual** (saved prompt: read new correction triples, read skills in `docs/`, propose diffs); graduate to a scheduled Agent SDK job only if the ritual earns it. |

## 6. Open decisions (blocking items above)

1. **Parse confirmations** — short-summary exemplars from Sean; multi-card handout structure confirm. (Anchor: resolved, in prose.)
2. **Break one approved entry into a handout** — first Parse calibration exemplar; sets the short-summary standard in the same pass.
3. **Priority domain list for the Stanford tour** — draft the list (prioritised, not enforced).
4. **Stop-by-stop content map** — decide format and build; blocks full Grounding + Gate spoiler checks.
5. **Fit-judgement threshold** — cautious vs confident on day one; tune in testing.
6. **Model selection** — voice bake-off on real answers (Haiku 4.5 vs alternatives); cheapest model for mechanical passes (fit judge, parse, metacognition, gate). Note: with open search + prioritisation, the hard dependency on Anthropic's `allowed_domains` parameter is gone; any search API can serve the web tier.
7. **Case 1 screening reword?** — verify the "point to model questions" instruction matches when model questions are actually visible in the interface.
8. **Skill Maintainer cadence** — how often the ritual runs (weekly? per N corrections?) and when, if ever, it graduates from Claude Code ritual to scheduled agent.

## 7. Suggested build order

1. ✅ **BUILT** (2026-07-04) — Knowledge base form + embedding on save (everything retrieval-shaped depends on it)
2. ✅ **BUILT** (2026-07-04) — `/api/context-answer` pipeline (the design's `/api/ask`, renamed to not clobber the old inquiry route). embed → cosine over the tour's `knowledge-entries` **+ authored Add-Context items** → research+draft (Opus 4.8, web search `web_search_20260209`, domains prioritised-not-enforced, structured `submit_answer` tool) → voice (Opus 4.8) → parse (Haiku 4.5, structured JSON) → full payload + Firestore log (`memorial-church-detective-responses`). Skills+exemplars loaded from `docs/` into the cached system block per pass; route stamps framing question + entry lens. Smoke-tested live: correct voice, real web sources with verified/unverified + check-this marks. **Needs Firestore rules** for `knowledge-entries` subcollection + `memorial-church-detective-responses`. Latency ~1–3 min (effort=medium, web max_uses=3; tunable). Follow-ups: render the handout via the ActContextCard edit-flow in-tour; em-dash lint (voice still slips them); lens picker in the ask UI (v1 derives the lead lens).
3. Visited-stops array + grounding inputs
4. Fields decision → Parse skill → pass 3
5. Deterministic lint + style ledger + permission tokens
6. Voice skill (full) → Final Gate skill → model gate call
7. Web supplement + whitelist + citation panel
8. Review queue → metacognition → corrections collection → correction retrieval
9. Approved Q&A → knowledge base loop

Each step leaves the system working; nothing depends on a later step to function.
