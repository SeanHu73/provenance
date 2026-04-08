"use client";

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./lib/firebase";
import { Pin } from "./lib/types";
import MapView from "./components/MapView";
import PinDetail from "./components/PinDetail";
import BottomSheet from "./components/BottomSheet";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";

export default function Home() {
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [mode, setMode] = useState<"explorer" | "storyteller">("explorer");
  const [activeTab, setActiveTab] = useState("map");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    loadPins();
  }, []);

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

  return (
    <div className="flex flex-col h-dvh max-w-[480px] mx-auto w-full bg-white relative overflow-hidden">
      <Header mode={mode} onModeChange={setMode} />

      <main className="flex-1 relative overflow-hidden">
        {activeTab === "map" ? (
          <>
            <MapView
              pins={pins}
              selectedPin={selectedPin}
              onPinClick={setSelectedPin}
            />

            {/* Filter chips */}
            <div className="absolute top-3 left-3 right-3 flex gap-1.5 flex-wrap z-10 pointer-events-none">
              {/* placeholder for future filter UI */}
            </div>

            {/* Storyteller FAB */}
            {mode === "storyteller" && (
              <button className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-4 py-3 bg-[#0C447C] text-white rounded-full shadow-lg text-sm font-semibold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                Add to map
              </button>
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

            {/* Bottom sheet */}
            <BottomSheet
              open={selectedPin !== null}
              onClose={() => setSelectedPin(null)}
            >
              {selectedPin && (
                <PinDetail
                  pin={selectedPin}
                  onClose={() => setSelectedPin(null)}
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
