// controllers/contextAssembler.ts
// Builds optimal AI prompt context per endpoint type, course-aware.
import { getLesson } from "./lessonControllers";
import { getCourse, getCourseForLesson, type Course, type CourseKnowledgeIndex } from "./courseController";

// Token budget per endpoint type
const BUDGETS: Record<string, { course: number; lesson: number; crossLesson: number; progress: number }> = {
  "chat":        { course: 1500, lesson: 8000, crossLesson: 1500, progress: 500 },
  "cheat-sheet": { course: 1000, lesson: 12000, crossLesson: 2000, progress: 0 },
  "quiz":        { course: 1000, lesson: 6000, crossLesson: 3000, progress: 500 },
  "mindmap":     { course: 800, lesson: 10000, crossLesson: 1500, progress: 0 },
  "weakness":    { course: 1200, lesson: 4000, crossLesson: 2000, progress: 1500 },
};

// Rough token estimation (~4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function trimToTokenBudget(text: string, budget: number): string {
  const charBudget = budget * 4;
  if (text.length <= charBudget) return text;
  return text.slice(0, charBudget) + "...";
}

export interface AssembledContext {
  courseBlock: string;
  lessonBlock: string;
  crossLessonBlock: string;
  progressBlock: string;
  fullContext: string;
  courseId: string | null;
  courseName: string | null;
}

export function assembleCourseContext(
  lessonId: string,
  endpointType: string,
  options?: { userQuery?: string }
): AssembledContext {
  const budget = BUDGETS[endpointType] || BUDGETS["chat"];
  const lesson = getLesson(lessonId);

  const emptyResult: AssembledContext = {
    courseBlock: "",
    lessonBlock: "",
    crossLessonBlock: "",
    progressBlock: "",
    fullContext: "",
    courseId: null,
    courseName: null,
  };

  if (!lesson) return emptyResult;

  // Find the course this lesson belongs to
  const course = getCourseForLesson(lessonId);
  const ki = course?.knowledgeIndex;

  // 1. Course Block
  let courseBlock = "";
  if (course && ki) {
    const parts: string[] = [];
    parts.push(`Course: ${course.code} - ${course.name}`);

    if (course.learningOutcomes?.length) {
      parts.push(`Learning Outcomes:\n${course.learningOutcomes.map((lo, i) => `  LO${i + 1}: ${lo}`).join("\n")}`);
    }

    if (ki.overview.topicProgression.length) {
      parts.push(`Lesson Progression:\n${ki.overview.topicProgression.map((t, i) => `  W${i + 1}: ${t}`).join("\n")}`);
    }

    if (ki.overview.courseThemes.length) {
      parts.push(`Course Themes: ${ki.overview.courseThemes.join(", ")}`);
    }

    courseBlock = trimToTokenBudget(parts.join("\n\n"), budget.course);
  }

  // 2. Lesson Block (current lesson context - similar to existing buildCondensedContext)
  let lessonBlock = "";
  {
    const plan = lesson.plan as any;
    const parts: string[] = [];

    parts.push(`Current Lesson: ${lesson.title}`);
    if (plan?.topic) parts.push(`Topic: ${plan.topic}`);
    if (plan?.key_concepts?.length) parts.push(`Key concepts: ${plan.key_concepts.join(", ")}`);

    if (plan?.modules?.length) {
      const modSummary = plan.modules
        .slice(0, 6)
        .map((m: any) => `- ${m.title || "Module"}: ${m.goal || ""}`)
        .join("\n");
      parts.push(`Modules:\n${modSummary}`);
    }

    const emphases = lesson.professorEmphases || plan?.emphases || [];
    if (emphases.length) {
      const emphSummary = emphases
        .slice(0, 8)
        .map((e: any) => `- ${e.statement}${e.why ? ` (${e.why})` : ""}`)
        .join("\n");
      parts.push(`Professor emphases:\n${emphSummary}`);
    }

    // Include transcript excerpt based on budget
    const transcriptBudget = Math.floor(budget.lesson * 0.5);
    if (lesson.transcript) {
      parts.push(`Transcript excerpt:\n${trimToTokenBudget(lesson.transcript, transcriptBudget)}`);
    }

    const slideBudget = Math.floor(budget.lesson * 0.3);
    if (lesson.slideText) {
      parts.push(`Slide content:\n${trimToTokenBudget(lesson.slideText, slideBudget)}`);
    }

    lessonBlock = trimToTokenBudget(parts.join("\n\n"), budget.lesson);
  }

  // 3. Cross-Lesson Block
  let crossLessonBlock = "";
  if (course && ki && budget.crossLesson > 0) {
    const currentDigest = ki.lessonDigests.find((d) => d.lessonId === lessonId);
    const currentTopics = new Set(currentDigest?.keyTopics.map((t) => t.toLowerCase()) || []);

    // Find user-referenced week if any
    const weekRef = options?.userQuery?.match(/(?:week|hafta|w)\s*(\d+)/i);
    const referencedWeek = weekRef ? parseInt(weekRef[1]) : null;

    // Select relevant digests
    let relevantDigests = ki.lessonDigests.filter((d) => d.lessonId !== lessonId);

    if (referencedWeek) {
      // User referenced a specific week - prioritize it
      relevantDigests.sort((a, b) => {
        const aMatch = a.weekNumber === referencedWeek ? 0 : 1;
        const bMatch = b.weekNumber === referencedWeek ? 0 : 1;
        return aMatch - bMatch;
      });
    } else {
      // Score by topic overlap with current lesson
      relevantDigests = relevantDigests
        .map((d) => {
          const overlap = d.keyTopics.filter((t) => currentTopics.has(t.toLowerCase())).length;
          return { ...d, _score: overlap };
        })
        .sort((a: any, b: any) => b._score - a._score);
    }

    // Take top 3 most relevant
    const selected = relevantDigests.slice(0, 3);
    if (selected.length > 0) {
      const parts = selected.map((d) => {
        return `W${d.weekNumber} - ${d.title}: Topics: ${d.keyTopics.join(", ")}${d.emphasisHighlights.length ? `\n  Key points: ${d.emphasisHighlights.join("; ")}` : ""}`;
      });

      // Add concept bridges that connect to current lesson
      const bridges = ki.conceptBridges
        .filter((b) => b.appearsInWeeks.includes(currentDigest?.weekNumber || -1))
        .slice(0, 3);

      if (bridges.length) {
        parts.push("\nCross-lesson concepts:");
        for (const b of bridges) {
          parts.push(`  - ${b.concept}: ${b.evolution}`);
        }
      }

      crossLessonBlock = trimToTokenBudget(parts.join("\n"), budget.crossLesson);
    }
  }

  // 4. Progress Block
  let progressBlock = "";
  if (ki && budget.progress > 0) {
    const ps = ki.progressSnapshot;
    const parts: string[] = [];
    if (ps.weakTopics.length) parts.push(`Weak topics: ${ps.weakTopics.join(", ")}`);
    if (ps.strongTopics.length) parts.push(`Strong topics: ${ps.strongTopics.join(", ")}`);
    if (ps.quizAverageScore > 0) parts.push(`Quiz average: ${Math.round(ps.quizAverageScore * 100)}%`);
    if (ps.flashcardsDue > 0) parts.push(`Flashcards due: ${ps.flashcardsDue}`);
    parts.push(`Completed lessons: ${ps.completedLessons}/${ki.overview.totalLessons}`);
    progressBlock = trimToTokenBudget(parts.join("\n"), budget.progress);
  }

  // 5. Assemble full context
  const sections: string[] = [];
  if (courseBlock) sections.push(`=== COURSE OVERVIEW ===\n${courseBlock}`);
  sections.push(`=== CURRENT LESSON ===\n${lessonBlock}`);
  if (crossLessonBlock) sections.push(`=== RELATED LESSONS ===\n${crossLessonBlock}`);
  if (progressBlock) sections.push(`=== STUDENT PROGRESS ===\n${progressBlock}`);

  return {
    courseBlock,
    lessonBlock,
    crossLessonBlock,
    progressBlock,
    fullContext: sections.join("\n\n"),
    courseId: course?.id || null,
    courseName: course ? `${course.code} - ${course.name}` : null,
  };
}

