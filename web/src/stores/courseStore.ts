// src/stores/courseStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Course, CourseProgress, WeeklySchedule } from "../types";
import { courseApi } from "../services/api";

interface CourseState {
  courses: Course[];
  currentCourseId: string | null;
  loading: boolean;
  error: string | null;

  // Progress & Schedule
  courseProgress: CourseProgress | null;
  weeklySchedule: WeeklySchedule | null;
  progressLoading: boolean;
  scheduleLoading: boolean;

  // Actions
  fetchCourses: () => Promise<void>;
  createCourse: (code: string, name: string, description?: string) => Promise<Course | null>;
  updateCourse: (id: string, updates: Partial<Course>) => Promise<Course | null>;
  deleteCourse: (id: string) => Promise<boolean>;
  selectCourse: (id: string | null) => void;
  addLessonToCourse: (courseId: string, lessonId: string) => Promise<void>;
  removeLessonFromCourse: (courseId: string, lessonId: string) => Promise<void>;
  rebuildIndex: (courseId: string) => Promise<void>;
  getCourseForCurrentLesson: (lessonId: string) => Course | null;

  // New actions
  fetchCourseProgress: (courseId: string) => Promise<void>;
  generateWeeklySchedule: (courseId: string, examDate?: string) => Promise<void>;
  exportCourse: (courseId: string) => Promise<void>;
}

export const useCourseStore = create<CourseState>()(
  persist(
    (set, get) => ({
      courses: [],
      currentCourseId: null,
      loading: false,
      error: null,
      courseProgress: null,
      weeklySchedule: null,
      progressLoading: false,
      scheduleLoading: false,

      fetchCourses: async () => {
        set({ loading: true, error: null });
        try {
          const result = await courseApi.getAll();
          if (result.ok && result.courses) {
            set({ courses: result.courses, loading: false });
          } else {
            set({ loading: false, error: result.error || "Failed to load courses" });
          }
        } catch (e: any) {
          set({ loading: false, error: e.message });
        }
      },

      createCourse: async (code, name, description) => {
        set({ loading: true, error: null });
        try {
          const result = await courseApi.create(code, name, description);
          if (result.ok && result.course) {
            set((s) => ({
              courses: [...s.courses, result.course!],
              currentCourseId: result.course!.id,
              loading: false,
            }));
            return result.course;
          }
          set({ loading: false, error: result.error });
          return null;
        } catch (e: any) {
          set({ loading: false, error: e.message });
          return null;
        }
      },

      updateCourse: async (id, updates) => {
        try {
          const result = await courseApi.update(id, updates);
          if (result.ok && result.course) {
            set((s) => ({
              courses: s.courses.map((c) => (c.id === id ? result.course! : c)),
            }));
            return result.course;
          }
          return null;
        } catch {
          return null;
        }
      },

      deleteCourse: async (id) => {
        try {
          const result = await courseApi.delete(id);
          if (result.ok) {
            set((s) => ({
              courses: s.courses.filter((c) => c.id !== id),
              currentCourseId: s.currentCourseId === id ? null : s.currentCourseId,
            }));
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      selectCourse: (id) => set({ currentCourseId: id, courseProgress: null, weeklySchedule: null }),

      addLessonToCourse: async (courseId, lessonId) => {
        try {
          const result = await courseApi.addLesson(courseId, lessonId);
          if (result.ok && result.course) {
            set((s) => ({
              courses: s.courses.map((c) => (c.id === courseId ? result.course! : c)),
            }));
          }
        } catch { /* ignore */ }
      },

      removeLessonFromCourse: async (courseId, lessonId) => {
        try {
          const result = await courseApi.removeLesson(courseId, lessonId);
          if (result.ok && result.course) {
            set((s) => ({
              courses: s.courses.map((c) => (c.id === courseId ? result.course! : c)),
            }));
          }
        } catch { /* ignore */ }
      },

      rebuildIndex: async (courseId) => {
        try {
          const result = await courseApi.rebuildIndex(courseId);
          if (result.ok && result.knowledgeIndex) {
            set((s) => ({
              courses: s.courses.map((c) =>
                c.id === courseId ? { ...c, knowledgeIndex: result.knowledgeIndex! } : c
              ),
            }));
          }
        } catch { /* ignore */ }
      },

      getCourseForCurrentLesson: (lessonId) => {
        return get().courses.find((c) => c.lessonIds.includes(lessonId)) || null;
      },

      fetchCourseProgress: async (courseId) => {
        set({ progressLoading: true });
        try {
          const result = await courseApi.getProgress(courseId);
          if (result.ok && result.progress) {
            set({ courseProgress: result.progress, progressLoading: false });
          } else {
            set({ progressLoading: false });
          }
        } catch {
          set({ progressLoading: false });
        }
      },

      generateWeeklySchedule: async (courseId, examDate) => {
        set({ scheduleLoading: true });
        try {
          const result = await courseApi.generateSchedule(courseId, examDate);
          if (result.ok && result.schedule) {
            set({ weeklySchedule: result.schedule, scheduleLoading: false });
          } else {
            set({ scheduleLoading: false });
          }
        } catch {
          set({ scheduleLoading: false });
        }
      },

      exportCourse: async (courseId) => {
        try {
          const result = await courseApi.exportCourse(courseId);
          if (result.ok && result.export) {
            const blob = new Blob([JSON.stringify(result.export, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `course-${result.export.course.code}-export.json`;
            a.click();
            URL.revokeObjectURL(url);
          }
        } catch { /* ignore */ }
      },
    }),
    {
      name: "learncraft-course-storage",
      partialize: (state) => ({
        currentCourseId: state.currentCourseId,
      }),
    }
  )
);
