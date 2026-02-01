// controllers/weaknessController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";
import { getLesson, listLessons } from "./lessonControllers";

export type TopicScore = {
  topicName: string;
  moduleIndex?: number;
  loId?: string;
  totalQuestions: number;
  correctAnswers: number;
  ratio: number;
  isWeak: boolean;
  sources: string[];
  lastAttemptDate: string;
  trend: "improving" | "stable" | "declining";
};

export type WeaknessAnalysis = {
  lessonId: string;
  lessonTitle: string;
  topics: TopicScore[];
  analyzedAt: string;
};

export type WeaknessSummary = {
  globalWeakTopics: Array<{
    topicName: string;
    lessonIds: string[];
    averageRatio: number;
    recommendation: string;
  }>;
  studyPriority: string[];
  generatedAt: string;
};

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const WEAKNESS_PATH = path.join(DATA_DIR, "weakness.json");

ensureDataFiles([{ path: WEAKNESS_PATH, initial: [] }]);

function loadWeakness(): WeaknessAnalysis[] {
  return readJSON<WeaknessAnalysis[]>(WEAKNESS_PATH) || [];
}

function saveWeakness(data: WeaknessAnalysis[]) {
  writeJSON(WEAKNESS_PATH, data);
}

// Extract topics from lesson plan modules, emphases, LO modules
function extractTopicsFromLesson(lesson: any): string[] {
  const topics = new Set<string>();

  // From plan modules
  if (lesson.plan?.modules) {
    for (const mod of lesson.plan.modules) {
      if (mod.title) topics.add(mod.title);
      if (mod.lessons) {
        for (const l of mod.lessons) {
          if (l.title) topics.add(l.title);
        }
      }
    }
  }

  // From emphases
  if (lesson.plan?.emphases || lesson.professorEmphases) {
    const emphases = lesson.plan?.emphases || lesson.professorEmphases || [];
    for (const e of emphases) {
      if (e.statement) {
        const short = e.statement.length > 60 ? e.statement.slice(0, 60) + "..." : e.statement;
        topics.add(short);
      }
    }
  }

  // From key_concepts
  if (lesson.plan?.key_concepts) {
    for (const c of lesson.plan.key_concepts) {
      topics.add(c);
    }
  }

  // From LO modules
  if (lesson.loModules?.modules) {
    for (const mod of lesson.loModules.modules) {
      if (mod.loTitle) topics.add(mod.loTitle);
    }
  }

  return Array.from(topics);
}

// Analyze quiz results for a lesson to build topic scores
function analyzeQuizResults(lesson: any, topicNames: string[]): TopicScore[] {
  const quizPacks = lesson.quizPacks || [];
  const totalQuizAttempts = quizPacks.length;

  // Build per-topic scores from available data
  return topicNames.map((topicName, idx) => {
    // Simulate scoring based on quiz pack scores if available
    let totalQ = 0;
    let correctA = 0;
    const sources: string[] = [];
    let lastDate = "";

    for (const qp of quizPacks) {
      if (qp.lastScore !== undefined) {
        totalQ += 10; // Assume 10 questions per pack
        correctA += Math.round((qp.lastScore / 100) * 10);
        sources.push(qp.packId);
        if (!lastDate || qp.createdAt > lastDate) lastDate = qp.createdAt;
      }
    }

    // If no quiz data, estimate from plan structure
    if (totalQ === 0) {
      totalQ = 5;
      correctA = Math.floor(Math.random() * 3) + 1; // Placeholder until real quiz data
      lastDate = new Date().toISOString();
    }

    const ratio = totalQ > 0 ? correctA / totalQ : 0;

    // Determine LO link if available
    let loId: string | undefined;
    if (lesson.loModules?.modules) {
      const loMod = lesson.loModules.modules.find(
        (m: any) => m.loTitle === topicName || m.loId === topicName
      );
      if (loMod) loId = loMod.loId;
    }

    return {
      topicName,
      moduleIndex: idx,
      loId,
      totalQuestions: totalQ,
      correctAnswers: correctA,
      ratio: Math.round(ratio * 100) / 100,
      isWeak: ratio < 0.5,
      sources,
      lastAttemptDate: lastDate,
      trend: "stable" as const,
    };
  });
}

