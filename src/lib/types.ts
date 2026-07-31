import type { Geometry } from 'geojson';

export type QuestionCategory = 'who' | 'what' | 'when' | 'where' | 'why' | 'how';

export interface PhotoAnnotation {
  x: number;             // percentage position (0-100)
  y: number;
  caption: string;
  categories: QuestionCategory[];
  clues: Partial<Record<QuestionCategory, string>>;
}

export type PhysicalLocationTag =
  | 'exterior_facade'
  | 'exterior_sides'
  | 'exterior_rear'
  | 'narthex'
  | 'nave'
  | 'nave_aisles'
  | 'crossing'
  | 'dome'
  | 'chancel'
  | 'transepts'
  | 'side_chapel'
  | 'organ_loft'
  | 'general';

export interface PinPhoto {
  url: string;
  type: 'onsite' | 'archival' | 'contributor';
  caption: string;
  credit: string;
  source: string | null;           // URL of the original archive source (for archival)
  year: string | null;             // when the photo was taken (for archival)
  license: string | null;          // licence status (for archival)
  physicalLocationTag: string;     // exterior_facade | narthex | nave | crossing | dome | chancel | transepts | side_chapel | organ_loft | general
  databaseEntries: string[];       // knowledge entry IDs this photo illustrates (e.g., ["3.1", "6.1"])
  categories: QuestionCategory[];  // which inquiry angles this photo primarily serves
  annotations: PhotoAnnotation[];
}

/**
 * Standalone Photo record stored in the `memorial-church-photos` Firestore
 * collection. Introduced by the photo_extraction_v1 migration to replace
 * per-pin embedded `PinPhoto` arrays with a photo-centric model.
 *
 * A Photo can attach to zero, one, or many pins via `linkedPinIds`. The
 * learner-facing app still reads `pin.photos` for backward compatibility —
 * /admin/photos keeps those embedded copies in sync until a later change
 * flips retrieval to the new collection.
 *
 * Fields that exist only on Photo (not on PinPhoto):
 *   - id             — UUID doc key in the new collection
 *   - description    — 2-4 sentence free-form narrative of what's in the
 *                      image. Powers AI retrieval: "does this photo help
 *                      answer this question?" matches against description
 *                      + keywords, not the structured databaseEntries list.
 *   - keywords       — lowercase tokens derived from captions, annotations,
 *                      pin tags, and knowledge entry titles. Cheap recall
 *                      layer before description-level matching.
 *   - linkedPinIds   — pins this photo belongs to. Empty = unattached
 *                      (valid, e.g. a candidate photo waiting for a pin).
 *   - storageBackend — where the bytes live: vercel-static for URLs under
 *                      /photos/, firebase-storage for uploads, unknown for
 *                      anything else. Lets the admin UI show provenance.
 *   - createdAt / updatedAt — ISO timestamps, set by savePhoto().
 */
export type PhotoStorageBackend = 'vercel-static' | 'firebase-storage' | 'unknown';

export interface Photo {
  id: string;                        // uuid, doc key in memorial-church-photos
  url: string;                       // where the bytes are served from
  storageBackend: PhotoStorageBackend;
  type: 'onsite' | 'archival' | 'contributor';
  caption: string;                   // short line shown under the image
  description: string;               // 2-4 sentence narrative for AI retrieval
  keywords: string[];                // lowercase tokens for cheap recall
  credit: string;
  source: string | null;
  year: string | null;
  license: string | null;
  physicalLocationTag: string;
  databaseEntries: string[];         // kept for compatibility with existing retrieval
  categories: QuestionCategory[];
  annotations: PhotoAnnotation[];
  linkedPinIds: string[];            // pins this photo attaches to (may be empty)
  notes?: string | null;             // optional admin-only context
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}

export interface ObservationHint {
  lookAt: string;      // What to physically look at: "the stone plaque on the facade"
  clue: string;        // How it helps answer this category of question
}

export interface Pin {
  id: string;
  title: string;
  location: {
    lat: number;
    lng: number;
    physicalArea: string;
  };
  photos: PinPhoto[];
  /**
   * New photo-centric linkage. After the photo_extraction_v1 migration runs,
   * this is the authoritative list of photos attached to the pin; the
   * embedded `photos` array above is kept as a cache for the learner-facing
   * app until retrieval is cut over in a later change.
   *
   * Optional because seed pins predating the migration don't carry it.
   */
  photoIds?: string[];
  inquiry: {
    question: string;
    answer: string;
    suggestedNext: {
      pinId: string;
      teaser: string;
    } | null;
  };
  observationHints: Partial<Record<QuestionCategory, ObservationHint>>;
  tags: string[];
  era: string;
  databaseEntryIds: string[];
}

export interface Contribution {
  id?: string;
  pinId: string | null;
  question: string;
  contribution: string;
  timestamp: string;
  verified: boolean;
}

/**
 * Per-session conversational memory. Persisted to sessionStorage so it
 * survives reloads but resets when the tab closes. The API route receives
 * this on every /api/ask call and uses it to:
 *   - prevent the model from recycling the same anchor or quotation
 *   - vary question approach across turns
 *   - gate the "Step back" zoom-out option on coverage
 *   - resurface deferred zoom-out questions once enough has been covered
 *
 * Sets are serialised as arrays in storage. Use the helpers in
 * `session-memory.ts` to load/save/update; don't mutate this directly.
 */
export interface SessionMemory {
  recentObservationAnchors: string[];   // most recent first, capped at 3
  recentQuotations: string[];           // most recent first, capped at 3
  recentQuestionCategories: QuestionCategory[]; // most recent first, capped at 5
  entriesEverUsed: string[];            // ever-seen knowledge entry IDs (acts as a Set)
  locationsEverDiscussed: string[];     // ever-seen physicalLocationTag / pin areas
  substantiveTurnCount: number;         // turns where the model gave a real answer
  openZoomOutQuestions: OpenZoomOutQuestion[];
}

export interface OpenZoomOutQuestion {
  question: string;
  requiredCoverage: string[]; // entry IDs the question depends on
  turnAsked: number;          // substantiveTurnCount value at time it was asked
}

/**
 * Shape of the JSON the model is asked to return on standard /api/ask.
 * `anchorUsed` is the short noun phrase naming the physical thing the
 * observation points at (e.g. "the facade plaque"). `quotationsUsed` is
 * any direct quotes embedded in the answer. Both feed into the recycled
 * content checks in validateResponse().
 */
export interface AskResponse {
  observation: string | null;
  answer: string;
  observationEntries: string[];
  answerEntries: string[];
  anchorUsed: string | null;
  quotationsUsed: string[];
}

// ─── Provenance v2: Tours ─────────────────────────────────────────

/** Tour playback mode. Source of truth for which experience to render.
 *  - `linear`        — fixed authored sequence (the original default)
 *  - `unstructured`  — explorer chooses stop order on a full-screen map
 *  - `context`       — Context-Prototype: sequential, no essential question
 *                      (Opening Frame only), no per-stop discussion / bridge;
 *                      stops are grouped into ordered Acts, each with an
 *                      optional opening + closing question. */
export type TourMode = 'linear' | 'unstructured' | 'context';

