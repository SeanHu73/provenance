"use client";

import { useState } from "react";
import { doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Pin,
  TYPE_ICONS,
  TYPE_LABELS,
  ROLE_COLORS,
  TYPE_COLORS,
} from "../lib/types";

function PhotoPlaceholder({
  pin,
  activeAnnotation,
  onAnnotationClick,
}: {
  pin: Pin;
  activeAnnotation: number | null;
  onAnnotationClick: (i: number) => void;
}) {
  const bgMap: Record<string, { bg: string; icon: string }> = {
    "Memorial Church mosaics": { bg: "#D5C4A1", icon: "\u26EA" },
    "The Cactus Garden's hidden origin": { bg: "#A8C99A", icon: "\u{1F335}" },
    "Where the oak grove stood": { bg: "#8B9E7C", icon: "\u{1F333}" },
    "What is this symbol?": { bg: "#C4B8A8", icon: "\u{1F523}" },
    "Rodin sculpture garden — the casting debate": { bg: "#B8AFA3", icon: "\u{1F3DB}" },
  };
  const { bg, icon } = bgMap[pin.title] ?? { bg: "#ccc", icon: "\u{1F4CD}" };

  return (
    <div
      className="relative w-full overflow-hidden flex items-center justify-center"
      style={{
        aspectRatio: "4/3",
        background: `linear-gradient(135deg, ${bg} 0%, ${bg}dd 100%)`,
      }}
    >
      <span className="text-7xl opacity-20">{icon}</span>
      {pin.annotations.map((a, i) => (
        <button
          key={i}
          onClick={() => onAnnotationClick(i)}
          className="absolute flex items-center justify-center rounded-full text-xs font-semibold transition-all"
          style={{
            left: `${a.x}%`,
            top: `${a.y}%`,
            transform: "translate(-50%,-50%)",
            width: activeAnnotation === i ? 32 : 26,
            height: activeAnnotation === i ? 32 : 26,
            background: activeAnnotation === i ? TYPE_COLORS.guided : "rgba(255,255,255,0.9)",
            color: activeAnnotation === i ? "#fff" : "#333",
            border: activeAnnotation === i ? `2.5px solid ${TYPE_COLORS.guided}` : "2px solid rgba(0,0,0,0.25)",
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

export default function PinDetail({
  pin,
  onClose,
}: {
  pin: Pin;
  onClose: () => void;
}) {
  const [activeAnnotation, setActiveAnnotation] = useState<number | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [upvoted, setUpvoted] = useState<{ accurate: boolean; helpful: boolean }>({
    accurate: false,
    helpful: false,
  });

  const currentAnn = activeAnnotation !== null ? pin.annotations[activeAnnotation] : null;

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

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-10 h-1 rounded-full bg-gray-300" />
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Photo */}
        <PhotoPlaceholder
          pin={pin}
          activeAnnotation={activeAnnotation}
          onAnnotationClick={(i) => {
            setActiveAnnotation(i);
            setShowQuestion(false);
          }}
        />

        {/* Annotation panel */}
        {currentAnn && (
          <div className="mx-4 -mt-2 relative z-10 p-3 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-xs text-blue-600 font-medium mb-1">
              Annotation {activeAnnotation! + 1} of {pin.annotations.length}
            </div>
            <p className="text-sm leading-relaxed text-gray-800 mb-2">
              {currentAnn.note}
            </p>
            {currentAnn.question && !showQuestion && (
              <button
                onClick={() => setShowQuestion(true)}
                className="w-full text-left p-2.5 bg-blue-100 text-blue-700 rounded-md text-sm font-medium"
              >
                Think about it: {currentAnn.question}
              </button>
            )}
            {showQuestion && currentAnn.question && (
              <div className="p-2.5 bg-white rounded-md border border-blue-200 text-sm text-gray-700">
                <p className="font-medium text-blue-700 mb-1">{currentAnn.question}</p>
                <p className="text-gray-500 text-xs">Take a moment to look before moving on.</p>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Title row */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">{TYPE_ICONS[pin.type]}</span>
              <span
                className="text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: TYPE_COLORS[pin.type] + "15",
                  color: TYPE_COLORS[pin.type],
                }}
              >
                {TYPE_LABELS[pin.type]}
              </span>
              {pin.era && (
                <span className="text-xs text-gray-400 font-medium">{pin.era}</span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 leading-tight">
              {pin.title}
            </h2>
          </div>

          {/* Contributor */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-500">
              {pin.contributor.name[0]}
            </div>
            <span className="text-sm text-gray-700">{pin.contributor.name}</span>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{
                background: (ROLE_COLORS[pin.contributor.role] ?? "#888") + "18",
                color: ROLE_COLORS[pin.contributor.role] ?? "#888",
              }}
            >
              {pin.contributor.role}
            </span>
          </div>

          {/* Description */}
          <p className="text-sm leading-relaxed text-gray-600">{pin.description}</p>

          {/* Guided CTA */}
          {pin.type === "guided" && pin.annotations.length > 0 && (
            <button
              onClick={() => {
                setActiveAnnotation(0);
                setShowQuestion(false);
              }}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white"
              style={{ background: TYPE_COLORS.guided }}
            >
              Start guided exploration
            </button>
          )}

          {/* Tags */}
          {pin.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pin.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Upvotes */}
          <div className="flex gap-4 pt-1">
            <button
              onClick={() => handleUpvote("accurate")}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: upvoted.accurate ? TYPE_COLORS.guided : "#9ca3af" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" /></svg>
              {pin.upvotes.accurate + (upvoted.accurate ? 1 : 0)} accurate
            </button>
            <button
              onClick={() => handleUpvote("helpful")}
              className="flex items-center gap-1.5 text-sm transition-colors"
              style={{ color: upvoted.helpful ? TYPE_COLORS.guided : "#9ca3af" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-6 0v4H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2h-5z" /></svg>
              {pin.upvotes.helpful + (upvoted.helpful ? 1 : 0)} helpful
            </button>
          </div>

          {/* Resources */}
          {pin.resources.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Go deeper
              </h3>
              <div className="space-y-2">
                {pin.resources.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg text-sm text-gray-700"
                  >
                    <span className="text-gray-400">
                      {r.type === "archive" ? "\u{1F4DA}" : r.type === "book" ? "\u{1F4D6}" : r.type === "museum" ? "\u{1F3DB}" : "\u{1F4CB}"}
                    </span>
                    {r.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add observation prompt */}
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-center">
            <p className="text-sm text-amber-700 font-medium mb-1">
              Notice something here?
            </p>
            <p className="text-xs text-amber-600">
              Add your own observation to this place
            </p>
          </div>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center text-gray-500 z-20"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
