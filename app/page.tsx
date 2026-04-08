"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";
import { Pin, ERA_OPTIONS } from "./lib/types";
import { useAuth } from "./lib/AuthContext";
import MapView from "./components/MapView";
import PinDetail from "./components/PinDetail";
import BottomSheet from "./components/BottomSheet";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import StorytellerFlow from "./components/StorytellerFlow";

export default function Home() {
  const { user } = useAuth();
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [mode, setMode] = useState<"explorer" | "storyteller">("explorer");
  const [activeTab, setActiveTab] = useState("map");
  const [seeding, setSeeding] = useState(false);
  const [showStorytellerFlow, setShowStorytellerFlow] = useState(false);

  // Filters
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeEra, setActiveEra] = useState<string | null>(null);

  // Highlighted pins (connected pins after exploration)
  const [highlightedPinIds, setHighlightedPinIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    loadPins();
  }, []);

  // Reset storyteller mode if user signs out
  useEffect(() => {
    if (!user && mode === "storyteller") {
      setMode("explorer");
    }
  }, [user, mode]);

  async function loadPins() {
    try {
      const snapshot = await getDocs(collection(db, "pins"));
      const loaded = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pin[];
      setPins(loaded);
    } catch {
      // offline or not yet seeded
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      await fetch("/seed", { method: "POST" });
      await loadPins();
    } finally {
      setSeeding(false);
    }
  }

  // Derived: all unique tags and eras present in pins
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    pins.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [pins]);

  const presentEras = useMemo(() => {
    const eras = new Set<string>();
    pins.forEach((p) => {
      if (p.era) eras.add(p.era);
    });
    return ERA_OPTIONS.filter((e) => eras.has(e));
  }, [pins]);

  // Filtered pins
  const filteredPins = useMemo(() => {
    return pins.filter((p) => {
      if (activeTag && !p.tags.includes(activeTag)) return false;
      if (activeEra && p.era !== activeEra) return false;
      return true;
    });
  }, [pins, activeTag, activeEra]);

  function handleTagClick(tag: string) {
    setActiveTag(tag);
    setSelectedPin(null);
  }

  function handleConnectedPinClick(pin: Pin) {
    // Highlight connected pins on map and open the clicked one
    const connectedIds = new Set(
      pins
        .filter(
          (p) =>
            p.id !== pin.id && p.tags.some((t) => pin.tags.includes(t))
        )
        .map((p) => p.id)
    );
    setHighlightedPinIds(connectedIds);
    setSelectedPin(pin);
  }

  function handlePinClose() {
    setSelectedPin(null);
    // Clear highlights after a delay so user sees them on the map
    setTimeout(() => setHighlightedPinIds(new Set()), 3000);
  }

  const hasActiveFilter = activeTag !== null || activeEra !== null;

  return (
    <div className="flex flex-col h-dvh max-w-[480px] mx-auto w-full bg-white relative overflow-hidden">
      <Header mode={mode} onModeChange={setMode} />

      <main className="flex-1 relative overflow-hidden">
        {activeTab === "map" ? (
          <>
            <MapView
              pins={filteredPins}
              selectedPin={selectedPin}
              highlightedPinIds={highlightedPinIds}
              onPinClick={setSelectedPin}
            />

            {/* Filter chips */}
            <div className="absolute top-3 left-3 right-3 flex flex-col gap-1.5 z-10 pointer-events-none">
              {/* Era filter */}
              {presentEras.length > 0 && (
                <div className="flex gap-1 overflow-x-auto no-scrollbar pointer-events-auto">
                  {presentEras.map((era) => (
                    <button
                      key={era}
                      onClick={() =>
                        setActiveEra(activeEra === era ? null : era)
                      }
                      className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
                      style={{
                        background:
                          activeEra === era ? "#111" : "rgba(255,255,255,0.95)",
                        color: activeEra === era ? "#fff" : "#666",
                        borderColor:
                          activeEra === era
                            ? "#111"
                            : "rgba(0,0,0,0.08)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      {era}
                    </button>
                  ))}
                </div>
              )}

              {/* Tag filter */}
              {allTags.length > 0 && (
                <div className="flex gap-1 overflow-x-auto no-scrollbar pointer-events-auto">
                  {hasActiveFilter && (
                    <button
                      onClick={() => {
                        setActiveTag(null);
                        setActiveEra(null);
                      }}
                      className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-500 border border-red-200"
                    >
                      Clear filters
                    </button>
                  )}
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() =>
                        setActiveTag(activeTag === tag ? null : tag)
                      }
                      className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors"
                      style={{
                        background:
                          activeTag === tag
                            ? "#0C447C"
                            : "rgba(255,255,255,0.95)",
                        color: activeTag === tag ? "#fff" : "#666",
                        borderColor:
                          activeTag === tag
                            ? "#0C447C"
                            : "rgba(0,0,0,0.08)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Storyteller FAB */}
            {mode === "storyteller" && (
              <button
                onClick={() => setShowStorytellerFlow(true)}
                className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-4 py-3 bg-[#0C447C] text-white rounded-full shadow-lg text-sm font-semibold"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add to map
              </button>
            )}

            {/* Storyteller Flow */}
            {showStorytellerFlow && (
              <div className="absolute inset-0 z-40 bg-white">
                <StorytellerFlow
                  mapCenter={{ lat: 37.4275, lng: -122.17 }}
                  onClose={() => setShowStorytellerFlow(false)}
                  onPublished={() => {
                    setShowStorytellerFlow(false);
                    loadPins();
                  }}
                />
              </div>
            )}

            {/* Empty state */}
            {pins.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                <div className="bg-white/90 backdrop-blur rounded-xl p-6 text-center shadow-lg pointer-events-auto">
                  <p className="text-sm text-gray-500 mb-3">No pins yet</p>
                  <button
                    onClick={handleSeed}
                    disabled={seeding}
                    className="px-4 py-2 bg-[#0C447C] text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  >
                    {seeding ? "Seeding..." : "Seed Stanford pins"}
                  </button>
                </div>
              </div>
            )}

            {/* Filter result count */}
            {hasActiveFilter && filteredPins.length > 0 && (
              <div className="absolute bottom-20 left-0 right-0 flex justify-center z-10 pointer-events-none">
                <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur text-xs text-gray-600 shadow-sm border border-gray-100 pointer-events-auto">
                  {filteredPins.length} pin{filteredPins.length !== 1 ? "s" : ""}{" "}
                  {activeTag ? `tagged "${activeTag}"` : ""}
                  {activeTag && activeEra ? " in " : ""}
                  {activeEra ? activeEra : ""}
                </span>
              </div>
            )}

            {/* Bottom sheet */}
            <BottomSheet
              open={selectedPin !== null}
              onClose={handlePinClose}
            >
              {selectedPin && (
                <PinDetail
                  pin={selectedPin}
                  allPins={pins}
                  onClose={handlePinClose}
                  onTagClick={handleTagClick}
                  onConnectedPinClick={handleConnectedPinClick}
                />
              )}
            </BottomSheet>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm h-full">
            {activeTab === "search" && "Search coming soon"}
            {activeTab === "saved" && "Saved pins coming soon"}
            {activeTab === "profile" && "Profile coming soon"}
          </div>
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