/** Opening Frame for Context-Prototype mode — the "Setting the Scene"
 *  screen kept when the essential question is removed. Mirrors the scene
 *  fields on `Tour.essentialQuestion` but stands on its own so the EQ can
 *  be genuinely absent in context mode. */
export interface OpeningFrame {
  scenePhotoUrl: string | null;
  sceneDescription: string;
  sceneAudioUrl: string | null;
  sceneAudioTitle: string | null;
  sceneAudioAutoplayDisabled?: boolean;
  openingFraming: string;            // Collapsible "tap to read along" text below the scene
  /** Optional map pin for the starting point — drives the "Find pin" button on
   *  the Opening Frame and a single pin on the map peek. */
  location?: { lat: number; lng: number } | null;
  /** A single tour-wide "theme question" posed right after the scene is set.
   *  The explorer records or types one response (saved to the session). Blank
   *  → the theme-question screen is skipped and the tour goes straight to the
   *  first act. */
  themeQuestion?: string;
}

/** An authored question shown at the start or end of an Act. The explorer
 *  responds by voice (transcribed) or by typing — the response is stored on
 *  the session, not here. Blank `prompt` → the screen is skipped. */
export interface ActQuestion {
  prompt: string;
}

/** One end-of-act reflection prompt the learner can choose to respond to. An act
 *  can carry several (shown as swipeable cards); the learner picks one — or writes
 *  their own. */
export interface ReflectionPrompt {
  id: string;
  prompt: string;
  /** Optional image shown on the prompt card. */
  photoUrl?: string | null;
}

/** A read-only "Context" section shown at the end of an Act (no map pin):
 *  an admin-framed question plus the context/answer the admin provides. The
 *  explorer reads it, then is prompted for their own context questions. */
export interface ActContext {
  question: string;                  // The framed question (read-only)
  context: string;                   // The context / answer the admin provides
  photos?: StopPhoto[];              // Optional supporting photos ([photo:N] inline)
  audioUrl?: string | null;
  audioTitle?: string | null;
  audioAutoplayDisabled?: boolean;
}

/** A P.A.S.T. lens key (shared with the Context Journal's PastCategory). */
export type PastLens = 'place' | 'attitudes' | 'society' | 'technology';

// ─── Context Detective — answer payload + review log ─────────────────

/** A source behind a Detective card. Verified base = knowledge entry / authored
 *  context; live web = unverified. Blank/inferred sub-fields are marked check-this. */
export interface DetectiveSource {
  kind: 'entry' | 'context' | 'web';
  id?: string;            // knowledge-entry / context id (verified base)
  url?: string;           // web url, or the entry's own source link
  name?: string;
  author?: string;
  date?: string;
  verified: boolean;
  /** Sub-field names the learner should verify (blank or inferred). */
  checkThis?: string[];
}

export interface DetectiveCard {
  lens: PastLens;
  title: string;
  summary: string;
  explanation: string;
  sources: DetectiveSource[];
  /** A photo to illustrate the answer. Set by the route when the answer draws on
   *  an authored context that carries a photo (its thumbnail / first photo, or a
   *  cited source's image), so the reveal shows the curated image. */
  imageUrl?: string;
  /** Optional attribution for `imageUrl` (e.g. a cited source's name). */
  imageCredit?: string;
}

/** The parsed handout. Framing question + entry lens are stamped by the route,
 *  never generated by the model. */
export interface DetectiveHandout {
  framingQuestion: string;
  entryLens: PastLens;
  cards: DetectiveCard[];
  /** Case-2: the context is likely not relevant to the subject of inquiry. */
  relevanceNote?: string;
}

export type DetectiveBranch = 'verified-base' | 'live' | 'banked';

/** What /api/context-answer returns to the client. */
export interface DetectiveAnswer {
  status: 'answered' | 'banked' | 'declined';
  narrative: string;
  handout: DetectiveHandout | null;
  branch: DetectiveBranch;
  sources: DetectiveSource[];
  relevanceNote?: string;
}

/** A logged Detective response for the admin review queue. */
export interface DetectiveLog extends DetectiveAnswer {
  id: string;
  tourId: string;
  actId?: string;
  question: string;
  /** The learner's ORIGINAL question, before the Framing Coach may have prompted
   *  a reframe. Equals `question` when they kept their wording. Lets the author
   *  see whether learners arrived at a good contextual question on their own. */
  originalQuestion?: string;
  /** ids of the verified-base sources retrieved for this question. */
  retrievedIds: string[];
  createdAt: string;
  reviewStatus?: 'unreviewed' | 'approved' | 'rejected';
  reviewComment?: string;
  reviewedAt?: string;
}

/** A curator-authored knowledge-base entry for the Context Detective. Stored in a
 *  `knowledge-entries` subcollection **under the tour** (not a global collection),
 *  so each tour carries its own verified base. The Detective retrieves these by
 *  embedding cosine as its top-of-ladder, verified sources. */
export interface KnowledgeEntry {
  id: string;
  title: string;
  shortSummary: string;
  longExplanation: string;
  /** Trusted source links the curator attached — these steer the Detective's
   *  live research (prioritised domains) and become the entry's citations. */
  sourceLinks: { label: string; url: string }[];
  lens: PastLens;
  /** OpenAI text-embedding-3-small vector of (short summary + long explanation),
   *  generated on save; drives in-code cosine retrieval. Omitted if embedding
   *  failed on save (the entry still saves; retrieval just skips it). */
  embedding?: number[];
  embeddingModel?: string;
  /** Hash of the text the embedding was generated from — lets a re-save skip
   *  re-embedding when the text is unchanged. */
  embeddingHash?: string;
  /** Curation state. `verified` (or undefined, for legacy curator-authored
   *  entries) is retrieved by the Detective. `candidate` is auto-captured from a
   *  learner's live (web) answer and is NOT retrieved until an admin promotes it. */
  status?: 'candidate' | 'verified';
  /** For candidates: the learner question that produced this answer (dedup + review). */
  sourceQuestion?: string;
  /** The photo the answer was illustrated with, remembered so the same question
   *  asked again — or this entry once promoted — shows the same image without
   *  paying for another Wikimedia Commons search (which is best-effort and can
   *  return something different, or nothing). `photoCredit` is its attribution. */
  photoUrl?: string;
  photoCredit?: string;
  /** Embedding of `sourceQuestion` — a *question* vector, unlike `embedding`
   *  which covers the answer text. Kept separately so a new ask can be compared
   *  question-to-question: close enough, and the stored answer is served straight
   *  back instead of researching it again. */
  questionEmbedding?: number[];
  createdAt: string;
  updatedAt: string;
}

/** A photo/audio clip on an Add-Context item (mirrors the journal's ContextMedia
 *  so an item can be cloned into a learner's Context Journal). */
export interface ContextMediaItem {
  id: string;
  kind: 'photo' | 'audio';
  url: string;
  title: string;
}

/** A cited source on an Add-Context item (mirrors the journal's ContextSource so
 *  an item can be cloned into a learner's Context Journal). */
export interface ContextSourceItem {
  id: string;
  name: string;
  author: string;
  date: string;
  imageUrl: string | null;
  /** Optional link — the source name is shown as a hyperlink to it in the app. */
  url?: string | null;
}

