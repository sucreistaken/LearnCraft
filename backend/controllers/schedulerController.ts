// controllers/schedulerController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";
import { listLessons, getLesson } from "./lessonControllers";
import { getGlobalWeaknessSummary, getWeaknessForLesson } from "./weaknessController";
import { getDueCards } from "./flashcardController";
import { getSettings as getSprintSettings } from "./sprintController";
import { listCourses, getCourse, getCourseLessons } from "./courseController";

// ---- Types ----

export type StudyTask = {
  id: string;
  courseId?: string;
  lessonId?: string;
  topicName: string;
  taskType: "review-weakness" | "flashcard-review" | "quiz-practice" | "deep-dive" | "revision";
  reason: string;
  estimatedMinutes: number;
  score: number;
  completed: boolean;
};

export type DailyPlan = {
  id: string;
  courseId?: string;
  date: string;
  generatedAt: string;
  tasks: StudyTask[];
  totalEstimatedMinutes: number;
  summary: string;
};

export type WeeklyOverview = {
  courseId?: string;
  startDate: string;
  endDate: string;
  days: Array<{
    date: string;
    dayName: string;
    totalMinutes: number;
    taskCount: number;
    highlights: string[];
  }>;
  weeklyStats: {
    totalTasks: number;
    totalMinutes: number;
    focusAreas: string[];
  };
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string | null;
  studyDates: string[];
};

type ScheduleStore = {
  dailyPlans: DailyPlan[];
  streak: StreakData;
  completedTasks: string[];
};

// ---- Paths ----
const DATA_DIR = path.join(process.cwd(), "backend", "data");
const SCHEDULES_PATH = path.join(DATA_DIR, "schedules.json");

ensureDataFiles([
  {
    path: SCHEDULES_PATH,
    initial: {
      dailyPlans: [],
      streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: null, studyDates: [] },
      completedTasks: [],
    },
  },
]);

