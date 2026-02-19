import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useChannelToolStore } from "../../../stores/channelToolStore";
import { channelToolApi } from "../../../services/channelToolApi";
import { getCollabSocket } from "../../../services/collabSocket";
import type { ChannelNoteItem } from "../../../types";

interface Props {
  channelId: string;
  topic: string;
  serverName: string;
  userId: string;
  nickname: string;
}

type NoteCategory = ChannelNoteItem["category"];
type FilterCategory = "all" | NoteCategory;

const EMPTY_NOTES: ChannelNoteItem[] = [];

const CATEGORIES: { value: NoteCategory; label: string; icon: string }[] = [
  { value: "concept", label: "Kavram", icon: "\u{1F4A1}" },
  { value: "formula", label: "Form\u00FCl", icon: "\u{1F4D0}" },
  { value: "example", label: "\u00D6rnek", icon: "\u{1F4D6}" },
  { value: "tip", label: "\u0130pucu", icon: "\u2728" },
  { value: "warning", label: "Uyar\u0131", icon: "\u26A0\uFE0F" },
  { value: "summary", label: "\u00D6zet", icon: "\u{1F4CB}" },
];

const CATEGORY_MAP: Record<NoteCategory, { label: string; icon: string }> = {
  concept: { label: "Kavram", icon: "\u{1F4A1}" },
  formula: { label: "Form\u00FCl", icon: "\u{1F4D0}" },
  example: { label: "\u00D6rnek", icon: "\u{1F4D6}" },
  tip: { label: "\u0130pucu", icon: "\u2728" },
  warning: { label: "Uyar\u0131", icon: "\u26A0\uFE0F" },
  summary: { label: "\u00D6zet", icon: "\u{1F4CB}" },
};

const FILTER_OPTIONS: { value: FilterCategory; label: string }[] = [
  { value: "all", label: "T\u00FCm\u00FC" },
  ...CATEGORIES.map((c) => ({ value: c.value as FilterCategory, label: `${c.icon} ${c.label}` })),
];

