// controllers/lessonControllers.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";

// ---- Tipler ----
export type Emphasis = {
  statement: string;
  why: string;
  in_slides: boolean;
  evidence: string;
  confidence: number; // 0..1
};

type QuizQA = { question: string; answer?: string };

export type Lesson = {
  id: string;
  title: string;
  date: string;                 // ISO string
  transcript: string;
  slideText: string;
  plan?: any;
  summary?: string;
  highlights?: string[];
  professorEmphases?: Emphasis[];
  // Eski şema ile uyumluluk için (opsiyonel):
  quiz?: QuizQA[];

  // Yeni quiz paket modeli:
  quizPacks?: Array<{ packId: string; createdAt: string; lastScore?: number }>;

  // Ders bazında ilerleme:
  progress?: { lastMode?: string; percent?: number };

  // Zaman damgaları:
  createdAt?: string;      // ISO string
  updatedAt?: string;      // ISO string
};

type GlobalMemory = {
  recurringConcepts: string[];
  recentEmphases: Array<Pick<Emphasis, "statement" | "why" | "confidence">>;
  lastUpdated: string; // ISO
};

// ---- Yollar ----
const DATA_DIR      = path.join(process.cwd(), "backend", "data");
const LESSONS_PATH  = path.join(DATA_DIR, "lessons.json");
const MEMORY_PATH   = path.join(DATA_DIR, "memory.json");

// Başlangıç dosyalarını garanti altına al
ensureDataFiles([
  { path: LESSONS_PATH, initial: [] },
  { path: MEMORY_PATH,  initial: { recurringConcepts: [], recentEmphases: [], lastUpdated: new Date().toISOString() } }
]);

// ---- Yardımcılar ----
function loadLessons(): Lesson[] {
  return readJSON<Lesson[]>(LESSONS_PATH) || [];
}

function saveLessons(list: Lesson[]) {
  writeJSON(LESSONS_PATH, list);
}

function loadMemory(): GlobalMemory {
  return (
    readJSON<GlobalMemory>(MEMORY_PATH) || {
      recurringConcepts: [],
      recentEmphases: [],
      lastUpdated: new Date().toISOString(),
    }
  );
}

function saveMemory(mem: GlobalMemory) {
  mem.lastUpdated = new Date().toISOString();
  writeJSON(MEMORY_PATH, mem);
}

// Bir ders üzerinden global memory'yi güncelle
function updateGlobalMemoryFromLesson(stamped: Lesson) {
  const memory = loadMemory();

  (stamped.highlights || []).forEach((h) => {
    if (h && !memory.recurringConcepts.includes(h)) memory.recurringConcepts.push(h);
  });

  if (stamped.professorEmphases?.length) {
    for (const e of stamped.professorEmphases) {
      memory.recentEmphases.unshift({
        statement: e.statement,
        why: e.why,
        confidence: e.confidence,
      });
    }
    // Kuyruk: en fazla 20 son vurgu
    memory.recentEmphases = memory.recentEmphases.slice(0, 20);
  }

  saveMemory(memory);
}

// ---- Okuma Fonksiyonları ----
export function listLessons(): Lesson[] {
  return loadLessons();
}

// Geriye dönük uyumluluk (eski isim):
export const getLessons = (): Lesson[] => listLessons();

export function getLesson(id: string): Lesson | null {
  return loadLessons().find((l) => l.id === id) || null;
}

export const getMemory = (): GlobalMemory => loadMemory();

// ---- Yazma/Update Fonksiyonları ----

// Eski API ile uyumluluk: addLesson (oluşturur + memory günceller)
export const addLesson = (lesson: Lesson) => {
  const lessons = loadLessons();
  const stamped: Lesson = {
    ...lesson,
    createdAt: lesson.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  lessons.push(stamped);
  saveLessons(lessons);

  updateGlobalMemoryFromLesson(stamped);
  return stamped;
};

// Yeni API: upsert (varsa günceller, yoksa oluşturur) + memory günceller
export function upsertLesson(newL: Partial<Lesson> & { id?: string }): Lesson {
  const list = loadLessons();
  let l: Lesson;

  if (newL.id) {
    const i = list.findIndex((x) => x.id === newL.id);
    if (i >= 0) {
      // Güncelle
      l = {
        ...list[i],
        ...newL,
        updatedAt: new Date().toISOString(),
      } as Lesson;

      // Varsayılan boş alanlar:
      l.transcript = l.transcript ?? "";
      l.slideText = l.slideText ?? "";
      l.highlights = l.highlights ?? [];
      l.professorEmphases = l.professorEmphases ?? [];
      l.quizPacks = l.quizPacks ?? list[i].quizPacks ?? [];
      l.progress = { ...(list[i].progress || {}), ...(newL.progress || {}) };

      list[i] = l;
    } else {
      // Yoksa oluştur
      l = {
        id: newL.id,
        title: newL.title || "Untitled Lecture",
        date: newL.date || new Date().toISOString(),
        transcript: newL.transcript || "",
        slideText: newL.slideText || "",
        plan: newL.plan,
        summary: newL.summary,
        highlights: newL.highlights || [],
        professorEmphases: newL.professorEmphases || [],
        quiz: newL.quiz || [],
        quizPacks: newL.quizPacks || [],
        progress: newL.progress || { lastMode: "alignment", percent: 0 },
        createdAt: newL.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      list.push(l);
    }
  } else {
    // Yeni kayıt oluştur
    const id = "lec-" + Date.now();
    l = {
      id,
      title: newL.title || "Untitled Lecture",
      date: newL.date || new Date().toISOString(),
      transcript: newL.transcript || "",
      slideText: newL.slideText || "",
      plan: newL.plan,
      summary: newL.summary,
      highlights: newL.highlights || [],
      professorEmphases: newL.professorEmphases || [],
      quiz: newL.quiz || [],
      quizPacks: newL.quizPacks || [],
      progress: newL.progress || { lastMode: "alignment", percent: 0 },
      createdAt: newL.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    list.push(l);
  }

  saveLessons(list);
  // Memory'yi ders içeriğine göre güncelle
  updateGlobalMemoryFromLesson(l);
  return l;
}

// Quiz paketi iliştirme
export function attachQuizPack(lessonId: string, packId: string) {
  const list = loadLessons();
  const i = list.findIndex((l) => l.id === lessonId);
  if (i < 0) return;

  const lp = list[i].quizPacks || [];
  lp.push({ packId, createdAt: new Date().toISOString() });
  list[i].quizPacks = lp;
  list[i].updatedAt = new Date().toISOString();

  saveLessons(list);
}

// Quiz skorunu güncelleme
export function setQuizScore(lessonId: string, packId: string, score: number) {
  const list = loadLessons();
  const i = list.findIndex((l) => l.id === lessonId);
  if (i < 0) return;

  const lp = list[i].quizPacks || [];
  const p = lp.find((x) => x.packId === packId);
  if (p) p.lastScore = score;

  list[i].quizPacks = lp;
  list[i].updatedAt = new Date().toISOString();
  saveLessons(list);
}

// İlerleme güncelleme (ders bazında durum saklama)
export function updateProgress(
  lessonId: string,
  progress: Partial<Lesson["progress"]>
) {
  const list = loadLessons();
  const i = list.findIndex((l) => l.id === lessonId);
  if (i < 0) return null;

  list[i].progress = { ...(list[i].progress || {}), ...progress };
  list[i].updatedAt = new Date().toISOString();
  saveLessons(list);
  return list[i];
}
