// controllers/flashcardController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";
import { getLesson, listLessons } from "./lessonControllers";

export type Flashcard = {
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
};

export type ReviewEntry = {
  cardId: string;
  reviewedAt: string;
  quality: number;
  previousInterval: number;
  newInterval: number;
};

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const FLASHCARDS_PATH = path.join(DATA_DIR, "flashcards.json");

ensureDataFiles([{ path: FLASHCARDS_PATH, initial: [] }]);

const rid = () => `fc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function loadFlashcards(): Flashcard[] {
  return readJSON<Flashcard[]>(FLASHCARDS_PATH) || [];
}

export function saveFlashcards(cards: Flashcard[]) {
  writeJSON(FLASHCARDS_PATH, cards);
}

export function createCard(
  lessonId: string,
  topicName: string,
  front: string,
  back: string,
  source: Flashcard["source"]
): Flashcard {
  return {
    id: rid(),
    lessonId,
    topicName,
    front,
    back,
    source,
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    nextReviewDate: new Date().toISOString(),
    state: "new",
    createdAt: new Date().toISOString(),
  };
}

// Generate flashcards from lesson content
export function generateFlashcardsForLesson(lessonId: string): Flashcard[] {
  const lesson = getLesson(lessonId);
  if (!lesson) return [];

  const existing = loadFlashcards();
  const existingForLesson = existing.filter((c) => c.lessonId === lessonId);

  // Avoid duplicates by checking front text
  const existingFronts = new Set(existingForLesson.map((c) => c.front));
  const newCards: Flashcard[] = [];

  // 1. From emphases
  const emphases = lesson.plan?.emphases || lesson.professorEmphases || [];
  for (const e of emphases) {
    const front = e.statement;
    if (front && !existingFronts.has(front)) {
      newCards.push(
        createCard(
          lessonId,
          e.statement.slice(0, 40),
          front,
          `Why: ${e.why || "Important concept"}\nEvidence: ${e.evidence || "Professor emphasis"}`,
          "emphasis"
        )
      );
      existingFronts.add(front);
    }
  }

  // 2. From cheat sheet quickQuiz
  if (lesson.cheatSheet?.quickQuiz) {
    for (const qa of lesson.cheatSheet.quickQuiz) {
      if (qa.q && !existingFronts.has(qa.q)) {
        newCards.push(createCard(lessonId, "Cheat Sheet", qa.q, qa.a, "cheatsheet"));
        existingFronts.add(qa.q);
      }
    }
  }

  // 3. From LO modules miniQuiz
  if (lesson.loModules?.modules) {
    for (const mod of lesson.loModules.modules) {
      if (mod.miniQuiz) {
        for (const mq of mod.miniQuiz) {
          if (mq.question && !existingFronts.has(mq.question)) {
            newCards.push(
              createCard(
                lessonId,
                mod.loTitle || mod.loId,
                mq.question,
                `${mq.answer}\n\nWhy: ${mq.why}`,
                "miniQuiz"
              )
            );
            existingFronts.add(mq.question);
          }
        }
      }

      // 4. From mustRemember (fill-in-the-blank style)
      if (mod.mustRemember) {
        for (const fact of mod.mustRemember) {
          if (fact && !existingFronts.has(fact)) {
            const words = fact.split(" ");
            if (words.length > 3) {
              const blankIdx = Math.floor(words.length / 2);
              const blanked = [...words];
              const answer = blanked[blankIdx];
              blanked[blankIdx] = "______";
              newCards.push(
                createCard(
                  lessonId,
                  mod.loTitle || mod.loId,
                  `Fill in the blank: ${blanked.join(" ")}`,
                  answer,
                  "loModule"
                )
              );
            } else {
              newCards.push(
                createCard(lessonId, mod.loTitle || mod.loId, `What is: ${fact}?`, fact, "loModule")
              );
            }
            existingFronts.add(fact);
          }
        }
      }
    }
  }

  // Save all new cards
  if (newCards.length > 0) {
    const all = [...existing, ...newCards];
    saveFlashcards(all);
  }

  return newCards;
}

// SM-2 Algorithm implementation
export function reviewCard(
  cardId: string,
  quality: number // 0-5
): { card: Flashcard; reviewEntry: ReviewEntry } | null {
  const cards = loadFlashcards();
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;

  const card = cards[idx];
  const previousInterval = card.interval;

  // SM-2 algorithm
  if (quality >= 3) {
    // Successful review
    card.repetitions += 1;
    if (card.repetitions === 1) {
      card.interval = 1;
    } else if (card.repetitions === 2) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }
    card.state = card.repetitions >= 5 ? "graduated" : "review";
  } else {
    // Failed review
    card.repetitions = 0;
    card.interval = 1;
    card.state = "learning";
  }

  // Update ease factor
  card.easeFactor = Math.max(
    1.3,
    card.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate next review date
  const now = new Date();
  const nextDate = new Date(now.getTime() + card.interval * 24 * 60 * 60 * 1000);
  card.nextReviewDate = nextDate.toISOString();
  card.lastReviewedAt = now.toISOString();

  cards[idx] = card;
  saveFlashcards(cards);

  const reviewEntry: ReviewEntry = {
    cardId,
    reviewedAt: now.toISOString(),
    quality,
    previousInterval,
    newInterval: card.interval,
  };

  return { card, reviewEntry };
}

// Get due cards (nextReviewDate <= now)
export function getDueCards(): Flashcard[] {
  const cards = loadFlashcards();
  const now = new Date().toISOString();
  return cards
    .filter((c) => c.state !== "graduated" && c.nextReviewDate <= now)
    .sort((a, b) => a.nextReviewDate.localeCompare(b.nextReviewDate));
}

// Get all cards, optionally filtered by lessonId
export function getFlashcards(lessonId?: string): Flashcard[] {
  const cards = loadFlashcards();
  if (lessonId) return cards.filter((c) => c.lessonId === lessonId);
  return cards;
}

// Get stats
export function getFlashcardStats(): {
  total: number;
  new: number;
  learning: number;
  review: number;
  graduated: number;
  dueToday: number;
} {
  const cards = loadFlashcards();
  const now = new Date().toISOString();
  return {
    total: cards.length,
    new: cards.filter((c) => c.state === "new").length,
    learning: cards.filter((c) => c.state === "learning").length,
    review: cards.filter((c) => c.state === "review").length,
    graduated: cards.filter((c) => c.state === "graduated").length,
    dueToday: cards.filter((c) => c.state !== "graduated" && c.nextReviewDate <= now).length,
  };
}

// Delete a card
export function deleteFlashcard(cardId: string): boolean {
  const cards = loadFlashcards();
  const idx = cards.findIndex((c) => c.id === cardId);
  if (idx < 0) return false;
  cards.splice(idx, 1);
  saveFlashcards(cards);
  return true;
}
