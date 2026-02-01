import React from "react";
import { useRoomStore } from "../../stores/roomStore";
import { WorkspaceTool } from "../../types";

const tools: { id: WorkspaceTool; label: string; icon: string }[] = [
  { id: "deep-dive", label: "Deep Dive", icon: "\uD83D\uDCAC" },
  { id: "flashcards", label: "Flashcards", icon: "\uD83C\uDCCF" },
  { id: "mind-map", label: "Mind Map", icon: "\uD83D\uDDFA\uFE0F" },
  { id: "notes", label: "Notes", icon: "\uD83D\uDCDD" },
  { id: "quiz", label: "Quiz", icon: "\u2753" },
  { id: "sprint", label: "Sprint", icon: "\u23F1\uFE0F" },
];

export default function ToolSidebar() {
  const activeTool = useRoomStore((s) => s.activeTool);
  const setActiveTool = useRoomStore((s) => s.setActiveTool);
  const workspace = useRoomStore((s) => s.workspace);

  const badgeCounts: Record<WorkspaceTool, number> = {
    "deep-dive": workspace.deepDive.messages.length,
    flashcards: workspace.flashcards.length,
    "mind-map": workspace.mindMapAnnotations.length,
    notes: workspace.notes.length,
    quiz: 0,
    sprint: 0,
  };

  return (
    <div className="ws-sidebar">
      <div className="ws-tools__label">Tools</div>
      <div className="ws-tools">
        {tools.map((tool) => (
          <button
            key={tool.id}
            className={`ws-tool${activeTool === tool.id ? " ws-tool--active" : ""}`}
            onClick={() => setActiveTool(tool.id)}
          >
            <span className="ws-tool__icon">{tool.icon}</span>
            <span className="ws-tool__label">{tool.label}</span>
            {badgeCounts[tool.id] > 0 && (
              <span className="ws-tool__badge">{badgeCounts[tool.id]}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
