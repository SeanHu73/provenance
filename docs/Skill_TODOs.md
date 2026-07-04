# Context Detective — Skill TODOs & Back-end Notes

**Purpose:** Everything pulled out of the six skill files that is *not* something the Detective reads at answer time — the "⚙ back-end notes for Sean" (infrastructure the route must provide) and the "⚑" flags (parameters and exemplars still awaiting Sean's ruling). The skill files themselves now contain only Detective-facing rules. Update this file as items land; when a ⚑ is resolved, fold the ruling into the skill and delete the flag here.

Organised by the skill each item came from.

---

## P.A.S.T. skill

No back-end notes or open flags. (The "Case 1 screening reword?" question lives in the tracker, §6 open decision 7.)

---

## Narrative Voice skill

**⚑ Parameters drafted as assumptions, awaiting Sean's ruling:**

1. **Register** — the exemplar entries' voice (guiding first-person plural with occasional direct address) is assumed to be the Detective's spoken voice as well. Veto if the spoken Detective should sound different from a written entry.
2. **Length** — no ruling exists yet. Working placeholder, now stated as a rule in the skill's §11: noticeably shorter than a context entry, hard ceiling 300 words. Confirm or replace the ceiling.

When either is ruled on, update the skill (§1 register, §11 length) and remove the corresponding note here.

---

## Research skill

**⚙ Back-end notes (infrastructure the route must provide):**

1. **Knowledge-base entries with a source-links field** (ladder rungs 1 and 2): the entry form is designed (tracker §4), but the *recommended-resources* behaviour needs an explicit build — the route must collect the source links of every retrieved entry and inject them into the search instructions as prioritised domains for that call.
2. **Approved-answer bank inside the verified base** (rung 1): the route must embed admin-approved answers and include them in retrieval alongside entries. Decide whether they live in the same collection as entries (simplest) or a parallel collection merged at query time. *(Tracker §4; later step — not this session.)*
3. **Priority domain list** (rung 3): no longer a hard whitelist — search is open, approved domains are prioritised. A per-site priority list still needs curating, but it no longer blocks the live-search rung.
4. **Branch label + flags in the response payload** (skill §7): the route must carry branch, verified/unverified marks, and the Case 2 relevance flag through all passes to the app, for citation styling and the parsed handout.

---

## Grounding skill

**⚙ Back-end notes (infrastructure the route must provide):**

1. **Visited-stops record** (tracker §3): the array must be passed into every Detective call; card-level grain optional but useful.
2. **Stop content retrievable** (skill §2): visited stops' script content must be embedded and searchable by the route, as a second retrieval target distinct from the knowledge base.
3. **Subject of inquiry per act/stop** (skill §2): each act or stop carries its own essential question; store it on the act/stop document and have the route inject the current one. No tour-wide EQ field.
4. **Later-stops map** (tracker §4, open decision 4): until built, the conservative spoiler rule applies. The map unlocks the full spoiler check here and in the Gate.

*(All Grounding infrastructure is tracker step 3 — not this session. The skill stays in its minimal v1 until the stop-by-stop content map lands.)*

---

## Parse skill

**⚑ Awaiting from Sean:**

1. **Short-summary exemplars** — the summary rules in the skill's §2 are provisional until Sean's examples arrive; when they do, they become the standard and the "provisional" note in §2 comes out.
2. **Multi-card structure** — one handout containing one or more context cards; confirm against the single-record reading.

**Resolved (folded into the skill):** anchoring is written into the context's prose, not held as a separate field (Sean's ruling).

**⚙ Back-end notes (infrastructure the route must provide):**

1. **JSON schema:** the route needs a fixed schema for handout + cards (sharedFields; cards[], each card: lens, title, summary, explanation, sources[], flags — no anchor field; anchoring is in the prose). The parse call returns this JSON; the app renders it into the edit UI.
2. **Passthrough stamping:** framing question and entry lens are written into the payload by the route, not requested from the model.
3. **Check-this affordance:** the edit UI needs a visible marker on blank or inferred source sub-fields (especially date) prompting learner verification.
4. **Journal write:** saving the edited handout to the Context Journal is an app action on learner confirm — no model involvement.
5. **Gate cluster E** switches on once Parse exists: the route passes the parsed JSON into the gate call alongside the narrative. *(Gate is a later step — not this session.)*
6. **First exemplar still owed:** break one approved entry into a handout (cards, titles, summaries, anchors, sources) — it becomes the Parse calibration exemplar and sets the short-summary standard in the same pass.

---

## Final Gate skill

**⚙ Back-end notes (infrastructure the route must provide):** *(Gate is a later tracker step — none of this is built this session.)*

1. **Gate-call plumbing:** the route must pass the gate only this skill + the candidate answer + metadata (grounding notes, granted devices, branch, identifiers, flags). Keeping the other skills out of the gate call is the point — build the prompt assembly accordingly.
2. **Regeneration cap:** proposed — one regeneration on a gate failure; if the second attempt also fails, do not loop — serve nothing, bank the question, and log the double failure for the review queue. Sean's call on the cap.
3. **Edit-list logging:** the gate's verdict and edit list should be logged with the answer in Firestore — free training signal for the review queue and the Skill Maintainer.
4. **Parse conformance (cluster E):** the route must pass the parsed handout JSON into the gate call alongside the narrative and metadata.
