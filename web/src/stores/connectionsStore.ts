import { create } from 'zustand';
import { ConceptConnection } from '../types';
import { connectionsApi } from '../services/api';

type SortMode = 'strength' | 'alpha' | 'lesson-count';

interface ConnectionsState {
  connections: ConceptConnection[];
  loading: boolean;
  error: string | null;

  searchQuery: string;
  minStrength: number;
  selectedLessonFilter: string | null;
  sortMode: SortMode;

  selectedConcept: string | null;
  deepDiveResult: string | null;
  deepDiveLoading: boolean;

  fetchConnections: () => Promise<void>;
  buildConnections: () => Promise<void>;

  setSearchQuery: (q: string) => void;
  setMinStrength: (v: number) => void;
  setLessonFilter: (lessonId: string | null) => void;
  setSortMode: (mode: SortMode) => void;

  setSelectedConcept: (concept: string | null) => void;
  deepDiveConcept: (concept: string, lessonTitles: string[], relatedConcepts: string[]) => Promise<void>;
  clearDeepDive: () => void;

  getFilteredConnections: () => ConceptConnection[];
}

export const useConnectionsStore = create<ConnectionsState>()((set, get) => ({
  connections: [],
  loading: false,
  error: null,

  searchQuery: '',
  minStrength: 0,
  selectedLessonFilter: null,
  sortMode: 'strength' as SortMode,

  selectedConcept: null,
  deepDiveResult: null,
  deepDiveLoading: false,

  fetchConnections: async () => {
    set({ loading: true, error: null });
    try {
      const res = await connectionsApi.get();
      if (res.ok && res.connections) {
        set({ connections: res.connections });
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch connections' });
    }
    set({ loading: false });
  },

  buildConnections: async () => {
    set({ loading: true, error: null });
    try {
      const res = await connectionsApi.build();
      if (res.ok && res.connections) {
        set({ connections: res.connections });
      } else {
        set({ error: res.error || 'Build failed' });
      }
    } catch (err: any) {
      set({ error: err.message || 'Failed to build connections' });
    }
    set({ loading: false });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setMinStrength: (v) => set({ minStrength: v }),
  setLessonFilter: (lessonId) => set({ selectedLessonFilter: lessonId }),
  setSortMode: (mode) => set({ sortMode: mode }),

  setSelectedConcept: (concept) => set({ selectedConcept: concept, deepDiveResult: null }),
  clearDeepDive: () => set({ deepDiveResult: null }),

  deepDiveConcept: async (concept, lessonTitles, relatedConcepts) => {
    set({ deepDiveLoading: true, deepDiveResult: null });
    try {
      const res = await connectionsApi.deepDive(concept, lessonTitles, relatedConcepts);
      if (res.ok && res.analysis) {
        set({ deepDiveResult: res.analysis });
      } else {
        set({ deepDiveResult: 'Deep dive analysis could not be generated.' });
      }
    } catch {
      set({ deepDiveResult: 'An error occurred during deep dive analysis.' });
    }
    set({ deepDiveLoading: false });
  },

  getFilteredConnections: () => {
    const { connections, searchQuery, minStrength, selectedLessonFilter, sortMode } = get();

    let filtered = connections.filter((c) => {
      if (searchQuery && !c.concept.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (c.strength < minStrength) return false;
      if (selectedLessonFilter && !c.lessonIds.includes(selectedLessonFilter)) return false;
      return true;
    });

    const sorted = [...filtered];
    switch (sortMode) {
      case 'strength':
        sorted.sort((a, b) => b.strength - a.strength);
        break;
      case 'alpha':
        sorted.sort((a, b) => a.concept.localeCompare(b.concept));
        break;
      case 'lesson-count':
        sorted.sort((a, b) => b.lessonIds.length - a.lessonIds.length);
        break;
    }

    return sorted;
  },
}));
