// src/services/api.ts
import { API_BASE } from '../config';
import { Plan, CheatSheet, LoAlignment, LoStudyModule, WeaknessAnalysis, WeaknessSummary, Flashcard, FlashcardStats, SprintSettings, SprintSession, ConceptConnection, SharedBundle, StudyRoom, RoomWorkspace, Course, CourseKnowledgeIndex, CourseProgress, WeeklySchedule, CourseExport, StudyTask, DailyPlan, WeeklyOverview, StreakData, AppNotification } from '../types';

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

// ============ Weakness Tracker API ============
export const weaknessApi = {
    async getGlobal(): Promise<{ ok: boolean; globalWeakTopics?: WeaknessSummary['globalWeakTopics']; studyPriority?: string[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/weakness`);
        return await res.json();
    },

    async getForLesson(lessonId: string): Promise<{ ok: boolean; analysis?: WeaknessAnalysis; error?: string }> {
        const res = await fetch(`${API_BASE}/api/weakness/${lessonId}`);
        return await res.json();
    },

    async analyzeAll(): Promise<{ ok: boolean; analyses?: WeaknessAnalysis[]; summary?: WeaknessSummary; error?: string }> {
        const res = await fetch(`${API_BASE}/api/weakness/analyze`, { method: 'POST' });
        return await res.json();
    },

    async analyzeLesson(lessonId: string): Promise<{ ok: boolean; analysis?: WeaknessAnalysis; error?: string }> {
        const res = await fetch(`${API_BASE}/api/weakness/${lessonId}/analyze`, { method: 'POST' });
        return await res.json();
    },
};

// ============ Flashcard API ============
export const flashcardApi = {
    async generate(lessonId: string): Promise<{ ok: boolean; generated?: number; cards?: Flashcard[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/flashcards/generate/${lessonId}`, { method: 'POST' });
        return await res.json();
    },

    async getDue(): Promise<{ ok: boolean; cards?: Flashcard[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/flashcards/due`);
        return await res.json();
    },

    async review(cardId: string, quality: number): Promise<{ ok: boolean; card?: Flashcard; error?: string }> {
        const res = await fetch(`${API_BASE}/api/flashcards/${cardId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ quality }),
        });
        return await res.json();
    },

    async getStats(): Promise<{ ok: boolean } & Partial<FlashcardStats>> {
        const res = await fetch(`${API_BASE}/api/flashcards/stats`);
        return await res.json();
    },

    async getAll(lessonId?: string): Promise<{ ok: boolean; cards?: Flashcard[]; error?: string }> {
        const url = lessonId ? `${API_BASE}/api/flashcards?lessonId=${lessonId}` : `${API_BASE}/api/flashcards`;
        const res = await fetch(url);
        return await res.json();
    },

    async delete(cardId: string): Promise<{ ok: boolean; error?: string }> {
        const res = await fetch(`${API_BASE}/api/flashcards/${cardId}`, { method: 'DELETE' });
        return await res.json();
    },

    async create(lessonId: string, front: string, back: string, topicName: string): Promise<{ ok: boolean; card?: Flashcard; error?: string }> {
        const res = await fetch(`${API_BASE}/api/flashcards`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonId, front, back, topicName }),
        });
        return await res.json();
    },
};

// ============ Sprint API ============
export const sprintApi = {
    async getSettings(): Promise<{ ok: boolean; settings?: SprintSettings }> {
        const res = await fetch(`${API_BASE}/api/sprint/settings`);
        return await res.json();
    },

    async updateSettings(settings: Partial<SprintSettings>): Promise<{ ok: boolean; settings?: SprintSettings }> {
        const res = await fetch(`${API_BASE}/api/sprint/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        return await res.json();
    },

    async createSession(lessonId?: string): Promise<{ ok: boolean; session?: SprintSession }> {
        const res = await fetch(`${API_BASE}/api/sprint/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonId }),
        });
        return await res.json();
    },

    async updateSession(id: string, updates: Partial<SprintSession>): Promise<{ ok: boolean; session?: SprintSession }> {
        const res = await fetch(`${API_BASE}/api/sprint/sessions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
        });
        return await res.json();
    },

    async getStats(): Promise<{ ok: boolean; totalSessions?: number; totalStudyMinutes?: number; totalPomodoros?: number; recentSessions?: SprintSession[] }> {
        const res = await fetch(`${API_BASE}/api/sprint/stats`);
        return await res.json();
    },

    async getFocus(lessonId: string): Promise<{ ok: boolean; focus?: { weakTopics: string[]; dueFlashcards: number; cheatHighlights: string[]; emphases: string[] } }> {
        const res = await fetch(`${API_BASE}/api/sprint/focus/${lessonId}`);
        return await res.json();
    },
};

// ============ Connections API ============
export const connectionsApi = {
    async get(): Promise<{ ok: boolean; connections?: ConceptConnection[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/connections`);
        return await res.json();
    },

    async build(): Promise<{ ok: boolean; connections?: ConceptConnection[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/connections/build`, { method: 'POST' });
        return await res.json();
    },

    async deepDive(
        concept: string,
        lessonTitles: string[],
        relatedConcepts: string[]
    ): Promise<{ ok: boolean; analysis?: string; error?: string }> {
        const res = await fetch(`${API_BASE}/api/connections/deep-dive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ concept, lessonTitles, relatedConcepts }),
        });
        return await res.json();
    },
};

