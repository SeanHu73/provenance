"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { APIProvider, Map } from "@vis.gl/react-google-maps";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../lib/AuthContext";
import type { PinType } from "../lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
  note: string;
  connection: string;
}

interface AISuggestions {
  questions: string[];
  insights: string[];
  bigPicture: string;
  sequenceRationale: string;
  connections: { from: number; to: number; thread: string }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const ORIENT_STEPS = [
  {
    label: "Explorer sees a question",
    text: '"What do you notice about the colours in the mosaic?"',
    type: "question" as const,
  },
  {
    label: "They look at the real thing, then tap to reveal",
    text: '"The left section was restored after 1906 — original glass on the right, modern replacement on the left."',
    type: "insight" as const,
  },
  {
    label: "The insight builds on the last one",
    text: '"Each point adds a piece. By the end, the explorer sees the building differently."',
    type: "summary" as const,
  },
];

const CONNECTION_PROMPTS = [
  "How does this relate to what you described at point {prev}?",
  "Is this the same story as point {prev}, or a different layer?",
  "Would an explorer need to understand point {prev} before this one makes sense?",
  "What changed between what you described at point {prev} and what you're describing here?",
];

function getConnectionPrompt(idx: number) {
  if (idx === 0) return null;
  return CONNECTION_PROMPTS[(idx - 1) % CONNECTION_PROMPTS.length].replace(
    "{prev}",
    String(idx)
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Spinner({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-2.5">
      <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-sm text-gray-500">{text}</span>
    </div>
  );
}

function PhotoCanvas({
  points,
  activeIdx,
  tapping,
  imageUrl,
  onTap,
  onPointClick,
}: {
  points: Point[];
  activeIdx: number | null;
  tapping: boolean;
  imageUrl: string | null;
  onTap: (x: number, y: number) => void;
  onPointClick: (i: number) => void;
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
    const touch = e.touches[0];
    const x = ((touch.clientX - r.left) / r.width) * 100;
    const y = ((touch.clientY - r.top) / r.height) * 100;
    onTap(x, y);
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "4/3",
        cursor: tapping ? "crosshair" : "default",
      }}
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
        <div className="absolute inset-0 border-2 border-dashed border-blue-400/40 pointer-events-none" />
      )}
      {tapping && points.length === 0 && (
        <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
          <span className="px-3 py-1.5 rounded-full bg-black/50 text-white text-xs">
            Tap where you want explorers to look first
          </span>
        </div>
      )}
      {points.map((p, i) => {
        const active = activeIdx === i;
        const done = !!p.note?.trim();
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onPointClick(i);
            }}
            className="absolute flex items-center justify-center rounded-full transition-all"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: "translate(-50%,-50%)",
              width: active ? 30 : 24,
              height: active ? 30 : 24,
              background: active
                ? "#fff"
                : done
                  ? "rgba(255,255,255,0.85)"
                  : "rgba(255,255,255,0.5)",
              border: active
                ? "2.5px solid #185FA5"
                : done
                  ? "2px solid #0F6E56"
                  : "2px dashed rgba(0,0,0,0.25)",
              color: active ? "#185FA5" : done ? "#0F6E56" : "rgba(0,0,0,0.3)",
              fontSize: active ? 12 : 10,
              fontWeight: 600,
              zIndex: active ? 3 : 2,
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
            }}
          >
            {done && !active ? "✓" : i + 1}
          </button>
        );
      })}
    </div>
  );
}

// ─── Voice Input Hook ────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────────

interface StorytellerFlowProps {
  mapCenter: { lat: number; lng: number };
  onClose: () => void;
  onPublished: () => void;
}

