// controllers/courseController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";
import { listLessons, getLesson } from "./lessonControllers";
import { getConnections } from "./connectionsController";
import { getFlashcards, getDueCards } from "./flashcardController";
import { getGlobalWeaknessSummary, getWeaknessForLesson } from "./weaknessController";

// ---- Types ----
export interface CourseKnowledgeIndex {
  builtAt: string;
  version: number;
  overview: {
    totalLessons: number;
    topicProgression: string[];
    courseThemes: string[];
  };
  lessonDigests: Array<{
    lessonId: string;
    title: string;
    weekNumber: number;
    keyTopics: string[];
    emphasisHighlights: string[];
    coveredLOIds: string[];
  }>;
  conceptBridges: Array<{
    concept: string;
    appearsInWeeks: number[];
    evolution: string;
  }>;
  loCoverage: Array<{
    loId: string;
    loTitle: string;
    coveredByLessons: string[];
    coverageLevel: "full" | "partial" | "none";
  }>;
  progressSnapshot: {
    weakTopics: string[];
    strongTopics: string[];
    quizAverageScore: number;
    flashcardsDue: number;
    completedLessons: number;
  };
}

export interface Course {
  id: string;
  code: string;
  name: string;
  description?: string;
  lessonIds: string[];
  learningOutcomes?: string[];
  knowledgeIndex?: CourseKnowledgeIndex;
  settings?: { language: "tr" | "en"; examDate?: string };
  createdAt: string;
  updatedAt: string;
}

// ---- Paths ----
const DATA_DIR = path.join(process.cwd(), "backend", "data");
const COURSES_PATH = path.join(DATA_DIR, "courses.json");

ensureDataFiles([{ path: COURSES_PATH, initial: [] }]);

// ---- Helpers ----
function loadCourses(): Course[] {
  return readJSON<Course[]>(COURSES_PATH) || [];
}

function saveCourses(courses: Course[]) {
  writeJSON(COURSES_PATH, courses);
}

// ---- CRUD ----
export function listCourses(): Course[] {
  return loadCourses();
}

export function getCourse(id: string): Course | null {
  return loadCourses().find((c) => c.id === id) || null;
}