const rid = () => `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function loadSchedules(): ScheduleStore {
  return (
    readJSON<ScheduleStore>(SCHEDULES_PATH) || {
      dailyPlans: [],
      streak: { currentStreak: 0, longestStreak: 0, lastStudyDate: null, studyDates: [] },
      completedTasks: [],
    }
  );
}

function saveSchedules(data: ScheduleStore) {
  writeJSON(SCHEDULES_PATH, data);
}

// ---- Scoring helpers ----

function computeTopicScore(
  ratio: number,
  trend: "improving" | "stable" | "declining",
  daysSinceStudied: number,
  hasDueFlashcards: boolean,
  daysToExam: number | null
): number {
  let score = 1.0;

  // Weakness weight
  if (ratio < 0.3) score *= 3;
  else if (ratio < 0.5) score *= 2;

  // Exam proximity
  if (daysToExam !== null) {
    if (daysToExam < 3) score *= 3;
    else if (daysToExam < 7) score *= 2;
    else if (daysToExam < 14) score *= 1.5;
  }

  // Recency bonus
  if (daysSinceStudied >= 3) score *= 1.5;

  // Flashcard due bonus
  if (hasDueFlashcards) score *= 1.3;

  // Declining penalty
  if (trend === "declining") score *= 2;

  return Math.round(score * 100) / 100;
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  return Math.abs(Math.floor((b - a) / (1000 * 60 * 60 * 24)));
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

// ---- Core: gather study tasks ----

function gatherStudyTasks(courseId?: string): StudyTask[] {
  const weaknessSummary = getGlobalWeaknessSummary();
  const dueCards = getDueCards();
  const now = new Date().toISOString();

  // Group due flashcards by topicName
  const dueByTopic = new Map<string, number>();
  for (const card of dueCards) {
    const count = dueByTopic.get(card.topicName) || 0;
    dueByTopic.set(card.topicName, count + 1);
  }

  // Get exam date if course specified
  let daysToExam: number | null = null;
  let courseLessonIds: Set<string> | null = null;

  if (courseId) {
    const course = getCourse(courseId);
    if (course?.settings?.examDate) {
      daysToExam = daysBetween(todayStr(), course.settings.examDate);
      // Only count if exam is in the future
      if (new Date(course.settings.examDate) < new Date()) daysToExam = null;
    }
    if (course) {
      courseLessonIds = new Set(course.lessonIds);
    }
  }

  const tasks: StudyTask[] = [];
  const seenTopics = new Set<string>();

  // From weakness data
  for (const weakTopic of weaknessSummary.globalWeakTopics) {
    // If filtering by course, check lesson overlap
    if (courseLessonIds) {
      const hasOverlap = weakTopic.lessonIds.some((lid) => courseLessonIds!.has(lid));
      if (!hasOverlap) continue;
    }

    if (seenTopics.has(weakTopic.topicName)) continue;
    seenTopics.add(weakTopic.topicName);

    // Get weakness details from lesson data
    let trend: "improving" | "stable" | "declining" = "stable";
    let lastAttemptDate = now;

    for (const lid of weakTopic.lessonIds) {
      const analysis = getWeaknessForLesson(lid);
      if (analysis) {
        const topic = analysis.topics.find((t) => t.topicName === weakTopic.topicName);
        if (topic) {
          trend = topic.trend;
          lastAttemptDate = topic.lastAttemptDate || now;
          break;
        }
      }
    }

    const daysSinceStudied = daysBetween(lastAttemptDate, now);
    const hasDue = dueByTopic.has(weakTopic.topicName);

    const score = computeTopicScore(
      weakTopic.averageRatio,
      trend,
      daysSinceStudied,
      hasDue,
      daysToExam
    );

    // Determine task type
    let taskType: StudyTask["taskType"] = "review-weakness";
    let reason = "";
    let estimatedMinutes = 20;

    if (weakTopic.averageRatio < 0.3) {
      taskType = "deep-dive";
      reason = `Critical weakness (${Math.round(weakTopic.averageRatio * 100)}% score). Deep study recommended.`;
      estimatedMinutes = 30;
    } else if (hasDue) {
      taskType = "flashcard-review";
      reason = `Weak topic with ${dueByTopic.get(weakTopic.topicName)} due flashcards. Review needed.`;
      estimatedMinutes = 15;
    } else if (trend === "declining") {
      taskType = "quiz-practice";
      reason = `Performance declining. Practice quizzes to reinforce understanding.`;
      estimatedMinutes = 25;
    } else {
      taskType = "review-weakness";
      reason = `Below target (${Math.round(weakTopic.averageRatio * 100)}% score). Quick review needed.`;
      estimatedMinutes = 20;
    }

    tasks.push({
      id: rid(),
      courseId,
      lessonId: weakTopic.lessonIds[0],
      topicName: weakTopic.topicName,
      taskType,
      reason,
      estimatedMinutes,
      score,
      completed: false,
    });
  }

  // Add flashcard-only tasks for due cards not already covered
  for (const [topicName, count] of dueByTopic) {
    if (seenTopics.has(topicName)) continue;

    // Check course filter
    if (courseLessonIds) {
      const card = dueCards.find((c) => c.topicName === topicName);
      if (card && !courseLessonIds.has(card.lessonId)) continue;
    }

    seenTopics.add(topicName);

    tasks.push({
      id: rid(),
      courseId,
      lessonId: dueCards.find((c) => c.topicName === topicName)?.lessonId,
      topicName,
      taskType: "flashcard-review",
      reason: `${count} flashcard${count > 1 ? "s" : ""} due for review.`,
      estimatedMinutes: Math.min(count * 3, 20),
      score: count > 5 ? 2.5 : 1.5,
      completed: false,
    });
  }

  // Sort by score descending
  tasks.sort((a, b) => b.score - a.score);

  return tasks;
}

// ---- Exported functions ----

// 1. Get next session: highest-priority single task
export function getNextSession(courseId?: string): { task: StudyTask | null; totalPending: number } {
  const tasks = gatherStudyTasks(courseId);
  return {
    task: tasks[0] || null,
    totalPending: tasks.length,
  };
}

// 2. Get daily plan (cached for 2 hours)
export function getDailyPlan(courseId?: string): DailyPlan {
  const store = loadSchedules();
  const today = todayStr();

  // Check cache
  const cached = store.dailyPlans.find(
    (p) => p.date === today && (p.courseId || undefined) === courseId
  );
  if (cached) {
    const cacheAge = Date.now() - new Date(cached.generatedAt).getTime();
    if (cacheAge < 2 * 60 * 60 * 1000) {
      // Update completed status from store
      for (const task of cached.tasks) {
        if (store.completedTasks.includes(task.id)) {
          task.completed = true;
        }
      }
      return cached;
    }
  }

  // Generate new plan
  const sprintSettings = getSprintSettings();
  const budgetMinutes = sprintSettings.studyDurationMin * 3;
  const allTasks = gatherStudyTasks(courseId);

  // Fill budget
  const planTasks: StudyTask[] = [];
  let totalMinutes = 0;

  for (const task of allTasks) {
    if (totalMinutes + task.estimatedMinutes > budgetMinutes) continue;
    // Mark as completed if was completed before
    if (store.completedTasks.includes(task.id)) {
      task.completed = true;
    }
    planTasks.push(task);
    totalMinutes += task.estimatedMinutes;
  }

  const plan: DailyPlan = {
    id: `plan-${Date.now()}`,
    courseId,
    date: today,
    generatedAt: new Date().toISOString(),
    tasks: planTasks,
    totalEstimatedMinutes: totalMinutes,
    summary: planTasks.length > 0
      ? `${planTasks.length} tasks planned: ${planTasks.map((t) => t.topicName).slice(0, 3).join(", ")}${planTasks.length > 3 ? "..." : ""}`
      : "No study tasks identified. Great job staying on top of your material!",
  };

  // Cache: keep max 7 daily plans
  const idx = store.dailyPlans.findIndex(
    (p) => p.date === today && (p.courseId || undefined) === courseId
  );
  if (idx >= 0) store.dailyPlans[idx] = plan;
  else store.dailyPlans.push(plan);

  store.dailyPlans = store.dailyPlans.slice(-7);
  saveSchedules(store);

  return plan;
}

// 3. Get weekly overview (7-day forward view)
export function getWeeklyOverview(courseId?: string): WeeklyOverview {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const tasks = gatherStudyTasks(courseId);
  const sprintSettings = getSprintSettings();
  const dailyBudget = sprintSettings.studyDurationMin * 3;

  const days: WeeklyOverview["days"] = [];
  const now = new Date();

  // Distribute tasks across the week
  let taskIdx = 0;
  let totalTasks = 0;
  let totalMinutes = 0;
  const focusAreas = new Set<string>();

  for (let d = 0; d < 7; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().split("T")[0];

    let dayMinutes = 0;
    let dayTaskCount = 0;
    const highlights: string[] = [];

    while (taskIdx < tasks.length && dayMinutes + tasks[taskIdx].estimatedMinutes <= dailyBudget) {
      dayMinutes += tasks[taskIdx].estimatedMinutes;
      dayTaskCount++;
      if (highlights.length < 2) highlights.push(tasks[taskIdx].topicName);
      focusAreas.add(tasks[taskIdx].topicName);
      taskIdx++;
    }

    // If still have tasks and day is empty, add at least one
    if (dayTaskCount === 0 && taskIdx < tasks.length) {
      dayMinutes = tasks[taskIdx].estimatedMinutes;
      dayTaskCount = 1;
      highlights.push(tasks[taskIdx].topicName);
      focusAreas.add(tasks[taskIdx].topicName);
      taskIdx++;
    }

    totalTasks += dayTaskCount;
    totalMinutes += dayMinutes;

    days.push({
      date: dateStr,
      dayName: dayNames[date.getDay()],
      totalMinutes: dayMinutes,
      taskCount: dayTaskCount,
      highlights,
    });
  }

  const startDate = days[0].date;
  const endDate = days[6].date;

  return {
    courseId,
    startDate,
    endDate,
    days,
    weeklyStats: {
      totalTasks,
      totalMinutes,
      focusAreas: [...focusAreas].slice(0, 5),
    },
  };
}

// 4. Complete a task
export function completeTask(taskId: string): { ok: boolean; streak: StreakData } {
  const store = loadSchedules();

  if (!store.completedTasks.includes(taskId)) {
    store.completedTasks.push(taskId);
    // Cap completed tasks list
    if (store.completedTasks.length > 500) {
      store.completedTasks = store.completedTasks.slice(-500);
    }
  }

  // Update streak
  const today = todayStr();
  if (!store.streak.studyDates.includes(today)) {
    store.streak.studyDates.push(today);
  }

  // Recalculate streak
  store.streak = recalcStreak(store.streak, today);

  // Mark in daily plans
  for (const plan of store.dailyPlans) {
    const task = plan.tasks.find((t) => t.id === taskId);
    if (task) task.completed = true;
  }

  saveSchedules(store);
  return { ok: true, streak: store.streak };
}

// 5. Get streak
export function getStreak(): StreakData {
  const store = loadSchedules();
  const today = todayStr();
  // Auto-reset if yesterday missed
  return recalcStreak(store.streak, today);
}

function recalcStreak(streak: StreakData, today: string): StreakData {
  const dates = [...streak.studyDates].sort();
  if (dates.length === 0) {
    return { currentStreak: 0, longestStreak: streak.longestStreak, lastStudyDate: null, studyDates: [] };
  }

  const lastDate = dates[dates.length - 1];

  // If last study date is more than 1 day ago, streak resets
  const diffDays = daysBetween(lastDate, today);
  if (diffDays > 1) {
    return {
      currentStreak: 0,
      longestStreak: streak.longestStreak,
      lastStudyDate: lastDate,
      studyDates: streak.studyDates,
    };
  }

  // Count consecutive days backwards from last date
  let current = 0;
  let checkDate = new Date(lastDate);

  while (true) {
    const checkStr = checkDate.toISOString().split("T")[0];
    if (dates.includes(checkStr)) {
      current++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  const longest = Math.max(streak.longestStreak, current);

  return {
    currentStreak: current,
    longestStreak: longest,
    lastStudyDate: lastDate,
    studyDates: streak.studyDates,
  };
}
