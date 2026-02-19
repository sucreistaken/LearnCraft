import { Router } from "express";
import {
  generateQuizFromEmphases,
  getQuizPack,
  scoreQuizPack,
} from "../controllers/quizController";
import { attachQuizPack, setQuizScore } from "../controllers/lessonControllers";
import { QuizPackT, isQuizPack } from "../types";

const router = Router();

router.post("/quiz/generate", (req, res) => {
  const { count, lessonIds, lessonId } = req.body as {
    count?: number;
    lessonIds?: string[];
    lessonId?: string;
  };
  const pack = generateQuizFromEmphases(count ?? 5, lessonIds);
  if (!isQuizPack(pack)) return res.status(400).json(pack);
  if (lessonId) attachQuizPack(lessonId, pack.id);
  return res.json(pack);
});

router.get("/quiz/:packId", (req, res) => {
  const pack = getQuizPack(req.params.packId);
  if (!pack) return res.status(404).json({ error: "Not found" });
  res.json(pack);
});

router.post("/quiz/:packId/submit", (req, res) => {
  const { answers, lessonId } = req.body as {
    answers: Array<{ id: string; answer: string | boolean }>;
    lessonId?: string;
  };
  const result = scoreQuizPack(req.params.packId, answers || []);
  if (lessonId && typeof result?.score === "number")
    setQuizScore(lessonId, req.params.packId, result.score);
  res.json(result);
});

export default router;