// Assemble context for course-level chat (no specific lesson)
export function assembleCourseWideContext(courseId: string): AssembledContext {
  const course = getCourse(courseId);
  const emptyResult: AssembledContext = {
    courseBlock: "",
    lessonBlock: "",
    crossLessonBlock: "",
    progressBlock: "",
    fullContext: "",
    courseId: null,
    courseName: null,
  };

  if (!course) return emptyResult;
  const ki = course.knowledgeIndex;

  const parts: string[] = [];
  parts.push(`Course: ${course.code} - ${course.name}`);
  if (course.description) parts.push(`Description: ${course.description}`);

  if (course.learningOutcomes?.length) {
    parts.push(`\nLearning Outcomes:\n${course.learningOutcomes.map((lo, i) => `  LO${i + 1}: ${lo}`).join("\n")}`);
  }

  if (ki) {
    parts.push(`\nTotal Lessons: ${ki.overview.totalLessons}`);
    parts.push(`Course Themes: ${ki.overview.courseThemes.join(", ")}`);

    parts.push(`\nLesson Overview:`);
    for (const d of ki.lessonDigests) {
      parts.push(`  W${d.weekNumber} - ${d.title}: ${d.keyTopics.join(", ")}`);
      if (d.emphasisHighlights.length) {
        parts.push(`    Emphases: ${d.emphasisHighlights.join("; ")}`);
      }
    }

    if (ki.conceptBridges.length) {
      parts.push(`\nCross-Lesson Concepts:`);
      for (const b of ki.conceptBridges) {
        parts.push(`  - ${b.concept}: ${b.evolution}`);
      }
    }

    if (ki.loCoverage.length) {
      parts.push(`\nLO Coverage:`);
      for (const lo of ki.loCoverage) {
        parts.push(`  ${lo.loId} (${lo.loTitle}): ${lo.coverageLevel} [${lo.coveredByLessons.length} lessons]`);
      }
    }

    const ps = ki.progressSnapshot;
    if (ps.weakTopics.length || ps.quizAverageScore > 0) {
      parts.push(`\nProgress:`);
      if (ps.weakTopics.length) parts.push(`  Weak: ${ps.weakTopics.join(", ")}`);
      if (ps.strongTopics.length) parts.push(`  Strong: ${ps.strongTopics.join(", ")}`);
      if (ps.quizAverageScore > 0) parts.push(`  Quiz avg: ${Math.round(ps.quizAverageScore * 100)}%`);
      parts.push(`  Completed: ${ps.completedLessons}/${ki.overview.totalLessons}`);
    }
  }

  const fullContext = parts.join("\n");

  return {
    courseBlock: fullContext,
    lessonBlock: "",
    crossLessonBlock: "",
    progressBlock: "",
    fullContext: `=== FULL COURSE CONTEXT ===\n${fullContext}`,
    courseId: course.id,
    courseName: `${course.code} - ${course.name}`,
  };
}
