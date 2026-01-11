// src/stores/notesStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Note {
    id: string;
    content: string;
    source: 'deep-dive' | 'cheat-sheet' | 'manual';
    lessonId?: string;
    createdAt: number;
}

interface NotesState {
    notes: Note[];
    addNote: (content: string, source: Note['source'], lessonId?: string) => void;
    removeNote: (id: string) => void;
    clearAllNotes: () => void;
}

export const useNotesStore = create<NotesState>()(
    persist(
        (set) => ({
            notes: [],

            addNote: (content, source, lessonId) => {
                const newNote: Note = {
                    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    content,
                    source,
                    lessonId,
                    createdAt: Date.now(),
                };
                set((state) => ({ notes: [newNote, ...state.notes] }));
            },

            removeNote: (id) => {
                set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }));
            },

            clearAllNotes: () => {
                set({ notes: [] });
            },
        }),
        {
            name: 'lc.notes',
        }
    )
);
