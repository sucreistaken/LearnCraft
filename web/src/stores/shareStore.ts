// stores/shareStore.ts
import { create } from 'zustand';
import { SharedBundle } from '../types';
import { sharesApi } from '../services/api';

interface ShareState {
  shares: SharedBundle[];
  currentShare: SharedBundle | null;
  loading: boolean;
  error: string | null;

  fetchAll: () => Promise<void>;
  createShare: (lessonId: string, createdBy?: string) => Promise<string | null>;
  fetchShare: (shareId: string) => Promise<void>;
  addComment: (shareId: string, author: string, text: string) => Promise<void>;
  deleteShare: (shareId: string) => Promise<void>;
  importShare: (shareId: string) => Promise<string | null>;
}

export const useShareStore = create<ShareState>((set, get) => ({
  shares: [],
  currentShare: null,
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const res = await sharesApi.list();
      if (res.ok) set({ shares: res.shares || [] });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  createShare: async (lessonId, createdBy) => {
    set({ loading: true, error: null });
    try {
      const res = await sharesApi.create(lessonId, createdBy);
      if (res.ok && res.share) {
        set((s) => ({ shares: [res.share!, ...s.shares] }));
        return res.share.shareId;
      }
      set({ error: res.error || 'Failed to create share' });
      return null;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    } finally {
      set({ loading: false });
    }
  },

  fetchShare: async (shareId) => {
    set({ loading: true, error: null });
    try {
      const res = await sharesApi.get(shareId);
      if (res.ok && res.share) set({ currentShare: res.share });
      else set({ error: res.error || 'Share not found' });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ loading: false });
    }
  },

  addComment: async (shareId, author, text) => {
    try {
      const res = await sharesApi.addComment(shareId, author, text);
      if (res.ok && res.share) set({ currentShare: res.share });
    } catch { }
  },

  deleteShare: async (shareId) => {
    try {
      await sharesApi.delete(shareId);
      set((s) => ({ shares: s.shares.filter((sh) => sh.shareId !== shareId) }));
    } catch { }
  },

  importShare: async (shareId) => {
    set({ loading: true, error: null });
    try {
      const res = await sharesApi.import(shareId);
      if (res.ok) return res.lessonId || null;
      set({ error: res.error || 'Import failed' });
      return null;
    } catch (e: any) {
      set({ error: e.message });
      return null;
    } finally {
      set({ loading: false });
    }
  },
}));
