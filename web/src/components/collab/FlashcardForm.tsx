import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";

export default function FlashcardForm({ onClose }: { onClose: () => void }) {
  const addFlashcard = useRoomStore((s) => s.addFlashcard);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [topicName, setTopicName] = useState("");

  const handleAdd = () => {
    if (!front.trim() || !back.trim()) return;
    addFlashcard(front.trim(), back.trim(), topicName.trim());
    setFront("");
    setBack("");
    setTopicName("");
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="ws-fc-form"
    >
      <input
        className="lc-textarea input"
        placeholder="Front (question)"
        value={front}
        onChange={(e) => setFront(e.target.value)}
        autoFocus
      />
      <textarea
        className="lc-textarea input"
        placeholder="Back (answer)"
        value={back}
        onChange={(e) => setBack(e.target.value)}
        rows={3}
        style={{ resize: "vertical" }}
      />
      <input
        className="lc-textarea input"
        placeholder="Topic (optional)"
        value={topicName}
        onChange={(e) => setTopicName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
        }}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button className="btn-small" onClick={onClose}>Cancel</button>
        <motion.button
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={!front.trim() || !back.trim()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ padding: "5px 14px", fontSize: 12 }}
        >
          Add Card
        </motion.button>
      </div>
    </motion.div>
  );
}