export default function ChannelNotes({ channelId, topic, serverName, userId, nickname }: Props) {
  // Zustand selectors - derive state inline, never call methods in selectors
  const notes = useChannelToolStore((s) => s.dataByChannel[channelId]?.notes?.items ?? EMPTY_NOTES);
  const addNoteToStore = useChannelToolStore((s) => s.addNoteToStore);
  const updateNoteInStore = useChannelToolStore((s) => s.updateNoteInStore);
  const removeNoteFromStore = useChannelToolStore((s) => s.removeNoteFromStore);

  // Local state
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState<NoteCategory>("concept");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");

  // Filter and sort notes
  const filteredNotes = notes
    .filter((note) => {
      if (filter !== "all" && note.category !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      // Pinned first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then by createdAt descending
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Handlers
  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim() || submitting) return;

    setSubmitting(true);
    try {
      const { note } = await channelToolApi.addNote(
        channelId,
        formTitle.trim(),
        formContent.trim(),
        formCategory,
        userId,
        nickname
      );
      addNoteToStore(channelId, note);
      getCollabSocket().emit("tool:notes:add", { channelId, note });

      // Reset form
      setFormTitle("");
      setFormContent("");
      setFormCategory("concept");
      setShowForm(false);
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePin(note: ChannelNoteItem) {
    try {
      const { note: updated } = await channelToolApi.pinNote(channelId, note.id);
      updateNoteInStore(channelId, updated);
      getCollabSocket().emit("tool:notes:pin", { channelId, note: updated });
    } catch (err) {
      console.error("Failed to pin note:", err);
    }
  }

  async function handleDelete(noteId: string) {
    try {
      await channelToolApi.deleteNote(channelId, noteId);
      removeNoteFromStore(channelId, noteId);
      getCollabSocket().emit("tool:notes:delete", { channelId, noteId });
    } catch (err) {
      console.error("Failed to delete note:", err);
    }
  }

  function startEdit(note: ChannelNoteItem) {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }

  async function handleSaveEdit(noteId: string) {
    if (!editTitle.trim() || !editContent.trim()) return;

    try {
      const { note: updated } = await channelToolApi.editNote(channelId, noteId, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      updateNoteInStore(channelId, updated);
      getCollabSocket().emit("tool:notes:edit", { channelId, note: updated });
      cancelEdit();
    } catch (err) {
      console.error("Failed to edit note:", err);
    }
  }

  // Empty state
  if (notes.length === 0 && !showForm) {
    return (
      <div className="sh-tool">
        <div className="sh-tool__header">
          <div className="sh-tool__header-left">
            <span>{"\u{1F4DD}"}</span>
            <h3 className="sh-main-content__channel-name">{topic}</h3>
          </div>
        </div>
        <div className="sh-tool__body">
          <div className="sh-notes__empty-state">
            <div className="sh-notes__empty-illustration">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="25" y="15" width="70" height="90" rx="8" fill="var(--card)" stroke="var(--border)" strokeWidth="2" />
                <rect x="25" y="15" width="70" height="90" rx="8" fill="color-mix(in srgb, var(--accent-2) 5%, var(--card))" />
                <rect x="35" y="35" width="40" height="4" rx="2" fill="var(--border)" />
                <rect x="35" y="47" width="50" height="3" rx="1.5" fill="var(--border)" opacity="0.6" />
                <rect x="35" y="56" width="45" height="3" rx="1.5" fill="var(--border)" opacity="0.6" />
                <rect x="35" y="65" width="35" height="3" rx="1.5" fill="var(--border)" opacity="0.6" />
                <rect x="35" y="80" width="20" height="8" rx="4" fill="color-mix(in srgb, var(--accent-2) 20%, transparent)" />
                <circle cx="82" cy="88" r="18" fill="var(--accent-2)" opacity="0.15" />
                <path d="M76 88L80 92L88 84" stroke="var(--accent-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="sh-notes__empty-title">Hen{"\u00FC"}z not yok</h3>
            <p className="sh-notes__empty-desc">
              Notlar ekleyerek bilgi birikiminizi organize edin. Kavramlar, form{"\u00FC"}ller, {"\u00F6"}rnekler ve daha fazlas{"\u0131"}n{"\u0131"} kategorize edebilirsiniz.
            </p>
            <button
              className="sh-notes__empty-cta"
              onClick={() => setShowForm(true)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {"\u0130"}lk Notunu Ekle
            </button>
          </div>
        </div>

        {/* FAB for empty state with form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              className="sh-notes__overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
            >
              <motion.div
                className="sh-notes__modal"
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sh-notes__modal-header">
                  <h3 className="sh-notes__modal-title">Yeni Not</h3>
                  <button
                    className="sh-notes__modal-close"
                    onClick={() => setShowForm(false)}
                    type="button"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <form className="sh-notes__modal-form" onSubmit={handleAddNote}>
                  <div className="sh-notes__form-group">
                    <label className="sh-notes__form-label">Ba{"\u015F"}l{"\u0131"}k</label>
                    <input
                      className="sh-notes__form-input"
                      type="text"
                      placeholder="Not ba\u015Fl\u0131\u011F\u0131..."
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="sh-notes__form-group">
                    <label className="sh-notes__form-label">{"\u0130"}{"\u00E7"}erik</label>
                    <textarea
                      className="sh-notes__form-textarea"
                      placeholder="Not i\u00E7eri\u011Fi..."
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      rows={5}
                      required
                    />
                  </div>
                  <div className="sh-notes__form-group">
                    <label className="sh-notes__form-label">Kategori</label>
                    <div className="sh-notes__category-picker">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          className={`sh-notes__category-option sh-notes__category-option--${c.value}${formCategory === c.value ? " sh-notes__category-option--selected" : ""}`}
                          onClick={() => setFormCategory(c.value)}
                        >
                          <span className="sh-notes__category-option-icon">{c.icon}</span>
                          <span>{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="sh-notes__modal-actions">
                    <button
                      type="button"
                      className="sh-notes__modal-btn sh-notes__modal-btn--ghost"
                      onClick={() => setShowForm(false)}
                    >
                      {"\u0130"}ptal
                    </button>
                    <button
                      type="submit"
                      className="sh-notes__modal-btn sh-notes__modal-btn--primary"
                      disabled={submitting}
                    >
                      {submitting ? "Ekleniyor..." : "Ekle"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="sh-tool">
      {/* Header */}
      <div className="sh-tool__header">
        <div className="sh-tool__header-left">
          <span>{"\u{1F4DD}"}</span>
          <h3 className="sh-main-content__channel-name">{topic}</h3>
          <span className="sh-notes__count">{notes.length} not</span>
        </div>
        <div className="sh-tool__header-right">
          {/* intentionally empty - FAB replaces header button */}
        </div>
      </div>

      <div className="sh-tool__body">
        {/* Search + Filter Toolbar */}
        <div className="sh-notes__toolbar">
          <div className="sh-notes__search">
            <svg className="sh-notes__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              className="sh-notes__search-input"
              type="text"
              placeholder="Notlarda ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                className="sh-notes__search-clear"
                onClick={() => setSearch("")}
                type="button"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Bar - Pill Toggles */}
          <div className="sh-notes__filters">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`sh-notes__filter sh-notes__filter--${opt.value}${filter === opt.value ? " sh-notes__filter--active" : ""}`}
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes Grid */}
        {filteredNotes.length === 0 ? (
          <div className="sh-notes__no-results">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <circle cx="22" cy="22" r="14" stroke="var(--muted)" strokeWidth="2" opacity="0.5" />
              <path d="M32 32l8 8" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
              <path d="M17 22h10" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
            </svg>
            <h3 className="sh-notes__no-results-title">Sonu{"\u00E7"} bulunamad{"\u0131"}</h3>
            <p className="sh-notes__no-results-desc">
              Farkl{"\u0131"} bir filtre veya arama terimi deneyin.
            </p>
          </div>
        ) : (
          <div className="sh-notes__grid">
            {filteredNotes.map((note) => {
              const catInfo = CATEGORY_MAP[note.category];
              const isEditing = editingId === note.id;
              const isOwner = note.authorId === userId;

              return (
                <motion.div
                  key={note.id}
                  className={`sh-notes__card sh-notes__card--${note.category}${note.pinned ? " sh-notes__card--pinned" : ""}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {/* Pinned Ribbon */}
                  {note.pinned && (
                    <div className="sh-notes__pin-ribbon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1.5L7.5 4.5L10.5 5L8.25 7.25L8.75 10.5L6 9L3.25 10.5L3.75 7.25L1.5 5L4.5 4.5L6 1.5Z" fill="currentColor" />
                      </svg>
                      Sabitlendi
                    </div>
                  )}

                  {/* Category Badge */}
                  <div className={`sh-notes__badge sh-notes__badge--${note.category}`}>
                    <span className="sh-notes__badge-icon">{catInfo.icon}</span>
                    <span className="sh-notes__badge-label">{catInfo.label}</span>
                  </div>

                  {/* Title */}
                  {isEditing ? (
                    <input
                      className="sh-notes__edit-input"
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    <h4 className="sh-notes__card-title">{note.title}</h4>
                  )}

                  {/* Content */}
                  {isEditing ? (
                    <textarea
                      className="sh-notes__edit-textarea"
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                    />
                  ) : (
                    <p className="sh-notes__card-content">{note.content}</p>
                  )}

                  {/* Footer */}
                  <div className="sh-notes__card-footer">
                    <div className="sh-notes__card-meta">
                      <span className="sh-notes__card-author">{note.authorNickname}</span>
                      <span className="sh-notes__card-dot">{"  "}</span>
                      <span className="sh-notes__card-date">
                        {new Date(note.createdAt).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {note.editedAt && <span className="sh-notes__card-edited">(d{"\u00FC"}zenlendi)</span>}
                    </div>

                    {/* Actions */}
                    <div className="sh-notes__card-actions">
                      {isEditing ? (
                        <>
                          <button
                            className="sh-notes__action-btn sh-notes__action-btn--ghost"
                            onClick={cancelEdit}
                            type="button"
                          >
                            {"\u0130"}ptal
                          </button>
                          <button
                            className="sh-notes__action-btn sh-notes__action-btn--save"
                            onClick={() => handleSaveEdit(note.id)}
                            type="button"
                          >
                            Kaydet
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className={`sh-notes__action-icon${note.pinned ? " sh-notes__action-icon--active" : ""}`}
                            onClick={() => handlePin(note)}
                            title={note.pinned ? "Sabitlemeyi kald\u0131r" : "Sabitle"}
                            type="button"
                          >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                              <path d="M7.5 1.5L9.5 4L12.5 4.5L10 7L10.5 10.5L7.5 9L4.5 10.5L5 7L2.5 4.5L5.5 4L7.5 1.5Z"
                                stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
                                fill={note.pinned ? "currentColor" : "none"} />
                            </svg>
                          </button>
                          {isOwner && (
                            <>
                              <button
                                className="sh-notes__action-icon"
                                onClick={() => startEdit(note)}
                                title="D\u00FCzenle"
                                type="button"
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                  <path d="M9.5 2.5l2 2L4.5 11.5H2.5v-2l7-7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                className="sh-notes__action-icon sh-notes__action-icon--danger"
                                onClick={() => handleDelete(note.id)}
                                title="Sil"
                                type="button"
                              >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                  <path d="M3 4h8M5.5 4V3a1 1 0 011-1h1a1 1 0 011 1v1M5.5 6.5v4M8.5 6.5v4M4 4l.5 7.5a1 1 0 001 .5h3a1 1 0 001-.5L10 4"
                                    stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        className="sh-notes__fab"
        onClick={() => setShowForm(true)}
        title="Not Ekle"
        type="button"
      >
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 4v14M4 11h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Add Note Modal Overlay */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="sh-notes__overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForm(false)}
          >
            <motion.div
              className="sh-notes__modal"
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sh-notes__modal-header">
                <h3 className="sh-notes__modal-title">Yeni Not</h3>
                <button
                  className="sh-notes__modal-close"
                  onClick={() => setShowForm(false)}
                  type="button"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <form className="sh-notes__modal-form" onSubmit={handleAddNote}>
                <div className="sh-notes__form-group">
                  <label className="sh-notes__form-label">Ba{"\u015F"}l{"\u0131"}k</label>
                  <input
                    className="sh-notes__form-input"
                    type="text"
                    placeholder="Not ba\u015Fl\u0131\u011F\u0131..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="sh-notes__form-group">
                  <label className="sh-notes__form-label">{"\u0130"}{"\u00E7"}erik</label>
                  <textarea
                    className="sh-notes__form-textarea"
                    placeholder="Not i\u00E7eri\u011Fi..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={5}
                    required
                  />
                </div>
                <div className="sh-notes__form-group">
                  <label className="sh-notes__form-label">Kategori</label>
                  <div className="sh-notes__category-picker">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        className={`sh-notes__category-option sh-notes__category-option--${c.value}${formCategory === c.value ? " sh-notes__category-option--selected" : ""}`}
                        onClick={() => setFormCategory(c.value)}
                      >
                        <span className="sh-notes__category-option-icon">{c.icon}</span>
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sh-notes__modal-actions">
                  <button
                    type="button"
                    className="sh-notes__modal-btn sh-notes__modal-btn--ghost"
                    onClick={() => setShowForm(false)}
                  >
                    {"\u0130"}ptal
                  </button>
                  <button
                    type="submit"
                    className="sh-notes__modal-btn sh-notes__modal-btn--primary"
                    disabled={submitting}
                  >
                    {submitting ? "Ekleniyor..." : "Ekle"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
