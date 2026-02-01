import React from "react";
import { ModeId } from "../types";

export default function ModeRibbon({
  mode,
  setMode,
}: {
  mode: ModeId;
  setMode: (m: ModeId) => void;
}) {
  const tabs: { id: ModeId; label: string }[] = [
    { id: "plan", label: "Plan" },
    { id: "alignment", label: "Alignment & Highlights" },
    { id: "deviation", label: "📊 Deviation Analysis" },
    { id: "lecturer-note", label: "Lecturer Notes" },
    { id: "quiz", label: "Quiz" },
    { id: "deep-dive", label: "Deep Dive (AI Chat)" },
    { id: "mindmap", label: "🗺️ Mind Map" },
    { id: "exam-sprint", label: "Sprint" },
    { id: "lo-study", label: "LO Study" },
    { id: "weakness", label: "Weakness" },
    { id: "flashcards", label: "Flashcards" },
    { id: "connections", label: "Connections" },
    { id: "history", label: "My Lessons" },
    { id: "cheat-sheet", label: "Cheat Sheet" },
    { id: "notes", label: "📝 Notes" },
    { id: "study-room", label: "Study Room" },
  ];

  return (
    <div className="mode-ribbon" role="tablist" aria-label="Content panels">
      <div className="tabs">
        {tabs.map((t, idx) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={mode === t.id}
            onClick={() => setMode(t.id)}
            className={`tab ${mode === t.id ? "tab--active" : ""}`}
            title={`Shortcut: ${idx + 1}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
