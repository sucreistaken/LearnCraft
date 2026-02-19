import { Router } from "express";
import {
  generateFlashcardsForLesson,
  reviewCard,
  getDueCards,
  getFlashcards,
  getFlashcardStats,
  deleteFlashcard,
  createCard,
  loadFlashcards,
  saveFlashcards,
} from "../controllers/flashcardController";

const router = Router();

router.post("/flashcards/generate/:lessonId", (req, res) => {
  const cards = generateFlashcardsForLesson(req.params.lessonId);
  res.json({ ok: true, generated: cards.length, cards });
});

router.get("/flashcards/due", (_req, res) => {
  const cards = getDueCards();
  res.json({ ok: true, cards });
});

router.post("/flashcards/:cardId/review", (req, res) => {
  const { quality } = req.body as { quality: number };
  if (typeof quality !== "number" || quality < 0 || quality > 5) {
    return res.status(400).json({ ok: false, error: "quality must be 0-5" });
  }
  const result = reviewCard(req.params.cardId, quality);
  if (!result) return res.status(404).json({ ok: false, error: "Card not found" });
  res.json({ ok: true, ...result });
});

router.get("/flashcards/stats", (_req, res) => {
  res.json({ ok: true, ...getFlashcardStats() });
});

router.get("/flashcards", (req, res) => {
  const lessonId = req.query.lessonId as string | undefined;
  const cards = getFlashcards(lessonId);
  res.json({ ok: true, cards });
});

router.delete("/flashcards/:cardId", (req, res) => {
  const ok = deleteFlashcard(req.params.cardId);
  if (!ok) return res.status(404).json({ ok: false, error: "Card not found" });
  res.json({ ok: true });
});

router.post("/flashcards", (req, res) => {
  const { lessonId, front, back, topicName } = req.body as {
    lessonId: string; front: string; back: string; topicName?: string;
  };
  if (!lessonId || !front || !back) {
    return res.status(400).json({ ok: false, error: "lessonId, front, back required" });
  }
  const cards = loadFlashcards();
  const card = createCard(lessonId, topicName || "", front, back, "ai-generated");
  cards.push(card);
  saveFlashcards(cards);
  res.json({ ok: true, card });
});

export default router;
