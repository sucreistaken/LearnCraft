import React from "react";
import { useRoomStore } from "../../stores/roomStore";

export default function InsightsPanel({ onClose }: { onClose: () => void }) {
  const insights = useRoomStore((s) => s.workspace.deepDive.savedInsights);
  const addNote = useRoomStore((s) => s.addNote);

  const handleExportToNotes = (text: string, insightId: string) => {
    addNote(
      "Insight from Deep Dive",
      text,
      "concept",
      "deep-dive",
      insightId
    );
  };

  return (
    <div className="ws-insights">
      <div className="ws-insights__head">
        <span>{"\uD83D\uDCCC"}</span>
        <span className="ws-insights__head-title">Saved Insights</span>
        <button className="btn-small" onClick={onClose} style={{ padding: "2px 8px" }}>
          {"\u2715"}
        </button>
      </div>

      <div className="ws-insights__list">
        {insights.length === 0 && (
          <div className="pane-empty" style={{ padding: "24px 12px" }}>
            <div className="pane-empty__desc">
              No insights saved yet. Click "Save insight" on any AI response to add it here.
            </div>
          </div>
        )}

        {insights.map((insight) => (
          <div key={insight.id} className="ws-insight-card">
            <div className="ws-insight-card__text">
              {insight.text.length > 200 ? insight.text.slice(0, 200) + "..." : insight.text}
            </div>
            <div className="ws-insight-card__footer">
              <span>
                by {insight.savedByNickname} {"\u00B7"}{" "}
                {new Date(insight.timestamp).toLocaleDateString()}
              </span>
              <button
                className="ws-ann-item__action"
                onClick={() => handleExportToNotes(insight.text, insight.id)}
                title="Export to Notes"
              >
                {"\uD83D\uDCDD"} To Notes
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