export default function StorytellerFlow({
  mapCenter,
  onClose,
  onPublished,
}: StorytellerFlowProps) {
  // Phase
  const [phase, setPhase] = useState<"orient" | "build" | "connect" | "preview">("orient");
  const [orientStep, setOrientStep] = useState(0);

  // Build
  const [points, setPoints] = useState<Point[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [tapping, setTapping] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [historicalImageUrl, setHistoricalImageUrl] = useState<string | null>(null);
  const [historicalImageFile, setHistoricalImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const historicalFileRef = useRef<HTMLInputElement>(null);

  // Pin location (tap on map to place)
  const [pinLocation, setPinLocation] = useState<{ lat: number; lng: number }>(mapCenter);
  const [pickingLocation, setPickingLocation] = useState(false);

  // Metadata
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pinType, setPinType] = useState<PinType>("guided");

  // Connect (AI)
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [bigPicture, setBigPicture] = useState("");
  const [seqRationale, setSeqRationale] = useState("");
  const [aiConnections, setAiConnections] = useState<
    { from: number; to: number; thread: string }[]
  >([]);
  const [order, setOrder] = useState<number[]>([]);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Preview
  const [prevIdx, setPrevIdx] = useState<number | null>(null);
  const [prevPhase, setPrevPhase] = useState(0);

  // Publishing
  const [publishing, setPublishing] = useState(false);

  // Voice
  const voiceCallback = useCallback(
    (transcript: string) => {
      if (activeIdx === null) return;
      setPoints((prev) => {
        const next = [...prev];
        next[activeIdx] = {
          ...next[activeIdx],
          note: next[activeIdx].note
            ? next[activeIdx].note + " " + transcript
            : transcript,
        };
        return next;
      });
    },
    [activeIdx]
  );
  const { listening, toggle: toggleVoice } = useVoiceInput(voiceCallback);

  // Derived
  const filledCount = points.filter((p) => p.note.trim()).length;
  const orderedData = order.map((i) => ({
    ...points[i],
    question: questions[i] ?? "",
    insight: insights[i] ?? "",
    origIdx: i,
  }));

  // ── Handlers ──

  function addPoint(x: number, y: number) {
    const np = [...points, { x, y, note: "", connection: "" }];
    setPoints(np);
    setActiveIdx(np.length - 1);
    setTapping(false);
  }

  function removePoint(i: number) {
    const np = [...points];
    np.splice(i, 1);
    setPoints(np);
    if (activeIdx === i) setActiveIdx(null);
    else if (activeIdx !== null && activeIdx > i) setActiveIdx(activeIdx - 1);
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    }
  }

  function handleHistoricalImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setHistoricalImageFile(file);
      setHistoricalImageUrl(URL.createObjectURL(file));
    }
  }

  async function runAI() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/shape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: points.map((p, i) => ({
            index: i,
            note: p.note,
            connection: p.connection || undefined,
          })),
          title: title || undefined,
          description: description || undefined,
        }),
      });
      if (res.ok) {
        const data: AISuggestions = await res.json();
        setQuestions(data.questions);
        setInsights(data.insights);
        setBigPicture(data.bigPicture);
        setSeqRationale(data.sequenceRationale);
        setAiConnections(data.connections ?? []);
        setOrder(points.map((_, i) => i));
        setAiDone(true);
      } else {
        // Fallback: generate placeholders so the flow isn't blocked
        setQuestions(points.map((p) => `What do you notice about ${p.note.split(" ").slice(0, 4).join(" ")}...?`));
        setInsights(points.map((p) => p.note));
        setBigPicture("These details together reveal something about this place that you wouldn't see at a glance.");
        setSeqRationale("Current order follows the storyteller's original sequence.");
        setAiConnections([]);
        setOrder(points.map((_, i) => i));
        setAiDone(true);
      }
    } catch {
      // Fallback on network error
      setQuestions(points.map(() => "What do you notice here?"));
      setInsights(points.map((p) => p.note));
      setBigPicture("Together, these observations tell a larger story about this place.");
      setSeqRationale("Default order.");
      setOrder(points.map((_, i) => i));
      setAiDone(true);
    } finally {
      setAiLoading(false);
    }
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

  const { user } = useAuth();

  async function handlePublish() {
    setPublishing(true);
    try {
      // Upload photos to Firebase Storage
      let photoUrl: string | null = null;
      let historicalPhotoUrl: string | null = null;

      if (imageFile) {
        const storageRef = ref(storage, `pins/${Date.now()}_${imageFile.name}`);
        await uploadBytes(storageRef, imageFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      if (historicalImageFile) {
        const storageRef = ref(storage, `pins/${Date.now()}_historical_${historicalImageFile.name}`);
        await uploadBytes(storageRef, historicalImageFile);
        historicalPhotoUrl = await getDownloadURL(storageRef);
      }

      const annotations = orderedData.map((d) => ({
        x: d.x,
        y: d.y,
        note: d.insight,
        question: d.question,
        insight: d.insight,
      }));

      await addDoc(collection(db, "pins"), {
        title: title || "Untitled pin",
        type: pinType,
        description: description || orderedData.map((d) => d.note).join(" "),
        lat: pinLocation.lat,
        lng: pinLocation.lng,
        era: null,
        contributor: {
          name: user?.displayName ?? "Anonymous",
          role: "Storyteller",
        },
        tags: [],
        upvotes: { accurate: 0, helpful: 0 },
        annotations,
        resources: [],
        photoUrl,
        historicalPhotoUrl,
        createdAt: serverTimestamp(),
      });
      onPublished();
    } catch (err) {
      console.error("Publish failed:", err);
    } finally {
      setPublishing(false);
    }
  }

  // ── ORIENT ──

  if (phase === "orient") {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100">
          <span className="text-[15px] font-medium text-gray-900">
            Create a guided look
          </span>
          <button onClick={onClose} className="text-sm text-gray-400">
            Cancel
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-base font-medium text-gray-900 mb-1 leading-snug">
            You're about to help someone see this place the way you do.
          </p>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">
            Here's what an explorer will experience from what you create:
          </p>

          <div className="flex flex-col gap-2.5 mb-5">
            {ORIENT_STEPS.map((step, i) => (
              <div
                key={i}
                className="flex gap-2.5 transition-opacity duration-400"
                style={{ opacity: orientStep >= i ? 1 : 0.25 }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                  style={{
                    background:
                      step.type === "question"
                        ? "#EFF6FF"
                        : step.type === "insight"
                          ? "#F0FDF4"
                          : "#FFFBEB",
                    color:
                      step.type === "question"
                        ? "#2563EB"
                        : step.type === "insight"
                          ? "#16A34A"
                          : "#D97706",
                  }}
                >
                  {step.type === "question" ? "?" : step.type === "insight" ? "→" : "Σ"}
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-0.5">
                    {step.label}
                  </p>
                  <p
                    className="text-sm text-gray-900 leading-relaxed"
                    style={{
                      fontStyle: step.type === "question" ? "italic" : "normal",
                    }}
                  >
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {orientStep < 2 ? (
            <button
              onClick={() => setOrientStep(orientStep + 1)}
              className="w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500"
            >
              Show next step
            </button>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-800 mb-1.5 leading-relaxed">
                Your job is to share what you know. The platform will help you
                turn it into this kind of experience — suggesting questions,
                finding connections, and shaping the flow.
              </p>
              <p className="text-xs text-gray-500">
                You don't need to be a teacher. Just tell it like you'd tell a
                friend.
              </p>
            </div>
          )}
        </div>

        {orientStep >= 2 && (
          <div className="px-4 py-2.5 border-t border-gray-100">
            <button
              onClick={() => setPhase("build")}
              className="w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-medium"
            >
              Let's start
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── BUILD ──

  if (phase === "build") {
    const connPrompt =
      activeIdx !== null && activeIdx > 0
        ? getConnectionPrompt(activeIdx)
        : null;

    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100">
          <span className="text-[15px] font-medium text-gray-900">
            Build your guided look
          </span>
          <span className="text-xs text-gray-400">
            {filledCount} point{filledCount !== 1 ? "s" : ""} described
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Location picker */}
          {pickingLocation && (
            <div className="px-4 pt-2 pb-2">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-700 mb-1">
                  Tap the map to place your pin
                </p>
                <p className="text-xs text-blue-600 mb-2">
                  Place it where the subject is, not where you're standing.
                </p>
                <div
                  className="relative w-full rounded-lg overflow-hidden bg-gray-200"
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
                  {/* Crosshair overlay — fixed in screen center */}
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
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-blue-600">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={pinLocation.lat}
                      onChange={(e) => setPinLocation((prev) => ({ ...prev, lat: parseFloat(e.target.value) || prev.lat }))}
                      className="w-full text-xs rounded border border-blue-200 px-2 py-1 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-blue-600">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={pinLocation.lng}
                      onChange={(e) => setPinLocation((prev) => ({ ...prev, lng: parseFloat(e.target.value) || prev.lng }))}
                      className="w-full text-xs rounded border border-blue-200 px-2 py-1 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setPickingLocation(false)}
                  className="w-full mt-2 py-2 rounded-md bg-blue-600 text-white text-xs font-medium"
                >
                  Confirm location
                </button>
              </div>
            </div>
          )}

          {!pickingLocation && (
            <div className="px-4 pt-2">
              <button
                onClick={() => setPickingLocation(true)}
                className="w-full py-2 mb-2 rounded-lg border border-gray-200 text-xs text-gray-500 flex items-center justify-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {pinLocation.lat === mapCenter.lat && pinLocation.lng === mapCenter.lng
                  ? "Set pin location on map"
                  : `Pin: ${pinLocation.lat.toFixed(4)}, ${pinLocation.lng.toFixed(4)} — tap to change`}
              </button>
            </div>
          )}

          {/* Photo upload */}
          <div className="px-4 pt-1">
            {!imageUrl && (
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 py-3 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  Take photo
                </button>
                <button
                  onClick={() => {
                    // Create a temporary input without capture to open gallery
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
                  }}
                  className="flex-1 py-3 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400 flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                  Upload
                </button>
              </div>
            )}
            {/* Hidden camera input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImage}
              className="hidden"
            />
            <PhotoCanvas
              points={points}
              activeIdx={activeIdx}
              tapping={tapping}
              imageUrl={imageUrl}
              onTap={addPoint}
              onPointClick={(i) => {
                setActiveIdx(i);
                setTapping(false);
              }}
            />

            {/* Change photo button */}
            {imageUrl && (
              <button
                onClick={() => {
                  setImageUrl(null);
                  setImageFile(null);
                }}
                className="text-xs text-gray-400 mt-1 mb-1"
              >
                Change photo
              </button>
            )}
          </div>

          {/* Historical photo for comparison */}
          <div className="px-4 pt-1">
            {!historicalImageUrl ? (
              <button
                onClick={() => historicalFileRef.current?.click()}
                className="w-full py-2 mb-2 rounded-lg border border-dashed border-amber-200 text-xs text-amber-500 flex items-center justify-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Add a historical photo for comparison (optional)
              </button>
            ) : (
              <div className="mb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-amber-600">Historical photo</span>
                  <button
                    onClick={() => {
                      setHistoricalImageUrl(null);
                      setHistoricalImageFile(null);
                    }}
                    className="text-[10px] text-gray-400"
                  >
                    Remove
                  </button>
                </div>
                <img
                  src={historicalImageUrl}
                  alt="Historical"
                  className="w-full rounded-lg object-cover"
                  style={{ aspectRatio: "4/3" }}
                />
              </div>
            )}
            <input
              ref={historicalFileRef}
              type="file"
              accept="image/*"
              onChange={handleHistoricalImage}
              className="hidden"
            />
          </div>

          <div className="px-4 pt-2">
            {!tapping && points.length > 0 && (
              <button
                onClick={() => {
                  setActiveIdx(null);
                  setTapping(true);
                }}
                className="w-full py-2 rounded-lg border border-dashed border-gray-200 text-xs text-gray-400 mb-2"
              >
                + Tap photo to add another point
              </button>
            )}
          </div>

          {/* Active point editor */}
          {activeIdx !== null && points[activeIdx] && (
            <div className="px-4 pb-3">
              <div className="p-3 border-2 border-blue-500 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[11px] font-semibold">
                      {activeIdx + 1}
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      Point {activeIdx + 1}
                    </span>
                  </div>
                  <button
                    onClick={() => removePoint(activeIdx)}
                    className="text-xs text-red-500"
                  >
                    Remove
                  </button>
                </div>

                <label className="text-xs text-gray-500 block mb-1">
                  What's here? What should someone notice?
                </label>
                <textarea
                  value={points[activeIdx].note}
                  onChange={(e) => {
                    const np = [...points];
                    np[activeIdx] = { ...np[activeIdx], note: e.target.value };
                    setPoints(np);
                  }}
                  placeholder="Describe what you see and why it matters. Keep it natural — you're talking to a curious friend."
                  rows={3}
                  className="w-full text-sm rounded-md border border-gray-200 p-2 resize-none leading-relaxed focus:outline-none focus:border-blue-400 mb-1.5"
                />

                <button
                  onClick={toggleVoice}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs mb-2"
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

                {connPrompt && (
                  <div className="p-2.5 bg-amber-50 rounded-md mb-2">
                    <p className="text-xs font-medium text-amber-600 mb-1">
                      Connection check
                    </p>
                    <p className="text-xs text-gray-800 mb-1.5 leading-relaxed">
                      {connPrompt}
                    </p>
                    <textarea
                      value={points[activeIdx].connection}
                      onChange={(e) => {
                        const np = [...points];
                        np[activeIdx] = {
                          ...np[activeIdx],
                          connection: e.target.value,
                        };
                        setPoints(np);
                      }}
                      placeholder="Optional — jot down how they connect, or skip this"
                      rows={2}
                      className="w-full text-xs rounded border border-amber-200 p-1.5 resize-none leading-relaxed focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}

                <div className="flex gap-1.5 mt-1">
                  {activeIdx > 0 && (
                    <button
                      onClick={() => setActiveIdx(activeIdx - 1)}
                      className="px-3 py-1.5 rounded-md border border-gray-200 text-xs text-gray-500"
                    >
                      ← Prev
                    </button>
                  )}
                  {activeIdx < points.length - 1 && (
                    <button
                      onClick={() => setActiveIdx(activeIdx + 1)}
                      className="px-3 py-1.5 rounded-md border border-gray-200 text-xs text-gray-500"
                    >
                      Next →
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveIdx(null);
                      setTapping(true);
                    }}
                    className="px-3 py-1.5 rounded-md border border-gray-200 text-xs text-gray-500 ml-auto"
                  >
                    Done with this point
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Points summary when no active point */}
          {points.length > 0 && activeIdx === null && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-gray-400 mb-1.5">
                Your points so far
              </p>
              {points.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveIdx(i);
                    setTapping(false);
                  }}
                  className="flex items-start gap-2 w-full p-2.5 rounded-lg border border-gray-100 text-left mb-1"
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 mt-0.5"
                    style={{
                      background: p.note.trim() ? "#F0FDF4" : "#F3F4F6",
                      color: p.note.trim() ? "#16A34A" : "#9CA3AF",
                    }}
                  >
                    {p.note.trim() ? "✓" : i + 1}
                  </div>
                  <p className="text-xs text-gray-700 truncate flex-1">
                    {p.note.trim() || "Tap to describe..."}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Title & description (shown when points exist) */}
          {points.length > 0 && activeIdx === null && (
            <div className="px-4 pb-3 space-y-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Title for this pin
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Memorial Church mosaics"
                  className="w-full text-sm rounded-md border border-gray-200 px-2.5 py-2 focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Brief description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="One or two sentences about why this place is interesting"
                  rows={2}
                  className="w-full text-sm rounded-md border border-gray-200 p-2.5 resize-none leading-relaxed focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 py-2.5 border-t border-gray-100">
          <button
            onClick={() => setPhase("orient")}
            className="px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500"
          >
            Back
          </button>
          <button
            onClick={() => {
              setPhase("connect");
              if (!aiDone) runAI();
            }}
            disabled={filledCount < 2}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{
              background: filledCount < 2 ? "#F3F4F6" : "#111",
              color: filledCount < 2 ? "#9CA3AF" : "#fff",
              cursor: filledCount < 2 ? "default" : "pointer",
            }}
          >
            Shape into exploration
            {filledCount < 2 ? ` (need ${2 - filledCount} more)` : ""}
          </button>
        </div>
      </div>
    );
  }

  // ── CONNECT ──

  if (phase === "connect") {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100">
          <span className="text-[15px] font-medium text-gray-900">
            Shape the exploration
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-4">
          {aiLoading && (
            <div className="py-8 text-center">
              <Spinner text="Reading your notes and finding connections..." />
              <p className="text-xs text-gray-400 mt-2">
                Drafting questions, insights, and a suggested sequence.
              </p>
            </div>
          )}

          {aiDone && (
            <>
              <div className="p-2.5 bg-green-50 rounded-lg mb-3">
                <p className="text-xs text-green-700 leading-relaxed">
                  Here's what the platform built from your notes. Everything is
                  editable — tap "edit" on anything you want to change.
                </p>
              </div>

              {/* Connections spotted */}
              {aiConnections.length > 0 && (
                <div className="p-2.5 bg-amber-50 rounded-lg mb-3 border-l-[3px] border-amber-500">
                  <p className="text-xs font-medium text-amber-600 mb-1">
                    Connections spotted
                  </p>
                  {aiConnections.map((c, i) => (
                    <p key={i} className="text-xs text-gray-800 leading-relaxed">
                      Points {c.from + 1} → {c.to + 1}: {c.thread}
                    </p>
                  ))}
                </div>
              )}

              {/* Sequence rationale */}
              <div className="p-2.5 bg-blue-50 rounded-lg mb-3 border-l-[3px] border-blue-500">
                <p className="text-[10px] font-medium text-blue-600 mb-0.5">
                  Suggested sequence
                </p>
                <p className="text-xs text-gray-800 leading-relaxed">
                  {seqRationale}
                </p>
              </div>

              {/* Per-point cards */}
              {order.map((origIdx, pos) => (
                <div
                  key={origIdx}
                  className="mb-2.5 p-2.5 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="flex flex-col gap-px">
                      <button
                        onClick={() => moveUp(pos)}
                        disabled={pos === 0}
                        className="text-[10px] leading-none disabled:text-gray-200 text-gray-400"
                      >
                        ▲
                      </button>
                      <span className="text-sm font-semibold text-blue-600 text-center">
                        {pos + 1}
                      </span>
                      <button
                        onClick={() => moveDown(pos)}
                        disabled={pos === order.length - 1}
                        className="text-[10px] leading-none disabled:text-gray-200 text-gray-400"
                      >
                        ▼
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate flex-1">
                      Your note: "{points[origIdx]?.note.slice(0, 45)}..."
                    </p>
                  </div>

                  <div className="ml-7 space-y-2">
                    {/* Question */}
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">
                          Question for explorer
                        </span>
                        <button
                          onClick={() =>
                            setEditingField(
                              editingField === `q${origIdx}`
                                ? null
                                : `q${origIdx}`
                            )
                          }
                          className="text-[10px] text-blue-600"
                        >
                          {editingField === `q${origIdx}` ? "done" : "edit"}
                        </button>
                      </div>
                      {editingField === `q${origIdx}` ? (
                        <textarea
                          value={questions[origIdx]}
                          onChange={(e) => {
                            const q = [...questions];
                            q[origIdx] = e.target.value;
                            setQuestions(q);
                          }}
                          rows={2}
                          className="w-full text-xs rounded border border-gray-200 p-1.5 resize-none leading-relaxed mt-1 focus:outline-none focus:border-blue-400"
                        />
                      ) : (
                        <p className="text-xs text-gray-800 italic leading-relaxed mt-0.5">
                          {questions[origIdx]}
                        </p>
                      )}
                    </div>

                    {/* Insight */}
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                          Insight revealed
                        </span>
                        <button
                          onClick={() =>
                            setEditingField(
                              editingField === `i${origIdx}`
                                ? null
                                : `i${origIdx}`
                            )
                          }
                          className="text-[10px] text-blue-600"
                        >
                          {editingField === `i${origIdx}` ? "done" : "edit"}
                        </button>
                      </div>
                      {editingField === `i${origIdx}` ? (
                        <textarea
                          value={insights[origIdx]}
                          onChange={(e) => {
                            const ins = [...insights];
                            ins[origIdx] = e.target.value;
                            setInsights(ins);
                          }}
                          rows={2}
                          className="w-full text-xs rounded border border-gray-200 p-1.5 resize-none leading-relaxed mt-1 focus:outline-none focus:border-blue-400"
                        />
                      ) : (
                        <p className="text-xs text-gray-800 leading-relaxed mt-0.5">
                          {insights[origIdx]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Big picture */}
              <div className="p-2.5 bg-blue-50 rounded-lg mt-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">
                    The big picture
                  </span>
                  <button
                    onClick={() =>
                      setEditingField(editingField === "bp" ? null : "bp")
                    }
                    className="text-[10px] text-blue-600"
                  >
                    {editingField === "bp" ? "done" : "edit"}
                  </button>
                </div>
                {editingField === "bp" ? (
                  <textarea
                    value={bigPicture}
                    onChange={(e) => setBigPicture(e.target.value)}
                    rows={3}
                    className="w-full text-xs rounded border border-blue-200 p-1.5 resize-none leading-relaxed focus:outline-none focus:border-blue-400"
                  />
                ) : (
                  <p className="text-sm text-gray-900 font-medium leading-relaxed">
                    {bigPicture}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 px-4 py-2.5 border-t border-gray-100">
          <button
            onClick={() => setPhase("build")}
            className="px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500"
          >
            Back
          </button>
          <button
            onClick={() => {
              setPhase("preview");
              setPrevIdx(null);
              setPrevPhase(0);
            }}
            disabled={!aiDone}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium"
            style={{
              background: aiDone ? "#111" : "#F3F4F6",
              color: aiDone ? "#fff" : "#9CA3AF",
              cursor: aiDone ? "pointer" : "default",
            }}
          >
            Preview as explorer
          </button>
        </div>
      </div>
    );
  }

  // ── PREVIEW ──

  if (phase === "preview") {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between px-4 h-12 border-b border-gray-100">
          <span className="text-[15px] font-medium text-gray-900">
            Explorer preview
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-medium">
            PREVIEW
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <PhotoCanvas
            points={orderedData}
            activeIdx={prevIdx}
            tapping={false}
            imageUrl={imageUrl}
            onTap={() => {}}
            onPointClick={(i) => {
              setPrevIdx(i);
              setPrevPhase(0);
            }}
          />

          <div className="p-4">
            {/* Intro */}
            {prevIdx === null && (
              <>
                <p className="text-sm text-gray-900 mb-1 leading-relaxed">
                  This guide builds an understanding piece by piece.
                </p>
                <p className="text-sm text-gray-500 mb-3">
                  Each point adds to the picture.
                </p>
                <button
                  onClick={() => {
                    setPrevIdx(0);
                    setPrevPhase(0);
                  }}
                  className="w-full py-3 rounded-lg bg-gray-900 text-white text-sm font-medium"
                >
                  Start ({orderedData.length} points)
                </button>
              </>
            )}

            {/* Active point */}
            {prevIdx !== null && prevIdx < orderedData.length && (
              <>
                {/* Progress bar */}
                <div className="flex gap-1 mb-3">
                  {orderedData.map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 h-[3px] rounded-full"
                      style={{
                        background:
                          i < prevIdx
                            ? "#2563EB"
                            : i === prevIdx
                              ? "#111"
                              : "#E5E7EB",
                      }}
                    />
                  ))}
                </div>

                {prevPhase === 0 && (
                  <>
                    <p className="text-sm text-gray-500 mb-1">
                      {orderedData[prevIdx].note?.slice(0, 60)}
                    </p>
                    <p className="text-[15px] font-medium text-gray-900 leading-relaxed mb-3">
                      {orderedData[prevIdx].question}
                    </p>
                    <button
                      onClick={() => setPrevPhase(1)}
                      className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium"
                    >
                      See what this reveals →
                    </button>
                  </>
                )}

                {prevPhase === 1 && (
                  <>
                    <div className="p-3 bg-blue-50 rounded-lg mb-3">
                      <p className="text-sm text-gray-900 font-medium leading-relaxed">
                        {orderedData[prevIdx].insight}
                      </p>
                    </div>
                    {prevIdx > 0 && (
                      <div className="flex gap-1 flex-wrap mb-3">
                        {orderedData.slice(0, prevIdx).map((d, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full bg-gray-100 text-[10px] text-gray-500"
                          >
                            {i + 1}.{" "}
                            {d.insight?.split("—")[0]?.slice(0, 25)?.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                    {prevIdx < orderedData.length - 1 ? (
                      <button
                        onClick={() => {
                          setPrevIdx(prevIdx + 1);
                          setPrevPhase(0);
                        }}
                        className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium"
                      >
                        Next piece →
                      </button>
                    ) : (
                      <button
                        onClick={() => setPrevIdx(orderedData.length)}
                        className="w-full py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium"
                      >
                        See the full picture →
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {/* Big picture (end) */}
            {prevIdx !== null && prevIdx >= orderedData.length && (
              <div className="pt-2">
                <div className="p-3.5 bg-blue-50 rounded-xl mb-3">
                  <p className="text-[10px] font-medium text-blue-600 mb-1">
                    The big picture
                  </p>
                  <p className="text-sm text-gray-900 font-medium leading-relaxed">
                    {bigPicture}
                  </p>
                </div>
                {orderedData.map((d, i) => (
                  <div key={i} className="flex gap-1.5 py-0.5">
                    <div className="w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[8px] font-semibold shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      {d.insight}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-4 py-2.5 border-t border-gray-100">
          <button
            onClick={() => setPhase("connect")}
            className="px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-500"
          >
            Edit
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: "#16A34A" }}
          >
            {publishing ? "Publishing..." : "Publish to map"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
