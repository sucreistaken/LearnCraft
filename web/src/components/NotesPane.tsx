// src/components/NotesPane.tsx
import React, { useState, useRef } from "react";
import { useNotesStore, Note } from "../stores/notesStore";
import { useRoomStore } from "../stores/roomStore";
import { motion, AnimatePresence } from "framer-motion";
import { exportToPdf } from "../utils/pdfExport";

export default function NotesPane() {
    const { notes, removeNote, clearAllNotes } = useNotesStore();
    const currentRoom = useRoomStore((s) => s.currentRoom);
    const addRoomNote = useRoomStore((s) => s.addNote);
    const [pdfLoading, setPdfLoading] = useState(false);
    const notesContentRef = useRef<HTMLDivElement>(null);

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                        📝 Notlarım
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
                        AI yanıtlarından kaydettiğin notlar
                    </div>
                </div>

                {notes.length > 0 && (
                    <div style={{ display: 'flex', gap: 8 }}>
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
                            if (confirm('Tüm notları silmek istediğine emin misin?')) {
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
                        🗑️ Tümünü Sil
                    </button>
                    </div>
                )}
            </div>

            {/* Empty State */}
            {notes.length === 0 && (
                <div className="muted-block" style={{ textAlign: 'center', padding: 40 }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>Henüz not yok</div>
                    <div className="small" style={{ opacity: 0.7 }}>
                        Deep Dive chat'te "💾 Kaydet" butonuna basarak notlar ekleyebilirsin
                    </div>
                </div>
            )}

            {/* Notes List */}
            <div ref={notesContentRef} style={{ display: 'grid', gap: 12 }}>
                <AnimatePresence>
                    {notes.map((note) => (
                        <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="card"
                            style={{ padding: 14 }}
                        >
                            {/* Note Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        fontSize: 11,
                                        background: 'var(--bg)',
                                        padding: '3px 8px',
                                        borderRadius: 6,
                                        border: '1px solid var(--border)'
                                    }}>
                                        {getSourceLabel(note.source)}
                                    </span>
                                    <span className="small muted">{formatDate(note.createdAt)}</span>
                                </div>

                                <div style={{ display: 'flex', gap: 6 }}>
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
                                        onClick={() => {
                                            navigator.clipboard.writeText(note.content);
                                        }}
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
                                        title="Kopyala"
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
                                        title="Sil"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>

                            {/* Note Content */}
                            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                                {formatContent(note.content)}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );
}
