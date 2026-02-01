import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRoomStore } from "../../stores/roomStore";
import NoteCard from "./NoteCard";
import NoteForm from "./NoteForm";

const categories = [
  { id: "all", label: "All" },
  { id: "concept", label: "Concept" },
  { id: "formula", label: "Formula" },
  { id: "example", label: "Example" },
  { id: "tip", label: "Tip" },
  { id: "warning", label: "Warning" },
  { id: "summary", label: "Summary" },
] as const;

export default function SharedNotes() {
  const workspace = useRoomStore((s) => s.workspace);
  const identity = useRoomStore((s) => s.identity);

  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  const notes = workspace.notes;
  const uniqueContributors = new Set(notes.map((n) => n.authorNickname)).size;

  let filteredNotes = notes;
  if (filter !== "all") {
    filteredNotes = filteredNotes.filter((n) => n.category === filter);
  }
  if (showPinnedOnly) {
    filteredNotes = filteredNotes.filter((n) => n.pinned);
  }

  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div className="ws-pane-head">
        <div className="ws-pane-head__icon" style={{ background: "#fff7ed", color: "#f59e0b" }}>
          {"\uD83D\uDCDD"}
        </div>
        <span className="ws-pane-head__title">Notes</span>
        <span className="ws-pane-head__meta">
          {notes.length} notes{uniqueContributors > 0 && ` \u00B7 ${uniqueContributors} contributor${uniqueContributors !== 1 ? "s" : ""}`}
        </span>
        <div className="ws-pane-head__actions">
          <button className="btn-small" onClick={() => setShowAddForm(true)}>+ Add Note</button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="ws-notes__filters">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`ws-notes__filter${filter === cat.id ? " ws-notes__filter--active" : ""}`}
            onClick={() => setFilter(cat.id)}
          >
            {cat.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className={`ws-notes__filter${showPinnedOnly ? " ws-notes__filter--active" : ""}`}
          onClick={() => setShowPinnedOnly(!showPinnedOnly)}
        >
          {"\uD83D\uDCCC"} Pinned
        </button>
      </div>

      {/* Notes list */}
      <div className="ws-notes__list">
        {sortedNotes.length === 0 && !showAddForm && (
          <div className="pane-empty">
            <div className="pane-empty__icon">{"\uD83D\uDCDD"}</div>
            <div className="pane-empty__title">No notes yet</div>
            <div className="pane-empty__desc">
              Add study notes, save insights from Deep Dive, or export mind map annotations here.
            </div>
            <button className="btn btn-primary" onClick={() => setShowAddForm(true)} style={{ marginTop: 16 }}>
              + Add Note
            </button>
          </div>
        )}

        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: 12 }}
            >
              <NoteForm onClose={() => setShowAddForm(false)} />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sortedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              currentUserId={identity?.id || ""}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
