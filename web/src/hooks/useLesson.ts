// src/hooks/useLesson.ts
import { useCallback } from 'react';
import { useLessonStore } from '../stores/lessonStore';
import { useUiStore } from '../stores/uiStore';
import { API_BASE } from '../config';
import { lessonsApi, planApi, loApi, cheatSheetApi, deviationApi, uploadApi } from '../services/api';

export function useLesson() {
    const store = useLessonStore();
    const ui = useUiStore();

    // Fetch all lessons
    const fetchLessons = useCallback(async () => {
        const lessons = await lessonsApi.getAll();
        store.setLessons(lessons as any);
    }, [store]);

    // Load a specific lesson
    const loadLesson = useCallback(async (id: string) => {
        const lesson = await lessonsApi.getById(id);
        if (lesson) {
            store.loadLesson(lesson as any);
            localStorage.setItem('lc.lastLessonId', id);
        }
    }, [store]);

    // Create a new lesson
    const createLesson = useCallback(async (title: string) => {
        ui.setIsLoading(true, 'Creating lesson...');
        try {
            const result = await lessonsApi.create(title);
            if (result) {
                store.setLessons([
                    { id: result.id, title: result.title, date: new Date().toISOString() } as any,
                    ...store.lessons,
                ]);
                store.setCurrentLessonId(result.id);
                localStorage.setItem('lc.lastLessonId', result.id);
                store.clearCurrentLesson();
                store.setCurrentLessonId(result.id);
                return result;
            }
            return null;
        } finally {
            ui.setIsLoading(false);
        }
    }, [store, ui]);

    // Generate plan
    const generatePlan = useCallback(async () => {
        const { currentLessonId, lectureText, slidesText, courseCode, learningOutcomes, lessons } = store;
        const currentLesson = lessons.find((l) => l.id === currentLessonId);
        const title = ui.draftTitle || currentLesson?.title || `Lecture ${new Date().toLocaleDateString()}`;

        ui.setIsLoading(true, 'Analyzing...');
        store.setError(null);
        store.setPlan(null);
        store.setQuiz([]);
        store.setLoAlignment(null);
        store.setLoModules(null);

        try {
            const result = await planApi.createFromText({
                lectureText,
                slidesText,
                title,
                lessonId: currentLessonId ?? undefined,
                courseCode: courseCode.trim() || undefined,
                learningOutcomes: learningOutcomes.length ? learningOutcomes : undefined,
            });

            if (!result.ok) {
                throw new Error(result.error || 'Error');
            }

            if (result.lessonId) {
                store.setCurrentLessonId(result.lessonId);
                localStorage.setItem('lc.lastLessonId', result.lessonId);
                ui.setDraftTitle('');
                await fetchLessons();
            }

            store.setPlan(result.plan);
            if (result.plan?.seed_quiz?.length) {
                store.setQuiz(result.plan.seed_quiz.slice(0, 12));
            }
            ui.setMode('alignment');
            return result.plan;
        } catch (e: any) {
            store.setError(e.message);
            return null;
        } finally {
            ui.setIsLoading(false);
        }
    }, [store, ui, fetchLessons]);

    // Fetch Learning Outcomes from IEU
    const fetchLearningOutcomes = useCallback(async () => {
        const code = store.courseCode.trim();
        if (!code) return;

        ui.setLoLoading(true);
        store.setError(null);

        try {
            const result = await loApi.fetchLearningOutcomes(code);
            if (!result.ok) {
                throw new Error(result.error || 'Learning Outcomes not found');
            }
            store.setLearningOutcomes(result.learningOutcomes || []);
        } catch (e: any) {
            store.setError(e.message);
            store.setLearningOutcomes([]);
        } finally {
            ui.setLoLoading(false);
        }
    }, [store, ui]);

    // Align with LO
    const alignWithLO = useCallback(async () => {
        const { currentLessonId, learningOutcomes, lectureText, slidesText } = store;

        if (!currentLessonId) {
            store.setError('First create or select a lesson.');
            return;
        }
        if (!learningOutcomes.length) {
            store.setError("First fetch Learning Outcomes from IEU.");
            return;
        }
        if (!lectureText.trim()) {
            store.setError('Transcript is empty, nothing to align.');
            return;
        }

        ui.setIsLoading(true, 'Aligning...');
        store.setError(null);

        try {
            const result = await loApi.align(currentLessonId, {
                transcript: lectureText,
                slidesText,
                learningOutcomes,
            });
            if (!result.ok) {
                throw new Error(result.error || 'LO alignment error');
            }
            store.setLoAlignment(result.loAlignment || null);
        } catch (e: any) {
            store.setError(e.message);
        } finally {
            ui.setIsLoading(false);
        }
    }, [store, ui]);

    // Generate LO Modules
    const generateLoModules = useCallback(async () => {
        const { currentLessonId, learningOutcomes } = store;

        if (!currentLessonId) {
            store.setError('First create or select a lesson.');
            return;
        }
        if (!learningOutcomes.length) {
            store.setError("You need to fetch Learning Outcomes from IEU first for LO Study.");
            return;
        }

        ui.setLoModulesLoading(true);
        store.setError(null);

        try {
            const result = await loApi.generateModules(currentLessonId);
            if (!result.ok) {
                throw new Error(result.error || 'Failed to generate LO modules');
            }
            store.setLoModules(result.modules || []);
            ui.setMode('lo-study');
        } catch (e: any) {
            store.setError(e.message);
        } finally {
            ui.setLoModulesLoading(false);
        }
    }, [store, ui]);

    // Generate Cheat Sheet
    const generateCheatSheet = useCallback(async (language: 'tr' | 'en' = 'tr') => {
        const { currentLessonId } = store;

        if (!currentLessonId) {
            ui.setCheatErr('First select a lesson.');
            return;
        }

        ui.setCheatLoading(true);
        ui.setCheatErr(null);

        try {
            const result = await cheatSheetApi.generate(currentLessonId, language);
            if (!result.ok) {
                throw new Error(result.error || 'Failed to generate cheat sheet');
            }
            store.setCheatSheet(result.cheatSheet || null);
            ui.setMode('cheat-sheet');
        } catch (e: any) {
            ui.setCheatErr(e.message);
        } finally {
            ui.setCheatLoading(false);
        }
    }, [store, ui]);

    // Deviation Analysis
    const analyzeDeviation = useCallback(async () => {
        const { currentLessonId } = store;

        if (!currentLessonId) {
            ui.setDevErr('First select a lesson.');
            return;
        }

        ui.setDevLoading(true);
        ui.setDevErr(null);

        try {
            const result = await deviationApi.analyze(currentLessonId);
            if (!result.ok) {
                throw new Error(result.error || 'Deviation analysis failed');
            }
            store.setDeviation(result.deviation);
        } catch (e: any) {
            ui.setDevErr(e.message);
        } finally {
            ui.setDevLoading(false);
        }
    }, [store, ui]);

    // Reanalyze Deviation (force bypass cache)
    const reanalyzeDeviation = useCallback(async () => {
        const { currentLessonId, lectureText, slidesText } = store;

        if (!currentLessonId) {
            ui.setDevErr('First select a lesson.');
            return;
        }

        ui.setDevLoading(true);
        ui.setDevErr(null);

        try {
            // Önce güncel transcript ve slides'ı kaydet
            await fetch(`${API_BASE}/api/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: currentLessonId,
                    transcript: lectureText,
                    slideText: slidesText,
                }),
            });

            // Sonra analizi force ile çalıştır
            const result = await deviationApi.reanalyze(currentLessonId);
            if (!result.ok) {
                throw new Error(result.error || 'Deviation analysis failed');
            }
            store.setDeviation(result.deviation);
        } catch (e: any) {
            ui.setDevErr(e.message);
        } finally {
            ui.setDevLoading(false);
        }
    }, [store, ui]);

    // Upload PDF / Slide
    const uploadPdf = useCallback(async (file: File) => {
        const { currentLessonId } = store;
        if (!currentLessonId) {
            store.setError('First create or select a lesson.');
            return;
        }

        ui.setIsLoading(true, 'Processing PDF (OCR)...');
        try {
            // Using the new OCR endpoint
            const result = await lessonsApi.uploadSlides(currentLessonId, file);
            if (result.ok && result.text) {
                store.setSlidesText(store.slidesText ? store.slidesText + '\n\n' + result.text : result.text);
            } else {
                store.setError(result.error || 'OCR process failed');
            }
        } catch (e: any) {
            console.error(e);
            ui.setIsLoading(false);
            // Show detailed alert to user
            const msg = e.message?.replace(/^Error:\s*/, "") || "Upload failed.";
            alert(`Error Occurred:\n${msg}`);
        } finally {
            ui.setIsLoading(false);
        }
    }, [store, ui]);

    return {
        // State
        ...store,
        // Actions
        fetchLessons,
        loadLesson,
        createLesson,
        generatePlan,
        fetchLearningOutcomes,
        alignWithLO,
        generateLoModules,
        generateCheatSheet,
        analyzeDeviation,
        reanalyzeDeviation,
        uploadPdf,
    };
}
