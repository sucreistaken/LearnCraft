// src/stores/lessonStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Plan, CheatSheet, LoAlignment, LoStudyModule, Emphasis } from '../types';

export interface Lesson {
  id: string;
  title: string;
  date: string;
  transcript?: string;
  slideText?: string;
  plan?: Plan;
  courseCode?: string;
  learningOutcomes?: string[];
  loAlignment?: LoAlignment;
  loModules?: LoStudyModule[];
  cheatSheet?: CheatSheet;
}

interface LessonState {
  // Ders listesi
  lessons: Lesson[];
  currentLessonId: string | null;

  // Aktif ders verileri
  lectureText: string;
  slidesText: string;
  plan: Plan | null;
  quiz: string[];

  // LO verileri
  courseCode: string;
  learningOutcomes: string[];
  loAlignment: LoAlignment | null;
  loModules: LoStudyModule[] | null;

  // Cheat Sheet
  cheatSheet: CheatSheet | null;

  // Deviation analizi
  deviation: unknown | null;

  // Error state
  error: string | null;

  // Actions
  setLessons: (lessons: Lesson[]) => void;
  setCurrentLessonId: (id: string | null) => void;
  setLectureText: (text: string) => void;
  setSlidesText: (text: string) => void;
  setPlan: (plan: Plan | null) => void;
  setQuiz: (quiz: string[]) => void;
  setCourseCode: (code: string) => void;
  setLearningOutcomes: (outcomes: string[]) => void;
  setLoAlignment: (alignment: LoAlignment | null) => void;
  setLoModules: (modules: LoStudyModule[] | null) => void;
  setCheatSheet: (sheet: CheatSheet | null) => void;
  setDeviation: (deviation: unknown | null) => void;
  setError: (error: string | null) => void;

  // Bulk actions
  clearCurrentLesson: () => void;
  loadLesson: (lesson: Partial<Lesson>) => void;
}

export const useLessonStore = create<LessonState>()(
  persist(
    (set) => ({
      // Initial state
      lessons: [],
      currentLessonId: null,
      lectureText: '',
      slidesText: '',
      plan: null,
      quiz: [],
      courseCode: '',
      learningOutcomes: [],
      loAlignment: null,
      loModules: null,
      cheatSheet: null,
      deviation: null,
      error: null,

      // Actions
      setLessons: (lessons) => set({ lessons }),
      setCurrentLessonId: (id) => set({ currentLessonId: id }),
      setLectureText: (text) => set({ lectureText: text }),
      setSlidesText: (text) => set({ slidesText: text }),
      setPlan: (plan) => set({ plan }),
      setQuiz: (quiz) => set({ quiz }),
      setCourseCode: (code) => set({ courseCode: code }),
      setLearningOutcomes: (outcomes) => set({ learningOutcomes: outcomes }),
      setLoAlignment: (alignment) => set({ loAlignment: alignment }),
      setLoModules: (modules) => set({ loModules: modules }),
      setCheatSheet: (sheet) => set({ cheatSheet: sheet }),
      setDeviation: (deviation) => set({ deviation }),
      setError: (error) => set({ error }),

      clearCurrentLesson: () =>
        set({
          currentLessonId: null,
          lectureText: '',
          slidesText: '',
          plan: null,
          quiz: [],
          courseCode: '',
          learningOutcomes: [],
          loAlignment: null,
          loModules: null,
          cheatSheet: null,
          deviation: null,
          error: null,
        }),

      loadLesson: (lesson) =>
        set({
          currentLessonId: lesson.id ?? null,
          lectureText: lesson.transcript ?? '',
          slidesText: lesson.slideText ?? '',
          plan: lesson.plan ?? null,
          courseCode: lesson.courseCode ?? '',
          learningOutcomes: lesson.learningOutcomes ?? [],
          loAlignment: lesson.loAlignment ?? null,
          loModules: Array.isArray(lesson.loModules)
            ? lesson.loModules
            : ((lesson.loModules as any)?.modules ?? null),
          cheatSheet: lesson.cheatSheet ?? null,
        }),
    }),
    {
      name: 'learncraft-lesson-storage',
      partialize: (state) => ({
        currentLessonId: state.currentLessonId,
      }),
    }
  )
);
