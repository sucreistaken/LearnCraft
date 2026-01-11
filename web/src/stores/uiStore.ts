// src/stores/uiStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ModeId } from '../types';

type Theme = 'light' | 'dark' | 'system';

interface SttProgress {
    progress: number;
    status: string | null;
    now: { start: number; end: number } | null;
    toast: string | null;
}

interface UiState {
    // Mode / Navigation
    mode: ModeId;

    // Theme
    theme: Theme;

    // Loading states
    isLoading: boolean;
    loadingMessage: string | null;

    // Modal states
    showNewLessonModal: boolean;
    newLessonTitle: string;
    draftTitle: string;

    // STT Progress
    stt: SttProgress;

    // Specific loading states
    loLoading: boolean;
    cheatLoading: boolean;
    devLoading: boolean;
    loModulesLoading: boolean;

    // Errors
    cheatErr: string | null;
    devErr: string | null;

    // Actions
    setMode: (mode: ModeId) => void;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    setIsLoading: (loading: boolean, message?: string | null) => void;
    setShowNewLessonModal: (show: boolean) => void;
    setNewLessonTitle: (title: string) => void;
    setDraftTitle: (title: string) => void;
    setSttProgress: (progress: Partial<SttProgress>) => void;
    resetStt: () => void;
    setLoLoading: (loading: boolean) => void;
    setCheatLoading: (loading: boolean) => void;
    setDevLoading: (loading: boolean) => void;
    setLoModulesLoading: (loading: boolean) => void;
    setCheatErr: (err: string | null) => void;
    setDevErr: (err: string | null) => void;
}

const getInitialMode = (): ModeId => {
    if (typeof window === 'undefined') return 'plan';
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get('mode') as ModeId | null;
    const saved = localStorage.getItem('lc.mode') as ModeId | null;
    if (q) return q;
    if (saved) return saved;
    return 'plan';
};

const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem('lc.theme') as Theme | null;
    return saved ?? 'system';
};

export const useUiStore = create<UiState>()(
    persist(
        (set, get) => ({
            // Initial state
            mode: getInitialMode(),
            theme: getInitialTheme(),
            isLoading: false,
            loadingMessage: null,
            showNewLessonModal: false,
            newLessonTitle: '',
            draftTitle: '',
            stt: {
                progress: 0,
                status: null,
                now: null,
                toast: null,
            },
            loLoading: false,
            cheatLoading: false,
            devLoading: false,
            loModulesLoading: false,
            cheatErr: null,
            devErr: null,

            // Actions
            setMode: (mode) => {
                set({ mode });
                // Sync with URL and localStorage
                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.set('mode', mode);
                    window.history.replaceState({}, '', url.toString());
                    localStorage.setItem('lc.mode', mode);
                }
            },

            setTheme: (theme) => {
                set({ theme });
                if (typeof window !== 'undefined') {
                    localStorage.setItem('lc.theme', theme);
                    // Apply theme to document
                    const root = document.documentElement;
                    root.classList.remove('light', 'dark');
                    if (theme === 'system') {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                        root.classList.add(prefersDark ? 'dark' : 'light');
                    } else {
                        root.classList.add(theme);
                    }
                }
            },

            toggleTheme: () => {
                const current = get().theme;
                const next: Theme = current === 'light' ? 'dark' : current === 'dark' ? 'system' : 'light';
                get().setTheme(next);
            },

            setIsLoading: (loading, message = null) =>
                set({ isLoading: loading, loadingMessage: message }),

            setShowNewLessonModal: (show) => set({ showNewLessonModal: show }),
            setNewLessonTitle: (title) => set({ newLessonTitle: title }),
            setDraftTitle: (title) => set({ draftTitle: title }),

            setSttProgress: (progress) =>
                set((state) => ({
                    stt: { ...state.stt, ...progress },
                })),

            resetStt: () =>
                set({
                    stt: { progress: 0, status: null, now: null, toast: null },
                }),

            setLoLoading: (loading) => set({ loLoading: loading }),
            setCheatLoading: (loading) => set({ cheatLoading: loading }),
            setDevLoading: (loading) => set({ devLoading: loading }),
            setLoModulesLoading: (loading) => set({ loModulesLoading: loading }),
            setCheatErr: (err) => set({ cheatErr: err }),
            setDevErr: (err) => set({ devErr: err }),
        }),
        {
            name: 'learncraft-ui-storage',
            partialize: (state) => ({
                theme: state.theme,
            }),
        }
    )
);

// Theme initialization helper
export const initializeTheme = () => {
    const theme = useUiStore.getState().theme;
    useUiStore.getState().setTheme(theme);
};
