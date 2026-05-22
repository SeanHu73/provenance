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
  };
  description: string;               // Brief intro shown on journal peek
  coverPhotoUrl: string;             // Photo for the journal peek
  peekAudioUrl: string | null;       // Audio that plays on the journal peek
  peekAudioTitle: string | null;
  // The "parent" pin on the map — the single marker visible before a
  // tour starts. Tapping it opens the journal peek.
  location: { lat: number; lng: number } | null;
  // Default background photo — shown behind all screens (including intro).
  // Individual stops can override this from their stop onward.
  backgroundPhotoUrl: string | null;
  stops: Stop[];                     // Ordered array of stops
  connectionWeb: WebNode[];          // Pre-authored node/connection structure
  // Essential question — optional framing that bookends the tour
  essentialQuestion: {
    question: string;                  // "What is this place for?"
    // Scene-setting screen
    scenePhotoUrl: string | null;      // Photo of where to find the starting point
    sceneDescription: string;          // "Find the stone plaque on the north wall..."
    sceneAudioUrl: string | null;      // Optional audio for the scene
    sceneAudioTitle: string | null;
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
    } | null;
    closingAudioUrl: string | null;     // Audio for the closing discuss screen
    closingAudioTitle: string | null;
    finalReflectionPrompt: string;     // "Your interpretation now..."
    finalReflectionPlaceholder: string;
    finalReasoningPrompt: string;      // "What did you discuss or see..."
    finalReasoningPlaceholder: string;
  } | null;
  // Unstructured exploration mode
  unstructuredMode?: boolean;        // Default false — when true, explorer chooses stop order
  categories?: string[];             // Author-defined category list for organising stops
  midwayEnabled?: boolean;           // Default false
  midwayQuestion?: string | null;    // Shown once the explorer completes half the stops

  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}

export interface StopPhoto {
  url: string;
  caption: string | null;
  displayMode?: 'cover' | 'contain';
  focalPoint?: { x: number; y: number };
  zoom?: number;                          // cover mode: 1.0 = standard fill, >1 = zoomed in
  thumbnailFocalPoint?: { x: number; y: number }; // focal point for small thumbnails
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
  };

  // Wonder phase — null means skip (notice goes straight to reveal)
  wonder: {
    question: string;                // Discussion prompt (no options)
    questionType: 'discuss' | 'opinion';  // 'discuss' = "Chance to discuss...", 'opinion' = "What's your opinion?"
    photos: StopPhoto[];
    audioUrl: string | null;
    audioTitle: string | null;
  } | null;

  // Reveal phase
  reveal: {
    text: string;                    // The authored insight
    photoUrl: string | null;         // Legacy single photo (kept for backward compat)
    photoCaption: string | null;
    photos: StopPhoto[]; // Multiple photos
    bridgeText: string;              // Forward-pointing sentence to next stop
    bridgePhotos: StopPhoto[];
    audioUrl: string | null;
    audioTitle: string | null;
  };

  // Extra wonder + context rounds (optional, after the initial reveal, before the bridge)
  extraRounds: Array<{
    wonder: { question: string; questionType: 'discuss' | 'opinion'; photos: StopPhoto[]; audioUrl: string | null; audioTitle: string | null } | null;
    reveal: {
      text: string;
      photos: StopPhoto[];
      audioUrl: string | null;
      audioTitle: string | null;
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

export type TourPhase = 'intro' | 'meet_guide' | 'eq_scene' | 'eq_discuss' | 'eq_opening' | 'eq_additional' | 'seed' | 'notice' | 'wonder' | 'reveal' | 'reflect' | 'whats_next' | 'branch' | 'off_path' | 'eq_closing_discuss' | 'eq_closing' | 'eq_final_reflect' | 'eq_questions' | 'end' | 'unstructured_map' | 'midway_checkin';

export interface TourSession {
  id: string;
  phaseHistory: Array<{ phase: TourPhase; round: number; stopIndex: number }>;
  tourId: string;
  currentStopIndex: number;
  currentPhase: TourPhase;
  currentRound: number;               // 0 = main wonder+reveal, 1+ = extra rounds
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
  } | null;
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
