import fs from "fs";
import path from "path";

// ── Interfaces ──────────────────────────────────────────────────────────────

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  type?: 'mc' | 'tf';
  difficulty?: string;
}

export interface QuizData {
  questions: QuizQuestion[];
  scores: Record<string, { correct: number; total: number; nickname: string }>;
  generatedAt?: string;
}

export interface FlashcardItem {
  id: string;
  front: string;
  back: string;
  hint?: string;
  topic: string;
  createdBy: string;
  createdByNickname: string;
  createdAt: string;
  votes: Array<{ userId: string; vote: "up" | "down" }>;
  source: "manual" | "ai-generated" | "lesson-emphasis" | "lesson-cheatsheet" | "lesson-miniQuiz" | "lesson-loModule";
  // SM-2 per-user review state
  sm2?: Record<string, {
    easeFactor: number;
    interval: number;
    repetitions: number;
    nextReview: string;
    lastReview: string;
  }>;
}

export interface FlashcardsData {
  cards: FlashcardItem[];
}

export interface DeepDiveMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  authorId: string;
  authorNickname: string;
  timestamp: string;
}

export interface DeepDiveData {
  messages: DeepDiveMessage[];
}

export interface MindMapData {
  mermaidCode: string;
  generatedAt?: string;
  topic?: string;
}

export interface SprintMember {
  status: string;
  lastUpdate: string;
  nickname: string;
}

export interface SprintData {
  phase: "idle" | "studying" | "break" | "finished";
  studyDurationMin: number;
  breakDurationMin: number;
  startedAt?: string;
  currentPhaseStartedAt?: string;
  pomodorosCompleted: number;
  members: Record<string, SprintMember>;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  category: "concept" | "formula" | "example" | "tip" | "warning" | "summary";
  authorId: string;
  authorNickname: string;
  createdAt: string;
  editedAt?: string;
  pinned: boolean;
}

export interface NotesData {
  items: NoteItem[];
}

export interface ChannelToolData {
  channelId: string;
  toolType: string;
  quiz?: QuizData;
  flashcards?: FlashcardsData;
  deepDive?: DeepDiveData;
  mindMap?: MindMapData;
  sprint?: SprintData;
  notes?: NotesData;
  locked?: boolean;
  lockedBy?: string;
}

// ── Repository ──────────────────────────────────────────────────────────────

const DATA_DIR = path.join(__dirname, "../data/channel-tools");

class ChannelToolRepository {
  constructor() {
    this.ensureDir();
  }

  ensureDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private filePath(channelId: string): string {
    return path.join(DATA_DIR, `${channelId}.json`);
  }

  private defaultData(channelId: string): ChannelToolData {
    return {
      channelId,
      toolType: "",
    };
  }

  load(channelId: string): ChannelToolData {
    const fp = this.filePath(channelId);
    try {
      if (!fs.existsSync(fp)) {
        return this.defaultData(channelId);
      }
      const raw = fs.readFileSync(fp, "utf-8");
      return JSON.parse(raw) as ChannelToolData;
    } catch {
      return this.defaultData(channelId);
    }
  }

  save(channelId: string, data: ChannelToolData): void {
    this.ensureDir();
    const fp = this.filePath(channelId);
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
  }
}

export const channelToolRepo = new ChannelToolRepository();
