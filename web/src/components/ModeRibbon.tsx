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
    { id: "plan",          label: "Plan" },
    { id: "alignment",     label: "Eşleştirme & Vurgular" },
    { id: "lecturer-note", label: "Hoca Notu" },
    { id: "quiz",          label: "Quiz" },
    { id: "deep-dive",     label: "Derinleşme" },
    { id: "exam-sprint",   label: "Sprint" },
    { id: "lo-study",      label: "LO Study" },      // 🔹 yeni sekme
    { id: "history",       label: "Derslerim" },
    { id: "cheat-sheet", label: "Cheat Sheet"},

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
