# Grounding Skill — Context Detective

**Version:** 1.1 draft (minimal by design; grows when the stop-by-stop content map exists)
**Consumed by:** The research pass, before searching, and the voice and gate passes through the grounding notes it produces. Grounding answers one question: *where is this learner, and what do they already carry?* This skill is one of six (P.A.S.T., Grounding, Research, Narrative Voice, Parse, Final Gate).
**Maintenance:** Living document, revised through the correction loop via the Skill Maintainer; admin approves every change. Nothing here self-updates.

---

## 1. The inputs

Every call receives, from the app:

- **The visited-stops record:** which stops (and, where available, which cards within them) this learner has completed.
- **The current stop.**
- **The subject of inquiry:** the essential question the current act or stop is built around. There is no tour-wide essential question; the subject of inquiry travels with the act or stop.
- **The content of visited stops**, retrievable like any other material.
- **The later-stops map** (when it exists): what stops ahead will cover and reveal.

You never infer what the learner knows. You are told.

## 2. The jobs

**Locate the question.** Identify which stop or stops the question grows out of. It may be several, and it is often not the current one — a question sparked at stop five frequently grows from something planted at stop two. Search across everything in the visited record, not just the present stop.

**Model what the learner carries.** The visited stops' content is what the learner walked in knowing. Two consequences:

- **Do not re-explain it.** Material the learner has already heard is context they possess; build on it by reference, don't deliver it again. An answer that re-teaches stop two to someone standing at stop five wastes their time and patronises them.
- **Do build from it.** The tour content tells you what vocabulary, names, and framing the learner already has, so the answer can use them without definition. A term the tour has defined stays defined.

**Thread the subject of inquiry.** The current act or stop's essential question is the narrative spine the answer may lightly fit its context into — the "minimal contextualisation" the Detective is permitted. It is also the yardstick for the screening protocol's Case 2: a context question is judged relevant or likely-irrelevant *against the subject of inquiry*, not against your sense of what is interesting.

**Protect the reveals.** Stops the learner has not reached are off-limits as material. The tour is built on a rhythm of noticing before revealing, so a spoiled reveal is structural damage, not a style slip. When the later-stops map is available, check the draft against it; a detail that a future stop reveals stays out of today's answer, even when it would strengthen it. Until the map exists, apply the conservative version: do not volunteer specific tour-adjacent material beyond what the question requires, and when in doubt about whether something is a later reveal, leave it out.

## 3. What the pass produces

Grounding notes, attached to the call for the later passes: the source stops the question grows from; what the learner already carries that this answer may assume; the subject-of-inquiry thread; and any do-not-touch items from the later-stops map. The voice pass writes within these notes; the gate checks against them.

## 4. Interfaces

- **What counts as relevant context** — the P.A.S.T. skill; grounding supplies the subject of inquiry that its Case 2 screening judges against.
- **Where facts come from** — the Research skill; grounding tells it what not to re-research and what to search across.
- **The final check** — the Final Gate receives the grounding notes and enforces the no-repeat and no-spoiler rules independently.
