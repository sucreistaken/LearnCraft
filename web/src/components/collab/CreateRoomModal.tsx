import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import { useLessonStore } from "../../stores/lessonStore";

export default function CreateRoomModal() {
  const show = useRoomStore((s) => s.showCreateModal);
  const setShow = useRoomStore((s) => s.setShowCreateModal);
  const createRoom = useRoomStore((s) => s.createRoom);
  const connecting = useRoomStore((s) => s.connecting);
  const error = useRoomStore((s) => s.error);
  const lessons = useLessonStore((s) => s.lessons);
  const currentLessonId = useLessonStore((s) => s.currentLessonId);

  const [name, setName] = useState("");
  const [lessonId, setLessonId] = useState(currentLessonId || "");

  if (!show) return null;

  const selectedLesson = lessons.find((l) => l.id === lessonId);

  const handleCreate = () => {
    if (!name.trim() || !lessonId) return;
    createRoom(name.trim(), lessonId, selectedLesson?.title || "");
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-backdrop"
        onClick={() => setShow(false)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          style={{ maxWidth: 440 }}
        >
          <div className="modal-title h3 mb-4">Create Study Workspace</div>

          <label className="label" htmlFor="room-name">Workspace Name</label>
          <input
            id="room-name"
            autoFocus
            className="lc-textarea input mb-3 w-full"
            placeholder="e.g. Calculus Study Group"
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && lessonId) handleCreate();
              if (e.key === "Escape") setShow(false);
            }}
          />

          <label className="label" htmlFor="room-lesson">
            Link to Lesson <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <select
            id="room-lesson"
            className="lc-select mb-3 w-full"
            value={lessonId}
            onChange={(e) => setLessonId(e.target.value)}
          >
            <option value="">-- Select a lesson --</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>

          {!lessonId && (
            <div className="text-red-500" style={{ fontSize: 12, marginBottom: 12 }}>
              A lesson must be selected. The workspace tools (AI chat, flashcards, mind map) use lesson content.
            </div>
          )}

          <div className="muted-block" style={{ marginBottom: 16 }}>
            This workspace is <strong>permanent</strong>. Members who join later will see all shared content
            (chat history, flashcards, notes, annotations). Only the host can delete it.
          </div>

          {error && <div className="text-red-500" style={{ fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShow(false)}>
              Cancel
            </button>
            <motion.button
              className="btn btn-primary"
              onClick={handleCreate}
              disabled={!name.trim() || !lessonId || connecting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {connecting ? "Creating..." : "Create Workspace"}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
