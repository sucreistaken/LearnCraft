import React, { useState } from "react";
import { useRoomStore } from "../../stores/roomStore";
import { MindMapAnnotation } from "../../types";

const typeIcons: Record<string, string> = {
  note: "\uD83D\uDCDD",
  question: "\u2753",
  example: "\uD83D\uDCD6",
  understood: "\u2705",
};

export default function NodeAnnotations({
  nodeLabel,
  annotations,
  onClose,
  layout = "vertical",
}: {
  nodeLabel: string;
  annotations: MindMapAnnotation[];
  onClose: () => void;
  layout?: "vertical" | "horizontal";
}) {
  const addAnnotation = useRoomStore((s) => s.addAnnotation);
  const replyToAnnotation = useRoomStore((s) => s.replyToAnnotation);
  const askMindMapAI = useRoomStore((s) => s.askMindMapAI);
  const addNote = useRoomStore((s) => s.addNote);
  const identity = useRoomStore((s) => s.identity);

  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<"note" | "question">("note");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [aiAsking, setAiAsking] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");

  const understoodBy = annotations
    .filter((a) => a.type === "understood")
    .map((a) => a.authorNickname);

  const nonUnderstoodAnnotations = annotations.filter((a) => a.type !== "understood");

  const handleAddAnnotation = () => {
    if (!newText.trim()) return;
    addAnnotation(nodeLabel, newType, newText.trim());
    setNewText("");
  };

  const handleReply = (annotationId: string) => {
    if (!replyText.trim()) return;
    replyToAnnotation(annotationId, replyText.trim());
    setReplyText("");
    setReplyingTo(null);
  };

  const handleAskAI = async () => {
    setAiAsking(true);
    try {
      await askMindMapAI(nodeLabel, aiQuestion || undefined);
      setAiQuestion("");
    } finally {
      setAiAsking(false);
    }
  };

  const handleMarkUnderstood = () => {
    addAnnotation(nodeLabel, "understood", `${identity?.nickname || "Someone"} understood this`);
  };

  const handleExportToNotes = (annotation: MindMapAnnotation) => {
    addNote(
      `${nodeLabel} - ${annotation.type}`,
      annotation.text,
      annotation.type === "example" ? "example" : "concept",
      "mind-map",
      annotation.id
    );
  };

  const headerEl = (
    <div className="ws-ann__head">
      <span className="ws-ann__head-title">{nodeLabel}</span>
      <button className="btn-small" onClick={onClose} style={{ padding: "2px 8px" }}>
        {"\u2715"}
      </button>
    </div>
  );

  const understoodEl = understoodBy.length > 0 ? (
    <div className="ws-ann__understood">
      {"\u2705"} Understood by: {understoodBy.join(", ")}
    </div>
  ) : null;

  const annotationsList = (
    <>
      {nonUnderstoodAnnotations.length === 0 && (
        <div className="pane-empty" style={{ padding: "24px 12px" }}>
          <div className="pane-empty__desc">
            No annotations yet. Add notes or ask questions about this node.
          </div>
        </div>
      )}

      {nonUnderstoodAnnotations.map((ann) => (
        <div key={ann.id} className="ws-ann-item">
          <div className="ws-ann-item__head">
            <span>{typeIcons[ann.type] || "\uD83D\uDCDD"}</span>
            <div
              className="ws-member__avatar"
              style={{ background: ann.authorAvatar, width: 18, height: 18, fontSize: 9 }}
            >
              {ann.authorNickname.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600 }}>{ann.authorNickname}</span>
            <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 9 }}>
              {new Date(ann.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          <div className="ws-ann-item__body">{ann.text}</div>

          {ann.replies.length > 0 && (
            <div className="ws-ann-item__replies">
              {ann.replies.map((reply) => (
                <div key={reply.id} className="ws-ann-item__reply">
                  <span className="ws-ann-item__reply-author">{reply.authorNickname}: </span>
                  <span>{reply.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="ws-ann-item__actions">
            <button
              className="ws-ann-item__action"
              onClick={() => setReplyingTo(replyingTo === ann.id ? null : ann.id)}
            >
              Reply
            </button>
            <button
              className="ws-ann-item__action"
              onClick={() => handleExportToNotes(ann)}
            >
              {"\uD83D\uDCDD"} To Notes
            </button>
          </div>

          {replyingTo === ann.id && (
            <div className="ws-ann__input-row" style={{ marginTop: 6 }}>
              <input
                className="lc-textarea"
                placeholder="Reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleReply(ann.id); }}
                style={{ flex: 1, minHeight: 30, padding: "5px 10px", fontSize: 11, borderRadius: 8 }}
                autoFocus
              />
              <button className="btn-small" onClick={() => handleReply(ann.id)}>Send</button>
            </div>
          )}
        </div>
      ))}
    </>
  );

  const inputArea = (
    <div className="ws-ann__input-area">
      <div className="ws-ann__input-row">
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as any)}
        >
          <option value="note">{"\uD83D\uDCDD"} Note</option>
          <option value="question">{"\u2753"} Question</option>
        </select>
        <input
          className="lc-textarea"
          placeholder={newType === "question" ? "Ask a question..." : "Add a note..."}
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddAnnotation(); }}
          style={{ flex: 1, minHeight: 30, padding: "5px 10px", fontSize: 11, borderRadius: 8 }}
        />
        <button className="btn-small" onClick={handleAddAnnotation} disabled={!newText.trim()}>Add</button>
      </div>

      <div className="ws-ann__bottom-row">
        <input
          className="lc-textarea"
          placeholder="Ask AI about this node..."
          value={aiQuestion}
          onChange={(e) => setAiQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAskAI(); }}
          style={{ flex: 1, minHeight: 30, padding: "5px 10px", fontSize: 11, borderRadius: 8 }}
        />
        <button className="btn-small" onClick={handleAskAI} disabled={aiAsking}>
          {aiAsking ? "..." : "\uD83E\uDD16"}
        </button>
        <button
          className="btn-small"
          onClick={handleMarkUnderstood}
          title="Mark as understood"
        >
          {"\u2705"}
        </button>
      </div>
    </div>
  );

  if (layout === "horizontal") {
    return (
      <>
        {headerEl}
        {understoodEl}
        <div className="ws-mm-drawer__content">
          <div className="ws-mm-drawer__ann-list">
            {annotationsList}
          </div>
          <div className="ws-mm-drawer__input-area">
            {inputArea}
          </div>
        </div>
      </>
    );
  }

  // Default vertical layout
  return (
    <div className="ws-ann">
      {headerEl}
      {understoodEl}
      <div className="ws-ann__list">
        {annotationsList}
      </div>
      {inputArea}
    </div>
  );
}