/**
 * A **context question** attached to one P.A.S.T. lens and posed after a stop.
 * The designer authors the question + the "context info" the learner receives,
 * and may attach photos/audio (like a stop). One question can yield several
 * contexts; contexts tag back to questions via `ActContextItem.questionIds`.
 * (A learner's own free-form question is the same shape, authored at runtime.)
 */
export interface ContextQuestion {
  id: string;
  afterStopId: string;               // posed after this stop within the act
  lens: PastLens;
  text: string;                      // the question itself
  contextInfo: string;               // the larger context shown on "Learn more"
  media: ContextMediaItem[];         // optional photos/audio for the question
  thumbnailMediaId: string | null;
}

/**
 * A rich "Add Context" item authored on a tour, positioned **after a stop**
 * (`afterStopId`) and shown in the learner sequence (question posed → title +
 * full explanation read aloud → "Add to Context Journal"). Its content mirrors
 * the Context Journal's ContextEntry so it can be cloned into a learner's
 * journal. Multiple items can sit after different stops in an act.
 */
export interface ActContextItem {
  id: string;
  pastCategory: PastLens;
  title: string;
  shortSummary: string;
  /** Optional "Full Explanation" — collapsible in the UI; '' = none. */
  longExplanation: string;
  timeRange: { start: number; end: number };
  geometry: Geometry | null;
  camera: { center: [number, number]; zoom: number } | null;
  mapType: 'default' | 'satellite';
  /** Whether the map + timeline show on the reader context page. `undefined` on
   *  older items → falls back to "show when geometry is set". */
  includePlaceTime?: boolean;
  media: ContextMediaItem[];
  thumbnailMediaId: string | null;
  /** An uploaded voiceover for this context's narration. When present it's the
   *  narration (played instead of any auto text-to-speech), same as a stop's
   *  voiceover. */
  voiceoverUrl?: string | null;
  voiceoverTitle?: string | null;
  /** Cached OpenAI narration of the Title + Full Explanation, generated by the
   *  admin "Generate missing narration" button. `ttsAudioHash` is the hash of
   *  the narrated text — stale when the title/explanation changes. Skipped when
   *  a `voiceoverUrl` is present. */
  ttsAudioUrl?: string | null;
  ttsAudioHash?: string | null;
  /** Cited sources shown on the context page (admin- or learner-authored). */
  sources?: ContextSourceItem[];
  /** Questions this context informs. A designer-created context auto-tags its
   *  origin question; more can be tagged. Replaces the old per-context framing
   *  `question` + `afterStopId` positioning. */
  questionIds?: string[];
  /** Designer-set unlock dependency: this context's question stays hidden in the
   *  journal until the referenced context has been listened to (is in the
   *  session's viewedContexts). Empty/undefined = available from the start. */
  unlockAfterContextId?: string;
  /** @deprecated legacy: contexts used to be positioned after a stop and carry
   *  their own framing question. Read for old tours only. */
  afterStopId?: string;
  /** @deprecated legacy framing question — superseded by `questionIds`. */
  question?: string;
}

/**
 * A **post-tour "additional stop"** in Context-Prototype mode: an existing
 * context stop pulled out of the guided Acts, offered for optional exploration
 * after the last act ends. It references the Stop **by id only** (the Stop lives
 * in `Tour.contextStops`, so moving a stop in or out of the additional pool never
 * loses stop data), and carries its own P.A.S.T. contexts, shown in a dismissible
 * Context Journal when the learner opens it.
 */
export interface AdditionalStop {
  stopId: string;                    // into Tour.contextStops
  /** Shown atop this stop's Context Journal (like an act's guiding question). */
  guidingQuestion?: string;
  /** This stop's P.A.S.T. contexts (same shape as an act's `contexts`). */
  contexts?: ActContextItem[];
}

/** A group of stops in Context-Prototype mode. Stops play sequentially in
 *  `stopIds` order; acts play in array order. */
export interface Act {
  id: string;
  title: string;
  /** The act's guiding question — shown to learners in place of the title (on
   *  the act intro, the footer, and atop the act's Context Journal). */
  guidingQuestion?: string;
  stopIds: string[];                 // Ordered stop IDs into `Tour.contextStops`
  openingQuestion: ActQuestion | null;  // Legacy — act_opening was retired
  closingQuestion: ActQuestion | null;  // Legacy — reflectionQuestion falls back to this
  /** Legacy end-of-act Context section (framed question + provided context).
   *  Superseded by `contexts[]`; still read for old tours via getActContexts(). */
  context?: ActContext | null;
  /** Designer-posed context questions in this act (each posed after a stop). */
  questions?: ContextQuestion[];
  /** Rich "Add Context" items, tagged to questions via `questionIds`. */
  contexts?: ActContextItem[];
  /** "Share What You Think" reflection prompt shown after the Context step.
   *  Falls back to `closingQuestion.prompt` for legacy tours. */
  reflectionQuestion?: ActQuestion | null;
  /** End-of-act reflection prompts the learner chooses from (the "Share Your
   *  Thoughts" step). Several are shown as swipeable cards; the learner may also
   *  write their own. Falls back to `reflectionQuestion` for older tours. */
  reflectionPrompts?: ReflectionPrompt[];
}

/** The explorer's reflection ("Share What You Think") response for an act —
 *  text plus optional photos and a single labelled map pin ("their own stop"),
 *  and whether they shared it to the community. */
export interface ActReflectionResponse {
  /** Stable local id, minted when the response is saved. The explorer can answer
   *  several prompts on the closing reflection, so "which response was shared"
   *  needs a key that isn't the act. */
  id?: string;
  /** The act whose prompt this answers — the acts' prompts are merged into one
   *  closing page, so a response is filed under its prompt's act, not the act
   *  the explorer happens to be standing in. */
  actId?: string;
  text: string;
  photos?: string[];                 // Uploaded photo URLs
  pin?: { lat: number; lng: number; title?: string; note?: string } | null;
  sharedToCommunity?: boolean;
  shareId?: string;                  // CommunityShare doc id if shared
  /** Every reflection is recorded to the community as an `unshared` CommunityShare
   *  the moment it's saved (so the admin can see all responses). This is that
   *  doc's id; if the explorer later shares, the same doc is promoted. */
  unsharedRecordId?: string;
  /** Which prompt the learner answered — its id + text snapshot, or a custom one
   *  they wrote themselves (`isCustom`). */
  promptId?: string | null;
  promptText?: string;
  isCustom?: boolean;
  /** Contexts the learner tagged as ones they referred to (id + title snapshot,
   *  so the admin can see what was picked even for guest-added contexts). */
  taggedContexts?: { id: string; title: string }[];
}

/** One prompt on the closing reflection page. Prompts authored on the tour carry
 *  no act; ones merged out of a legacy tour's acts carry the act they came from,
 *  so responses stay filed under it. */
export interface MergedReflectionPrompt extends ReflectionPrompt {
  actId?: string;
  /** 1-based act number, for the card's label. */
  actNumber?: number;
}

/** One context question the explorer asked (and the AI's answer, once wired). */
export interface ContextQuestionEntry {
  question: string;
  answer?: string | null;            // null while AI is stubbed / not found
  status: 'answered' | 'banked';
}

