// stores/weaknessStore.ts
import { create } from 'zustand';
import { WeaknessAnalysis, WeaknessSummary } from '../types';
import { weaknessApi } from '../services/api';

interface WeaknessState {
  summary: WeaknessSummary | null;
  lessonAnalysis: WeaknessAnalysis | null;
  loading: boolean;
  error: string | null;

  fetchGlobal: () => Promise<void>;
  fetchForLesson: (lessonId: string) => Promise<void>;
  analyzeAll: () => Promise<void>;
  analyzeLesson: (lessonId: string) => Promise<void>;
}

export const useWeaknessStore = create<WeaknessState>((set) => ({
  summary: null,
  lessonAnalysis: null,
  loading: false,
  error: null,

  fetchGlobal: async () => {
    set({ loading: true, error: null });
    try {
      const res = await weaknessApi.getGlobal();
      if (res.ok) {
        set({
          summary: {
            globalWeakTopics: res.globalWeakTopics || [],
            studyPriority: res.studyPriority || [],
            generatedAt: new Date().toISOString(),
          },
        });
      } else {
        set({ error: res.error || 'Failed to load weakness data' });
      }
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  fetchForLesson: async (lessonId) => {
    set({ loading: true, error: null });
    try {
      const res = await weaknessApi.getForLesson(lessonId);
      if (res.ok && res.analysis) {
        set({ lessonAnalysis: res.analysis });
      }
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  analyzeAll: async () => {
    set({ loading: true, error: null });
    try {
      const res = await weaknessApi.analyzeAll();
      if (res.ok && res.summary) {
        set({ summary: res.summary });
      }
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  analyzeLesson: async (lessonId) => {
    set({ loading: true, error: null });
    try {
      const res = await weaknessApi.analyzeLesson(lessonId);
      if (res.ok && res.analysis) {
        set({ lessonAnalysis: res.analysis });
      }
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },
}));
