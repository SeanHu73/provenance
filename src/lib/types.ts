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
  media: ContextMediaItem[];
  thumbnailMediaId: string | null;
  /** Cited sources shown on the context page (admin- or learner-authored). */
  sources?: ContextSourceItem[];
  /** Questions this context informs. A designer-created context auto-tags its
   *  origin question; more can be tagged. Replaces the old per-context framing
   *  `question` + `afterStopId` positioning. */
  questionIds?: string[];
  /** @deprecated legacy: contexts used to be positioned after a stop and carry
   *  their own framing question. Read for old tours only. */
  afterStopId?: string;
  /** @deprecated legacy framing question — superseded by `questionIds`. */
  question?: string;
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

export type TourPhase = 'intro' | 'meet_guide' | 'eq_scene' | 'eq_discuss' | 'eq_opening' | 'eq_additional' | 'seed' | 'notice' | 'wonder' | 'reveal' | 'reflect' | 'whats_next' | 'branch' | 'off_path' | 'eq_closing_discuss' | 'eq_closing' | 'eq_closing_additional' | 'eq_final_reflect' | 'eq_questions' | 'guide_outro' | 'end' | 'unstructured_map' | 'midway_checkin' | 'opening_frame' | 'act_intro' | 'act_opening' | 'act_closing' | 'act_questions' | 'stop_map' | 'community_forum' | 'resources' | 'act_context_intro' | 'act_context' | 'act_context_questions' | 'act_reflection_intro' | 'act_reflection' | 'community_share';

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
  /** The P.A.S.T. lens ('place' | 'attitudes' | 'society' | 'technology'). */
  lens: string;
  /** authored = designer's, added = the learner's own copy, self = their own. */
  origin?: 'authored' | 'added' | 'self';
  /** The question they gave themselves (self-authored contexts). */
  question?: string;
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
  /** True once the full Context intro has played — later context steps show the
   *  shorter "let's explore the P.A.S.T. again" return intro instead. */
  contextIntroSeen?: boolean;
  completedStops: string[];
  completionOrder: string[];           // Stop IDs in the order the explorer completed them (unstructured mode)
  midwayResponseText: string | null;   // Explorer's response to the midway check-in question
  midwayShownAt: number | null;        // Index in completionOrder when midway check-in was shown
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
    reflection?: ActReflectionResponse;
    contextQuestions?: ContextQuestionEntry[];
  }>;
  /** Snapshots of the contexts the explorer added/edited/created in their
   *  Context Journal, mirrored from the guest-local store so the admin can see
   *  them (and their map + timeline setup) and they survive an early exit. */
  contextEntries?: ContextEntrySnapshot[];
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
  text: string;
  photos: string[];
  pin?: { lat: number; lng: number; title?: string; note?: string } | null;
  sessionId: string;
  name?: string;
  about?: string;
  upvotes?: number;          // per-device toggle in the explorer view
  status: ModerationStatus;  // created `approved` (immediate); admin can hide
  /** True while the reflection was recorded but NOT published by the explorer.
   *  Unshared records are hidden from other explorers (excluded in `getShares`)
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