export interface Tour {
  id: string;
  title: string;                     // "Memorial Church"
  subtitle: string;                  // "Stanford University · Main Quad"
  guide: {
    name: string;                    // "Prof. Elena Ruiz"
    role: string;                    // "Art History · Stanford"
    initials: string;                // "ER"
    photoUrl?: string;               // Round photo — "Meet Your Guide" screen + journal peek
    photoFocalPoint?: { x: number; y: number }; // Crop focal point for the round photo
    photoZoom?: number;              // 1–3× zoom for the round photo
    intro?: string;                  // Brief intro shown on the "Meet Your Guide" screen
    introAudioUrl?: string | null;   // Optional narration on the "Meet Your Guide" screen
    introAudioTitle?: string | null;
    introAudioAutoplayDisabled?: boolean; // When true, never autoplay this screen's audio
    thankYouMessage?: string;        // Closing "Last words from <guide>" message
    thankYouAudioUrl?: string | null;   // Optional narration on the "Last words" screen
    thankYouAudioTitle?: string | null;
    thankYouAudioAutoplayDisabled?: boolean;
  };
  description: string;               // Brief intro shown on journal peek
  coverPhotoUrl: string;             // Photo for the journal peek
  coverPhotoFocalPoint?: { x: number; y: number }; // Crop focal point (0–100%)
  coverPhotoZoom?: number;           // 1–3× zoom for the cover crop
  peekAudioUrl: string | null;       // Audio that plays on the journal peek
  peekAudioTitle: string | null;
  peekAudioAutoplayDisabled?: boolean;
  // The "parent" pin on the map — the single marker visible before a
  // tour starts. Tapping it opens the journal peek.
  location: { lat: number; lng: number } | null;
  // Default background photo — shown behind all screens (including intro).
  // Individual stops can override this from their stop onward.
  backgroundPhotoUrl: string | null;
  backgroundPhotoContrast?: number;   // CSS contrast % (50–200). Default 100 = unchanged.
  stops: Stop[];                     // Ordered array of stops
  connectionWeb: WebNode[];          // Pre-authored node/connection structure
  // Essential question — optional framing that bookends the tour
  essentialQuestion: {
    question: string;                  // "What is this place for?"
    /** Optional contextualising text shown above the main EQ question
     *  on its own snap-scroll section. When empty, the question renders
     *  on its own without snap. */
    questionBackground?: string;
    questionBackgroundAudioUrl?: string | null;
    questionBackgroundAudioTitle?: string | null;
    questionBackgroundAudioAutoplayDisabled?: boolean;
    questionBackgroundPhotos?: StopPhoto[];
    /** When true, explorer renders the background block as italic
     *  "Instructions" instead of the DISCOVER + "Background" treatment. */
    questionBackgroundAsInstructions?: boolean;
    // Scene-setting screen
    scenePhotoUrl: string | null;      // Photo of where to find the starting point
    sceneDescription: string;          // "Find the stone plaque on the north wall..."
    sceneAudioUrl: string | null;      // Optional audio for the scene
    sceneAudioTitle: string | null;
    sceneAudioAutoplayDisabled?: boolean;
    openingFraming: string;            // Toggle text below the scene
    closingFraming: string;            // "You answered this question before..."
    theoryPrompt: string;              // "What might your theory be?"
    theoryPlaceholder: string;
    reasoningPrompt: string;           // "What makes you think that?"
    reasoningPlaceholder: string;
    // Optional additional question after written prompts
    additionalQuestion: {
      question: string;
      questionType: 'discuss' | 'opinion';
      questionBackground?: string;
      questionBackgroundAudioUrl?: string | null;
      questionBackgroundAudioTitle?: string | null;
      questionBackgroundAudioAutoplayDisabled?: boolean;
      questionBackgroundPhotos?: StopPhoto[];
      questionBackgroundAsInstructions?: boolean;
      /** Spectrum labels for opinion-type gamification in rooms. When
       *  both are set and questionType === 'opinion' and the device is
       *  in a room, the explorer sees a semicircular dial instead of
       *  the regular discussion UI. */
      opinionSpectrumLeft?: string;
      opinionSpectrumRight?: string;
    } | null;
    /** Optional list of extra discussion/opinion questions shown after
     *  the main eq_closing card and before eq_final_reflect. Each plays
     *  as its own discussion-question screen with the same snap-scroll
     *  background → "Discuss" + question pattern. */
    additionalClosingQuestions?: Array<{
      question: string;
      questionType: 'discuss' | 'opinion';
      questionBackground?: string;
      questionBackgroundAudioUrl?: string | null;
      questionBackgroundAudioTitle?: string | null;
      questionBackgroundAudioAutoplayDisabled?: boolean;
      questionBackgroundPhotos?: StopPhoto[];
      questionBackgroundAsInstructions?: boolean;
      opinionSpectrumLeft?: string;
      opinionSpectrumRight?: string;
    }>;
    closingAudioUrl: string | null;     // Audio for the closing discuss screen
    closingAudioTitle: string | null;
    closingAudioAutoplayDisabled?: boolean;
    finalReflectionPrompt: string;     // "Your interpretation now..."
    finalReflectionPlaceholder: string;
    finalReasoningPrompt: string;      // "What did you discuss or see..."
    finalReasoningPlaceholder: string;
    /** Final-reflection (eq_final_reflect) configuration. Falls back to
     *  sensible defaults when undefined so existing tours keep working. */
    finalCognitivePrompt?: string;        // default: "How much did this tour change your answer to the original question?"
    finalCognitiveLeftLabel?: string;     // default: "Confirmed what we thought"
    finalCognitiveRightLabel?: string;    // default: "Shifted our thinking"
    finalPerceptualPrompt?: string;       // default: "How much did this change how you see this place?"
    finalPerceptualLeftLabel?: string;    // default: "Same as before"
    finalPerceptualRightLabel?: string;   // default: "I see it completely differently now"
    finalWhatShiftedPrompt?: string;      // default: "What changed?"
    finalWhatShiftedOptions?: string[];   // default: ['We learned something new', 'We changed our mind', 'We had part of it', 'We were surprised']
    finalReasoningSourcePrompt?: string;  // default: "Why did it change or not?"
    finalReasoningSourceOptions?: string[]; // default: ['What we could see here', 'Something we discussed', 'Something we already knew', 'A guess']
  } | null;
  // Playback mode — source of truth. When absent, derived from
  // `unstructuredMode` for backward compatibility (see getTourMode).
  tourMode?: TourMode;
  // Preferred websites/domains the Context Detective should lean on when it has to
  // search the web (e.g. "stanford.edu", "sgs.stanford.edu/founding-grant"). These
  // are always prioritised (not restricted-to), on top of any source links from
  // retrieved entries. Domains or full URLs, one per entry.
  preferredDomains?: string[];
  // Unstructured exploration mode
  unstructuredMode?: boolean;        // Default false — when true, explorer chooses stop order
  // Parallel stops array used when unstructuredMode is true. Authored
  // independently of `stops` (linear) so the writing for each mode can
  // diverge. First populated by deep-cloning `stops` when the author
  // enables unstructuredMode for the first time. Falls back to `stops`
  // if missing (legacy tours).
  unstructuredStops?: Stop[];
  // Parallel stops array used when tourMode === 'context'. Cloned from the
  // unstructured set (or linear) when context mode is first enabled, so its
  // writing can diverge from the other modes.
  contextStops?: Stop[];
  // Ordered Acts for context mode. Each references stop IDs in `contextStops`.
  acts?: Act[];
  /** Prompts offered on the tour's one closing reflection ("Share Your
   *  Thoughts"), authored here rather than per act — reflection is the tour's
   *  closing stage. Absent on tours authored before the move, where the acts'
   *  own `reflectionPrompts` are merged instead (allReflectionPrompts). */
  reflectionPrompts?: ReflectionPrompt[];
  // Optional post-tour "additional stops" (context mode): stops pulled out of the
  // guided acts, explored freely from a menu after the last act. Each references a
  // stop in `contextStops` by id and carries its own P.A.S.T. contexts.
  additionalStops?: AdditionalStop[];
  // Opening Frame shown at the start of a context-mode tour (in place of the
  // essential-question opening). Null/absent → no opening frame screen.
  openingFrame?: OpeningFrame | null;
  defaultZoom?: number;              // Starting map zoom level (14–20). Default 17 if unset.
  categories?: string[];             // Author-defined category list for organising stops
  midwayEnabled?: boolean;           // Default false
  midwayQuestion?: string | null;    // Shown once the explorer completes half the stops
  /** Optional contextualising text shown above the midway question on
   *  its own snap-scroll section. When empty, the question renders
   *  directly with no extra snap. */
  midwayQuestionBackground?: string;
  midwayQuestionBackgroundAudioUrl?: string | null;
  midwayQuestionBackgroundAudioTitle?: string | null;
  midwayQuestionBackgroundAudioAutoplayDisabled?: boolean;
  midwayQuestionBackgroundPhotos?: StopPhoto[];
  midwayQuestionBackgroundAsInstructions?: boolean;

  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}

