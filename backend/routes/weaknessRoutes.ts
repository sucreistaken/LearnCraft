import { Router } from "express";
import {
  analyzeLessonWeakness,
  analyzeAllWeaknesses,
  getWeaknessForLesson,
  getGlobalWeaknessSummary,
} from "../controllers/weaknessController";

const router = Router();

router.get("/weakness", (_req, res) => {
  res.json({ ok: true, ...getGlobalWeaknessSummary() });
});

router.get("/weakness/:lessonId", (req, res) => {
  const analysis = getWeaknessForLesson(req.params.lessonId);
  if (!analysis) return res.status(404).json({ ok: false, error: "No analysis found" });
  res.json({ ok: true, analysis });
});

router.post("/weakness/analyze", (_req, res) => {
  const analyses = analyzeAllWeaknesses();
  res.json({ ok: true, analyses, summary: getGlobalWeaknessSummary() });
});

router.post("/weakness/:lessonId/analyze", (req, res) => {
  const analysis = analyzeLessonWeakness(req.params.lessonId);
  if (!analysis) return res.status(404).json({ ok: false, error: "Lesson not found" });
  res.json({ ok: true, analysis });
});

export default router;
