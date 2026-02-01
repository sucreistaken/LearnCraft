// controllers/sprintController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";

export type SprintSettings = {
  studyDurationMin: number;
  breakDurationMin: number;
  examDate?: string;
  intensiveMode: boolean;
};

export type SprintSession = {
  id: string;
  startedAt: string;
  endedAt?: string;
  lessonId?: string;
  status: "studying" | "break" | "completed" | "abandoned";
  pomodorosCompleted: number;
  topicsCovered: string[];
  totalStudyMinutes: number;
};

type SprintData = {
  settings: SprintSettings;
  sessions: SprintSession[];
};

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const SPRINT_PATH = path.join(DATA_DIR, "sprint.json");

ensureDataFiles([
  {
    path: SPRINT_PATH,
    initial: {
      settings: { studyDurationMin: 40, breakDurationMin: 10, intensiveMode: false },
      sessions: [],
    },
  },
]);

const rid = () => `sprint-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function loadSprint(): SprintData {
  return (
    readJSON<SprintData>(SPRINT_PATH) || {
      settings: { studyDurationMin: 40, breakDurationMin: 10, intensiveMode: false },
      sessions: [],
    }
  );
}

function saveSprint(data: SprintData) {
  writeJSON(SPRINT_PATH, data);
}

export function getSettings(): SprintSettings {
  return loadSprint().settings;
}

export function updateSettings(partial: Partial<SprintSettings>): SprintSettings {
  const data = loadSprint();
  data.settings = { ...data.settings, ...partial };
  saveSprint(data);
  return data.settings;
}

export function createSession(lessonId?: string): SprintSession {
  const data = loadSprint();
  const session: SprintSession = {
    id: rid(),
    startedAt: new Date().toISOString(),
    lessonId,
    status: "studying",
    pomodorosCompleted: 0,
    topicsCovered: [],
    totalStudyMinutes: 0,
  };
  data.sessions.unshift(session);
  // Keep max 50 sessions
  data.sessions = data.sessions.slice(0, 50);
  saveSprint(data);
  return session;
}

export function updateSession(
  sessionId: string,
  updates: Partial<SprintSession>
): SprintSession | null {
  const data = loadSprint();
  const idx = data.sessions.findIndex((s) => s.id === sessionId);
  if (idx < 0) return null;

  data.sessions[idx] = { ...data.sessions[idx], ...updates };
  saveSprint(data);
  return data.sessions[idx];
}

export function getSprintStats(): {
  totalSessions: number;
  totalStudyMinutes: number;
  totalPomodoros: number;
  topicsCovered: string[];
  recentSessions: SprintSession[];
} {
  const data = loadSprint();
  const sessions = data.sessions;

  return {
    totalSessions: sessions.length,
    totalStudyMinutes: sessions.reduce((a, s) => a + s.totalStudyMinutes, 0),
    totalPomodoros: sessions.reduce((a, s) => a + s.pomodorosCompleted, 0),
    topicsCovered: [...new Set(sessions.flatMap((s) => s.topicsCovered))],
    recentSessions: sessions.slice(0, 10),
  };
}
