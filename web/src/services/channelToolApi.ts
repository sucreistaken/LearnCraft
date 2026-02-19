import { API_BASE } from "../config";
import type {
  ChannelToolData,
  ChannelFlashcardItem,
  ChannelDeepDiveMessage,
  ChannelMindMapData,
  ChannelSprintData,
  ChannelNoteItem,
  Channel,
  LessonSummary,
  LessonContextInfo,
  LessonDetailData,
  ExtractionSummary,
} from "../types";

const BASE = `${API_BASE}/api/collab/channels`;
const COLLAB_BASE = `${API_BASE}/api/collab`;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const channelToolApi = {
  getToolData(channelId: string) {
    return request<ChannelToolData>(`${BASE}/${channelId}/tool-data`);
  },

  generateQuiz(channelId: string, topic: string, serverName: string, count?: number, difficulty?: string, includeTrueFalse?: boolean) {
    return request<{ ok: boolean; data: ChannelToolData; sourcesSummary?: string | null }>(
      `${BASE}/${channelId}/tool/quiz/generate`,
      { method: "POST", body: JSON.stringify({ topic, serverName, count, difficulty, includeTrueFalse }) }
    );
  },

  answerQuiz(channelId: string, userId: string, nickname: string, questionId: string, selectedIndex: number) {
    return request<{ ok: boolean; result: { correct: boolean; correctIndex: number; explanation: string; scores: any } }>(
      `${BASE}/${channelId}/tool/quiz/answer`,
      { method: "POST", body: JSON.stringify({ userId, nickname, questionId, selectedIndex }) }
    );
  },

  addFlashcard(channelId: string, front: string, back: string, topic: string, userId: string, nickname: string) {
    return request<{ ok: boolean; card: ChannelFlashcardItem }>(
      `${BASE}/${channelId}/tool/flashcards/add`,
      { method: "POST", body: JSON.stringify({ front, back, topic, userId, nickname }) }
    );
  },

  generateFlashcards(channelId: string, topic: string, serverName: string, count?: number) {
    return request<{ ok: boolean; cards: ChannelFlashcardItem[]; sourcesSummary?: string | null }>(
      `${BASE}/${channelId}/tool/flashcards/generate`,
      { method: "POST", body: JSON.stringify({ topic, serverName, count }) }
    );
  },

  extractFlashcardsFromLesson(channelId: string) {
    return request<{ ok: boolean; cards: ChannelFlashcardItem[]; summary: ExtractionSummary }>(
      `${BASE}/${channelId}/tool/flashcards/extract`,
      { method: "POST" }
    );
  },

  reviewFlashcard(channelId: string, cardId: string, userId: string, quality: number) {
    return request<{ ok: boolean; card: ChannelFlashcardItem }>(
      `${BASE}/${channelId}/tool/flashcards/review`,
      { method: "POST", body: JSON.stringify({ cardId, userId, quality }) }
    );
  },

  deepDiveChat(channelId: string, text: string, userId: string, nickname: string, topic: string, serverName: string) {
    return request<{ ok: boolean; userMessage: ChannelDeepDiveMessage; aiMessage: ChannelDeepDiveMessage }>(
      `${BASE}/${channelId}/tool/deep-dive/chat`,
      { method: "POST", body: JSON.stringify({ text, userId, nickname, topic, serverName }) }
    );
  },

  generateMindMap(channelId: string, topic: string, serverName: string) {
    return request<{ ok: boolean; mindMap: ChannelMindMapData; sourcesSummary?: string | null }>(
      `${BASE}/${channelId}/tool/mind-map/generate`,
      { method: "POST", body: JSON.stringify({ topic, serverName }) }
    );
  },

  startSprint(channelId: string, studyMin: number, breakMin: number, userId: string, nickname: string) {
    return request<{ ok: boolean; sprint: ChannelSprintData }>(
      `${BASE}/${channelId}/tool/sprint/start`,
      { method: "POST", body: JSON.stringify({ studyMin, breakMin, userId, nickname }) }
    );
  },

  updateSprintStatus(channelId: string, userId: string, nickname: string, status: string) {
    return request<{ ok: boolean; sprint: ChannelSprintData }>(
      `${BASE}/${channelId}/tool/sprint/status`,
      { method: "POST", body: JSON.stringify({ userId, nickname, status }) }
    );
  },

  addNote(channelId: string, title: string, content: string, category: string, userId: string, nickname: string) {
    return request<{ ok: boolean; note: ChannelNoteItem }>(
      `${BASE}/${channelId}/tool/notes/add`,
      { method: "POST", body: JSON.stringify({ title, content, category, userId, nickname }) }
    );
  },

  editNote(channelId: string, noteId: string, updates: { title?: string; content?: string; category?: string }) {
    return request<{ ok: boolean; note: ChannelNoteItem }>(
      `${BASE}/${channelId}/tool/notes/${noteId}`,
      { method: "PATCH", body: JSON.stringify(updates) }
    );
  },

  deleteNote(channelId: string, noteId: string) {
    return request<{ ok: boolean }>(
      `${BASE}/${channelId}/tool/notes/${noteId}`,
      { method: "DELETE" }
    );
  },

  pinNote(channelId: string, noteId: string) {
    return request<{ ok: boolean; note: ChannelNoteItem }>(
      `${BASE}/${channelId}/tool/notes/${noteId}/pin`,
      { method: "POST" }
    );
  },

  // Export
  exportQuiz(channelId: string) {
    return request<{ ok: boolean; data: any }>(`${BASE}/${channelId}/export/quiz`);
  },

  exportFlashcards(channelId: string) {
    return request<{ ok: boolean; data: any }>(`${BASE}/${channelId}/export/flashcards`);
  },

  exportNotes(channelId: string) {
    return request<{ ok: boolean; data: any }>(`${BASE}/${channelId}/export/notes`);
  },

  exportMindMap(channelId: string) {
    return request<{ ok: boolean; data: any }>(`${BASE}/${channelId}/export/mind-map`);
  },

  exportAll(channelId: string) {
    return request<{ ok: boolean; data: any }>(`${BASE}/${channelId}/export/all`);
  },

  // Lock
  lockTool(channelId: string, userId: string) {
    return request<{ ok: boolean; locked: boolean; lockedBy: string }>(
      `${BASE}/${channelId}/tool/lock`,
      { method: "POST", body: JSON.stringify({ userId }) }
    );
  },

  unlockTool(channelId: string) {
    return request<{ ok: boolean; locked: boolean; lockedBy: string | null }>(
      `${BASE}/${channelId}/tool/unlock`,
      { method: "POST" }
    );
  },

  // ── Lesson linking ──────────────────────────────────────────────────────
  getLessons() {
    return request<LessonSummary[]>(`${COLLAB_BASE}/lessons`);
  },

  linkLesson(channelId: string, serverId: string, userId: string, lessonId: string, lessonTitle: string) {
    return request<{ ok: boolean; channel: Channel }>(
      `${BASE}/${channelId}/link-lesson`,
      { method: "POST", body: JSON.stringify({ serverId, userId, lessonId, lessonTitle }) }
    );
  },

  unlinkLesson(channelId: string, serverId: string, userId: string) {
    return request<{ ok: boolean; channel: Channel }>(
      `${BASE}/${channelId}/link-lesson`,
      { method: "DELETE", body: JSON.stringify({ serverId, userId }) }
    );
  },

  getLessonContext(channelId: string) {
    return request<LessonContextInfo>(`${BASE}/${channelId}/lesson-context`);
  },

  getLessonDetail(channelId: string) {
    return request<LessonDetailData>(`${BASE}/${channelId}/lesson-detail`);
  },
};
