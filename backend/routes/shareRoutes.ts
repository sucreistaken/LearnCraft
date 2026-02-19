import { Router } from "express";
import {
  createShare,
  getShare,
  addComment,
  listShares,
  deleteShare,
} from "../controllers/shareController";
import { upsertLesson } from "../controllers/lessonControllers";

const router = Router();

router.post("/shares", (req, res) => {
  const { lessonId, createdBy } = req.body as { lessonId: string; createdBy?: string };
  if (!lessonId) return res.status(400).json({ ok: false, error: "lessonId is required" });
  const share = createShare(lessonId, createdBy);
  if (!share) return res.status(404).json({ ok: false, error: "Lesson not found" });
  res.json({ ok: true, share });
});

router.get("/shares/:shareId", (req, res) => {
  const share = getShare(req.params.shareId);
  if (!share) return res.status(404).json({ ok: false, error: "Share not found or expired" });
  res.json({ ok: true, share });
});

router.post("/shares/:shareId/comments", (req, res) => {
  const { author, text } = req.body as { author: string; text: string };
  if (!text) return res.status(400).json({ ok: false, error: "text is required" });
  const share = addComment(req.params.shareId, author, text);
  if (!share) return res.status(404).json({ ok: false, error: "Share not found" });
  res.json({ ok: true, share });
});

router.get("/shares", (_req, res) => {
  const shares = listShares();
  res.json({ ok: true, shares });
});

router.delete("/shares/:shareId", (req, res) => {
  const ok = deleteShare(req.params.shareId);
  if (!ok) return res.status(404).json({ ok: false, error: "Share not found" });
  res.json({ ok: true });
});

router.post("/shares/:shareId/import", (req, res) => {
  const share = getShare(req.params.shareId);
  if (!share) return res.status(404).json({ ok: false, error: "Share not found" });
  const newLesson = upsertLesson({
    title: `[Imported] ${share.bundle.title}`,
    plan: share.bundle.plan,
    cheatSheet: share.bundle.cheatSheet,
    professorEmphases: share.bundle.emphases,
  } as any);
  res.json({ ok: true, lessonId: newLesson.id, lesson: newLesson });
});

export default router;