export function createCourse(data: { code: string; name: string; description?: string; learningOutcomes?: string[]; settings?: Course["settings"] }): Course {
  const courses = loadCourses();
  const course: Course = {
    id: "course-" + Date.now(),
    code: data.code,
    name: data.name,
    description: data.description,
    lessonIds: [],
    learningOutcomes: data.learningOutcomes || [],
    settings: data.settings || { language: "en" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  courses.push(course);
  saveCourses(courses);
  return course;
}

export function updateCourse(id: string, updates: Partial<Omit<Course, "id" | "createdAt">>): Course | null {
  const courses = loadCourses();
  const idx = courses.findIndex((c) => c.id === id);
  if (idx < 0) return null;

  courses[idx] = {
    ...courses[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  saveCourses(courses);
  return courses[idx];
}

export function deleteCourse(id: string): boolean {
  const courses = loadCourses();
  const idx = courses.findIndex((c) => c.id === id);
  if (idx < 0) return false;
  courses.splice(idx, 1);
  saveCourses(courses);
  return true;
}

// ---- Lesson-Course Relationships ----
export function addLessonToCourse(courseId: string, lessonId: string): Course | null {
  const courses = loadCourses();
  const idx = courses.findIndex((c) => c.id === courseId);
  if (idx < 0) return null;

  if (!courses[idx].lessonIds.includes(lessonId)) {
    courses[idx].lessonIds.push(lessonId);
    courses[idx].updatedAt = new Date().toISOString();
    saveCourses(courses);
  }
  return courses[idx];
}

export function removeLessonFromCourse(courseId: string, lessonId: string): Course | null {
  const courses = loadCourses();
  const idx = courses.findIndex((c) => c.id === courseId);
  if (idx < 0) return null;

  courses[idx].lessonIds = courses[idx].lessonIds.filter((id) => id !== lessonId);
  courses[idx].updatedAt = new Date().toISOString();
  saveCourses(courses);
  return courses[idx];
}

export function getCourseLessons(courseId: string): any[] {
  const course = getCourse(courseId);
  if (!course) return [];
  return course.lessonIds
    .map((id) => getLesson(id))
    .filter(Boolean);
}

export function getCourseForLesson(lessonId: string): Course | null {
  const courses = loadCourses();
  return courses.find((c) => c.lessonIds.includes(lessonId)) || null;
}

// ---- Knowledge Index Builder (Phase 2) ----
export function rebuildKnowledgeIndex(courseId: string): CourseKnowledgeIndex | null {
  const course = getCourse(courseId);
  if (!course) return null;

  const lessons = course.lessonIds
    .map((id) => getLesson(id))
    .filter(Boolean) as any[];

  // 1. Build lesson digests
  const lessonDigests = lessons.map((lesson, i) => {
    const plan = lesson.plan || {};
    const emphases = lesson.professorEmphases || plan.emphases || [];

    // Extract LO coverage from loAlignment
    const coveredLOIds: string[] = [];
    if (lesson.loAlignment?.segments) {
      for (const seg of lesson.loAlignment.segments) {
        for (const link of seg.lo_links || []) {
          if (link.confidence >= 0.5 && !coveredLOIds.includes(link.lo_id)) {
            coveredLOIds.push(link.lo_id);
          }
        }
      }
    }

    return {
      lessonId: lesson.id,
      title: lesson.title || "Untitled",
      weekNumber: i + 1,
      keyTopics: (plan.key_concepts || []).slice(0, 5),
      emphasisHighlights: emphases.slice(0, 3).map((e: any) => e.statement || String(e)),
      coveredLOIds,
    };
  });

  // 2. Build topic progression
  const topicProgression = lessonDigests.map((d) => d.title);

  // 3. Extract course themes (most frequent key topics across lessons)
  const topicCounts = new Map<string, number>();
  for (const digest of lessonDigests) {
    for (const topic of digest.keyTopics) {
      const key = topic.toLowerCase().trim();
      topicCounts.set(key, (topicCounts.get(key) || 0) + 1);
    }
  }
  const courseThemes = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // 4. Build concept bridges (concepts appearing in 2+ lessons)
  const conceptLessonsMap = new Map<string, { weeks: Set<number>; lessonTitles: string[] }>();
  for (const digest of lessonDigests) {
    for (const topic of digest.keyTopics) {
      const key = topic.toLowerCase().trim();
      if (!conceptLessonsMap.has(key)) {
        conceptLessonsMap.set(key, { weeks: new Set(), lessonTitles: [] });
      }
      const entry = conceptLessonsMap.get(key)!;
      entry.weeks.add(digest.weekNumber);
      entry.lessonTitles.push(digest.title);
    }
  }

  const conceptBridges: CourseKnowledgeIndex["conceptBridges"] = [];
  for (const [concept, data] of conceptLessonsMap) {
    if (data.weeks.size < 2) continue;
    const weeks = [...data.weeks].sort((a, b) => a - b);
    const evolution = `Introduced in W${weeks[0]}, revisited in W${weeks.slice(1).join(", W")}`;
    conceptBridges.push({ concept, appearsInWeeks: weeks, evolution });
  }

  // 5. Build LO coverage matrix
  const courseLOs = course.learningOutcomes || [];
  const loCoverage: CourseKnowledgeIndex["loCoverage"] = courseLOs.map((lo, i) => {
    const loId = `LO${i + 1}`;
    const coveredBy = lessonDigests
      .filter((d) => d.coveredLOIds.includes(loId))
      .map((d) => d.lessonId);

    let coverageLevel: "full" | "partial" | "none" = "none";
    if (coveredBy.length >= 2) coverageLevel = "full";
    else if (coveredBy.length === 1) coverageLevel = "partial";

    return {
      loId,
      loTitle: lo,
      coveredByLessons: coveredBy,
      coverageLevel,
    };
  });

  // 6. Build progress snapshot
  const allLessons = listLessons();
  let totalScore = 0;
  let scoreCount = 0;
  for (const lesson of lessons) {
    const packs = lesson.quizPacks || [];
    for (const pack of packs) {
      if (typeof pack.lastScore === "number") {
        totalScore += pack.lastScore;
        scoreCount++;
      }
    }
  }

  // Get weakness data
  const weakTopics: string[] = [];
  const strongTopics: string[] = [];
  for (const lesson of lessons) {
    const weakness = getWeaknessForLesson(lesson.id);
    if (weakness?.topics) {
      for (const topic of weakness.topics) {
        if (topic.isWeak) {
          if (!weakTopics.includes(topic.topicName)) weakTopics.push(topic.topicName);
        } else if (topic.ratio >= 0.8) {
          if (!strongTopics.includes(topic.topicName)) strongTopics.push(topic.topicName);
        }
      }
    }
  }

  // Count due flashcards for course lessons
  const dueCards = getDueCards();
  const courseLessonIds = new Set(course.lessonIds);
  const flashcardsDue = dueCards.filter((c: any) => courseLessonIds.has(c.lessonId)).length;

  const completedLessons = lessons.filter((l) => l.plan && l.transcript).length;

  const progressSnapshot: CourseKnowledgeIndex["progressSnapshot"] = {
    weakTopics: weakTopics.slice(0, 10),
    strongTopics: strongTopics.slice(0, 10),
    quizAverageScore: scoreCount > 0 ? Math.round((totalScore / scoreCount) * 100) / 100 : 0,
    flashcardsDue,
    completedLessons,
  };

  // 7. Assemble the index
  const index: CourseKnowledgeIndex = {
    builtAt: new Date().toISOString(),
    version: (course.knowledgeIndex?.version || 0) + 1,
    overview: {
      totalLessons: lessons.length,
      topicProgression,
      courseThemes,
    },
    lessonDigests,
    conceptBridges,
    loCoverage,
    progressSnapshot,
  };

  // Save to course
  updateCourse(courseId, { knowledgeIndex: index });

  return index;
}

// ---- Course Progress ----
export function getCourseProgress(courseId: string) {
  const course = getCourse(courseId);
  if (!course) return null;

  const lessons = course.lessonIds
    .map((id) => getLesson(id))
    .filter(Boolean) as any[];

  const lessonStatuses = lessons.map((lesson) => {
    const packs = lesson.quizPacks || [];
    const quizScores = packs
      .filter((p: any) => typeof p.lastScore === 'number')
      .map((p: any) => p.lastScore);

    // Get flashcard stats for this lesson
    const allCards = getFlashcards(lesson.id);
    const fcStats = {
      total: allCards.length,
      new: allCards.filter((c: any) => c.state === 'new').length,
      learning: allCards.filter((c: any) => c.state === 'learning').length,
      review: allCards.filter((c: any) => c.state === 'review').length,
      graduated: allCards.filter((c: any) => c.state === 'graduated').length,
    };

    return {
      lessonId: lesson.id,
      title: lesson.title || 'Untitled',
      hasTranscript: !!lesson.transcript,
      hasPlan: !!lesson.plan,
      quizScores,
      flashcardStats: fcStats,
    };
  });

  // Overall quiz average
  const allScores = lessonStatuses.flatMap((s) => s.quizScores);
  const overallQuizAvg = allScores.length > 0
    ? allScores.reduce((a, b) => a + b, 0) / allScores.length
    : 0;

  // Flashcard summary
  const allFcStats = lessonStatuses.map((s) => s.flashcardStats);
  const flashcardSummary = {
    total: allFcStats.reduce((a, s) => a + s.total, 0),
    new: allFcStats.reduce((a, s) => a + s.new, 0),
    learning: allFcStats.reduce((a, s) => a + s.learning, 0),
    review: allFcStats.reduce((a, s) => a + s.review, 0),
    graduated: allFcStats.reduce((a, s) => a + s.graduated, 0),
    due: getDueCards().filter((c: any) => course.lessonIds.includes(c.lessonId)).length,
  };

  // Weak/strong topics from weakness data
  const weakTopics: string[] = [];
  const strongTopics: string[] = [];
  for (const lesson of lessons) {
    const weakness = getWeaknessForLesson(lesson.id);
    if (weakness?.topics) {
      for (const topic of weakness.topics) {
        if (topic.isWeak && !weakTopics.includes(topic.topicName)) {
          weakTopics.push(topic.topicName);
        } else if (topic.ratio >= 0.8 && !strongTopics.includes(topic.topicName)) {
          strongTopics.push(topic.topicName);
        }
      }
    }
  }

  const completedLessons = lessons.filter((l) => l.plan && l.transcript).length;

  return {
    courseId,
    totalLessons: lessons.length,
    completedLessons,
    lessonStatuses,
    overallQuizAvg,
    flashcardSummary,
    weakTopics,
    strongTopics,
  };
}

// ---- Course Export ----
export function exportCourseData(courseId: string) {
  const course = getCourse(courseId);
  if (!course) return null;

  const lessons = course.lessonIds
    .map((id) => getLesson(id))
    .filter(Boolean) as any[];

  const lessonExports = lessons.map((l) => ({
    id: l.id,
    title: l.title || 'Untitled',
    plan: l.plan || undefined,
    cheatSheet: l.cheatSheet || undefined,
  }));

  // All flashcards for course lessons
  const allFlashcards: any[] = [];
  for (const lid of course.lessonIds) {
    const cards = getFlashcards(lid);
    allFlashcards.push(...cards);
  }

  // Weak topics
  const weakTopics: string[] = [];
  for (const lesson of lessons) {
    const weakness = getWeaknessForLesson(lesson.id);
    if (weakness?.topics) {
      for (const topic of weakness.topics) {
        if (topic.isWeak && !weakTopics.includes(topic.topicName)) {
          weakTopics.push(topic.topicName);
        }
      }
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    course,
    lessons: lessonExports,
    flashcards: allFlashcards,
    weakTopics,
  };
}
