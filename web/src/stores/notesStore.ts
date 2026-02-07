// src/stores/notesStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Note {
    id: string;
    content: string;
    source: 'deep-dive' | 'cheat-sheet' | 'manual';
    lessonId?: string;
    createdAt: number;
    tags: string[];
    pinned: boolean;
    title?: string;
    updatedAt?: number;
}

interface NotesState {
    notes: Note[];
    searchQuery: string;
    selectedTags: string[];

    // Actions
    addNote: (content: string, source: Note['source'], lessonId?: string, title?: string, tags?: string[]) => void;
    removeNote: (id: string) => void;
    updateNote: (id: string, updates: Partial<Pick<Note, 'content' | 'title' | 'tags'>>) => void;
    togglePin: (id: string) => void;
    addTag: (noteId: string, tag: string) => void;
    removeTag: (noteId: string, tag: string) => void;
    setSearchQuery: (query: string) => void;
    setSelectedTags: (tags: string[]) => void;
    clearAllNotes: () => void;

    // Derived
    getAllTags: () => string[];
    getFilteredNotes: () => Note[];
}

export const useNotesStore = create<NotesState>()(
    persist(
        (set, get) => ({
            notes: [],
            searchQuery: '',
            selectedTags: [],

            addNote: (content, source, lessonId, title, tags) => {
                const newNote: Note = {
                    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    content,
                    source,
                    lessonId,
                    createdAt: Date.now(),
                    tags: tags || [],
                    pinned: false,
                    title,
                };
                set((state) => ({ notes: [newNote, ...state.notes] }));
            },

            removeNote: (id) => {
                set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
            },

            updateNote: (id, updates) => {
                set((state) => ({
                    notes: state.notes.map((n) =>
                        n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
                    ),
                }));
            },

            togglePin: (id) => {
                set((state) => ({
                    notes: state.notes.map((n) =>
                        n.id === id ? { ...n, pinned: !n.pinned } : n
                    ),
                }));
            },

            addTag: (noteId, tag) => {
                const trimmed = tag.trim().toLowerCase();
                if (!trimmed) return;
                set((state) => ({
                    notes: state.notes.map((n) =>
                        n.id === noteId && !n.tags.includes(trimmed)
                            ? { ...n, tags: [...n.tags, trimmed], updatedAt: Date.now() }
                            : n
                    ),
                }));
            },

            removeTag: (noteId, tag) => {
                set((state) => ({
                    notes: state.notes.map((n) =>
                        n.id === noteId
                            ? { ...n, tags: n.tags.filter((t) => t !== tag), updatedAt: Date.now() }
                            : n
                    ),
                }));
            },

            setSearchQuery: (query) => set({ searchQuery: query }),
            setSelectedTags: (tags) => set({ selectedTags: tags }),

            clearAllNotes: () => {
                set({ notes: [] });
            },

            getAllTags: () => {
                const allTags = new Set<string>();
                get().notes.forEach((n) => n.tags.forEach((t) => allTags.add(t)));
                return [...allTags].sort();
            },

            getFilteredNotes: () => {
                const { notes, searchQuery, selectedTags } = get();
                let filtered = [...notes];

                // Search filter
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    filtered = filtered.filter(
                        (n) =>
                            n.content.toLowerCase().includes(q) ||
                            (n.title && n.title.toLowerCase().includes(q)) ||
                            n.tags.some((t) => t.includes(q))
                    );
                }

                // Tag filter
                if (selectedTags.length > 0) {
                    filtered = filtered.filter((n) =>
                        selectedTags.every((tag) => n.tags.includes(tag))
                    );
                }

                // Sort: pinned first, then by creation date
                filtered.sort((a, b) => {
                    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                    return b.createdAt - a.createdAt;
                });

                return filtered;
            },
        }),
        {
            name: 'lc.notes',
            version: 2,
            migrate: (persisted: any, version: number) => {
                if (version < 2) {
                    const notes = (persisted?.notes || []).map((n: any) => ({
                        ...n,
                        tags: n.tags || [],
                        pinned: n.pinned ?? false,
                        title: n.title || undefined,
                        updatedAt: n.updatedAt || undefined,
                    }));
                    return { ...persisted, notes, searchQuery: '', selectedTags: [] };
                }
                return persisted as any;
            },
            partialize: (state) => ({
                notes: state.notes,
            }),
        }
    )
);