// ============ Shares API ============
export const sharesApi = {
    async create(lessonId: string, createdBy?: string): Promise<{ ok: boolean; share?: SharedBundle; error?: string }> {
        const res = await fetch(`${API_BASE}/api/shares`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lessonId, createdBy }),
        });
        return await res.json();
    },

    async get(shareId: string): Promise<{ ok: boolean; share?: SharedBundle; error?: string }> {
        const res = await fetch(`${API_BASE}/api/shares/${shareId}`);
        return await res.json();
    },

    async addComment(shareId: string, author: string, text: string): Promise<{ ok: boolean; share?: SharedBundle }> {
        const res = await fetch(`${API_BASE}/api/shares/${shareId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author, text }),
        });
        return await res.json();
    },

    async list(): Promise<{ ok: boolean; shares?: SharedBundle[] }> {
        const res = await fetch(`${API_BASE}/api/shares`);
        return await res.json();
    },

    async delete(shareId: string): Promise<{ ok: boolean }> {
        const res = await fetch(`${API_BASE}/api/shares/${shareId}`, { method: 'DELETE' });
        return await res.json();
    },

    async import(shareId: string): Promise<{ ok: boolean; lessonId?: string; error?: string }> {
        const res = await fetch(`${API_BASE}/api/shares/${shareId}/import`, { method: 'POST' });
        return await res.json();
    },
};

// ============ Rooms API ============
export const roomsApi = {
    async create(name: string, hostId: string, settings?: any, lessonId?: string, lessonTitle?: string): Promise<{ ok: boolean; room?: StudyRoom; error?: string }> {
        const res = await fetch(`${API_BASE}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, hostId, settings, lessonId, lessonTitle }),
        });
        return await res.json();
    },

    async get(id: string): Promise<{ ok: boolean; room?: StudyRoom; error?: string }> {
        const res = await fetch(`${API_BASE}/api/rooms/${id}`);
        return await res.json();
    },

    async getByCode(code: string): Promise<{ ok: boolean; room?: StudyRoom; error?: string }> {
        const res = await fetch(`${API_BASE}/api/rooms/code/${encodeURIComponent(code)}`);
        return await res.json();
    },

    async list(): Promise<{ ok: boolean; rooms?: StudyRoom[] }> {
        const res = await fetch(`${API_BASE}/api/rooms`);
        return await res.json();
    },

    async getMyRooms(userId: string): Promise<{ ok: boolean; rooms?: StudyRoom[] }> {
        const res = await fetch(`${API_BASE}/api/rooms/my/${encodeURIComponent(userId)}`);
        return await res.json();
    },

    async getWorkspace(roomId: string): Promise<{ ok: boolean; workspace?: any; error?: string }> {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}/workspace`);
        return await res.json();
    },

    async delete(id: string, userId?: string): Promise<{ ok: boolean; error?: string }> {
        const url = userId ? `${API_BASE}/api/rooms/${id}?userId=${encodeURIComponent(userId)}` : `${API_BASE}/api/rooms/${id}`;
        const res = await fetch(url, { method: 'DELETE' });
        return await res.json();
    },
};

// ============ Room Workspace API ============
export const roomWorkspaceApi = {
    async deepDiveAsk(roomId: string, message: string, history: any[]): Promise<{ ok: boolean; text?: string; suggestions?: string[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}/deepdive/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history }),
        });
        return await res.json();
    },

    async generateFlashcards(roomId: string): Promise<{ ok: boolean; cards?: any[]; error?: string }> {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}/flashcards/generate`, {
            method: 'POST',
        });
        return await res.json();
    },

    async mindMapAsk(roomId: string, nodeLabel: string, question?: string): Promise<{ ok: boolean; text?: string; error?: string }> {
        const res = await fetch(`${API_BASE}/api/rooms/${roomId}/mindmap/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeLabel, question }),
        });
        return await res.json();
    },
};

// ============ Course API ============
export const courseApi = {
    async getAll(): Promise<{ ok: boolean; courses?: Course[]; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses`);
            return await res.json();
        } catch (error) {
            console.warn('Courses could not be loaded', error);
            return { ok: false, error: 'Failed to load courses' };
        }
    },

    async getById(id: string): Promise<{ ok: boolean; course?: Course; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${id}`);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to load course' };
        }
    },

    async create(code: string, name: string, description?: string): Promise<{ ok: boolean; course?: Course; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, name, description }),
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to create course' };
        }
    },

    async update(id: string, updates: Partial<Course>): Promise<{ ok: boolean; course?: Course; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to update course' };
        }
    },

    async delete(id: string): Promise<{ ok: boolean; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${id}`, { method: 'DELETE' });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to delete course' };
        }
    },

    async addLesson(courseId: string, lessonId: string): Promise<{ ok: boolean; course?: Course; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${courseId}/lessons/${lessonId}`, {
                method: 'POST',
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to add lesson' };
        }
    },

    async removeLesson(courseId: string, lessonId: string): Promise<{ ok: boolean; course?: Course; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${courseId}/lessons/${lessonId}`, {
                method: 'DELETE',
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to remove lesson' };
        }
    },

    async rebuildIndex(courseId: string): Promise<{ ok: boolean; knowledgeIndex?: CourseKnowledgeIndex; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${courseId}/rebuild-index`, {
                method: 'POST',
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to rebuild index' };
        }
    },

    async courseChat(courseId: string, message: string, history: any[]): Promise<{ ok: boolean; text?: string; suggestions?: string[]; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${courseId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, history }),
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to chat' };
        }
    },

    async getProgress(courseId: string): Promise<{ ok: boolean; progress?: CourseProgress; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${courseId}/progress`);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to get progress' };
        }
    },

    async generateSchedule(courseId: string, examDate?: string): Promise<{ ok: boolean; schedule?: WeeklySchedule; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${courseId}/study-schedule`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ examDate }),
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to generate schedule' };
        }
    },

    async exportCourse(courseId: string): Promise<{ ok: boolean; export?: CourseExport; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/courses/${courseId}/export`);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to export course' };
        }
    },
};

