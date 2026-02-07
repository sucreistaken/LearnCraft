// controllers/notificationController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";
import { getDueCards } from "./flashcardController";
import { getGlobalWeaknessSummary } from "./weaknessController";
import { listCourses } from "./courseController";
import { getStreak } from "./schedulerController";

// ---- Types ----

export type NotificationType =
  | "flashcard-due"
  | "weakness-alert"
  | "exam-countdown"
  | "schedule-reminder"
  | "streak-milestone";

export type NotificationSeverity = "info" | "warning" | "critical";

export type AppNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  dismissed: boolean;
  createdAt: string;
  dismissedAt?: string;
  actionTarget?: {
    mode: string;
    lessonId?: string;
    courseId?: string;
  };
  metadata?: Record<string, any>;
};

// ---- Paths ----
const DATA_DIR = path.join(process.cwd(), "backend", "data");
const NOTIFICATIONS_PATH = path.join(DATA_DIR, "notifications.json");

ensureDataFiles([{ path: NOTIFICATIONS_PATH, initial: [] }]);

const rid = () => `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function loadNotifications(): AppNotification[] {
  return readJSON<AppNotification[]>(NOTIFICATIONS_PATH) || [];
}

function saveNotifications(data: AppNotification[]) {
  writeJSON(NOTIFICATIONS_PATH, data);
}

// ---- Deduplication helper ----

function hasRecentNotification(
  notifications: AppNotification[],
  type: NotificationType,
  cooldownHours: number,
  milestoneKey?: string
): boolean {
  const cutoff = Date.now() - cooldownHours * 60 * 60 * 1000;
  return notifications.some((n) => {
    if (n.type !== type) return false;
    if (new Date(n.createdAt).getTime() < cutoff) return false;
    if (milestoneKey && n.metadata?.milestoneKey !== milestoneKey) return false;
    return true;
  });
}

// ---- Exported functions ----

// 1. List notifications
export function listNotifications(unreadOnly?: boolean): AppNotification[] {
  let notifications = loadNotifications();

  if (unreadOnly) {
    notifications = notifications.filter((n) => !n.dismissed);
  }

  // Sort by createdAt desc, max 50
  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return notifications.slice(0, 50);
}

// 2. Dismiss notification
export function dismissNotification(notifId: string): AppNotification | null {
  const all = loadNotifications();
  const idx = all.findIndex((n) => n.id === notifId);
  if (idx < 0) return null;

  all[idx].dismissed = true;
  all[idx].dismissedAt = new Date().toISOString();
  saveNotifications(all);
  return all[idx];
}

// 3. Get unread count
export function getUnreadCount(): number {
  const all = loadNotifications();
  return all.filter((n) => !n.dismissed).length;
}

// 4. Create notification
export function createNotification(params: {
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  actionTarget?: AppNotification["actionTarget"];
  metadata?: Record<string, any>;
}): AppNotification {
  const all = loadNotifications();

  const notif: AppNotification = {
    id: rid(),
    type: params.type,
    title: params.title,
    message: params.message,
    severity: params.severity,
    dismissed: false,
    createdAt: new Date().toISOString(),
    actionTarget: params.actionTarget,
    metadata: params.metadata,
  };

  all.unshift(notif);

  // Cap at 200 total
  const trimmed = all.slice(0, 200);
  saveNotifications(trimmed);

  return notif;
}

// 5. Check and generate notifications (scan rules)
export function checkAndGenerateNotifications(): AppNotification[] {
  const existing = loadNotifications();
  const newNotifications: AppNotification[] = [];

  // ---- Rule 1: Flashcard due ----
  const dueCards = getDueCards();
  if (dueCards.length > 0 && !hasRecentNotification(existing, "flashcard-due", 12)) {
    const severity: NotificationSeverity = dueCards.length > 10 ? "warning" : "info";
    const notif = createNotification({
      type: "flashcard-due",
      title: "Flashcards Due",
      message: `You have ${dueCards.length} flashcard${dueCards.length > 1 ? "s" : ""} waiting for review.`,
      severity,
      actionTarget: { mode: "flashcards" },
      metadata: { count: dueCards.length },
    });
    newNotifications.push(notif);
  }

  // ---- Rule 2: Weakness alert ----
  const weaknessSummary = getGlobalWeaknessSummary();
  const decliningTopics = weaknessSummary.globalWeakTopics.filter((t) => {
    // Check if any of this topic's trends are declining - we check the summary ratio as proxy
    return t.averageRatio < 0.5;
  });

  if (decliningTopics.length > 0 && !hasRecentNotification(existing, "weakness-alert", 24)) {
    const worstTopic = decliningTopics[0];
    const severity: NotificationSeverity = worstTopic.averageRatio < 0.3 ? "critical" : "warning";
    const notif = createNotification({
      type: "weakness-alert",
      title: "Weak Topics Detected",
      message: `"${worstTopic.topicName}" is at ${Math.round(worstTopic.averageRatio * 100)}%. ${decliningTopics.length > 1 ? `${decliningTopics.length - 1} more weak topic${decliningTopics.length > 2 ? "s" : ""}.` : ""}`,
      severity,
      actionTarget: { mode: "weakness" },
      metadata: { topicCount: decliningTopics.length, worstRatio: worstTopic.averageRatio },
    });
    newNotifications.push(notif);
  }

  // ---- Rule 3: Exam countdown ----
  const courses = listCourses();
  const milestones = [30, 14, 7, 3, 1];

  for (const course of courses) {
    if (!course.settings?.examDate) continue;

    const examDate = new Date(course.settings.examDate);
    const now = new Date();
    const diffMs = examDate.getTime() - now.getTime();
    if (diffMs < 0) continue; // Past exam

    const daysToExam = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    for (const milestone of milestones) {
      if (daysToExam <= milestone && daysToExam > (milestone === 1 ? 0 : milestone - 1)) {
        const milestoneKey = `exam-${course.id}-${milestone}d`;
        if (!hasRecentNotification(existing, "exam-countdown", 24 * 365, milestoneKey)) {
          let severity: NotificationSeverity = "info";
          if (milestone <= 1) severity = "critical";
          else if (milestone <= 3) severity = "warning";

          const notif = createNotification({
            type: "exam-countdown",
            title: `Exam in ${daysToExam} day${daysToExam > 1 ? "s" : ""}`,
            message: `${course.code} - ${course.name} exam is ${daysToExam === 1 ? "tomorrow" : `in ${daysToExam} days`}!`,
            severity,
            actionTarget: { mode: "course-dashboard", courseId: course.id },
            metadata: { milestoneKey, daysToExam, courseId: course.id },
          });
          newNotifications.push(notif);
        }
      }
    }
  }

  // ---- Rule 4: Streak milestones ----
  const streak = getStreak();
  const streakMilestones = [3, 7, 14, 30];

  for (const ms of streakMilestones) {
    if (streak.currentStreak === ms) {
      const milestoneKey = `streak-${ms}`;
      if (!hasRecentNotification(existing, "streak-milestone", 24 * 365, milestoneKey)) {
        const notif = createNotification({
          type: "streak-milestone",
          title: `${ms}-Day Streak!`,
          message: `You've studied ${ms} days in a row. Keep it up!`,
          severity: "info",
          metadata: { milestoneKey, streakDays: ms },
        });
        newNotifications.push(notif);
      }
    }
  }

  return newNotifications;
}
