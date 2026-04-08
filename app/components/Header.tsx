"use client";

import { useAuth } from "../lib/AuthContext";

interface HeaderProps {
  mode: "explorer" | "storyteller";
  onModeChange: (mode: "explorer" | "storyteller") => void;
}

export default function Header({ mode, onModeChange }: HeaderProps) {
  const { user, signIn, logOut } = useAuth();

  function handleModeChange(newMode: "explorer" | "storyteller") {
    if (newMode === "storyteller" && !user) {
      signIn();
      return;
    }
    onModeChange(newMode);
  }

  return (
    <header className="flex items-center justify-between px-4 h-12 bg-white border-b border-gray-100 shrink-0 z-20">
      <h1 className="text-base font-bold tracking-tight text-gray-900">
        Provenance
      </h1>
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 rounded-full p-0.5">
          <button
            onClick={() => handleModeChange("explorer")}
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
            onClick={() => handleModeChange("storyteller")}
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
        {user ? (
          <button
            onClick={logOut}
            className="w-7 h-7 rounded-full overflow-hidden border border-gray-200"
            title={user.displayName ?? "Sign out"}
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                {user.displayName?.[0] ?? user.email?.[0] ?? "U"}
              </div>
            )}
          </button>
        ) : (
          <button
            onClick={signIn}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