// ============ Scheduler API ============
export const schedulerApi = {
    async getNextSession(courseId?: string): Promise<{ ok: boolean; task?: StudyTask | null; totalPending?: number; error?: string }> {
        try {
            const url = courseId
                ? `${API_BASE}/api/scheduler/next-session?courseId=${encodeURIComponent(courseId)}`
                : `${API_BASE}/api/scheduler/next-session`;
            const res = await fetch(url);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to get next session' };
        }
    },

    async getDailyPlan(courseId?: string): Promise<{ ok: boolean; plan?: DailyPlan; error?: string }> {
        try {
            const url = courseId
                ? `${API_BASE}/api/scheduler/daily?courseId=${encodeURIComponent(courseId)}`
                : `${API_BASE}/api/scheduler/daily`;
            const res = await fetch(url);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to get daily plan' };
        }
    },

    async getWeeklyOverview(courseId?: string): Promise<{ ok: boolean; overview?: WeeklyOverview; error?: string }> {
        try {
            const url = courseId
                ? `${API_BASE}/api/scheduler/weekly?courseId=${encodeURIComponent(courseId)}`
                : `${API_BASE}/api/scheduler/weekly`;
            const res = await fetch(url);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to get weekly overview' };
        }
    },

    async completeTask(taskId: string): Promise<{ ok: boolean; streak?: StreakData; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/scheduler/complete-task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId }),
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to complete task' };
        }
    },

    async getStreak(): Promise<{ ok: boolean; streak?: StreakData; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/scheduler/streak`);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to get streak' };
        }
    },
};

// ============ Notification API ============
export const notificationApi = {
    async getAll(unreadOnly?: boolean): Promise<{ ok: boolean; notifications?: AppNotification[]; error?: string }> {
        try {
            const url = unreadOnly
                ? `${API_BASE}/api/notifications?unread=true`
                : `${API_BASE}/api/notifications`;
            const res = await fetch(url);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to load notifications' };
        }
    },

    async dismiss(notifId: string): Promise<{ ok: boolean; notification?: AppNotification; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/notifications/${notifId}/dismiss`, {
                method: 'POST',
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to dismiss notification' };
        }
    },

    async getUnreadCount(): Promise<{ ok: boolean; count?: number; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/notifications/unread-count`);
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to get unread count' };
        }
    },

    async check(): Promise<{ ok: boolean; newNotifications?: AppNotification[]; count?: number; error?: string }> {
        try {
            const res = await fetch(`${API_BASE}/api/notifications/check`, {
                method: 'POST',
            });
            return await res.json();
        } catch (error) {
            return { ok: false, error: 'Failed to check notifications' };
        }
    },
};
