import { Router } from "express";
import {
  getSettings as getSprintSettings,
  updateSettings as updateSprintSettings,
  createSession as createSprintSession,
  updateSession as updateSprintSession,
  getSprintStats,
} from "../controllers/sprintController";
import { getLesson } from "../controllers/lessonControllers";
import { getWeaknessForLesson } from "../controllers/weaknessController";
import { getDueCards } from "../controllers/flashcardController";

const router = Router();

router.get("/sprint/settings", (_req, res) => {
  res.json({ ok: true, settings: getSprintSettings() });
});

router.put("/sprint/settings", (req, res) => {
  const settings = updateSprintSettings(req.body);
  res.json({ ok: true, settings });
});

router.post("/sprint/sessions", (req, res) => {
  const { lessonId } = req.body as { lessonId?: string };
  const session = createSprintSession(lessonId);
  res.json({ ok: true, session });
});

router.patch("/sprint/sessions/:id", (req, res) => {
  const session = updateSprintSession(req.params.id, req.body);
  if (!session) return res.status(404).json({ ok: false, error: "Session not found" });
  res.json({ ok: true, session });
});

router.get("/sprint/stats", (_req, res) => {
  res.json({ ok: true, ...getSprintStats() });
});

router.get("/sprint/focus/:lessonId", async (req, res) => {
  try {
    const lessonId = req.params.lessonId;
    const lesson = getLesson(lessonId);
    if (!lesson) return res.status(404).json({ ok: false, error: "Lesson not found" });

    const weakness = getWeaknessForLesson(lessonId);
    const weakTopics = weakness?.topics?.filter((t) => t.isWeak) || [];
    const dueCards = getDueCards().filter((c) => c.lessonId === lessonId).slice(0, 5);
    const cheatHighlights = lesson.cheatSheet?.pitfalls?.slice(0, 3) || [];
    const emphases = (lesson.plan?.emphases || lesson.professorEmphases || []).slice(0, 5);

    res.json({
      ok: true,
      focus: {
        weakTopics: weakTopics.map((t) => t.topicName),
        dueFlashcards: dueCards.length,
        cheatHighlights,
        emphases: emphases.map((e: any) => e.statement),
      },
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || "server error" });
  }
});

export default router;
