// src/services/api.ts
import { API_BASE } from '../config';
import { Plan, CheatSheet, LoAlignment, LoStudyModule } from '../types';

// ============ Types ============
export interface ApiResponse<T = unknown> {
    ok: boolean;
    error?: string;
    data?: T;
}

export interface LessonData {
    id: string;
    title: string;
    date: string;
    transcript?: string;
    slideText?: string;
    plan?: Plan;
    courseCode?: string;
    learningOutcomes?: string[];
    loAlignment?: LoAlignment;
    loModules?: { modules: LoStudyModule[] };
    cheatSheet?: CheatSheet;
}

export interface PlanResponse {
    ok: boolean;
    plan: Plan;
    lessonId?: string;
    error?: string;
}

export interface TranscribeStartResponse {
    ok: boolean;
    jobId: string;
    error?: string;
}

// ============ Helper ============
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const json = await response.json();
    if (!response.ok || !json.ok) {
        return { ok: false, error: json.error || 'Bir hata oluştu' };
    }
    return { ok: true, data: json };
}

// ============ Lessons API ============
export const lessonsApi = {
    async getAll(): Promise<LessonData[]> {
        try {
            const res = await fetch(`${API_BASE}/api/lessons`);
            const json = await res.json();
            return Array.isArray(json) ? json : [];
        } catch (error) {
            console.warn('Dersler yüklenemedi', error);
            return [];
        }
    },

    async getById(id: string): Promise<LessonData | null> {
        try {
            const res = await fetch(`${API_BASE}/api/lessons/${id}`);
            if (!res.ok) return null;
            return await res.json();
        } catch (error) {
            console.warn('Ders yüklenemedi', error);
            return null;
        }
    },

    async create(title: string): Promise<{ id: string; title: string } | null> {
        try {
            const res = await fetch(`${API_BASE}/api/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });
            const json = await res.json();
            if (res.ok && json.id) {
                return { id: json.id, title: json.title };
            }
            return null;
        } catch (error) {
            console.error('Ders oluşturma hatası:', error);
            return null;
        }
    },

    async delete(id: string): Promise<{ ok: boolean; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/lessons/${id}`, {
                method: 'DELETE',
            });
            return await res.json();
        } catch (error) {
            console.error('Ders silme hatası:', error);
            return { ok: false, error: 'Ders silinemedi' };
        }
    },

    async uploadSlides(lessonId: string, file: File): Promise<{ ok: boolean; text?: string; error?: string }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('lessonId', lessonId);

        try {
            const res = await fetch(`${API_BASE}/api/slides/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                // Return the detailed error from backend (which includes stderr)
                throw new Error(data.details || data.error || res.statusText);
            }
            return data;
        } catch (error: any) {
            console.error('OCR upload failed:', error);
            throw error; // Propagate the specific error message
        }
    },
};

// ============ Plan API ============
export const planApi = {
    async createFromText(params: {
        lectureText: string;
        slidesText: string;
        title: string;
        lessonId?: string;
        courseCode?: string;
        learningOutcomes?: string[];
    }): Promise<PlanResponse> {
        const res = await fetch(`${API_BASE}/api/plan-from-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        return await res.json();
    },
};

// ============ LO (Learning Outcomes) API ============
export const loApi = {
    async fetchLearningOutcomes(courseCode: string): Promise<{ ok: boolean; learningOutcomes?: string[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/ieu/learning-outcomes?code=${encodeURIComponent(courseCode)}`);
        return await res.json();
    },

    async align(lessonId: string, params: {
        transcript: string;
        slidesText: string;
        learningOutcomes: string[];
    }): Promise<{ ok: boolean; loAlignment?: LoAlignment; error?: string }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/lo-align`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        return await res.json();
    },

    async generateModules(lessonId: string): Promise<{ ok: boolean; modules?: LoStudyModule[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/lo-modules`, {
            method: 'POST',
        });
        return await res.json();
    },
};

// ============ Quiz API ============
export const quizApi = {
    async generateFromPlan(plan: Plan): Promise<{ ok: boolean; questions?: string[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/quiz-from-plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan }),
        });
        return await res.json();
    },

    async getAnswers(params: {
        questions: string[];
        lectureText: string;
        slidesText: string;
        plan: Plan | null;
    }): Promise<{ ok: boolean; answers?: unknown[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/quiz-answers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        });
        return await res.json();
    },
};

// ============ Cheat Sheet API ============
export const cheatSheetApi = {
    async generate(lessonId: string, language: 'tr' | 'en' = 'tr'): Promise<{ ok: boolean; cheatSheet?: CheatSheet; error?: string }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/cheat-sheet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language }),
        });
        return await res.json();
    },
};

// ============ Deviation API ============
export const deviationApi = {
    async analyze(lessonId: string, force = false): Promise<{ ok: boolean; deviation?: unknown; error?: string }> {
        const url = force
            ? `${API_BASE}/api/lessons/${lessonId}/deviation?force=true`
            : `${API_BASE}/api/lessons/${lessonId}/deviation`;
        const res = await fetch(url, {
            method: 'POST',
        });
        return await res.json();
    },

    async reanalyze(lessonId: string): Promise<{ ok: boolean; deviation?: unknown; error?: string }> {
        return this.analyze(lessonId, true);
    },
};

// ============ Upload API ============
export const uploadApi = {
    async uploadPdf(file: File): Promise<{ ok: boolean; text?: string; error?: string }> {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/api/upload/pdf`, {
            method: 'POST',
            body: formData,
        });
        return await res.json();
    },

    async startTranscribe(file: File, lessonId: string): Promise<TranscribeStartResponse> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('lessonId', lessonId);
        const res = await fetch(`${API_BASE}/api/transcribe/start`, {
            method: 'POST',
            body: formData,
        });
        return await res.json();
    },

    getTranscribeStreamUrl(jobId: string): string {
        return `${API_BASE}/api/transcribe/stream/${jobId}`;
    },
};

// ============ Deep Dive (Chat & MindMap) API ============
export const deepDiveApi = {
    async chat(lessonId: string, message: string, history: any[]): Promise<{ ok: boolean; text?: string; suggestions?: string[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history }),
        });
        return await res.json();
    },

    async generateMindMap(lessonId: string): Promise<{ ok: boolean; code?: string; error?: string }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/mindmap`, {
            method: 'POST',
        });
        return await res.json();
    },

    // Multi-Map: Get list of modules
    async getModules(lessonId: string): Promise<{ ok: boolean; lessonTitle?: string; modules?: Array<{ id: number; title: string; topics: string[] }>; error?: string }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/modules`);
        return await res.json();
    },

    // Multi-Map: Generate mindmap for specific module
    async generateModuleMindMap(lessonId: string, moduleIndex: number): Promise<{ ok: boolean; code?: string; moduleTitle?: string; error?: string }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/mindmap/module`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moduleIndex }),
        });
        return await res.json();
    },

    // Node Detail: Get AI-powered explanation, example, or quiz for a node
    async getNodeDetail(lessonId: string, nodeName: string, action: 'explain' | 'example' | 'quiz'): Promise<{
        ok: boolean;
        action?: string;
        title?: string;
        explanation?: string;
        keyPoints?: string[];
        relatedConcepts?: string[];
        example?: { scenario: string; explanation: string; takeaway: string };
        quiz?: { question: string; options: string[]; correctAnswer: string; explanation: string };
        error?: string;
    }> {
        const res = await fetch(`${API_BASE}/api/lessons/${lessonId}/mindmap/node-detail`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeName, action }),
        });
        return await res.json();
    }
};
