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
    const [showCreator, setShowCreator] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newContent, setNewContent] = useState("");
    const [newTags, setNewTags] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editContent, setEditContent] = useState("");
    const [searchInput, setSearchInput] = useState(searchQuery);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => setSearchQuery(searchInput), 200);
        return () => clearTimeout(timer);
    }, [searchInput, setSearchQuery]);

    const allTags = getAllTags();
    const filteredNotes = getFilteredNotes();

    const handleExportPdf = async () => {
        if (!notesContentRef.current) return;
        setPdfLoading(true);
        try { await exportToPdf(notesContentRef.current, "Notes"); }
        catch (err) { console.error("PDF export error:", err); }
        finally { setPdfLoading(false); }
    };

    const handleCreateNote = () => {
        if (!newContent.trim()) return;
        addNote(newContent.trim(), 'manual', undefined, newTitle.trim() || undefined, newTags);
        setNewTitle(""); setNewContent(""); setNewTags([]); setShowCreator(false);
    };

    const startEdit = useCallback((note: Note) => {
        setEditingId(note.id); setEditTitle(note.title || ""); setEditContent(note.content);
    }, []);

    const saveEdit = useCallback(() => {
        if (!editingId || !editContent.trim()) return;
        updateNote(editingId, { content: editContent.trim(), title: editTitle.trim() || undefined });
        setEditingId(null);
    }, [editingId, editContent, editTitle, updateNote]);

    const cancelEdit = useCallback(() => setEditingId(null), []);

    const toggleTagFilter = (tag: string) => {
        setSelectedTags(selectedTags.includes(tag) ? selectedTags.filter(t => t !== tag) : [...selectedTags, tag]);
    };

    const copyNote = (content: string, id: string) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const formatDate = (ts: number) => new Date(ts).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    const getSourceInfo = (source: Note['source']) => {
        switch (source) {
            case 'deep-dive': return { icon: '🧠', label: 'Deep Dive', cls: 'nt-source--deepdive' };
            case 'cheat-sheet': return { icon: '📋', label: 'Cheat Sheet', cls: 'nt-source--cheat' };
            case 'manual': return { icon: '✏️', label: 'Manual', cls: 'nt-source--manual' };
            default: return { icon: '📝', label: 'Note', cls: '' };
        }
    };

    const formatLine = (text: string, kp: string): React.ReactNode[] => {
        const parts: React.ReactNode[] = [];
        const re = /(\*\*(.+?)\*\*|`(.+?)`)/g;
        let last = 0, m, pi = 0;
        while ((m = re.exec(text)) !== null) {
            if (m.index > last) parts.push(text.slice(last, m.index));
            if (m[2]) parts.push(<strong key={`${kp}-b${pi++}`}>{m[2]}</strong>);
            else if (m[3]) parts.push(<code key={`${kp}-c${pi++}`} className="nt-inline-code">{m[3]}</code>);
            last = re.lastIndex;
        }
        if (last < text.length) parts.push(text.slice(last));
        return parts.length ? parts : [text];
    };

    const formatContent = (content: string): React.ReactNode[] => {
        return content.split('\n').map((line, i) => {
            if (line.startsWith('• ') || line.startsWith('- '))
                return <div key={i} className="nt-list-item">{'• '}{formatLine(line.slice(2), `n${i}`)}</div>;
            if (!line.trim()) return <div key={i} className="nt-spacer">{'\u00A0'}</div>;
            return <div key={i} className="nt-text-line">{formatLine(line, `n${i}`)}</div>;
        });
    };

    return (
        <motion.div
            className="lc-section nt-pane"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
            {/* Header */}
            <div className="nt-header">
                <div className="nt-header-left">
                    <h2 className="nt-title">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
                        </svg>
                        My Notes
                        {notes.length > 0 && <span className="nt-count">{notes.length}</span>}
                    </h2>
                    <p className="nt-subtitle">Saved from AI responses or created manually</p>
                </div>
                <div className="nt-header-actions">
                    <button className="nt-btn nt-btn--primary" onClick={() => setShowCreator(!showCreator)}>
                        {showCreator ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                                Cancel
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                                New Note
                            </>
                        )}
                    </button>
                    {notes.length > 0 && (
                        <>
                            <button className="nt-btn nt-btn--secondary" onClick={handleExportPdf} disabled={pdfLoading}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                {pdfLoading ? "Exporting..." : "PDF"}
                            </button>
                            <button
                                className="nt-btn nt-btn--danger"
                                onClick={() => { if (confirm('Delete all notes?')) clearAllNotes(); }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Note Creator */}
            <AnimatePresence>
                {showCreator && (
                    <motion.div
                        className="nt-creator"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                    >
                        <div className="nt-creator-inner">
                            <input
                                autoFocus
                                className="nt-input"
                                placeholder="Note title (optional)"
                                value={newTitle}
                                onChange={e => setNewTitle(e.target.value)}
                            />
                            <textarea
                                className="nt-textarea"
                                placeholder="Write your note here..."
                                value={newContent}
                                onChange={e => setNewContent(e.target.value)}
                                rows={4}
                            />
                            <div className="nt-creator-tags">
                                <span className="nt-label">Tags</span>
                                <TagInput
                                    tags={newTags}
                                    allTags={allTags}
                                    onAdd={t => setNewTags([...newTags, t])}
                                    onRemove={t => setNewTags(newTags.filter(x => x !== t))}
                                    placeholder="Add tags..."
                                />
                            </div>
                            <div className="nt-creator-actions">
                                <button className="nt-btn nt-btn--secondary" onClick={() => setShowCreator(false)}>Cancel</button>
                                <button className="nt-btn nt-btn--primary" onClick={handleCreateNote} disabled={!newContent.trim()}>Save Note</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Search */}
            {notes.length > 0 && (
                <div className="nt-search">
                    <svg className="nt-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input
                        className="nt-search-input"
                        placeholder="Search notes..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                    />
                </div>
            )}

            {/* Tag Filters */}
            {allTags.length > 0 && (
                <div className="nt-tag-filters">
                    {allTags.map(tag => (
                        <button
                            key={tag}
                            className={`nt-tag-filter${selectedTags.includes(tag) ? ' nt-tag-filter--active' : ''}`}
                            onClick={() => toggleTagFilter(tag)}
                        >
                            #{tag}
                        </button>
                    ))}
                    {selectedTags.length > 0 && (
                        <button className="nt-tag-filter nt-tag-filter--clear" onClick={() => setSelectedTags([])}>
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* Empty State */}
            {notes.length === 0 && !showCreator && (
                <div className="nt-empty">
                    <div className="nt-empty-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                    <div className="nt-empty-title">No notes yet</div>
                    <div className="nt-empty-desc">Save AI responses from Deep Dive or create notes manually</div>
                    <button className="nt-btn nt-btn--primary" onClick={() => setShowCreator(true)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                        Create First Note
                    </button>
                </div>
            )}

            {/* No results */}
            {notes.length > 0 && filteredNotes.length === 0 && (
                <div className="nt-empty">
                    <div className="nt-empty-title">No matching notes</div>
                    <div className="nt-empty-desc">Try different search terms or clear filters</div>
                </div>
            )}

            {/* Notes Grid */}
            <div ref={notesContentRef} className="nt-grid">
                <AnimatePresence>
                    {filteredNotes.map(note => {
                        const src = getSourceInfo(note.source);
                        return (
                            <motion.div
                                key={note.id}
                                className={`nt-card${note.pinned ? ' nt-card--pinned' : ''}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                layout
                            >
                                {/* Card Header */}
                                <div className="nt-card-header">
                                    <div className="nt-card-meta">
                                        <button className={`nt-pin${note.pinned ? ' nt-pin--active' : ''}`} onClick={() => togglePin(note.id)} title={note.pinned ? "Unpin" : "Pin"}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill={note.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/></svg>
                                        </button>
                                        {note.title && <span className="nt-card-title">{note.title}</span>}
                                        <span className={`nt-source ${src.cls}`}>{src.icon} {src.label}</span>
                                    </div>
                                    <div className="nt-card-actions">
                                        <button className="nt-card-action" onClick={() => editingId === note.id ? cancelEdit() : startEdit(note)} title="Edit">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        {currentRoom && (
                                            <button className="nt-card-action" onClick={() => addRoomNote('Shared Note', note.content, 'summary', note.source || 'manual')} title="Share">
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                                            </button>
                                        )}
                                        <button
                                            className={`nt-card-action${copiedId === note.id ? ' nt-card-action--success' : ''}`}
                                            onClick={() => copyNote(note.content, note.id)}
                                            title="Copy"
                                        >
                                            {copiedId === note.id ? (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                                            ) : (
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                            )}
                                        </button>
                                        <button className="nt-card-action nt-card-action--delete" onClick={() => removeNote(note.id)} title="Delete">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                {editingId === note.id ? (
                                    <div className="nt-edit-form">
                                        <input className="nt-input" placeholder="Title (optional)" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                                        <textarea className="nt-textarea" value={editContent} onChange={e => setEditContent(e.target.value)} rows={5} />
                                        <div className="nt-edit-actions">
                                            <button className="nt-btn nt-btn--secondary" onClick={cancelEdit}>Cancel</button>
                                            <button className="nt-btn nt-btn--primary" onClick={saveEdit}>Save</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="nt-card-content">{formatContent(note.content)}</div>
                                )}

                                {/* Footer: date + tags */}
                                <div className="nt-card-footer">
                                    <span className="nt-date">{formatDate(note.createdAt)}</span>
                                    <div className="nt-tags">
                                        {note.tags.map(tag => (
                                            <span key={tag} className="nt-tag">
                                                #{tag}
                                                <button className="nt-tag-remove" onClick={() => removeTag(note.id, tag)}>&times;</button>
                                            </span>
                                        ))}
                                        <InlineTagAdder noteId={note.id} existingTags={note.tags} allTags={allTags} onAdd={addTag} />
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

function InlineTagAdder({ noteId, existingTags, allTags, onAdd }: {
    noteId: string; existingTags: string[]; allTags: string[];
    onAdd: (noteId: string, tag: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState("");
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setValue(""); } };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const suggestions = value.trim() ? allTags.filter(t => t.includes(value.toLowerCase()) && !existingTags.includes(t)).slice(0, 4) : [];
    const submit = (tag?: string) => {
        const t = (tag || value).trim().toLowerCase();
        if (t && !existingTags.includes(t)) onAdd(noteId, t);
        setValue(""); setOpen(false);
    };

    if (!open) return (
        <button className="nt-add-tag" onClick={() => setOpen(true)}>+ tag</button>
    );

    return (
        <div ref={ref} className="nt-tag-input-wrap">
            <input
                ref={inputRef} value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setOpen(false); setValue(""); } }}
                placeholder="tag..."
                className="nt-tag-input"
            />
            {suggestions.length > 0 && (
                <div className="nt-tag-suggestions">
                    {suggestions.map(s => (
                        <div key={s} className="nt-tag-suggestion" onClick={() => submit(s)}>{s}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