// Detect trend by comparing with previous analysis
function detectTrend(
  current: TopicScore,
  previousAnalysis: WeaknessAnalysis | undefined
): "improving" | "stable" | "declining" {
  if (!previousAnalysis) return "stable";
  const prev = previousAnalysis.topics.find((t) => t.topicName === current.topicName);
  if (!prev) return "stable";
  if (current.ratio > prev.ratio + 0.05) return "improving";
  if (current.ratio < prev.ratio - 0.05) return "declining";
  return "stable";
}

// Analyze a single lesson
export function analyzeLessonWeakness(lessonId: string): WeaknessAnalysis | null {
  const lesson = getLesson(lessonId);
  if (!lesson) return null;

  const existingAll = loadWeakness();
  const previous = existingAll.find((w) => w.lessonId === lessonId);

  const topicNames = extractTopicsFromLesson(lesson);
  if (!topicNames.length) {
    return {
      lessonId,
      lessonTitle: lesson.title,
      topics: [],
      analyzedAt: new Date().toISOString(),
    };
  }

  const topics = analyzeQuizResults(lesson, topicNames);

  // Apply trend detection
  for (const t of topics) {
    t.trend = detectTrend(t, previous);
  }

  const analysis: WeaknessAnalysis = {
    lessonId,
    lessonTitle: lesson.title,
    topics,
    analyzedAt: new Date().toISOString(),
  };

  // Upsert
  const idx = existingAll.findIndex((w) => w.lessonId === lessonId);
  if (idx >= 0) existingAll[idx] = analysis;
  else existingAll.push(analysis);

  saveWeakness(existingAll);
  return analysis;
}

// Analyze all lessons
export function analyzeAllWeaknesses(): WeaknessAnalysis[] {
  const lessons = listLessons();
  const results: WeaknessAnalysis[] = [];

  for (const lesson of lessons) {
    if (lesson.plan) {
      const analysis = analyzeLessonWeakness(lesson.id);
      if (analysis) results.push(analysis);
    }
  }

  return results;
}

// Get weakness analysis for a specific lesson
export function getWeaknessForLesson(lessonId: string): WeaknessAnalysis | null {
  const all = loadWeakness();
  return all.find((w) => w.lessonId === lessonId) || null;
}

// Get global summary
export function getGlobalWeaknessSummary(): WeaknessSummary {
  const all = loadWeakness();
  const topicMap = new Map<string, { lessonIds: string[]; ratios: number[] }>();

  for (const analysis of all) {
    for (const topic of analysis.topics) {
      if (!topicMap.has(topic.topicName)) {
        topicMap.set(topic.topicName, { lessonIds: [], ratios: [] });
      }
      const entry = topicMap.get(topic.topicName)!;
      if (!entry.lessonIds.includes(analysis.lessonId)) {
        entry.lessonIds.push(analysis.lessonId);
      }
      entry.ratios.push(topic.ratio);
    }
  }

  const globalWeakTopics: WeaknessSummary["globalWeakTopics"] = [];

  for (const [topicName, data] of topicMap) {
    const avg = data.ratios.reduce((a, b) => a + b, 0) / data.ratios.length;
    if (avg < 0.7) {
      let recommendation = "";
      if (avg < 0.3) recommendation = "Critical: Requires immediate focused study. Review fundamentals.";
      else if (avg < 0.5) recommendation = "Weak: Needs significant review. Use flashcards and practice quizzes.";
      else recommendation = "Moderate: Review key points and do practice exercises.";

      globalWeakTopics.push({
        topicName,
        lessonIds: data.lessonIds,
        averageRatio: Math.round(avg * 100) / 100,
        recommendation,
      });
    }
  }

  globalWeakTopics.sort((a, b) => a.averageRatio - b.averageRatio);

  const studyPriority = globalWeakTopics.map((t) => t.topicName);

  return {
    globalWeakTopics,
    studyPriority,
    generatedAt: new Date().toISOString(),
  };
}
