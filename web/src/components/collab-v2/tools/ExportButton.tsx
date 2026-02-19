import { useState } from "react";
import { channelToolApi } from "../../../services/channelToolApi";

interface Props {
  channelId: string;
  toolType: "quiz" | "flashcards" | "notes" | "mind-map" | "all";
  label?: string;
}

export default function ExportButton({ channelId, toolType, label }: Props) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      let data: any;
      switch (toolType) {
        case "quiz": data = (await channelToolApi.exportQuiz(channelId)).data; break;
        case "flashcards": data = (await channelToolApi.exportFlashcards(channelId)).data; break;
        case "notes": data = (await channelToolApi.exportNotes(channelId)).data; break;
        case "mind-map": data = (await channelToolApi.exportMindMap(channelId)).data; break;
        case "all": data = (await channelToolApi.exportAll(channelId)).data; break;
      }

      if (!data) return;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${toolType}-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      className="lc-btn lc-btn--ghost lc-btn--sm"
      onClick={handleExport}
      disabled={exporting}
      title="D\u0131\u015Fa aktar"
    >
      {exporting ? "\u23F3" : "\uD83D\uDCE5"} {label || "D\u0131\u015Fa Aktar"}
    </button>
  );
}
