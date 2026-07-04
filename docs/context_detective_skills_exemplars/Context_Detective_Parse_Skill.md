# Parse Skill — Context Detective

**Version:** 1.1 draft
**Consumed by:** The parse pass (pass 3), which runs on the voice pass's finished narrative. Parsing is extraction, not authorship: nothing may appear in a field that is not in the narrative, except the compressions this skill explicitly permits (title, short summary). This skill is one of six (P.A.S.T., Grounding, Research, Narrative Voice, Parse, Final Gate).
**Maintenance:** Living document, revised through the correction loop via the Skill Maintainer; admin approves every change. Nothing here self-updates.

---

## 1. The output shape

One **handout** per answer. The handout carries two shared fields stamped by the app (the model never generates or copies them):

- **Framing question** — the learner's question, exactly as asked.
- **Entry lens** — the lens the learner chose to ask through.

Inside the handout: one or more **context cards**. The lead context (the one that answered through the entry lens) is always the first card. Contexts from other lenses that earned their place in the narrative (per the P.A.S.T. skill's lead-and-notice and parsimony rules) each become one further card, tagged with their true lens. A context that did not earn separate existence in the narrative does not get a card.

If the metadata carries the Case 2 relevance flag, the handout carries it too, with the plain statement of likely irrelevance and the learner's edit-to-explain path.

Every generated field is a draft. The learner edits before anything reaches their journal; nothing you produce is final copy.

## 2. The fields of a context card

**Lens.** The card's true lens, assigned per the P.A.S.T. skill. The lead card's lens equals the entry lens; a crossed context keeps the lens it actually belongs to, even though the learner asked through another.

**Title.** Generated: a short plain phrase naming the context itself — the conditions, not the site or the question. "The Gilded Age economy," not "How Stanford got rich." A few words, no rhetoric, no cleverness, no punctuation tricks. A learner scanning their journal months later should know from the title alone what conditions this card holds.

**Short summary.** Generated: one to three sentences distilling the context's conditions. It must stand alone — a reader who sees only the summary should come away with the context's core claim, its time, and its place. Anchoring lives here and in the explanation as prose, not as a separate field: per the P.A.S.T. skill's anchoring rules, the summary or explanation must name the span the described effect ran (rarely a single year) and the region over which the conditions held, default broad — decade and region. The narrative voice rules apply in miniature: no banned patterns, no rhetoric, plain claims at the confidence the sources support.

**Full explanation.** Extracted: the narrative's own material for this context, reorganised only as far as standing alone requires. Cutting a flowing narrative into cards breaks referents, so repair them — name what a pronoun pointed to — but add no facts, no sentences, no connective flourishes. The explanation is the narrative's content wearing card shape, nothing more.

**Sources.** One entry per source actually used for this card's content, drawn only from the metadata identifiers — never from memory, never composed. Four sub-fields:

- *Source name* — as the source presents itself.
- *Author* — when findable.
- *Link* — the identifier's URL, or the knowledge-base entry it points to.
- *Date* — when findable.

Rules that bind all four: never invent a value. A sub-field that cannot be filled from what was actually retrieved is left blank and marked **check this** — the interface asks the learner to verify it. Date is the most error-prone sub-field; when a date is inferred rather than stated by the source, it is marked check-this even when filled. Sources from the live-search branch carry their unverified mark onto the card.

## 3. Fidelity checks before returning

- Every card's content appears in the narrative; no card invents.
- Every context in the narrative that earned existence has a card; no card is missing.
- Lens tags, flags, and source marks match the metadata exactly; every card's prose carries its time-and-place anchor (a card whose summary and explanation never name when and where fails the check).
- The framing question and entry lens fields are untouched passthroughs.
- Card count respects parsimony: lead plus at most about three, and fewer is the norm.

(The Final Gate's cluster E performs these same checks independently once switched on.)

## 4. Interfaces

- **Which contexts exist, their lenses, their anchors, their weights** — decided upstream by the P.A.S.T. skill's rules; you separate and label, you do not re-judge.
- **What the sources are** — the Research skill's returned identifiers; your source fields are a rendering of them, not a new search.
- **How the words sound** — the summary and title inherit the Narrative Voice rules; the full explanation inherits the narrative's finished prose.
- **The learner's journal** — app territory. You produce the handout's data; the app renders, the learner edits, the app saves.
