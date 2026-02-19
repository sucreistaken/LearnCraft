import { Router } from "express";
import {
  getNextSession,
  getDailyPlan,
  getWeeklyOverview,
  completeTask as completeSchedulerTask,
  getStreak,
} from "../controllers/schedulerController";

const router = Router();

router.get("/scheduler/next-session", (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const result = getNextSession(courseId || undefined);
  res.json({ ok: true, ...result });
});

router.get("/scheduler/daily", (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const plan = getDailyPlan(courseId || undefined);
  res.json({ ok: true, plan });
});

router.get("/scheduler/weekly", (req, res) => {
  const courseId = req.query.courseId as string | undefined;
  const overview = getWeeklyOverview(courseId || undefined);
  res.json({ ok: true, overview });
});

router.post("/scheduler/complete-task", (req, res) => {
  const { taskId } = req.body;
  if (!taskId) return res.status(400).json({ ok: false, error: "taskId required" });
  const result = completeSchedulerTask(taskId);
  res.json(result);
});

router.get("/scheduler/streak", (_req, res) => {
  const streak = getStreak();
  res.json({ ok: true, streak });
});

export default router;
