// stores/flashcardStore.ts
import { create } from 'zustand';
import { Flashcard, FlashcardStats } from '../types';
import { flashcardApi } from '../services/api';

interface FlashcardState {
  cards: Flashcard[];
  dueCards: Flashcard[];
  stats: FlashcardStats | null;
  currentIndex: number;
  isFlipped: boolean;
  loading: boolean;
  error: string | null;
  viewMode: 'review' | 'browse';

  fetchAll: (lessonId?: string) => Promise<void>;
  fetchDue: () => Promise<void>;
  fetchStats: () => Promise<void>;
  generate: (lessonId: string) => Promise<number>;
  review: (cardId: string, quality: number) => Promise<void>;
  deleteCard: (cardId: string) => Promise<void>;
  setFlipped: (flipped: boolean) => void;
  nextCard: () => void;
  setViewMode: (mode: 'review' | 'browse') => void;
}

export const useFlashcardStore = create<FlashcardState>((set, get) => ({
  cards: [],
  dueCards: [],
  stats: null,
  currentIndex: 0,
  isFlipped: false,
  loading: false,
  error: null,
  viewMode: 'review',

  fetchAll: async (lessonId) => {
    set({ loading: true, error: null });
    try {
      const res = await flashcardApi.getAll(lessonId);
      if (res.ok) set({ cards: res.cards || [] });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchDue: async () => {
    set({ loading: true, error: null });
    try {
      const res = await flashcardApi.getDue();
      if (res.ok) set({ dueCards: res.cards || [], currentIndex: 0, isFlipped: false });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const res = await flashcardApi.getStats();
      if (res.ok) {
        set({
          stats: {
            total: res.total || 0,
            new: res.new || 0,
            learning: res.learning || 0,
            review: res.review || 0,
            graduated: res.graduated || 0,
            dueToday: res.dueToday || 0,
          },
        });
      }
    } catch { }
  },

  generate: async (lessonId) => {
    set({ loading: true, error: null });
    try {
      const res = await flashcardApi.generate(lessonId);
      if (res.ok) {
        await get().fetchAll();
        await get().fetchStats();
        return res.generated || 0;
      }
      return 0;
    } catch (e: any) {
      set({ error: e.message });
      return 0;
    } finally {
      set({ loading: false });
    }
  },

  review: async (cardId, quality) => {
    try {
      const res = await flashcardApi.review(cardId, quality);
      if (res.ok) {
        // Move to next card
        get().nextCard();
        await get().fetchStats();
      }
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  deleteCard: async (cardId) => {
    try {
      await flashcardApi.delete(cardId);
      set((s) => ({ cards: s.cards.filter((c) => c.id !== cardId) }));
      await get().fetchStats();
    } catch { }
  },

  setFlipped: (flipped) => set({ isFlipped: flipped }),

  nextCard: () => {
    const { dueCards, currentIndex } = get();
    if (currentIndex < dueCards.length - 1) {
      set({ currentIndex: currentIndex + 1, isFlipped: false });
    } else {
      // Refresh due cards when done
      get().fetchDue();
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),
}));