// ─── Photo overlays ──────────────────────────────────────────────
// Visual overlays an admin can drop onto a stop photo to highlight
// features: text labels, outlined circles, outlined rectangles. Stored
// in percent-of-photo coordinates so they scale with any rendered
// size. (Distinct from the legacy v1 inquiry PhotoAnnotation above.)
export type PhotoOverlay =
  | { id: string; kind: 'text'; x: number; y: number; text: string; color: string; fontSize?: number }
  | { id: string; kind: 'circle'; x: number; y: number; w: number; h: number; color: string }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; color: string };

/** Audio-synced photo highlight cue: at `time` seconds into the audio, the
 *  photo at `photoIndex` (into that phase's `photos` array) is highlighted. */
export interface PhotoCue {
  time: number;
  photoIndex: number;
}

export interface StopPhoto {
  url: string;
  caption: string | null;
  displayMode?: 'cover' | 'contain';
  focalPoint?: { x: number; y: number };
  zoom?: number;                          // cover mode: 1.0 = standard fill, >1 = zoomed in
  thumbnailFocalPoint?: { x: number; y: number }; // focal point for small thumbnails
  overlays?: PhotoOverlay[];              // admin-authored highlights/text
}

// ─── Notice map ──────────────────────────────────────────────────
// Optional admin-uploaded floorplan / room photo used on the Notice
// screen when GPS pins are unhelpful (e.g. inside a building). Each
// marker is a "this is where the stop is" indicator at (x, y)
// percent coordinates, with an optional admin-authored label.
export interface NoticeMapMarker {
  id: string;
  x: number;                              // 0–100
  y: number;                              // 0–100
  label?: string;
}

export interface NoticeMap {
  url: string;
  caption?: string | null;
  markers: NoticeMapMarker[];
  /** When true, the map is hidden behind a "Tap for hint" button so the
   *  group has to actively reveal it instead of seeing it immediately. */
  isHint?: boolean;
}

export interface Stop {
  id: string;
  order: number;                     // Position in the tour sequence
  title: string;                     // "The Facade Mosaic", "Jane Stanford's Vision"
  isFinalStop: boolean;              // If true, this stop ends the tour — skips What's Next, goes to EQ closing

  // Map location — only needed for stops at a DIFFERENT physical
  // location (e.g., walking to the rear of the church). Most stops
  // inside the building share the tour's parent pin and leave this null.
  location: {
    lat: number;
    lng: number;
  } | null;

  // Override background photo — replaces the tour-level background
  // from this stop onward. null = keep using the previous background.
  backgroundPhotoOverride: string | null;

  // Seed phase
  seed: {
    text: string;                    // 2–3 sentences of context
    photoUrl: string | null;         // Legacy single photo
    photoCaption: string | null;
    photos: StopPhoto[]; // Multiple photos
    ttsText: string | null;          // Optional override for TTS
    timerSeconds: number | null;     // Optional reading timer (null = no timer)
    audioUrl: string | null;         // Optional audio narration
    audioTitle: string | null;       // Display title for audio
    audioAutoplayDisabled?: boolean;
    /** When true, this uploaded audio IS the stop's voiceover, so no auto
     *  text-to-speech is generated over the background text. Defaults false
     *  (existing audio isn't assumed to be a voiceover). */
    audioIsVoiceover?: boolean;
    /** Cached OpenAI narration of the Background text, generated by the admin
     *  "Generate missing narration" button and stored in Firebase Storage.
     *  `ttsAudioHash` is the hash of the text it was generated from — when the
     *  text changes, the cache is stale and regenerated. */
    ttsAudioUrl?: string | null;
    ttsAudioHash?: string | null;
    photoCues?: PhotoCue[];          // Audio-synced photo highlights
    photoCuesHoldLast?: boolean;     // Keep the last cued photo highlighted after audio ends
  };

  // Notice phase
  notice: {
    prompt: string;                  // Observation directive
    timerSeconds: number;            // Default 30
    photoUrl: string | null;         // Legacy single photo
    photoCaption: string | null;
    photos: StopPhoto[]; // Multiple photos
    audioUrl: string | null;
    audioTitle: string | null;
    audioAutoplayDisabled?: boolean;
    audioIsVoiceover?: boolean;      // This audio is the voiceover (skip auto TTS)
    photoCues?: PhotoCue[];          // Audio-synced photo highlights
    photoCuesHoldLast?: boolean;     // Keep the last cued photo highlighted after audio ends
    /** Optional indoor "where to go" map shown above the prompt. Used
     *  for stops inside buildings where the outdoor GPS pin isn't
     *  enough — the admin uploads a floorplan / room photo and drops
     *  marker(s) on it pointing to where this sub-stop is. */
    noticeMap?: NoticeMap | null;
  };

