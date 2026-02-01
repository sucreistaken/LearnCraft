// src/types.ts

export type Activity = { type: string; prompt: string; expected_outcome?: string };

export type Lesson = {
  title: string;
  objective: string;
  study_time_min: number;
  activities: Activity[];
  mini_quiz?: string[];
};

export type ModuleT = { title: string; goal: string; lessons: Lesson[] };

export type Emphasis = {
  statement: string;
  why: string;
  in_slides: boolean;
  evidence: string;
  confidence: number;
};
export type LoLink = {
  lo_id: string;      // "LO1"
  lo_title: string;   // "classify functions"
  confidence: number; // 0–1
};

export type LoAlignedSegment = {
  index: number;      // 0,1,2...
  text: string;       // transcript segmenti
  lo_links: LoLink[];
};

export type LoAlignment = {
  segments: LoAlignedSegment[];
};
export type AlignItem = {
  topic: string;
  concepts: string[];
  in_both: boolean;
  emphasis_level: "high" | "medium" | "low";
  lecture_quotes: string[];
  slide_refs: string[];
  duration_min: number;
  confidence: number;
};

export type Alignment = {
  summary_chatty?: string;
  average_duration_min?: number;
  items?: AlignItem[];
};
// varsa diğer tiplerin yanına
export interface LearningOutcome {
  code: string;
  description: string;
  covered?: boolean;
  covered_by_lessons?: string[];
}
export type LoStudyModule = {
  loId: string;             // "LO2"
  loTitle: string;          // resmi LO metni

  // 1) Çekirdek bilgi
  oneLineGist: string;      // 1 cümlede öz
  coreIdeas: string[];      // 3–6 madde, en önemli kavramlar
  mustRemember: string[];   // “unutursan kalırsın” tipinde 3–5 kritik gerçek

  // 2) Bağlam ve örnek
  intuitiveExplanation: string; // öğrenciye anlatır gibi açıklama (max 6–7 cümle)
  examples: {
    label: string;
    description: string;
  }[];

  // 3) Test odaklı kısım
  typicalQuestions: string[];   // bu LO’dan gelen tipik soru kökleri
  commonTraps: string[];        // öğrencinin en sık düştüğü hatalar
  miniQuiz: {
    question: string;
    answer: string;
    why: string;
  }[];

  // 4) Çalışma zaman tahmini
  recommended_study_time_min: number;  // bu LO için önerilen süre
};

export type Plan = {
  topic?: string;
  difficulty?: "Beginner" | "Intermediate" | "Advanced";
  key_concepts?: string[];
  duration_weeks?: number;
  modules?: ModuleT[];
  resources?: string[];
  emphases?: Emphasis[];
  seed_quiz?: string[];
  alignment?: Alignment;
  learning_outcomes?: LearningOutcome[];
};

export type ModeId =
  | "plan"
  | "alignment"
  | "deviation"
  | "lecturer-note"
  | "quiz"
  | "deep-dive"
  | "mindmap"
  | "exam-sprint"
  | "history"
  | "lo-study"
  | "cheat-sheet"
  | "notes"
  | "weakness"
  | "flashcards"
  | "connections"
  | "study-room";

export type CheatSheet = {
  title: string;
  updatedAt: string;
  sections: Array<{ heading: string; bullets: string[] }>;
  formulas?: string[];
  pitfalls?: string[];
  quickQuiz?: Array<{ q: string; a: string }>;
};
// Weakness Tracker types
export interface TopicScore {
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
}

export interface WeaknessAnalysis {
  lessonId: string;
  lessonTitle: string;
  topics: TopicScore[];
  analyzedAt: string;
}

export interface WeaknessSummary {
  globalWeakTopics: Array<{
    topicName: string;
    lessonIds: string[];
    averageRatio: number;
    recommendation: string;
  }>;
  studyPriority: string[];
  generatedAt: string;
}

// Flashcard / Spaced Repetition types
export interface Flashcard {
  id: string;
  lessonId: string;
  topicName: string;
  front: string;
  back: string;
  source: "emphasis" | "cheatsheet" | "miniQuiz" | "loModule" | "ai-generated";
  interval: number;
  easeFactor: number;
  repetitions: number;
  nextReviewDate: string;
  state: "new" | "learning" | "review" | "graduated";
  createdAt: string;
  lastReviewedAt?: string;
}

export interface FlashcardStats {
  total: number;
  new: number;
  learning: number;
  review: number;
  graduated: number;
  dueToday: number;
}

// Sprint types
export interface SprintSettings {
  studyDurationMin: number;
  breakDurationMin: number;
  examDate?: string;
  intensiveMode: boolean;
}

export interface SprintSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  lessonId?: string;
  status: "studying" | "break" | "completed" | "abandoned";
  pomodorosCompleted: number;
  topicsCovered: string[];
  totalStudyMinutes: number;
}

// Connection types
export interface ConceptConnection {
  concept: string;
  lessonIds: string[];
  lessonTitles: string[];
  strength: number;
  relatedConcepts: string[];
  aiInsight?: string;
}

// Share types
export interface SharedBundle {
  shareId: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  lessonId: string;
  bundle: {
    title: string;
    plan: Plan | null;
    cheatSheet: CheatSheet | null;
    quiz: string[];
    loModules: LoStudyModule[] | null;
    emphases: Emphasis[];
    notes: string[];
    weakTopics?: TopicScore[];
  };
  comments: Array<{ author: string; text: string; createdAt: string }>;
  accessCount: number;
}

