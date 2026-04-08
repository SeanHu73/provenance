"use client";

interface HeaderProps {
  mode: "explorer" | "storyteller";
  onModeChange: (mode: "explorer" | "storyteller") => void;
}

export default function Header({ mode, onModeChange }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 h-12 bg-white border-b border-gray-100 shrink-0 z-20">
      <h1 className="text-base font-bold tracking-tight text-gray-900">
        Provenance
      </h1>
      <div className="flex bg-gray-100 rounded-full p-0.5">
        <button
          onClick={() => onModeChange("explorer")}
          className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
          style={{
            background: mode === "explorer" ? "#fff" : "transparent",
            color: mode === "explorer" ? "#111" : "#888",
            boxShadow: mode === "explorer" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
          }}
        >
          Explorer
        </button>
        <button
          onClick={() => onModeChange("storyteller")}
          className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
          style={{
            background: mode === "storyteller" ? "#fff" : "transparent",
            color: mode === "storyteller" ? "#111" : "#888",
            boxShadow: mode === "storyteller" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
          }}
        >
          Storyteller
        </button>
      </div>
    </header>
  );
}
