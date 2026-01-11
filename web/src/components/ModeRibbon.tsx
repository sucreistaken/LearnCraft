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
    { id: "alignment", label: "Eşleştirme & Vurgular" },
    { id: "deviation", label: "📊 Deviation Analysis" },
    { id: "lecturer-note", label: "Hoca Notu" },
    { id: "quiz", label: "Quiz" },
    { id: "deep-dive", label: "Derinleşme (AI Chat)" },
    { id: "mindmap", label: "🗺️ Zihin Haritası" },
    { id: "exam-sprint", label: "Sprint" },
    { id: "lo-study", label: "LO Study" },
    { id: "history", label: "Derslerim" },
    { id: "cheat-sheet", label: "Cheat Sheet" },
    { id: "notes", label: "📝 Notes" },
  ];

  return (
    <div className="mode-ribbon">
      <div className="tabs">
        {tabs.map((t, idx) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`tab ${mode === t.id ? "tab--active" : ""}`}
            title={`Kısayol: ${idx + 1}`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