// ====== Collaborative Study Room types ======

export interface StudyUser {
  id: string;
  nickname: string;
  avatar: string; // color hex
  joinedAt: string;
}

export interface RoomMember {
  userId: string;
  nickname: string;
  avatar: string;
  joinedAt: string;
  lastSeenAt: string;
  contributionCount: number;
}

export interface RoomSettings {
  maxParticipants: number;
  allowChat: boolean;
  lessonId?: string;
  courseCode?: string;
}

export interface StudyRoom {
  id: string;
  name: string;
  code: string; // 6-char code e.g. "MATH42"
  hostId: string;
  settings: RoomSettings;
  participants: StudyUser[];       // currently online
  members: RoomMember[];           // all-time members
  lessonId: string;                // required - every room is tied to a lesson
  lessonTitle: string;
  createdAt: string;
  // No expiresAt - rooms are permanent
}

// Workspace tool tabs
export type WorkspaceTool = "deep-dive" | "flashcards" | "mind-map" | "notes" | "quiz" | "sprint";

// ====== Shared Deep Dive (Group AI Chat) ======

export interface SharedDeepDiveState {
  messages: SharedChatMessage[];
  savedInsights: SharedInsight[];
}

export interface SharedChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  authorId: string;
  authorNickname: string;
  authorAvatar: string;
  timestamp: string;
  reactions: MessageReaction[];
  savedAsInsight: boolean;
}

export interface SharedInsight {
  id: string;
  text: string;
  sourceMessageId: string;
  savedBy: string;
  savedByNickname: string;
  tags: string[];
  timestamp: string;
}

export interface MessageReaction {
  userId: string;
  type: "helpful";
}

// ====== Shared Flashcard Builder ======

export interface SharedFlashcard {
  id: string;
  front: string;
  back: string;
  topicName: string;
  createdBy: string;
  createdByNickname: string;
  createdAt: string;
  editedBy?: string;
  editedByNickname?: string;
  editedAt?: string;
  votes: FlashcardVote[];
  source: "manual" | "ai-generated";
}

export interface FlashcardVote {
  userId: string;
  vote: "up" | "down";
}

// ====== Shared Mind Map ======

export interface MindMapAnnotation {
  id: string;
  nodeLabel: string;
  type: "note" | "question" | "example" | "understood";
  text: string;
  authorId: string;
  authorNickname: string;
  authorAvatar: string;
  timestamp: string;
  replies: AnnotationReply[];
}

export interface AnnotationReply {
  id: string;
  text: string;
  authorId: string;
  authorNickname: string;
  timestamp: string;
}

// ====== Shared Notes ======

export interface SharedNote {
  id: string;
  title: string;
  content: string;
  category: "concept" | "formula" | "example" | "tip" | "warning" | "summary";
  authorId: string;
  authorNickname: string;
  authorAvatar: string;
  createdAt: string;
  editedAt?: string;
  editedBy?: string;
  editedByNickname?: string;
  source?: "manual" | "deep-dive" | "mind-map";
  sourceId?: string;
  pinned: boolean;
}

// ====== Room Workspace (all collaborative tool data) ======

export interface RoomWorkspace {
  deepDive: SharedDeepDiveState;
  flashcards: SharedFlashcard[];
  mindMapAnnotations: MindMapAnnotation[];
  notes: SharedNote[];
}

// ====== Chat ======

export type RoomChatMessageType = "text" | "system" | "activity";

export interface RoomChatMessage {
  id: string;
  type: RoomChatMessageType;
  author: string;
  authorId: string;
  text: string;
  time: string;
}

// ====== Legacy activity types (kept for backward compat, unused by new workspace) ======

export type RoomActivityType = "quiz" | "flashcards" | "sprint";

export interface RoomActivity {
  type: RoomActivityType;
  startedAt: string;
  startedBy: string;
  data: CollabQuizState | CollabFlashcardState | CollabSprintState;
}

export interface CollabQuizAnswer {
  userId: string;
  nickname: string;
  answer: string;
  correct: boolean;
  answeredAt: string;
}

export interface CollabQuizState {
  questions: Array<{
    id: string;
    type: "why" | "tf";
    prompt: string;
    expected_keywords?: string[];
    expected_tf?: boolean;
  }>;
  currentQuestionIndex: number;
  answers: Record<string, CollabQuizAnswer[]>;
  phase: "waiting" | "answering" | "reviewing" | "finished";
  scores: Record<string, number>;
  hostId: string;
}

export interface CollabFlashcardState {
  cards: Array<{ id: string; front: string; back: string }>;
  currentCardIndex: number;
  isFlipped: boolean;
  mode: "round-robin" | "free-for-all";
  currentTurnUserId: string | null;
  turnOrder: string[];
  phase: "active" | "finished";
}

export interface CollabSprintState {
  phase: "studying" | "break" | "finished";
  studyDurationMin: number;
  breakDurationMin: number;
  startedAt: string;
  currentPhaseStartedAt: string;
  pomodorosCompleted: number;
  participantStatus: Record<string, { mode: string; lastUpdate: string }>;
}

