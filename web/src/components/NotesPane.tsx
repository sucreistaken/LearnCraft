// src/components/NotesPane.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNotesStore, Note } from "../stores/notesStore";
import { useRoomStore } from "../stores/roomStore";
import { motion, AnimatePresence } from "framer-motion";
import { exportToPdf } from "../utils/pdfExport";
import TagInput from "./ui/TagInput";

export default function NotesPane() {
    const {
        notes, removeNote, clearAllNotes, addNote, updateNote, togglePin,
        addTag, removeTag, searchQuery, setSearchQuery, selectedTags,
        setSelectedTags, getAllTags, getFilteredNotes,
    } = useNotesStore();
    const currentRoom = useRoomStore((s) => s.currentRoom);
    const addRoomNote = useRoomStore((s) => s.addNote);
    const [pdfLoading, setPdfLoading] = useState(false);
    const notesContentRef = useRef<HTMLDivElement>(null);

    // Manual note creator state
    const [showCreator, setShowCreator] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTags, setNewTags] = useState<string[]>([]);

    // Edit mode state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editContent, setEditContent] = useState("");

    // Debounced search
    const [searchInput, setSearchInput] = useState(searchQuery);
    useEffect(() => {
        const timer = setTimeout(() => setSearchQuery(searchInput), 200);
        return () => clearTimeout(timer);
    }, [searchInput, setSearchQuery]);

    const allTags = getAllTags();
    const filteredNotes = getFilteredNotes();

    const handleExportPdf = async () => {
        if (!notesContentRef.current) return;
        setPdfLoading(true);
        try {
            await exportToPdf(notesContentRef.current, "Notes");
        } catch (err) {
            console.error("PDF export error:", err);
        } finally {
            setPdfLoading(false);
        }
    };

    const handleCreateNote = () => {
        if (!newContent.trim()) return;
        addNote(newContent.trim(), 'manual', undefined, newTitle.trim() || undefined, newTags);
        setNewTitle("");
        setNewContent("");
        setNewTags([]);
        setShowCreator(false);
    };

    const startEdit = useCallback((note: Note) => {
        setEditingId(note.id);
        setEditTitle(note.title || "");
        setEditContent(note.content);
    }, []);

    const saveEdit = useCallback(() => {
        if (!editingId || !editContent.trim()) return;
        updateNote(editingId, {
            content: editContent.trim(),
            title: editTitle.trim() || undefined,
        });
        setEditingId(null);
    }, [editingId, editContent, editTitle, updateNote]);

    const cancelEdit = useCallback(() => {
        setEditingId(null);
    }, []);

    const toggleTagFilter = (tag: string) => {
        setSelectedTags(
            selectedTags.includes(tag)
                ? selectedTags.filter((t) => t !== tag)
                : [...selectedTags, tag]
        );
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSourceLabel = (source: Note['source']) => {
        switch (source) {
            case 'deep-dive': return '🧠 Deep Dive';
            case 'cheat-sheet': return '📋 Cheat Sheet';
            case 'manual': return '✏️ Manuel';
            default: return '📝 Not';
        }
    };

    const formatLine = (text: string, keyPrefix: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
        let lastIndex = 0;
        let match;
        let partIdx = 0;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            if (match[2]) {
                parts.push(<strong key={`${keyPrefix}-b${partIdx++}`}>{match[2]}</strong>);
            } else if (match[3]) {
                parts.push(<code key={`${keyPrefix}-c${partIdx++}`} style={{ background: 'var(--hair)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{match[3]}</code>);
            }
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }
        return parts.length > 0 ? parts : [text];
    };

    const formatContent = (content: string): React.ReactNode[] => {
        return content.split('\n').map((line, i) => {
            if (line.startsWith('• ') || line.startsWith('- ')) {
                return <div key={i} style={{ paddingLeft: 16, marginBottom: 4 }}>{'• '}{formatLine(line.slice(2), `n${i}`)}</div>;
            }
            if (!line.trim()) {
                return <div key={i} style={{ marginBottom: 4 }}>{'\u00A0'}</div>;
            }
            return <div key={i} style={{ marginBottom: 4 }}>{formatLine(line, `n${i}`)}</div>;
        });
    };

    return (
        <div className="lc-section" style={{ padding: 16 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        📝 Notlarim
                        {notes.length > 0 && (
                            <span style={{
                                fontSize: 12,
                                background: 'var(--accent-2)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: 10,
                                fontWeight: 700
                            }}>
                                {notes.length}
                            </span>
                        )}
                    </div>
                    <div className="muted-block small" style={{ marginTop: 4 }}>
                        AI yanitlarindan kaydettigin veya manuel olusturdugum notlar
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowCreator(!showCreator)}
                        style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                        {showCreator ? "Cancel" : "+ New Note"}
                    </button>
                    {notes.length > 0 && (
                        <>
                            <button
                                className="btn btn-secondary"
                                onClick={handleExportPdf}
                                disabled={pdfLoading}
                                style={{ fontSize: 12, padding: '6px 12px' }}
                            >
                                {pdfLoading ? "Exporting..." : "PDF Export"}
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Tum notlari silmek istedigine emin misin?')) {
                                        clearAllNotes();
                                    }
                                }}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    padding: '6px 12px',
                                    fontSize: 12,
                                    color: 'var(--muted)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--danger, #ef4444)'; e.currentTarget.style.color = 'var(--danger, #ef4444)'; }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--muted)'; }}
                            >
                                🗑️ Clear All
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Manual Note Creator */}
            <AnimatePresence>
                {showCreator && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="card"
                        style={{ padding: 14, marginBottom: 12, overflow: "hidden" }}
                    >
                        <input
                            autoFocus
                            className="lc-textarea input w-full"
                            placeholder="Note title (optional)"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            style={{ marginBottom: 8, fontSize: 13 }}
                        />
                        <textarea
                            className="lc-textarea textarea w-full"
                            placeholder="Write your note here..."
                            value={newContent}
                            onChange={(e) => setNewContent(e.target.value)}
                            rows={4}
                            style={{ marginBottom: 8, fontSize: 13 }}
                        />
                        <div style={{ marginBottom: 8 }}>
                            <div className="small muted" style={{ marginBottom: 4 }}>Tags</div>
                            <TagInput
                                tags={newTags}
                                allTags={allTags}
                                onAdd={(t) => setNewTags([...newTags, t])}
                                onRemove={(t) => setNewTags(newTags.filter((x) => x !== t))}
                                placeholder="Add tags..."
                            />
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                            <button className="btn btn-secondary" onClick={() => setShowCreator(false)} style={{ fontSize: 12 }}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleCreateNote} disabled={!newContent.trim()} style={{ fontSize: 12 }}>
                                Save Note
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search Bar */}
            {notes.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                    <div style={{ position: "relative" }}>
                        <input
                            className="lc-textarea input w-full"
                            placeholder="Search notes by title, content, or tags..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            style={{ fontSize: 13, paddingLeft: 32 }}
                        />
                        <span style={{
                            position: "absolute",
                            left: 10,
                            top: "50%",
                            transform: "translateY(-50%)",
                            opacity: 0.4,
                            fontSize: 14,
                            pointerEvents: "none",
                        }}>
                            🔍
                        </span>
                    </div>
                </div>
            )}

            {/* Tag Filter Pills */}
            {allTags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {allTags.map((tag) => {
                        const active = selectedTags.includes(tag);
                        return (
                            <button
                                key={tag}
                                onClick={() => toggleTagFilter(tag)}
                                style={{
                                    padding: "3px 10px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    border: `1px solid ${active ? "var(--accent-2)" : "var(--border)"}`,
                                    background: active ? "var(--accent-2)" : "var(--bg)",
                                    color: active ? "white" : "var(--text)",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                {tag}
                            </button>
                        );
                    })}
                    {selectedTags.length > 0 && (
                        <button
                            onClick={() => setSelectedTags([])}
                            style={{
                                padding: "3px 10px",
                                borderRadius: 999,
                                fontSize: 11,
                                border: "1px solid var(--border)",
                                background: "transparent",
                                color: "var(--muted)",
                                cursor: "pointer",
                            }}
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            )}

            {/* Empty State */}
            {notes.length === 0 && !showCreator && (
                <div className="muted-block" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Henuz not yok</div>
                    <div className="small" style={{ opacity: 0.7, marginBottom: 12 }}>
                        Deep Dive chat'te "💾 Kaydet" butonuna basarak veya "+ New Note" ile manuel not ekleyebilirsin
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowCreator(true)} style={{ fontSize: 12 }}>
                        + Create Your First Note
                    </button>
                </div>
            )}

            {/* No results state */}
            {notes.length > 0 && filteredNotes.length === 0 && (
                <div className="muted-block" style={{ textAlign: 'center', padding: 24 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>No matching notes</div>
                    <div className="small muted">Try different search terms or clear tag filters</div>
                </div>
            )}

            {/* Notes List */}
            <div ref={notesContentRef} style={{ display: 'grid', gap: 12 }}>
                <AnimatePresence>
                    {filteredNotes.map((note) => (
                        <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="card"
                            style={{
                                padding: 14,
                                borderLeft: note.pinned ? "3px solid var(--accent-2)" : "3px solid transparent",
                            }}
                        >
                            {/* Note Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                                    {/* Pin button */}
                                    <button
                                        onClick={() => togglePin(note.id)}
                                        style={{
                                            background: "transparent",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: 2,
                                            fontSize: 14,
                                            opacity: note.pinned ? 1 : 0.3,
                                            transition: "opacity 0.15s",
                                            flexShrink: 0,
                                        }}
                                        title={note.pinned ? "Unpin" : "Pin to top"}
                                    >
                                        📌
                                    </button>
                                    {note.title && (
                                        <span style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {note.title}
                                        </span>
                                    )}
                                    <span style={{
                                        fontSize: 11,
                                        background: 'var(--bg)',
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        border: '1px solid var(--border)',
                                        flexShrink: 0,
                                    }}>
                                        {getSourceLabel(note.source)}
                                    </span>
                                    <span className="small muted" style={{ flexShrink: 0 }}>{formatDate(note.createdAt)}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    {/* Edit button */}
                                    <button
                                        onClick={() => editingId === note.id ? cancelEdit() : startEdit(note)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 4,
                                            fontSize: 13,
                                            opacity: editingId === note.id ? 1 : 0.5,
                                            borderRadius: 4,
                                            color: editingId === note.id ? 'var(--accent-2)' : 'inherit',
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseOut={(e) => e.currentTarget.style.opacity = editingId === note.id ? '1' : '0.5'}
                                        title="Edit"
                                    >
                                        ✏️
                                    </button>
                                    {currentRoom && (
                                        <button
                                            onClick={() => addRoomNote('Shared Note', note.content, 'summary', note.source || 'manual')}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 4,
                                                fontSize: 14,
                                                opacity: 0.5,
                                                borderRadius: 4
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                                            title="Share to Room"
                                        >
                                            {"↗"}
                                        </button>
                                    )}
                                    <button
                                        onClick={() => navigator.clipboard.writeText(note.content)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 4,
                                            fontSize: 14,
                                            opacity: 0.5,
                                            borderRadius: 4
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                        onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                                        title="Copy"
                                    >
                                        {"📋"}
                                    </button>
                                    <button
                                        onClick={() => removeNote(note.id)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: 4,
                                            fontSize: 14,
                                            opacity: 0.5,
                                            borderRadius: 4
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--danger-bg, #fee)'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.background = 'transparent'; }}
                                        title="Delete"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Edit Mode */}
                            {editingId === note.id ? (
                                <div>
                                    <input
                                        className="lc-textarea input w-full"
                                        placeholder="Title (optional)"
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        style={{ marginBottom: 6, fontSize: 13 }}
                                    />
                                    <textarea
                                        className="lc-textarea textarea w-full"
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        rows={5}
                                        style={{ marginBottom: 8, fontSize: 13 }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                                        <button className="btn btn-secondary" onClick={cancelEdit} style={{ fontSize: 11, padding: "4px 10px" }}>
                                            Cancel
                                        </button>
                                        <button className="btn btn-primary" onClick={saveEdit} style={{ fontSize: 11, padding: "4px 10px" }}>
                                            Save
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* Note Content */
                                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                                    {formatContent(note.content)}
                                </div>
                            )}

                            {/* Tags Row */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8, alignItems: "center" }}>
                                {note.tags.map((tag) => (
                                    <span
                                        key={tag}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 3,
                                            padding: "2px 8px",
                                            borderRadius: 6,
                                            background: "var(--ring)",
                                            color: "var(--accent-2)",
                                            fontSize: 10,
                                            fontWeight: 600,
                                        }}
                                    >
                                        #{tag}
                                        <button
                                            onClick={() => removeTag(note.id, tag)}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                cursor: "pointer",
                                                color: "var(--accent-2)",
                                                padding: 0,
                                                fontSize: 10,
                                                lineHeight: 1,
                                                opacity: 0.6,
                                            }}
                                        >
                                            x
                                        </button>
                                    </span>
                                ))}
                                <InlineTagAdder
                                    noteId={note.id}
                                    existingTags={note.tags}
                                    allTags={allTags}
                                    onAdd={addTag}
                                />
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}

// Small inline "+" button to add tags directly on a note card
function InlineTagAdder({ noteId, existingTags, allTags, onAdd }: {
    noteId: string;
    existingTags: string[];
    allTags: string[];
    onAdd: (noteId: string, tag: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
                setValue("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const suggestions = value.trim()
        ? allTags.filter((t) => t.includes(value.toLowerCase()) && !existingTags.includes(t)).slice(0, 4)
        : [];

    const submit = (tag?: string) => {
        const t = (tag || value).trim().toLowerCase();
        if (t && !existingTags.includes(t)) {
            onAdd(noteId, t);
        }
        setValue("");
        setOpen(false);
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                style={{
                    background: "none",
                    border: "1px dashed var(--border)",
                    borderRadius: 6,
                    padding: "2px 6px",
                    fontSize: 10,
                    cursor: "pointer",
                    color: "var(--muted)",
                    transition: "all 0.15s",
                }}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--accent-2)"; e.currentTarget.style.color = "var(--accent-2)"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}
            >
                + tag
            </button>
        );
    }

    return (
        <div ref={containerRef} style={{ position: "relative" }}>
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                    if (e.key === "Escape") { setOpen(false); setValue(""); }
                }}
                placeholder="tag..."
                style={{
                    width: 80,
                    border: "1px solid var(--accent-2)",
                    borderRadius: 6,
                    padding: "2px 6px",
                    fontSize: 10,
                    outline: "none",
                    background: "var(--input-bg)",
                    color: "var(--text)",
                }}
            />
            {suggestions.length > 0 && (
                <div style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 2,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    boxShadow: "var(--shadow-1)",
                    zIndex: 30,
                    minWidth: 80,
                }}>
                    {suggestions.map((s) => (
                        <div
                            key={s}
                            onClick={() => submit(s)}
                            style={{
                                padding: "4px 8px",
                                fontSize: 10,
                                cursor: "pointer",
                                color: "var(--text)",
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg)")}
                            onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                            {s}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
