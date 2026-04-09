"use client";

import { useState, useEffect, useRef } from "react";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Pin,
  TYPE_ICONS,
  TYPE_LABELS,
  ROLE_COLORS,
  TYPE_COLORS,
} from "../lib/types";

// ─── Helpers ────────────────────────────────────────────────────────────────

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

function ReadAloudButton({ text, label = "Read aloud" }: { text: string; label?: string }) {
  return (
    <button
      onClick={() => speak(text)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] text-gray-600 bg-gray-100 hover:bg-gray-200"
      aria-label={label}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
      </svg>
      {label}
    </button>
  );
}

// ─── Discussion Pause ───────────────────────────────────────────────────────

function DiscussionPause({ onContinue }: { onContinue: () => void }) {
  const [timer, setTimer] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startTimer(seconds: number) {
    setTimer(seconds);
    setRemaining(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  return (
    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 my-3">
      <p className="text-[15px] font-medium text-amber-800 mb-3">
        Discuss with your group
      </p>
      {timer === null ? (
        <div className="flex flex-col gap-2">
          <button
            onClick={() => startTimer(30)}
            className="w-full py-3 rounded-lg bg-white border border-amber-200 text-[15px] font-medium text-amber-700"
          >
            30-second timer
          </button>
          <button
            onClick={() => startTimer(60)}
            className="w-full py-3 rounded-lg bg-white border border-amber-200 text-[15px] font-medium text-amber-700"
          >
            1-minute timer
          </button>
          <button
            onClick={onContinue}
            className="w-full py-3 rounded-lg bg-amber-600 text-white text-[15px] font-medium"
          >
            We're ready — continue
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl font-semibold text-amber-700 tabular-nums">
            {Math.floor(remaining / 60)}:
            {String(remaining % 60).padStart(2, "0")}
          </div>
          <button
            onClick={onContinue}
            className="w-full py-3 rounded-lg bg-amber-600 text-white text-[15px] font-medium"
          >
            We've discussed it — continue
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Guide Card ─────────────────────────────────────────────────────────────

function GuideCard({ guide }: { guide: NonNullable<Pin["guide"]> }) {
  const labelByType = {
    historical: "Historical figure",
    composite: "Composite character",
    self: "Storyteller's own perspective",
  };
  return (
    <div className="mx-4 mt-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-white border border-blue-100">
      <div className="flex items-start gap-3">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-semibold text-white shrink-0"
          style={{ background: TYPE_COLORS.guided }}
        >
          {guide.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-gray-900 leading-tight">
            {guide.name}
          </p>
          <p className="text-[14px] text-gray-600 mt-0.5">
            {guide.role} · {guide.era}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-blue-600 mt-1 font-medium">
            {labelByType[guide.type]}
          </p>
        </div>
      </div>
      <p className="text-[15px] text-gray-800 mt-3 leading-relaxed italic">
        &ldquo;{guide.relationship}&rdquo;
      </p>
      {guide.type === "composite" && guide.basedOn && (
        <p className="text-[12px] text-gray-500 mt-2">
          Based on {guide.basedOn}
        </p>
      )}
    </div>
  );
}

// ─── Pin Photo with Annotations ─────────────────────────────────────────────

function PinPhoto({
  pin,
  activeAnnotation,
  onAnnotationClick,
}: {
  pin: Pin;
  activeAnnotation: number | null;
  onAnnotationClick: (i: number) => void;
}) {
  const fallbackMap: Record<string, { bg: string; icon: string }> = {
    "Memorial Church mosaics": { bg: "#D5C4A1", icon: "\u26EA" },
    "The Cactus Garden's hidden origin": { bg: "#A8C99A", icon: "\u{1F335}" },
    "Where the oak grove stood": { bg: "#8B9E7C", icon: "\u{1F333}" },
    "What is this symbol?": { bg: "#C4B8A8", icon: "\u{1F523}" },
    "Rodin sculpture garden \u2014 the casting debate": { bg: "#B8AFA3", icon: "\u{1F3DB}" },
  };

  const hasPhoto = !!pin.photoUrl;
  const fallback = fallbackMap[pin.title] ?? { bg: "#ccc", icon: "\u{1F4CD}" };

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: "4/3" }}
    >
      {hasPhoto ? (
        <img
          src={pin.photoUrl!}
          alt={pin.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${fallback.bg} 0%, ${fallback.bg}dd 100%)`,
          }}
        >
          <span className="text-7xl opacity-20">{fallback.icon}</span>
        </div>
      )}
      {pin.annotations.map((a, i) => (
        <button
          key={i}
          onClick={() => onAnnotationClick(i)}
          className="absolute flex items-center justify-center rounded-full font-semibold transition-all"
          style={{
            left: `${a.x}%`,
            top: `${a.y}%`,
            transform: "translate(-50%,-50%)",
            width: activeAnnotation === i ? 36 : 30,
            height: activeAnnotation === i ? 36 : 30,
            fontSize: 14,
            background:
              activeAnnotation === i
                ? TYPE_COLORS.guided
                : "rgba(255,255,255,0.95)",
            color: activeAnnotation === i ? "#fff" : "#333",
            border:
              activeAnnotation === i
                ? `2.5px solid ${TYPE_COLORS.guided}`
                : "2px solid rgba(0,0,0,0.25)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            zIndex: activeAnnotation === i ? 3 : 2,
          }}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

// ─── Annotation Stop (one stop in the guided exploration) ───────────────────

function AnnotationStop({
  annotation,
  index,
  total,
  guideName,
  onNext,
}: {
  annotation: Pin["annotations"][number];
  index: number;
  total: number;
  guideName: string;
  onNext: () => void;
}) {
  // Phases within a stop:
  // 0: question (with optional "look first" pause before answer)
  // 1: discussion pause (if lookFirst)
  // 2: answer revealed
  const [phase, setPhase] = useState(0);

  // Reset when annotation changes
  useEffect(() => {
    setPhase(0);
  }, [index]);

  const question =
    annotation.question ||
    annotation.note ||
    "What do you notice here?";
  const answer = annotation.answer ?? annotation.insight ?? annotation.note ?? "";
  const lookFirst = !!annotation.lookFirst;

  const attributedQuestion = `${guideName} asks your group: "${question}"`;
  const lookSentence = annotation.lookPrompt
    ? `${guideName} says: "Everyone look at ${annotation.lookPrompt}. Talk about what you see together."`
    : `${guideName} says: "Everyone look. Talk about what you see together."`;

  return (
    <div className="mx-4 -mt-2 relative z-10 p-4 bg-blue-50 rounded-xl border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] text-blue-700 font-semibold">
          Stop {index + 1} of {total}
        </div>
        <div className="text-[12px] text-gray-500">{guideName}</div>
      </div>

      {phase === 0 && (
        <>
          {lookFirst ? (
            <>
              <p className="text-[18px] font-semibold text-gray-900 leading-snug mb-2">
                {lookSentence}
              </p>
              <div className="mb-3">
                <ReadAloudButton text={lookSentence} />
              </div>
              <button
                onClick={() => setPhase(1)}
                className="w-full py-3 rounded-lg bg-blue-600 text-white text-[15px] font-semibold"
              >
                Start group discussion
              </button>
            </>
          ) : (
            <>
              <p className="text-[18px] font-semibold text-gray-900 leading-snug mb-2">
                {attributedQuestion}
              </p>
              <div className="mb-3">
                <ReadAloudButton text={attributedQuestion} />
              </div>
              <button
                onClick={() => setPhase(2)}
                className="w-full py-3 rounded-lg bg-blue-600 text-white text-[15px] font-semibold"
              >
                Reveal {guideName}&rsquo;s answer
              </button>
            </>
          )}
        </>
      )}

      {phase === 1 && (
        <>
          <p className="text-[15px] text-gray-700 mb-2 leading-relaxed">
            Look together. When you&rsquo;ve discussed it, continue.
          </p>
          <DiscussionPause onContinue={() => setPhase(2)} />
        </>
      )}

      {phase === 2 && (
        <>
          <p className="text-[15px] text-blue-700 italic leading-relaxed mb-2">
            {attributedQuestion}
          </p>
          <div className="p-3 bg-white rounded-lg border border-blue-200 mt-2">
            <p className="text-[10px] uppercase tracking-wide text-blue-600 font-medium mb-1">
              {guideName}&rsquo;s answer
            </p>
            <p className="text-[15px] text-gray-800 leading-relaxed">{answer}</p>
            <div className="mt-2">
              <ReadAloudButton text={answer} />
            </div>
          </div>
          {annotation.historicalPhotoUrl && (
            <div className="mt-3">
              <img
                src={annotation.historicalPhotoUrl}
                alt="Historical"
                className="w-full rounded-lg object-cover"
                style={{ aspectRatio: "4/3" }}
              />
              <p className="text-[12px] text-amber-700 mt-1">Historical photo</p>
            </div>
          )}
          <button
            onClick={onNext}
            className="w-full mt-3 py-3 rounded-lg bg-gray-900 text-white text-[15px] font-semibold"
          >
            {index < total - 1 ? "Next stop \u2192" : "Hear " + guideName + "\u2019s message"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main PinDetail ─────────────────────────────────────────────────────────

interface PinDetailProps {
  pin: Pin;
  allPins: Pin[];
  onClose: () => void;
  onTagClick: (tag: string) => void;
  onConnectedPinClick: (pin: Pin) => void;
}

export default function PinDetail({
  pin,
  allPins,
  onClose,
  onTagClick,
  onConnectedPinClick,
}: PinDetailProps) {
  const [activeAnnotation, setActiveAnnotation] = useState<number | null>(null);
  const [explorationComplete, setExplorationComplete] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [upvoted, setUpvoted] = useState<{
    accurate: boolean;
    helpful: boolean;
  }>({
    accurate: false,
    helpful: false,
  });

  // Stop speech when pin changes / unmounts
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [pin.id]);

  // Reset exploration state when pin changes
  useEffect(() => {
    setActiveAnnotation(null);
    setExplorationComplete(false);
    setShowHistorical(false);
  }, [pin.id]);

  const guide = pin.guide;
  const guideName = guide?.name ?? "The storyteller";

  // Connected pins: share at least one tag, exclude self
  const connectedPins =
    pin.tags.length > 0
      ? allPins.filter(
          (p) => p.id !== pin.id && p.tags.some((t) => pin.tags.includes(t))
        )
      : [];

  // Other guides at this same location (within ~50m)
  const otherGuidesHere = allPins.filter(
    (p) =>
      p.id !== pin.id &&
      p.guide &&
      Math.abs(p.lat - pin.lat) < 0.0005 &&
      Math.abs(p.lng - pin.lng) < 0.0005
  );

  async function handleUpvote(field: "accurate" | "helpful") {
    if (upvoted[field]) return;
    setUpvoted((prev) => ({ ...prev, [field]: true }));
    try {
      await updateDoc(doc(db, "pins", pin.id), {
        [`upvotes.${field}`]: increment(1),
      });
    } catch {
      // silently fail for offline
    }
  }

  function handleNextStop() {
    if (activeAnnotation === null) return;
    if (activeAnnotation < pin.annotations.length - 1) {
      setActiveAnnotation(activeAnnotation + 1);
    } else {
      setExplorationComplete(true);
      setActiveAnnotation(null);
    }
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-gray-300" />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Photo */}
        {!showHistorical ? (
          <PinPhoto
            pin={pin}
            activeAnnotation={activeAnnotation}
            onAnnotationClick={(i) => setActiveAnnotation(i)}
          />
        ) : (
          <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
            <img
              src={pin.historicalPhotoUrl!}
              alt="Historical"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[12px] font-medium">
              Historical photo
            </div>
          </div>
        )}

        {/* Historical photo toggle */}
        {pin.historicalPhotoUrl && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => setShowHistorical(!showHistorical)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium"
              style={{
                background: showHistorical ? "#FEF3C7" : "#F3F4F6",
                color: showHistorical ? "#D97706" : "#6B7280",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {showHistorical ? "Show current" : "Compare with old photo"}
            </button>
          </div>
        )}

        {/* Active stop (guided exploration) */}
        {activeAnnotation !== null && pin.annotations[activeAnnotation] && (
          <AnnotationStop
            annotation={pin.annotations[activeAnnotation]}
            index={activeAnnotation}
            total={pin.annotations.length}
            guideName={guideName}
            onNext={handleNextStop}
          />
        )}

        {/* Guide card */}
        {guide && activeAnnotation === null && !explorationComplete && (
          <GuideCard guide={guide} />
        )}

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title row */}
          {activeAnnotation === null && (
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{TYPE_ICONS[pin.type]}</span>
                <span
                  className="text-[12px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: TYPE_COLORS[pin.type] + "15",
                    color: TYPE_COLORS[pin.type],
                  }}
                >
                  {TYPE_LABELS[pin.type]}
                </span>
                {pin.era && (
                  <span className="text-[12px] text-gray-400 font-medium">
                    {pin.era}
                  </span>
                )}
              </div>
              <h2 className="text-[20px] font-semibold text-gray-900 leading-tight">
                {pin.title}
              </h2>
            </div>
          )}

          {/* Contributor */}
          {activeAnnotation === null && (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-[12px] font-medium text-gray-500">
                {pin.contributor.name[0]}
              </div>
              <span className="text-[14px] text-gray-700">
                Pin by {pin.contributor.name}
              </span>
              <span
                className="text-[12px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: (ROLE_COLORS[pin.contributor.role] ?? "#888") + "18",
                  color: ROLE_COLORS[pin.contributor.role] ?? "#888",
                }}
              >
                {pin.contributor.role}
              </span>
            </div>
          )}

          {/* Description */}
          {activeAnnotation === null && !explorationComplete && (
            <p className="text-[15px] leading-relaxed text-gray-600">
              {pin.description}
            </p>
          )}

          {/* CTA — start exploration */}
          {pin.annotations.length > 0 &&
            activeAnnotation === null &&
            !explorationComplete && (
              <button
                onClick={() => setActiveAnnotation(0)}
                className="w-full py-4 rounded-xl text-[16px] font-semibold text-white"
                style={{ background: TYPE_COLORS.guided }}
              >
                Start guided exploration with your group
              </button>
            )}

          {/* Perspective statement (revealed at end) */}
          {explorationComplete && guide && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white">
              <p className="text-[11px] uppercase tracking-wider text-blue-200 font-semibold mb-2">
                {guide.name}&rsquo;s message to your group
              </p>
              <p className="text-[18px] font-medium leading-relaxed">
                &ldquo;{guide.perspective}&rdquo;
              </p>
              <div className="mt-3">
                <button
                  onClick={() => speak(guide.perspective)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] text-white bg-white/15 hover:bg-white/25"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  </svg>
                  Read aloud
                </button>
              </div>
            </div>
          )}

          {/* Other guides at this same place */}
          {explorationComplete && otherGuidesHere.length > 0 && (
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
              <p className="text-[13px] font-semibold text-purple-700 mb-2">
                See this place through different eyes
              </p>
              {otherGuidesHere.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  onClick={() => onConnectedPinClick(p)}
                  className="flex items-center gap-2.5 w-full p-2 rounded-lg hover:bg-white text-left mb-1"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
                    style={{ background: TYPE_COLORS[p.type] }}
                  >
                    {p.guide?.avatarInitials ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-gray-900">
                      {p.guide?.name ?? p.title}
                    </p>
                    <p className="text-[12px] text-gray-500">
                      {p.guide?.role}
                      {p.guide?.era ? " · " + p.guide.era : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Tags */}
          {activeAnnotation === null && pin.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pin.tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-[13px] font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Upvotes */}
          {activeAnnotation === null && (
            <div className="flex gap-4 pt-1">
              <button
                onClick={() => handleUpvote("accurate")}
                className="flex items-center gap-1.5 text-[14px] transition-colors"
                style={{
                  color: upvoted.accurate ? TYPE_COLORS.guided : "#9ca3af",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                </svg>
                {pin.upvotes.accurate + (upvoted.accurate ? 1 : 0)} accurate
              </button>
              <button
                onClick={() => handleUpvote("helpful")}
                className="flex items-center gap-1.5 text-[14px] transition-colors"
                style={{
                  color: upvoted.helpful ? TYPE_COLORS.guided : "#9ca3af",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 00-6 0v4H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2h-5z" />
                </svg>
                {pin.upvotes.helpful + (upvoted.helpful ? 1 : 0)} helpful
              </button>
            </div>
          )}

          {/* Resources */}
          {activeAnnotation === null && pin.resources.length > 0 && (
            <div>
              <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Go deeper
              </h3>
              <div className="space-y-2">
                {pin.resources.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg text-[14px] text-gray-700"
                  >
                    <span className="text-gray-400">
                      {r.type === "archive"
                        ? "\u{1F4DA}"
                        : r.type === "book"
                          ? "\u{1F4D6}"
                          : r.type === "museum"
                            ? "\u{1F3DB}"
                            : "\u{1F4CB}"}
                    </span>
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected pins */}
          {connectedPins.length > 0 &&
            (explorationComplete || pin.annotations.length === 0) && (
              <div>
                <h3 className="text-[12px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Nearby related pins
                </h3>
                <div className="space-y-1.5">
                  {connectedPins.slice(0, 4).map((cp) => (
                    <button
                      key={cp.id}
                      onClick={() => onConnectedPinClick(cp)}
                      className="flex items-center gap-2.5 w-full p-2.5 bg-gray-50 rounded-lg text-left hover:bg-blue-50 transition-colors"
                    >
                      <span className="text-base">
                        {TYPE_ICONS[cp.type]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-gray-800 truncate">
                          {cp.title}
                        </p>
                        <p className="text-[12px] text-gray-400">
                          {cp.tags
                            .filter((t) => pin.tags.includes(t))
                            .slice(0, 2)
                            .join(", ")}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Add observation prompt */}
          {activeAnnotation === null && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-center">
              <p className="text-[15px] text-amber-700 font-semibold mb-1">
                Did your group notice something here?
              </p>
              <p className="text-[13px] text-amber-600">
                Add your group&rsquo;s observation to this place
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-500 z-20"
        aria-label="Close"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
