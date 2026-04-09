"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import {
  CONTEXT_TYPES,
  ERA_OPTIONS,
  getInitials,
  type ContextType,
  type GuideType,
  type Guide,
} from "../lib/types";
import { QUESTION_JOURNEYS, fillTemplate } from "../lib/question-journeys";

// ─── Types ──────────────────────────────────────────────────────────────────

type Phase =
  | "context"
  | "guide"
  | "place"
  | "questions"
  | "arrange"
  | "preview";

interface AnswerDraft {
  stopId: string;
  questionText: string; // already filled-in (no [GUIDE] placeholders)
  answer: string;
  x: number; // photo annotation coord (0-100)
  y: number;
  lookFirst: boolean;
  lookPrompt: string;
  historicalImageFile: File | null;
  historicalImageUrl: string | null;
}

interface StorytellerFlowProps {
  mapCenter: { lat: number; lng: number };
  onClose: () => void;
  onPublished: () => void;
}

// ─── Voice Input Hook ───────────────────────────────────────────────────────

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0]?.[0]?.transcript;
      if (transcript) onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }, [listening, onResult]);

  return { listening, toggle };
}

// ─── Annotation Photo (storyteller side) ────────────────────────────────────

function StorytellerPhoto({
  imageUrl,
  answers,
  activeIdx,
  tapping,
  onTap,
}: {
  imageUrl: string | null;
  answers: AnswerDraft[];
  activeIdx: number | null;
  tapping: boolean;
  onTap: (x: number, y: number) => void;
}) {
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!tapping) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    onTap(x, y);
  }
  function handleTouch(e: React.TouchEvent<HTMLDivElement>) {
    if (!tapping) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    const x = ((t.clientX - r.left) / r.width) * 100;
    const y = ((t.clientY - r.top) / r.height) * 100;
    onTap(x, y);
  }
  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "4/3", cursor: tapping ? "crosshair" : "default" }}
      onClick={handleClick}
      onTouchEnd={handleTouch}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Your photo"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#C9B896] via-[#B8A882] to-[#D1C4A0] flex items-center justify-center">
          <span className="text-7xl opacity-10">📷</span>
        </div>
      )}
      {tapping && (
        <div className="absolute inset-0 border-2 border-dashed border-blue-400/60 pointer-events-none" />
      )}
      {tapping && (
        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-black/60 text-white text-[13px]">
            Tap where you want the group to look
          </span>
        </div>
      )}
      {answers.map((a, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center rounded-full font-semibold text-[13px]"
          style={{
            left: `${a.x}%`,
            top: `${a.y}%`,
            transform: "translate(-50%,-50%)",
            width: activeIdx === i ? 32 : 26,
            height: activeIdx === i ? 32 : 26,
            background: activeIdx === i ? "#0C447C" : "rgba(255,255,255,0.92)",
            color: activeIdx === i ? "#fff" : "#333",
            border:
              activeIdx === i
                ? "2.5px solid #0C447C"
                : "2px solid rgba(0,0,0,0.25)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            zIndex: activeIdx === i ? 3 : 2,
          }}
        >
          {i + 1}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function StorytellerFlow({
  mapCenter,
  onClose,
  onPublished,
}: StorytellerFlowProps) {
  const { user } = useAuth();

  // ── Phase ──
  const [phase, setPhase] = useState<Phase>("context");

  // ── Step 1: Context type ──
  const [contextType, setContextType] = useState<ContextType | null>(null);

  // ── Step 2: Guide ──
  const [guideType, setGuideType] = useState<GuideType | null>(null);
  const [guideName, setGuideName] = useState("");
  const [guideRole, setGuideRole] = useState("");
  const [guideEra, setGuideEra] = useState("");
  const [guideRelationship, setGuideRelationship] = useState("");
  const [guidePerspective, setGuidePerspective] = useState("");
  const [guideBasedOn, setGuideBasedOn] = useState("");

  // ── Step 3: Place ──
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pinLocation, setPinLocation] = useState(mapCenter);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [title, setTitle] = useState("");
  const [era, setEra] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Step 4: Question journey answers ──
  const [answers, setAnswers] = useState<AnswerDraft[]>([]);
  const [currentStopIdx, setCurrentStopIdx] = useState(0);
  // For the current stop: which question variant (or "custom") and the draft
  const [questionChoice, setQuestionChoice] = useState<number | "custom">(0);
  const [customQuestion, setCustomQuestion] = useState("");
  const [draftAnswer, setDraftAnswer] = useState("");
  const [draftLookFirst, setDraftLookFirst] = useState(false);
  const [draftLookPrompt, setDraftLookPrompt] = useState("");
  const [draftCoord, setDraftCoord] = useState<{ x: number; y: number } | null>(
    null
  );
  const [draftHistoricalUrl, setDraftHistoricalUrl] = useState<string | null>(
    null
  );
  const [draftHistoricalFile, setDraftHistoricalFile] = useState<File | null>(
    null
  );
  const histFileRef = useRef<HTMLInputElement>(null);
  const [tappingPhoto, setTappingPhoto] = useState(false);

  // ── Step 5: Arrange ──
  const [order, setOrder] = useState<number[]>([]);

  // ── Publishing ──
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // ── Voice ──
  const voiceCallback = useCallback((transcript: string) => {
    setDraftAnswer((prev) => (prev ? prev + " " + transcript : transcript));
  }, []);
  const { listening, toggle: toggleVoice } = useVoiceInput(voiceCallback);

  // ── Derived ──
  const journey = contextType ? QUESTION_JOURNEYS[contextType] : null;
  const currentStop = journey?.stops[currentStopIdx] ?? null;
  const guideForTemplate = {
    name: guideName || "the guide",
    era: guideEra || "their time",
    role: guideRole || "guide",
  };
  const guideObj: Guide | null =
    guideType && guideName
      ? {
          name: guideName,
          role: guideRole,
          era: guideEra,
          relationship: guideRelationship,
          perspective: guidePerspective,
          type: guideType,
          avatarInitials: getInitials(guideName),
          ...(guideType === "composite" && guideBasedOn
            ? { basedOn: guideBasedOn }
            : {}),
        }
      : null;

  // Pre-fill self-guide from auth user when they pick "myself"
  useEffect(() => {
    if (guideType === "self" && user) {
      if (!guideName && user.displayName) setGuideName(user.displayName);
      if (!guideRole) setGuideRole("Storyteller");
    }
  }, [guideType, user, guideName, guideRole]);

  // Suggest look-first when entering a new stop
  useEffect(() => {
    if (currentStop) {
      setDraftLookFirst(currentStop.suggestLookFirst ?? false);
    }
  }, [currentStop]);

  // ── Handlers ──

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    }
  }

  function pickFromGallery() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setImageFile(file);
        setImageUrl(URL.createObjectURL(file));
      }
    };
    input.click();
  }

  function handleHistoricalImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setDraftHistoricalFile(file);
      setDraftHistoricalUrl(URL.createObjectURL(file));
    }
  }

  function resetDraft() {
    setQuestionChoice(0);
    setCustomQuestion("");
    setDraftAnswer("");
    setDraftLookFirst(currentStop?.suggestLookFirst ?? false);
    setDraftLookPrompt("");
    setDraftCoord(null);
    setDraftHistoricalUrl(null);
    setDraftHistoricalFile(null);
    setTappingPhoto(false);
  }

  function getQuestionText(): string {
    if (!currentStop) return "";
    if (questionChoice === "custom") {
      return customQuestion;
    }
    if (questionChoice === 0) {
      return fillTemplate(currentStop.primary, guideForTemplate);
    }
    return fillTemplate(
      currentStop.alternatives[questionChoice - 1],
      guideForTemplate
    );
  }

  function saveAnswerAndContinue() {
    if (!currentStop || !draftAnswer.trim()) return;
    const newAnswer: AnswerDraft = {
      stopId: currentStop.id,
      questionText: getQuestionText(),
      answer: draftAnswer.trim(),
      x: draftCoord?.x ?? 50,
      y: draftCoord?.y ?? 50,
      lookFirst: draftLookFirst,
      lookPrompt: draftLookPrompt.trim(),
      historicalImageFile: draftHistoricalFile,
      historicalImageUrl: draftHistoricalUrl,
    };
    setAnswers((prev) => [...prev, newAnswer]);
    resetDraft();
    // Move to next stop in journey, or stay at last stop
    if (journey && currentStopIdx < journey.stops.length - 1) {
      setCurrentStopIdx(currentStopIdx + 1);
    }
  }

  function finishQuestions() {
    setOrder(answers.map((_, i) => i));
    setPhase("arrange");
  }

  function moveUp(pos: number) {
    if (pos <= 0) return;
    const no = [...order];
    [no[pos - 1], no[pos]] = [no[pos], no[pos - 1]];
    setOrder(no);
  }
  function moveDown(pos: number) {
    if (pos >= order.length - 1) return;
    const no = [...order];
    [no[pos], no[pos + 1]] = [no[pos + 1], no[pos]];
    setOrder(no);
  }

  async function handlePublish() {
    if (!contextType || !guideObj) {
      setPublishError("Missing context type or guide.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      // Upload main photo
      let photoUrl: string | null = null;
      if (imageFile) {
        const r = ref(storage, `pins/${Date.now()}_${imageFile.name}`);
        await uploadBytes(r, imageFile);
        photoUrl = await getDownloadURL(r);
      }
      // Upload per-answer historical photos in order
      const orderedAnswers = order.map((i) => answers[i]);
      const annotations = [];
      for (let i = 0; i < orderedAnswers.length; i++) {
        const a = orderedAnswers[i];
        let histUrl: string | null = null;
        if (a.historicalImageFile) {
          const r = ref(
            storage,
            `pins/${Date.now()}_hist_${i}_${a.historicalImageFile.name}`
          );
          await uploadBytes(r, a.historicalImageFile);
          histUrl = await getDownloadURL(r);
        }
        annotations.push({
          x: a.x,
          y: a.y,
          question: a.questionText,
          answer: a.answer,
          lookFirst: a.lookFirst,
          lookPrompt: a.lookPrompt,
          historicalPhotoUrl: histUrl,
          order: i,
        });
      }

      await addDoc(collection(db, "pins"), {
        title: title || guideObj.name + "'s perspective",
        type: CONTEXT_TYPES.find((c) => c.id === contextType)?.defaultPinType ?? "guided",
        contextType,
        guide: guideObj,
        description:
          guideObj.perspective ||
          orderedAnswers.map((a) => a.answer).join(" ").slice(0, 240),
        lat: pinLocation.lat,
        lng: pinLocation.lng,
        era: era || null,
        contributor: {
          name: user?.displayName ?? "Anonymous",
          role: "Storyteller",
        },
        tags: [],
        upvotes: { accurate: 0, helpful: 0 },
        annotations,
        resources: [],
        photoUrl,
        historicalPhotoUrl: null,
        createdAt: serverTimestamp(),
      });
      onPublished();
    } catch (err) {
      console.error("Publish failed:", err);
      setPublishError(String(err));
    } finally {
      setPublishing(false);
    }
  }

  // ─── Render: header (used in all phases) ─────────────────────────────────

  function Header({ title }: { title: string }) {
    return (
      <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100 shrink-0">
        <span className="text-[15px] font-medium text-gray-900">{title}</span>
        <button onClick={onClose} className="text-[13px] text-gray-400">
          Cancel
        </button>
      </div>
    );
  }

  // ═══ PHASE: CONTEXT ═══

  if (phase === "context") {
    return (
      <div className="flex flex-col h-full bg-white">
        <Header title="What kind of story?" />
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-[15px] text-gray-700 mb-1 leading-relaxed">
            Pick the type of story you want to tell.
          </p>
          <p className="text-[13px] text-gray-500 mb-4">
            This shapes the questions you&rsquo;ll be guided through.
          </p>
          <div className="flex flex-col gap-2.5">
            {CONTEXT_TYPES.map((c) => (
              <button
                key={c.id}
                onClick={() => setContextType(c.id)}
                className="flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-colors"
                style={{
                  borderColor: contextType === c.id ? "#0C447C" : "#E5E7EB",
                  background: contextType === c.id ? "#EFF6FF" : "#fff",
                }}
              >
                <span className="text-[24px] shrink-0">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-gray-900 leading-snug">
                    {c.label}
                  </p>
                  <p className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">
                    {c.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => setPhase("guide")}
            disabled={!contextType}
            className="w-full py-3 rounded-xl text-[15px] font-semibold"
            style={{
              background: contextType ? "#0C447C" : "#E5E7EB",
              color: contextType ? "#fff" : "#9CA3AF",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ═══ PHASE: GUIDE ═══

  if (phase === "guide") {
    const journeyForType = contextType ? QUESTION_JOURNEYS[contextType] : null;
    return (
      <div className="flex flex-col h-full bg-white">
        <Header title="Who will guide this?" />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[15px] text-gray-700 leading-relaxed">
              Choose a guide whose perspective frames the experience for the group.
            </p>
            {journeyForType && (
              <p className="text-[13px] text-gray-500 mt-1 italic">
                Suggested: {journeyForType.guideHint}
              </p>
            )}
          </div>

          {/* Guide type cards */}
          <div className="flex flex-col gap-2">
            {(
              [
                {
                  id: "historical" as const,
                  icon: "📜",
                  title: "A real person from history",
                  desc: "A specific named individual",
                },
                {
                  id: "composite" as const,
                  icon: "👤",
                  title: "A character I'm creating",
                  desc: "A composite representing real experiences",
                },
                {
                  id: "self" as const,
                  icon: "🪪",
                  title: "Myself",
                  desc: "Personal testimony — you are the guide",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                onClick={() => setGuideType(opt.id)}
                className="flex items-center gap-3 p-3 rounded-xl border-2 text-left"
                style={{
                  borderColor: guideType === opt.id ? "#0C447C" : "#E5E7EB",
                  background: guideType === opt.id ? "#EFF6FF" : "#fff",
                }}
              >
                <span className="text-[20px]">{opt.icon}</span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-gray-900">
                    {opt.title}
                  </p>
                  <p className="text-[12px] text-gray-500">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Fields */}
          {guideType && (
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[12px] font-medium text-gray-600 block mb-1">
                  Name
                </label>
                <input
                  value={guideName}
                  onChange={(e) => setGuideName(e.target.value)}
                  placeholder={
                    guideType === "historical"
                      ? "e.g. Ah Ling"
                      : guideType === "composite"
                        ? "e.g. Maria Gonzalez"
                        : "Your name"
                  }
                  className="w-full text-[15px] rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-600 block mb-1">
                  Role
                </label>
                <input
                  value={guideRole}
                  onChange={(e) => setGuideRole(e.target.value)}
                  placeholder="e.g. Railroad worker, Architect, Long-time resident"
                  className="w-full text-[15px] rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-medium text-gray-600 block mb-1">
                  Era
                </label>
                <input
                  value={guideEra}
                  onChange={(e) => setGuideEra(e.target.value)}
                  placeholder="e.g. 1865, 1940s, today"
                  className="w-full text-[15px] rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>
              {guideType === "composite" && (
                <div>
                  <label className="text-[12px] font-medium text-gray-600 block mb-1">
                    Based on
                  </label>
                  <input
                    value={guideBasedOn}
                    onChange={(e) => setGuideBasedOn(e.target.value)}
                    placeholder="e.g. The experiences of Latina cannery workers in 1940s Monterey"
                    className="w-full text-[15px] rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Composite characters get a label so explorers know they&rsquo;re a synthesis.
                  </p>
                </div>
              )}
              <div>
                <label className="text-[12px] font-medium text-gray-600 block mb-1">
                  One-sentence relationship to this place
                </label>
                <textarea
                  value={guideRelationship}
                  onChange={(e) => setGuideRelationship(e.target.value)}
                  rows={2}
                  placeholder='e.g. "He built this station with his own hands."'
                  className="w-full text-[15px] rounded-lg border border-gray-200 px-3 py-2.5 resize-none leading-relaxed focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <label className="text-[12px] font-semibold text-blue-700 block mb-1">
                  In one sentence: what does this person want visitors to understand that they might not see on their own?
                </label>
                <p className="text-[11px] text-blue-600 mb-2">
                  This is the perspective statement — everything in the exploration builds toward it.
                </p>
                <textarea
                  value={guidePerspective}
                  onChange={(e) => setGuidePerspective(e.target.value)}
                  rows={3}
                  placeholder='e.g. "These tracks were laid by hands like mine — but my name is on no plaque."'
                  className="w-full text-[15px] rounded-lg border border-blue-200 px-3 py-2.5 resize-none leading-relaxed focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => setPhase("context")}
            className="px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-500"
          >
            Back
          </button>
          <button
            onClick={() => setPhase("place")}
            disabled={
              !guideType ||
              !guideName.trim() ||
              !guideRelationship.trim() ||
              !guidePerspective.trim()
            }
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold"
            style={{
              background:
                guideType &&
                guideName.trim() &&
                guideRelationship.trim() &&
                guidePerspective.trim()
                  ? "#0C447C"
                  : "#E5E7EB",
              color:
                guideType &&
                guideName.trim() &&
                guideRelationship.trim() &&
                guidePerspective.trim()
                  ? "#fff"
                  : "#9CA3AF",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ═══ PHASE: PLACE ═══

  if (phase === "place") {
    return (
      <div className="flex flex-col h-full bg-white">
        <Header title="Capture the place" />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Photo */}
          <div>
            <label className="text-[12px] font-medium text-gray-600 block mb-1.5">
              Photo
            </label>
            {imageUrl ? (
              <div>
                <img
                  src={imageUrl}
                  alt="Pin"
                  className="w-full rounded-xl object-cover"
                  style={{ aspectRatio: "4/3" }}
                />
                <button
                  onClick={() => {
                    setImageUrl(null);
                    setImageFile(null);
                  }}
                  className="text-[12px] text-gray-400 mt-1.5"
                >
                  Change photo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 py-4 rounded-xl border-2 border-dashed border-gray-200 text-[13px] text-gray-500 flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Take photo
                </button>
                <button
                  onClick={pickFromGallery}
                  className="flex-1 py-4 rounded-xl border-2 border-dashed border-gray-200 text-[13px] text-gray-500 flex items-center justify-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  Upload
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImage}
              className="hidden"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-[12px] font-medium text-gray-600 block mb-1.5">
              Pin location
            </label>
            {!pickingLocation ? (
              <button
                onClick={() => setPickingLocation(true)}
                className="w-full py-3 rounded-xl border border-gray-200 text-[13px] text-gray-600 flex items-center justify-center gap-2"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {pinLocation.lat === mapCenter.lat &&
                pinLocation.lng === mapCenter.lng
                  ? "Tap to set pin location"
                  : `${pinLocation.lat.toFixed(4)}, ${pinLocation.lng.toFixed(4)} — tap to change`}
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-[13px] font-medium text-blue-700 mb-1">
                  Drag the map so the crosshair sits where the subject is
                </p>
                <p className="text-[11px] text-blue-600 mb-2">
                  Place it where the subject is, not where you&rsquo;re standing.
                </p>
                <div
                  className="relative w-full rounded-xl overflow-hidden bg-gray-200"
                  style={{ aspectRatio: "16/9" }}
                >
                  <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
                    <Map
                      defaultCenter={pinLocation}
                      defaultZoom={18}
                      mapTypeId="hybrid"
                      gestureHandling="greedy"
                      disableDefaultUI={true}
                      onCameraChanged={(e) => {
                        setPinLocation({
                          lat: e.detail.center.lat,
                          lng: e.detail.center.lng,
                        });
                      }}
                      className="w-full h-full"
                    />
                  </APIProvider>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 relative">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-red-500" />
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-red-500" />
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-3 bg-red-500" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-3 bg-red-500" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full border-2 border-red-500" />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setPickingLocation(false)}
                  className="w-full mt-2 py-2.5 rounded-lg bg-blue-600 text-white text-[13px] font-semibold"
                >
                  Confirm location
                </button>
              </div>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-[12px] font-medium text-gray-600 block mb-1.5">
              Title for this pin
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Memorial Church mosaics"
              className="w-full text-[15px] rounded-lg border border-gray-200 px-3 py-2.5 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Era */}
          <div>
            <label className="text-[12px] font-medium text-gray-600 block mb-1.5">
              Era
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {ERA_OPTIONS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEra(era === e ? "" : e)}
                  className="px-2.5 py-1 rounded-full text-[12px] font-medium border"
                  style={{
                    background: era === e ? "#0C447C" : "#fff",
                    color: era === e ? "#fff" : "#666",
                    borderColor: era === e ? "#0C447C" : "#E5E7EB",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => setPhase("guide")}
            className="px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-500"
          >
            Back
          </button>
          <button
            onClick={() => setPhase("questions")}
            disabled={!imageUrl || !title.trim()}
            className="flex-1 py-3 rounded-xl text-[15px] font-semibold"
            style={{
              background: imageUrl && title.trim() ? "#0C447C" : "#E5E7EB",
              color: imageUrl && title.trim() ? "#fff" : "#9CA3AF",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ═══ PHASE: QUESTIONS ═══

  if (phase === "questions" && currentStop && journey) {
    const showWarning = answers.length >= 4;
    return (
      <div className="flex flex-col h-full bg-white">
        <Header title={`${currentStop.label}`} />
        <div className="flex-1 overflow-y-auto">
          {/* Photo with answer markers */}
          <StorytellerPhoto
            imageUrl={imageUrl}
            answers={answers}
            activeIdx={null}
            tapping={tappingPhoto}
            onTap={(x, y) => {
              setDraftCoord({ x, y });
              setTappingPhoto(false);
            }}
          />

          <div className="p-4 space-y-4">
            <p className="text-[13px] text-gray-500 leading-relaxed italic">
              {currentStop.purpose}
            </p>

            {/* Question chooser */}
            <div className="space-y-2">
              <p className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide">
                Choose a question for {guideName || "your guide"}
              </p>
              <button
                onClick={() => setQuestionChoice(0)}
                className="w-full p-3 rounded-xl border-2 text-left"
                style={{
                  borderColor: questionChoice === 0 ? "#0C447C" : "#E5E7EB",
                  background: questionChoice === 0 ? "#EFF6FF" : "#fff",
                }}
              >
                <p className="text-[15px] font-semibold text-gray-900 leading-snug">
                  {fillTemplate(currentStop.primary, guideForTemplate)}
                </p>
              </button>
              {currentStop.alternatives.map((alt, i) => (
                <button
                  key={i}
                  onClick={() => setQuestionChoice(i + 1)}
                  className="w-full p-2.5 rounded-lg border text-left"
                  style={{
                    borderColor:
                      questionChoice === i + 1 ? "#0C447C" : "#E5E7EB",
                    background: questionChoice === i + 1 ? "#EFF6FF" : "#fff",
                  }}
                >
                  <p className="text-[11px] text-gray-400 mb-0.5">or try:</p>
                  <p className="text-[14px] text-gray-800 leading-snug">
                    {fillTemplate(alt, guideForTemplate)}
                  </p>
                </button>
              ))}
              <button
                onClick={() => setQuestionChoice("custom")}
                className="w-full p-2.5 rounded-lg border border-dashed text-left"
                style={{
                  borderColor:
                    questionChoice === "custom" ? "#0C447C" : "#D1D5DB",
                  background:
                    questionChoice === "custom" ? "#EFF6FF" : "#FAFAFA",
                }}
              >
                <p className="text-[11px] text-gray-400 mb-0.5">
                  None fit? Write your own
                </p>
                {questionChoice === "custom" ? (
                  <textarea
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    rows={2}
                    placeholder={`Write a question for ${guideName || "your guide"} to ask the group`}
                    className="w-full mt-1 text-[14px] rounded border border-gray-200 p-2 resize-none focus:outline-none focus:border-blue-500 bg-white"
                  />
                ) : (
                  <p className="text-[13px] text-gray-500">
                    Write a question for {guideName || "your guide"} to ask
                  </p>
                )}
              </button>
            </div>

            {/* Answer */}
            <div>
              <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                {guideName || "Your guide"}&rsquo;s answer
              </label>
              <textarea
                value={draftAnswer}
                onChange={(e) => setDraftAnswer(e.target.value)}
                rows={4}
                placeholder="Write what the guide would say. Keep it natural — like you're talking to a curious friend."
                className="w-full text-[15px] rounded-lg border border-gray-200 p-3 resize-none leading-relaxed focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={toggleVoice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] mt-2"
                style={{
                  background: listening ? "#FEE2E2" : "#F3F4F6",
                  color: listening ? "#DC2626" : "#6B7280",
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                </svg>
                {listening ? "Listening..." : "Say it instead"}
              </button>
            </div>

            {/* Annotation point */}
            <div>
              <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                Photo annotation
              </label>
              <button
                onClick={() => setTappingPhoto(true)}
                className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 text-[13px] text-gray-500"
              >
                {draftCoord
                  ? `Marker placed at ${Math.round(draftCoord.x)}%, ${Math.round(draftCoord.y)}% — tap photo again to move`
                  : "Tap on the photo above to mark what you're describing"}
              </button>
            </div>

            {/* Look first toggle */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-amber-900">
                    Should the group observe this before reading?
                  </p>
                  <p className="text-[12px] text-amber-700 mt-0.5 leading-relaxed">
                    Toggle on to make this a group look-and-discuss moment before the answer is revealed.
                  </p>
                </div>
                <button
                  onClick={() => setDraftLookFirst(!draftLookFirst)}
                  className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                  style={{ background: draftLookFirst ? "#D97706" : "#E5E7EB" }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                    style={{
                      transform: draftLookFirst
                        ? "translateX(22px)"
                        : "translateX(2px)",
                    }}
                  />
                </button>
              </div>
              {draftLookFirst && (
                <input
                  value={draftLookPrompt}
                  onChange={(e) => setDraftLookPrompt(e.target.value)}
                  placeholder="What should they look at? e.g. the cornerstone"
                  className="w-full mt-2 text-[14px] rounded-lg border border-amber-200 px-3 py-2 focus:outline-none focus:border-amber-500 bg-white"
                />
              )}
            </div>

            {/* Historical photo */}
            <div>
              <label className="text-[12px] font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">
                Historical photo (optional)
              </label>
              {draftHistoricalUrl ? (
                <div>
                  <img
                    src={draftHistoricalUrl}
                    alt="Historical"
                    className="w-full rounded-lg object-cover"
                    style={{ aspectRatio: "4/3" }}
                  />
                  <button
                    onClick={() => {
                      setDraftHistoricalUrl(null);
                      setDraftHistoricalFile(null);
                    }}
                    className="text-[12px] text-gray-400 mt-1"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => histFileRef.current?.click()}
                  className="w-full py-2.5 rounded-lg border border-dashed border-amber-300 text-[12px] text-amber-600"
                >
                  Add an old photo for this stop
                </button>
              )}
              <input
                ref={histFileRef}
                type="file"
                accept="image/*"
                onChange={handleHistoricalImage}
                className="hidden"
              />
            </div>

            {/* Preview of how it'll appear to explorers */}
            {draftAnswer.trim() && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                <p className="text-[11px] uppercase font-semibold text-blue-700 mb-1">
                  Preview — how the group will see this
                </p>
                <p className="text-[15px] text-gray-900 italic leading-snug mb-2">
                  {guideName || "Your guide"} asks your group: &ldquo;
                  {getQuestionText() || "..."}&rdquo;
                </p>
                {draftLookFirst && (
                  <p className="text-[12px] text-amber-700 mb-1.5">
                    First: &ldquo;Everyone look at {draftLookPrompt || "..."}. Discuss together.&rdquo;
                  </p>
                )}
                <p className="text-[14px] text-gray-700 leading-relaxed">
                  {draftAnswer}
                </p>
              </div>
            )}

            {/* Warning if too many */}
            {showWarning && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-[13px] text-red-700">
                  Groups tend to lose focus after 4 stops. Can any of these be combined?
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer: stop navigation and save */}
        <div className="flex flex-col gap-2 px-4 py-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-[12px] text-gray-500">
            <span>{answers.length} stop{answers.length !== 1 ? "s" : ""} saved</span>
            <span>
              Stop {currentStopIdx + 1} of {journey.stops.length} in journey
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase("place")}
              className="px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-500"
            >
              Back
            </button>
            <button
              onClick={saveAnswerAndContinue}
              disabled={!draftAnswer.trim() || (questionChoice === "custom" && !customQuestion.trim())}
              className="flex-1 py-3 rounded-xl text-[14px] font-semibold"
              style={{
                background:
                  draftAnswer.trim() &&
                  !(questionChoice === "custom" && !customQuestion.trim())
                    ? "#0C447C"
                    : "#E5E7EB",
                color:
                  draftAnswer.trim() &&
                  !(questionChoice === "custom" && !customQuestion.trim())
                    ? "#fff"
                    : "#9CA3AF",
              }}
            >
              Save & continue
            </button>
            <button
              onClick={finishQuestions}
              disabled={answers.length < 1}
              className="px-4 py-3 rounded-xl text-[14px] font-semibold"
              style={{
                background: answers.length >= 1 ? "#16A34A" : "#E5E7EB",
                color: answers.length >= 1 ? "#fff" : "#9CA3AF",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ PHASE: ARRANGE ═══

  if (phase === "arrange") {
    const orderedAnswers = order.map((i) => answers[i]);
    return (
      <div className="flex flex-col h-full bg-white">
        <Header title="Arrange the stops" />
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-[13px] text-gray-500 leading-relaxed">
            Reorder your stops. Build from observation toward the perspective.
          </p>

          {orderedAnswers.map((a, pos) => (
            <div
              key={pos}
              className="p-3 rounded-xl border border-gray-200 flex gap-3"
            >
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => moveUp(pos)}
                  disabled={pos === 0}
                  className="text-[14px] disabled:text-gray-200 text-gray-400"
                >
                  ▲
                </button>
                <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[13px] font-semibold">
                  {pos + 1}
                </span>
                <button
                  onClick={() => moveDown(pos)}
                  disabled={pos === order.length - 1}
                  className="text-[14px] disabled:text-gray-200 text-gray-400"
                >
                  ▼
                </button>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] italic text-blue-700 leading-snug mb-1">
                  &ldquo;{a.questionText}&rdquo;
                </p>
                <p className="text-[14px] text-gray-800 leading-relaxed">
                  {a.answer}
                </p>
                {a.lookFirst && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    👁 Group look-first
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Perspective statement at bottom */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white">
            <p className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold mb-1">
              Everything builds toward this
            </p>
            <p className="text-[15px] leading-relaxed italic">
              &ldquo;{guidePerspective}&rdquo;
            </p>
            <p className="text-[12px] text-blue-200 mt-2">
              — {guideName}, {guideRole}
            </p>
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => setPhase("questions")}
            className="px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-500"
          >
            Back
          </button>
          <button
            onClick={() => setPhase("preview")}
            className="flex-1 py-3 rounded-xl bg-[#0C447C] text-white text-[15px] font-semibold"
          >
            Preview as group
          </button>
        </div>
      </div>
    );
  }

  // ═══ PHASE: PREVIEW ═══

  if (phase === "preview") {
    const orderedAnswers = order.map((i) => answers[i]);
    return (
      <div className="flex flex-col h-full bg-white">
        <Header title="Group preview" />
        <div className="flex-1 overflow-y-auto">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={title}
              className="w-full object-cover"
              style={{ aspectRatio: "4/3" }}
            />
          )}
          <div className="p-4 space-y-4">
            {/* Guide card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
              <div className="flex items-start gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-semibold text-white shrink-0"
                  style={{ background: "#0C447C" }}
                >
                  {getInitials(guideName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-gray-900">
                    {guideName}
                  </p>
                  <p className="text-[14px] text-gray-600">
                    {guideRole} · {guideEra}
                  </p>
                </div>
              </div>
              <p className="text-[15px] text-gray-800 mt-3 italic leading-relaxed">
                &ldquo;{guideRelationship}&rdquo;
              </p>
            </div>

            {/* Stops */}
            {orderedAnswers.map((a, i) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-blue-50 border border-blue-100"
              >
                <p className="text-[12px] font-semibold text-blue-700 mb-2">
                  Stop {i + 1} of {orderedAnswers.length}
                </p>
                {a.lookFirst && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 mb-2">
                    <p className="text-[14px] text-amber-800 font-medium">
                      {guideName} says: &ldquo;Everyone look at{" "}
                      {a.lookPrompt || "this"}. Talk about what you see.&rdquo;
                    </p>
                  </div>
                )}
                <p className="text-[16px] font-semibold text-gray-900 italic leading-snug mb-2">
                  {guideName} asks your group: &ldquo;{a.questionText}&rdquo;
                </p>
                <div className="p-3 rounded-lg bg-white border border-blue-200">
                  <p className="text-[10px] uppercase font-semibold text-blue-700 mb-1">
                    {guideName}&rsquo;s answer
                  </p>
                  <p className="text-[14px] text-gray-800 leading-relaxed">
                    {a.answer}
                  </p>
                </div>
              </div>
            ))}

            {/* Perspective */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white">
              <p className="text-[10px] uppercase tracking-wider text-blue-200 font-semibold mb-2">
                {guideName}&rsquo;s message to your group
              </p>
              <p className="text-[18px] font-medium leading-relaxed italic">
                &ldquo;{guidePerspective}&rdquo;
              </p>
            </div>

            {publishError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-[13px] text-red-700">
                {publishError}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-gray-100">
          <button
            onClick={() => setPhase("arrange")}
            className="px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-500"
          >
            Edit
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white text-[15px] font-semibold disabled:opacity-50"
          >
            {publishing ? "Publishing..." : "Publish to map"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
