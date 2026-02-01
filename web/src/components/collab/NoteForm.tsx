import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";

export default function NoteForm({ onClose }: { onClose: () => void }) {
  const addNote = useRoomStore((s) => s.addNote);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("concept");

  const handleAdd = () => {
    if (!title.trim() || !content.trim()) return;
    addNote(title.trim(), content.trim(), category);
    onClose();
  };

  return (
    <div className="ws-note-form">
      <input
        className="lc-textarea input"
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ fontWeight: 600 }}
        autoFocus
      />

      <select
        className="lc-select"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        <option value="concept">{"\uD83D\uDCA1"} Concept</option>
        <option value="formula">{"\uD83D\uDCCA"} Formula</option>
        <option value="example">{"\uD83D\uDCD6"} Example</option>
        <option value="tip">{"\u2728"} Tip</option>
        <option value="warning">{"\u26A0\uFE0F"} Warning</option>
        <option value="summary">{"\uD83D\uDCCB"} Summary</option>
      </select>

      <textarea
        className="lc-textarea input"
        placeholder="Write your note... (markdown supported)"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        style={{ resize: "vertical" }}
      />

      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button className="btn-small" onClick={onClose}>Cancel</button>
        <motion.button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={!title.trim() || !content.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "5px 14px", fontSize: 12 }}
        >
          Add Note
        </motion.button>
      </div>
    </div>
  );
}
