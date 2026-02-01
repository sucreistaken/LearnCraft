import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import { useNotesStore } from "../../stores/notesStore";
import { SharedNote } from "../../types";

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  concept: { icon: "\uD83D\uDCA1", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
  formula: { icon: "\uD83D\uDCCA", color: "#8b5cf6", bg: "rgba(139,92,246,0.08)" },
  example: { icon: "\uD83D\uDCD6", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  tip: { icon: "\u2728", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  warning: { icon: "\u26A0\uFE0F", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
  summary: { icon: "\uD83D\uDCCB", color: "#06b6d4", bg: "rgba(6,182,212,0.08)" },
};

const sourceLabels: Record<string, string> = {
  "deep-dive": "\uD83D\uDD17 From Deep Dive",
  "mind-map": "\uD83D\uDD17 From Mind Map",
};

export default function NoteCard({ note, currentUserId }: { note: SharedNote; currentUserId: string }) {
  const editNote = useRoomStore((s) => s.editNote);
  const deleteNote = useRoomStore((s) => s.deleteNote);
  const pinNote = useRoomStore((s) => s.pinNote);
  const currentRoom = useRoomStore((s) => s.currentRoom);
  const addPersonalNote = useNotesStore((s) => s.addNote);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [editCategory, setEditCategory] = useState(note.category);
  const [savedPersonal, setSavedPersonal] = useState(false);

  const canDelete = note.authorId === currentUserId || currentRoom?.hostId === currentUserId;
  const cat = categoryConfig[note.category] || categoryConfig.concept;

  const handleSave = () => {
    editNote(note.id, editTitle, editContent, editCategory);
    setEditing(false);
  };

  if (editing) {
    return (
      <motion.div layout className="ws-note-form">
        <input
          className="lc-textarea input"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title"
          style={{ fontWeight: 600 }}
          autoFocus
        />
        <select
          className="lc-select"
          value={editCategory}
          onChange={(e) => setEditCategory(e.target.value as any)}
        >
          <option value="concept">Concept</option>
          <option value="formula">Formula</option>
          <option value="example">Example</option>
          <option value="tip">Tip</option>
          <option value="warning">Warning</option>
          <option value="summary">Summary</option>
        </select>
        <textarea
          className="lc-textarea input"
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          placeholder="Content (markdown supported)"
          rows={4}
          style={{ resize: "vertical" }}
        />
        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
          <button className="btn-small" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} style={{ padding: "5px 14px", fontSize: 12 }}>Save</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`ws-note-card ws-note-card--postit ws-note-card--${note.category}${note.pinned ? " ws-note-card--pinned" : ""}`}
    >
      {note.pinned && <span className="ws-note-card__pin">{"\uD83D\uDCCC"}</span>}

      <div className="ws-note-card__head">
        <span>{cat.icon}</span>
        <span className="ws-note-card__title">{note.title}</span>
      </div>

      <div className="ws-note-card__body">
        {note.content.length > 300 ? note.content.slice(0, 300) + "..." : note.content}
      </div>

      <div className="ws-note-card__footer">
        <span className="ws-note-card__cat" style={{ background: cat.bg, color: cat.color }}>
          {note.category}
        </span>

        {note.source && note.source !== "manual" && (
          <span className="ws-note-card__source">{sourceLabels[note.source] || note.source}</span>
        )}

        <div className="ws-note-card__author">
          <div className="ws-note-card__author-avatar" style={{ background: note.authorAvatar }}>
            {note.authorNickname.charAt(0).toUpperCase()}
          </div>
          <span>{note.authorNickname}</span>
        </div>

        {note.editedByNickname && (
          <span className="ws-note-card__time" style={{ fontStyle: "italic" }}>
            edited by {note.editedByNickname}
          </span>
        )}

        <span className="ws-note-card__time">{getTimeAgo(note.createdAt)}</span>

        <div className="ws-note-card__actions">
          <button
            className="ws-note-card__action-btn"
            onClick={() => {
              addPersonalNote(note.title + "\n\n" + note.content, "manual");
              setSavedPersonal(true);
            }}
            title={savedPersonal ? "Saved!" : "Save to personal notes"}
            disabled={savedPersonal}
            style={savedPersonal ? { opacity: 0.5 } : undefined}
          >
            {savedPersonal ? "\u2705" : "\uD83D\uDCBE"}
          </button>
          <button
            className="ws-note-card__action-btn"
            onClick={() => pinNote(note.id)}
            title={note.pinned ? "Unpin" : "Pin"}
          >
            {"\uD83D\uDCCC"}
          </button>
          <button
            className="ws-note-card__action-btn"
            onClick={() => {
              setEditTitle(note.title);
              setEditContent(note.content);
              setEditCategory(note.category);
              setEditing(true);
            }}
            title="Edit"
          >
            {"\u270F\uFE0F"}
          </button>
          {canDelete && (
            <button
              className="ws-note-card__action-btn ws-note-card__action-btn--danger"
              onClick={() => deleteNote(note.id)}
              title="Delete"
            >
              {"\u2715"}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
