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
  | "lecturer-note"
  | "quiz"
  | "deep-dive"
  | "exam-sprint"
  | "history"
  | "lo-study"
  | "cheat-sheet";

export type CheatSheet = {
  title: string;
  updatedAt: string;
  sections: Array<{ heading: string; bullets: string[] }>;
  formulas?: string[];
  pitfalls?: string[];
  quickQuiz?: Array<{ q: string; a: string }>;
};
        // 🔹 yeni mod

  