  // Wonder phase — null means skip (notice goes straight to reveal)
  wonder: {
    question: string;                // Discussion prompt (no options)
    questionType: 'discuss' | 'opinion';  // 'discuss' = "Chance to discuss...", 'opinion' = "What's your opinion?"
    /** Optional contextualising text shown on a separate snap-scroll
     *  section before the question. When empty, the question renders on
     *  its own without snap. */
    questionBackground?: string;
    /** Optional audio for the question background section. */
    questionBackgroundAudioUrl?: string | null;
    questionBackgroundAudioTitle?: string | null;
    questionBackgroundAudioAutoplayDisabled?: boolean;
    /** Optional photos for the question background section. */
    questionBackgroundPhotos?: StopPhoto[];
    questionBackgroundAsInstructions?: boolean;
    /** Spectrum labels for opinion-type gamification in rooms. */
    opinionSpectrumLeft?: string;
    opinionSpectrumRight?: string;
    /** When true, explorer picks from a list of admin-authored question
     *  options (or proposes their own) instead of being shown the
     *  static `question`. In rooms, only the first non-host member
     *  picks while others wait. */
    userChoiceEnabled?: boolean;
    userChoiceQuestions?: string[];
    photos: StopPhoto[];
    audioUrl: string | null;
    audioTitle: string | null;
    audioAutoplayDisabled?: boolean;
  } | null;

  // Reveal phase
  reveal: {
    text: string;                    // The authored insight
    photoUrl: string | null;         // Legacy single photo (kept for backward compat)
    photoCaption: string | null;
    photos: StopPhoto[]; // Multiple photos
    bridgeText: string;              // Forward-pointing sentence to next stop
    bridgePhotos: StopPhoto[];
    /** Optional audio for the bridge / What's Next screen. */
    bridgeAudioUrl?: string | null;
    bridgeAudioTitle?: string | null;
    bridgeAudioAutoplayDisabled?: boolean;
    audioUrl: string | null;
    audioTitle: string | null;
    audioAutoplayDisabled?: boolean;
    audioIsVoiceover?: boolean;      // This audio is the voiceover (skip auto TTS)
    /** Cached OpenAI narration of the Stop Info text (see seed.ttsAudioUrl). */
    ttsAudioUrl?: string | null;
    ttsAudioHash?: string | null;
    /** Audio-synced photo highlights: at each cue's `time` (seconds into the
     *  reveal audio) the photo at `photoIndex` in `photos` gets a gentle
     *  glow + a one-shot haptic, replacing any previously highlighted photo.
     *  Only active while the reveal audio is present/playing. */
    photoCues?: PhotoCue[];
    photoCuesHoldLast?: boolean;     // Keep the last cued photo highlighted after audio ends
  };

  // Extra wonder + context rounds (optional, after the initial reveal, before the bridge)
  extraRounds: Array<{
    wonder: { question: string; questionType: 'discuss' | 'opinion'; questionBackground?: string; questionBackgroundAudioUrl?: string | null; questionBackgroundAudioTitle?: string | null; questionBackgroundAudioAutoplayDisabled?: boolean; questionBackgroundPhotos?: StopPhoto[]; questionBackgroundAsInstructions?: boolean; opinionSpectrumLeft?: string; opinionSpectrumRight?: string; userChoiceEnabled?: boolean; userChoiceQuestions?: string[]; photos: StopPhoto[]; audioUrl: string | null; audioTitle: string | null; audioAutoplayDisabled?: boolean } | null;
    reveal: {
      text: string;
      photos: StopPhoto[];
      audioUrl: string | null;
      audioTitle: string | null;
      audioAutoplayDisabled?: boolean;
    } | null;
  }>;

  // Reflection phase — null means skip entirely
  reflect: {
    sliderPrompt: string;            // Default: "How much did that change your thinking?"
    sliderLeftLabel: string;         // Default: "Confirmed what we thought"
    sliderRightLabel: string;        // Default: "Shifted our thinking completely"
    followUps: Array<'what_shifted' | 'reasoning_source'>;  // can select multiple (or empty for none)
    followUpOptions: string[] | null;          // custom options for what_shifted
    reasoningSourceOptions: string[] | null;   // custom options for reasoning_source
    photos: StopPhoto[];
  } | null;

  // Related artefacts — optional side-path detours
  detours: Detour[];

  // Unstructured mode metadata
  category?: string | null;          // From the tour's categories list
  mergeGroup?: string | null;        // Stops with the same value form a sequence; null = standalone

  // Metadata
  physicalLocationTag: string;       // Where in the site this stop is
  relatedEntryIds: string[];         // Knowledge base entries this stop draws from
  upcomingTopics: string[];          // Keywords for AI question routing
}

export interface Detour {
  id: string;
  title: string;                     // "The Pendentive Angels"
  coverPhoto: {
    url: string;
    caption: string;
  };
  physicalLocationTag: string;
  relatedEntryIds: string[];
  // All phases optional except reveal
  notice: {
    prompt: string;
    timerSeconds: number;
  } | null;
  wonder: {
    question: string;
  } | null;
  reveal: {
    text: string;
    photos: StopPhoto[];
  };
  bridge: string | null;
}

export interface WebNode {
  id: string;
  type: 'seed' | 'notice' | 'wonder';
  label: string;                     // Short label shown after completion
  stopId: string;                    // Which stop this node belongs to
  connections: string[];             // IDs of connected nodes
  x: number;                        // Position in the web layout (0–100)
  y: number;
}

export type TourPhase = 'intro' | 'meet_guide' | 'eq_scene' | 'eq_discuss' | 'eq_opening' | 'eq_additional' | 'seed' | 'notice' | 'wonder' | 'reveal' | 'reflect' | 'whats_next' | 'branch' | 'off_path' | 'eq_closing_discuss' | 'eq_closing' | 'eq_closing_additional' | 'eq_final_reflect' | 'eq_questions' | 'guide_outro' | 'end' | 'unstructured_map' | 'midway_checkin' | 'opening_frame' | 'theme_question' | 'act_intro' | 'act_opening' | 'act_closing' | 'act_questions' | 'stop_map' | 'community_forum' | 'resources' | 'act_context_intro' | 'act_context' | 'act_context_questions' | 'act_reflection_intro' | 'act_reflection' | 'community_share' | 'additional_menu';

/** A Firestore-safe snapshot of one Context-Journal entry the explorer added,
 *  edited, or created during a tour. The live entries are guest-local (wiped at
 *  tour end); we mirror these snapshots into the session backup so the admin can
 *  review what people built — their contexts, and how they set up the map +
 *  timeline — and so nothing is lost if they leave early.
 *
 *  Geometry is stored as a JSON string (`geometryJson`) because Firestore rejects
 *  the nested coordinate arrays GeoJSON uses; `camera.center` is a flat 2-number
 *  array, which Firestore accepts. */
