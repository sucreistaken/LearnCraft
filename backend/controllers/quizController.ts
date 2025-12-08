// backend/controllers/quizControllers.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";

type Emphasis = {
  statement: string;
  why: string;
  in_slides: boolean;
  evidence: string;
  confidence: number;
};

type Lesson = {
  id: string;
  title: string;
  date: string;
  transcript: string;
  summary?: string;
  highlights?: string[];
  professorEmphases?: Emphasis[];
  quiz?: { question: string; answer?: string }[];
  createdAt?: string;
};

type QuizItem = {
  id: string;
  type: "why" | "tf";
  lessonId?: string;
  prompt: string;
  expected_keywords?: string[];
  expected_tf?: boolean;
};

type QuizPack = {
  id: string;
  createdAt: string;
  items: QuizItem[];
};

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const LESSONS_PATH = path.join(DATA_DIR, "lessons.json");
const QUIZ_PATH = path.join(DATA_DIR, "quiz.json");

// Eğer dosyalar yoksa oluştur
ensureDataFiles([
  { path: LESSONS_PATH, initial: [] },
  { path: QUIZ_PATH, initial: { packs: [] as QuizPack[] } },
]);

// Random id oluştur
const rid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 🧠 1. Quiz üretme
export const generateQuizFromEmphases = (count = 5, lessonIds?: string[]) => {
  const lessons = readJSON<Lesson[]>(LESSONS_PATH) || [];
  const emphases: Array<{ lessonId: string; e: Emphasis }> = [];

  for (const L of lessons) {
    if (lessonIds && !lessonIds.includes(L.id)) continue;
    (L.professorEmphases || []).forEach((e) => emphases.push({ lessonId: L.id, e }));
  }

  if (!emphases.length) {
    return { error: "No emphases found. Add lessons with professorEmphases first." };
  }

  const shuffled = emphases.sort(() => Math.random() - 0.5).slice(0, count);

  const items: QuizItem[] = shuffled.flatMap(({ lessonId, e }) => {
    const whyQ: QuizItem = {
      id: rid("q"),
      type: "why",
      lessonId,
      prompt: `Why did the professor emphasize: “${e.statement}”?`,
      expected_keywords: (e.why || "")
        .toLowerCase()
        .split(/\W+/)
        .filter(Boolean)
        .slice(0, 6),
    };

    const tfQ: QuizItem = {
      id: rid("q"),
      type: "tf",
      lessonId,
      prompt: `Was this emphasized point present in slides? (“${e.statement}”)`,
      expected_tf: !!e.in_slides,
    };
    return [whyQ, tfQ];
  });

  const pack: QuizPack = {
    id: rid("qp"),
    createdAt: new Date().toISOString(),
    items,
  };

  const quizStore = readJSON<{ packs: QuizPack[] }>(QUIZ_PATH) || { packs: [] };
  quizStore.packs.unshift(pack);
  quizStore.packs = quizStore.packs.slice(0, 20);
  writeJSON(QUIZ_PATH, quizStore);

  return pack;
};

// 🧠 2. Quiz pack getir
export const getQuizPack = (packId: string) => {
  const quizStore = readJSON<{ packs: QuizPack[] }>(QUIZ_PATH) || { packs: [] };
  return quizStore.packs.find((p) => p.id === packId) || null;
};

// 🧠 3. Quiz değerlendirme
export const scoreQuizPack = (
  packId: string,
  answers: Array<{ id: string; answer: string | boolean }>
) => {
  const pack = getQuizPack(packId);
  if (!pack) return { error: "Quiz pack not found." };

  let correct = 0;
  const feedback: Array<{ id: string; correct: boolean; note?: string }> = [];

  for (const item of pack.items) {
    const a = answers.find((x) => x.id === item.id);
    if (!a) {
      feedback.push({ id: item.id, correct: false, note: "No answer" });
      continue;
    }

    if (item.type === "tf") {
      const ok = String(a.answer) === String(item.expected_tf);
      if (ok) correct++;
      feedback.push({ id: item.id, correct: ok, note: ok ? "✓" : `Expected ${item.expected_tf}` });
    } else {
      const text = String(a.answer).toLowerCase();
      const keys = item.expected_keywords || [];
      const hits = keys.filter((k) => k.length > 2 && text.includes(k)).length;
      const ok = hits >= Math.max(1, Math.ceil(keys.length * 0.4));
      if (ok) correct++;
      feedback.push({ id: item.id, correct: ok, note: `${hits}/${keys.length} keywords hit` });
    }
  }

  return {
    packId,
    total: pack.items.length,
    correct,
    score: Math.round((correct / pack.items.length) * 100),
    feedback,
  };
};
