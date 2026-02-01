// stores/sprintStore.ts
import { create } from 'zustand';
import { SprintSettings, SprintSession } from '../types';
import { sprintApi } from '../services/api';

interface SprintState {
  settings: SprintSettings;
  currentSession: SprintSession | null;
  stats: {
    totalSessions: number;
    totalStudyMinutes: number;
    totalPomodoros: number;
    recentSessions: SprintSession[];
  } | null;
  focus: {
    weakTopics: string[];
    dueFlashcards: number;
    cheatHighlights: string[];
    emphases: string[];
  } | null;
  timerSeconds: number;
  timerRunning: boolean;
  timerPhase: 'study' | 'break' | 'idle';
  loading: boolean;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<SprintSettings>) => Promise<void>;
  startSession: (lessonId?: string) => Promise<void>;
  endSession: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchFocus: (lessonId: string) => Promise<void>;
  setTimerSeconds: (sec: number) => void;
  setTimerRunning: (running: boolean) => void;
  setTimerPhase: (phase: 'study' | 'break' | 'idle') => void;
  completePomodoroRound: () => void;
}

export const useSprintStore = create<SprintState>((set, get) => ({
  settings: { studyDurationMin: 40, breakDurationMin: 10, intensiveMode: false },
  currentSession: null,
  stats: null,
  focus: null,
  timerSeconds: 40 * 60,
  timerRunning: false,
  timerPhase: 'idle',
  loading: false,

  fetchSettings: async () => {
    try {
      const res = await sprintApi.getSettings();
      if (res.ok && res.settings) {
        set({ settings: res.settings, timerSeconds: res.settings.studyDurationMin * 60 });
      }
    } catch { }
  },

  updateSettings: async (partial) => {
    try {
      const res = await sprintApi.updateSettings(partial);
      if (res.ok && res.settings) set({ settings: res.settings });
    } catch { }
  },

  startSession: async (lessonId) => {
    set({ loading: true });
    try {
      const res = await sprintApi.createSession(lessonId);
      if (res.ok && res.session) {
        const { settings } = get();
        set({
          currentSession: res.session,
          timerSeconds: settings.studyDurationMin * 60,
          timerPhase: 'study',
          timerRunning: true,
        });
      }
    } catch { }
    set({ loading: false });
  },

  endSession: async () => {
    const { currentSession } = get();
    if (currentSession) {
      await sprintApi.updateSession(currentSession.id, {
        status: 'completed',
        endedAt: new Date().toISOString(),
      });
    }
    set({ currentSession: null, timerRunning: false, timerPhase: 'idle' });
  },

  fetchStats: async () => {
    try {
      const res = await sprintApi.getStats();
      if (res.ok) {
        set({
          stats: {
            totalSessions: res.totalSessions || 0,
            totalStudyMinutes: res.totalStudyMinutes || 0,
            totalPomodoros: res.totalPomodoros || 0,
            recentSessions: res.recentSessions || [],
          },
        });
      }
    } catch { }
  },

  fetchFocus: async (lessonId) => {
    try {
      const res = await sprintApi.getFocus(lessonId);
      if (res.ok && res.focus) set({ focus: res.focus });
    } catch { }
  },

  setTimerSeconds: (sec) => set({ timerSeconds: sec }),
  setTimerRunning: (running) => set({ timerRunning: running }),
  setTimerPhase: (phase) => set({ timerPhase: phase }),

  completePomodoroRound: () => {
    const { timerPhase, settings, currentSession } = get();
    if (timerPhase === 'study') {
      // Switch to break
      set({
        timerPhase: 'break',
        timerSeconds: settings.breakDurationMin * 60,
        timerRunning: true,
      });
      // Update session pomodoro count
      if (currentSession) {
        const updated = { ...currentSession, pomodorosCompleted: currentSession.pomodorosCompleted + 1 };
        set({ currentSession: updated });
        sprintApi.updateSession(currentSession.id, {
          pomodorosCompleted: updated.pomodorosCompleted,
          totalStudyMinutes: updated.pomodorosCompleted * settings.studyDurationMin,
        });
      }
    } else {
      // Switch back to study
      set({
        timerPhase: 'study',
        timerSeconds: settings.studyDurationMin * 60,
        timerRunning: true,
      });
    }
  },
}));