export interface ContextEntrySnapshot {
  id: string;
  title: string;
  shortSummary?: string;
  /** The full context text (the Detective's answer / authored explanation), so the
   *  admin can read the whole thing in the sessions view, not just the summary. */
  longExplanation?: string;
  /** The learner's own predicted answer (predict-then-reveal), if they wrote one. */
  learnerPrediction?: string;
  /** Why the learner asked this — the "Why did you ask this question?" reflection
   *  captured while the Detective researches. */
  motivation?: string;
  /** The P.A.S.T. lens ('place' | 'attitudes' | 'society' | 'technology'). */
  lens: string;
  /** authored = designer's, added = the learner's own copy, self = their own. */
  origin?: 'authored' | 'added' | 'self';
  /** The act this answer belongs to — lets the journal tell it was asked for this
   *  act (so back-nav doesn't re-lock the ask gate). */
  actId?: string;
  /** The question they gave themselves (self-authored contexts). */
  question?: string;
  /** The learner's FIRST question, before the Framing Coach reframe — only stored
   *  when it differs from `question` (they took a suggested reframe). */
  originalQuestion?: string;
  /** The context's cited sources (label + url), carried so an admin can promote a
   *  reviewed answer into the verified knowledge base with its provenance intact. */
  sourceLinks?: { label: string; url: string }[];
  /** Timeline span they set, inclusive years. */
  timeRange?: { start: number; end: number } | null;
  /** Map camera they framed the geometry with. */
  camera?: { center: [number, number]; zoom: number } | null;
  mapType?: 'default' | 'satellite';
  /** GeoJSON geometry type they drew ('Point' | 'Polygon' | …), if any. */
  geometryType?: string | null;
  /** Full geometry as a JSON string (nested arrays can't be stored raw). */
  geometryJson?: string | null;
  mediaCount?: number;
  /** The context's thumbnail photo, carried so promoting this answer into the
   *  verified base keeps its illustration — and so a repeat of the same question
   *  can be served with the same picture rather than searching for a new one. */
  thumbnailUrl?: string;
  thumbnailCredit?: string;
}

/**
 * An admin's review/correction of a Detective answer the learner kept (keyed by
 * the context entry id). Editing preserves BOTH the `original` and `edited` text so
 * the change is legible — the raw material for the skill-correction loop. Stored in
 * `memorial-church-detective-corrections/{contextId}`, separate from the learner's
 * session so the learner's client can never clobber an admin correction.
 */
export interface DetectiveCorrection {
  id: string;                 // = the reviewed context entry's id
  sessionId: string;
  tourId: string;
  verdict?: 'approved' | 'needs_work' | 'rejected';
  /**
   * Which skill this correction is a lesson about. Not cosmetic — it routes the
   * correction, and the two paths are opposites:
   *
   *  'content' is **local**. The lesson is about this subject, so it rides the
   *    correction-retrieval path: embed the question, resurface on similar ones.
   *  'voice' is **global**. A voice lesson learned on a railroad question applies to
   *    every question ever asked, so question-similarity retrieval would bury it —
   *    it belongs in the Narrative Voice skill, which loads on every call.
   *
   * Misfiling a voice lesson as content turns a rule into an anecdote, which is why
   * the admin says so rather than the Maintainer guessing.
   */
  kind?: 'voice' | 'content' | 'both';
  /**
   * The *why*, not the *what* — `original` vs `edited` already shows what changed.
   * The useful note states a rule that would still make sense on a different
   * question ("Voice — don't open by restating the question; start with the fact").
   * A note that only describes the diff ("made it less flowery") adds nothing.
   */
  note?: string;
  /** Snapshot of the answer as the AI produced it, captured on first edit. */
  original?: { title: string; shortSummary: string; longExplanation: string };
  /** The admin's corrected text (present only when they edited). */
  edited?: { title: string; shortSummary: string; longExplanation: string };
  /** A better illustration the admin picked, replacing whatever the Detective
   *  found. Stored on the correction rather than written straight to the entry so
   *  it is legible as a review decision and survives re-promotion. */
  photoUrl?: string;
  photoCredit?: string;
  /** Knowledge-entry id if the admin promoted this into the verified base. */
  promotedEntryId?: string;
  updatedAt: string;
}

/** A designer-authored context item the explorer opened during the tour. */
export interface ViewedContext {
  contextId: string;
  title: string;
  lens: string;
  question?: string;
  actId?: string;
  at: string;                          // ISO timestamp of first view
}

export interface TourSession {
  id: string;
  phaseHistory: Array<{ phase: TourPhase; round: number; stopIndex: number }>;
  tourId: string;
  currentStopIndex: number;
  currentPhase: TourPhase;
  currentRound: number;               // 0 = main wonder+reveal, 1+ = extra rounds
  /** Which positioned Add-Context item is currently showing (act_context phases). */
  currentContextId?: string | null;
  /** Context mode: true while the learner is exploring a post-tour *additional*
   *  stop (its stop content + its own dismissible Context Journal), which routes
   *  back to the additional-stops menu rather than into the act flow. */
  additionalActive?: boolean;
  /** The additional stop currently being explored (its `stopId`), or null. */
  currentAdditionalStopId?: string | null;
  /** True once the full Context intro has played — later context steps show the
   *  shorter "let's explore the P.A.S.T. again" return intro instead. */
  contextIntroSeen?: boolean;
  completedStops: string[];
  completionOrder: string[];           // Stop IDs in the order the explorer completed them (unstructured mode)
  midwayResponseText: string | null;   // Explorer's response to the midway check-in question
  midwayShownAt: number | null;        // Index in completionOrder when midway check-in was shown
  /** Response to the tour-wide theme question shown after the Opening Frame
   *  (Context-Prototype). Null until answered; '' if the explorer skipped. */
  themeQuestionResponse?: string | null;
  /** The explorer's answer to the onboarding "What do you think history is?"
   *  question, captured before the tour and copied onto the session at start so
   *  it shows up in the admin's session record. */
  onboardingHistoryResponse?: string | null;
  reflections: Array<{
    stopId: string;
    sliderValue: number;              // 0–1
    followUpResponse: string | null;  // Text of selected option, or null
  }>;
  bankedQuestions: BankedQuestion[];
  detourVisits: Array<{ stopId: string; detourId: string; timestamp: string }>;
  essentialQuestionResponses: {
    initialTheory: string;
    initialReasoning: string;
    finalReflection: string;
    finalReasoning: string;
    finalCognitiveSlider: number;          // 0–1
    finalPerceptualSlider: number | null;  // 0–1
    whatShiftedResponse: string[] | null;  // multi-select
    reasoningSourceResponse: string[] | null; // multi-select
    /** Per-question responses for tour.essentialQuestion.additionalClosingQuestions,
     *  parallel to that array. */
    additionalClosingResponses?: string[];
  } | null;
  /** Context-Prototype per-act responses, keyed by act id. `opening`/`closing`
   *  are legacy act-question answers; `reflection` is the "Share What You Think"
   *  response; `contextQuestions` are the questions the explorer asked. */
  actResponses?: Record<string, {
    opening?: string;
    closing?: string;
    /** The first reflection filed under this act. Kept as-is so older sessions
     *  (and everything that reads a single response) still resolve; `reflections`
     *  is the full list. */
    reflection?: ActReflectionResponse;
    /** Every reflection filed under this act — the closing reflection lets the
     *  explorer answer more than one prompt. Read this (falling back to
     *  `reflection`) wherever responses are shown or exported. */
    reflections?: ActReflectionResponse[];
    contextQuestions?: ContextQuestionEntry[];
  }>;
  /** Snapshots of the contexts the explorer added/edited/created in their
   *  Context Journal, mirrored from the guest-local store so the admin can see
   *  them (and their map + timeline setup) and they survive an early exit. */
  contextEntries?: ContextEntrySnapshot[];
  /** Every Detective answer the explorer got from asking their own question in the
   *  Context Journal — captured whether or not they "added" it, so the admin can
   *  review/correct/promote each answer (the skill-correction loop). Full snapshots
   *  so they render with the same controls as built contexts. */
  detectiveAnswers?: ContextEntrySnapshot[];
  /** Designer-authored context items the explorer opened during the tour. */
  viewedContexts?: ViewedContext[];
  startedAt: string;
  completedAt: string | null;
}

