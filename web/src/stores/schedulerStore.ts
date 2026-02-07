// src/stores/schedulerStore.ts
import { create } from 'zustand';
import { StudyTask, DailyPlan, WeeklyOverview, StreakData } from '../types';
import { schedulerApi } from '../services/api';

interface SchedulerState {
    nextTask: StudyTask | null;
    totalPending: number;
    dailyPlan: DailyPlan | null;
    weeklyOverview: WeeklyOverview | null;
    streak: StreakData | null;
    loading: boolean;
    expanded: boolean;

    fetchNextSession: (courseId?: string) => Promise<void>;
    fetchDailyPlan: (courseId?: string) => Promise<void>;
    fetchWeeklyOverview: (courseId?: string) => Promise<void>;
    fetchStreak: () => Promise<void>;
    completeTask: (taskId: string) => Promise<void>;
    setExpanded: (expanded: boolean) => void;
    toggleExpanded: () => void;
}

export const useSchedulerStore = create<SchedulerState>()((set, get) => ({
    nextTask: null,
    totalPending: 0,
    dailyPlan: null,
    weeklyOverview: null,
    streak: null,
    loading: false,
    expanded: false,

    fetchNextSession: async (courseId?: string) => {
        set({ loading: true });
        const res = await schedulerApi.getNextSession(courseId);
        if (res.ok) {
            set({
                nextTask: res.task || null,
                totalPending: res.totalPending || 0,
            });
        }
        set({ loading: false });
    },

    fetchDailyPlan: async (courseId?: string) => {
        set({ loading: true });
        const res = await schedulerApi.getDailyPlan(courseId);
        if (res.ok && res.plan) {
            set({ dailyPlan: res.plan });
        }
        set({ loading: false });
    },

    fetchWeeklyOverview: async (courseId?: string) => {
        const res = await schedulerApi.getWeeklyOverview(courseId);
        if (res.ok && res.overview) {
            set({ weeklyOverview: res.overview });
        }
    },

    fetchStreak: async () => {
        const res = await schedulerApi.getStreak();
        if (res.ok && res.streak) {
            set({ streak: res.streak });
        }
    },

    completeTask: async (taskId: string) => {
        const res = await schedulerApi.completeTask(taskId);
        if (res.ok) {
            if (res.streak) set({ streak: res.streak });

            // Update local dailyPlan
            const plan = get().dailyPlan;
            if (plan) {
                const updatedTasks = plan.tasks.map((t) =>
                    t.id === taskId ? { ...t, completed: true } : t
                );
                set({ dailyPlan: { ...plan, tasks: updatedTasks } });
            }

            // Update nextTask if it was the one completed
            const next = get().nextTask;
            if (next?.id === taskId) {
                set({ nextTask: null });
            }
        }
    },

    setExpanded: (expanded: boolean) => set({ expanded }),
    toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
}));