export interface BankedQuestion {
  id: string;
  tourId: string;
  sessionId: string;
  questionText: string;
  askedAfterStopId: string;
  aiResponse: 'coming_up' | 'answered_off_path' | 'banked';
  timestamp: string;
}

export interface CommunalQuestion {
  id: string;
  tourId: string;
  questionText: string;
  askedBySessionCount: number;
  responses: CommunalResponse[];
  createdAt: string;
}

export interface CommunalResponse {
  sessionId: string;
  responseText: string;
  timestamp: string;
}

// ─── Community Forum (Context-Prototype) ─────────────────────────
// Explorer-submitted questions + responses, moderated in /admin/community.
// Only `approved` items surface in the explorer Community Forum.

export type ModerationStatus = 'pending' | 'approved';

export interface ForumQuestion {
  id: string;
  tourId: string;
  actId?: string;            // The act this question belongs to (per-act forum)
  text: string;
  sessionId: string;
  name?: string;             // Author's name (from the saved forum identity)
  about?: string;            // "Anything we should know about you" (saved once)
  likes?: number;            // Community "like" count (per-device toggle in the explorer forum)
  status: ModerationStatus;
  createdAt: string;
}

export interface ForumResponse {
  id: string;
  questionId: string;
  tourId: string;
  text: string;
  sessionId: string;
  name?: string;
  about?: string;
  status: ModerationStatus;
  createdAt: string;
}

/** Saved per-device forum identity, reused so we don't re-ask on later stops. */
export interface ForumIdentity {
  name: string;
  about: string;
}

// ─── Community shares (Context-Prototype "Hear from the Community") ───
// Replaces the per-act question forum. At the end of each act, explorers can
// share their "Share What You Think" reflection (text + photos + a labelled map
// pin) and others upvote / comment. Shares + comments appear immediately
// (created `approved`); admins can still remove them in /admin/community.

/** An explorer's shared reflection for an act. */
export interface CommunityShare {
  id: string;
  tourId: string;
  actId: string;
  /** The reflection prompt this answers — the community wall groups shares by
   *  question. Absent on shares recorded before the closing reflection merged
   *  the prompts; those are grouped by their act instead. */
  promptId?: string | null;
  promptText?: string;
  isCustom?: boolean;
  text: string;
  photos: string[];
  pin?: { lat: number; lng: number; title?: string; note?: string } | null;
  sessionId: string;
  name?: string;
  about?: string;
  upvotes?: number;          // per-device toggle in the explorer view
  status: ModerationStatus;  // created `approved` (immediate); admin can hide
  /** True while the reflection was recorded but NOT published by the explorer.
   *  Unshared records are hidden from other explorers (excluded in `getSharesForTour`)
   *  but visible to admins under an "Unshared" category. Cleared when the
   *  explorer chooses to share (the same doc is promoted). */
  unshared?: boolean;
  createdAt: string;
}

/** A comment on a shared reflection. */
export interface CommunityComment {
  id: string;
  shareId: string;
  tourId: string;
  text: string;
  sessionId: string;
  name?: string;
  status: ModerationStatus;  // created `approved` (immediate)
  createdAt: string;
}

export interface ResourceLink {
  label: string;
  url: string;
}

/** A suggested resource shown at the end of a context tour. `admin` resources
 *  are curated; `user` resources are explorer-submitted and moderated. */
export interface ForumResource {
  id: string;
  tourId: string;
  title: string;
  description: string;
  photos: string[];
  links: ResourceLink[];
  source: 'admin' | 'user';
  status: ModerationStatus;
  sessionId?: string;
  name?: string;
  createdAt: string;
}

// ─── Rooms (multi-device group tours) ────────────────────────────
//
// A Room ties multiple TourSessions to one coordinated playback.
// Each member's device still runs its own TourSession independently;
// the room only coordinates two things:
//
//   1. Stop transitions — host proposes, every member must approve.
//   2. Discussion-question barriers — every member must arrive, then
//      every member must press "ready". No exclusion of offline members
//      (sleeping phones must wake to advance the group).
//
// Stored in Firestore at memorial-church-rooms/{code}.

export interface RoomMember {
  sessionId: string;                  // matches TourSession.id on that device
  name: string;                       // user-entered or auto-assigned ("Explorer 2")
  joinedAt: string;                   // ISO
  lastSeenAt: string;                 // ISO — updated by heartbeat
}

export interface BarrierState {
  /** sessionIds of members currently parked on this barrier */
  arrivals: string[];
  /** sessionIds who've pressed "Ready to continue" */
  readys: string[];
  /** ISO when every member was ready — triggers everyone's local advance */
  resolvedAt: string | null;
}

/** Per-opinion-question dial state stored on the room. Keyed by the
 *  same `${stopId|"eq"}:${phase}:${round}` shape barriers use, so a
 *  card knows where to look. */
export interface OpinionDialState {
  /** sessionId → chosen position on the spectrum (0 = left option, 1 = right option). */
  positions: Record<string, number>;
  /** sessionIds who have tapped "Find out where your friend is" — once
   *  every member is in here, the dial reveals each other's dots. */
  revealedBy: string[];
}

export interface Room {
  code: string;                       // 4-char alphanumeric, doc id
  tourId: string;
  hostSessionId: string;
  members: RoomMember[];
  /** false until host taps "Begin tour" in the lobby */
  started: boolean;
  /** Mirror of the group's tour progress; rejoining devices sync from here. */
  currentStopId: string | null;
  completedStopIds: string[];
  /** Logical stops the group has finished, in visit order. For cluster
   *  groups this is the leader id (one entry per group). Drives the
   *  "N of M explored" pill on the progress bar and the midway
   *  threshold. */
  completionOrder?: string[];
  /** What "outer" phase the room is in between stops — mirrored by
   *  members so they land on the right surface (map, midway, closing).
   *  Set by the host. Null/undefined while inside a stop (currentStopId
   *  is the authority then). */
  groupPhase?: TourPhase | null;
  /** Host has proposed a transition to this stop; awaiting approvals. */
  pendingStopId: string | null;
  pendingApprovals: string[];
  /** key = `${stopId|"eq"}:${phase}:${round}` */
  barriers: Record<string, BarrierState>;
  /** Opinion-dial state per opinion question, keyed the same way as
   *  barriers. Populated only when the question is an opinion type AND
   *  the admin has authored both spectrum labels AND the device is in
   *  a room. */
  opinionDials?: Record<string, OpinionDialState>;
  /** User-choice question selections, keyed the same way as barriers
   *  (`${stopId}:wonder:${round}`). The non-host picker writes once;
   *  every member then jumps to that question. */
  userChoiceSelections?: Record<string, { chosenBy: string; question: string; isCustom?: boolean }>;
  createdAt: string;
  updatedAt: string;
}
