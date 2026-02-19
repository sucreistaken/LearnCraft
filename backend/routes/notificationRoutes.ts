import { Router } from "express";
import {
  listNotifications,
  dismissNotification,
  getUnreadCount,
  checkAndGenerateNotifications,
} from "../controllers/notificationController";

const router = Router();

router.get("/notifications", (req, res) => {
  const unread = req.query.unread === "true";
  const notifications = listNotifications(unread);
  res.json({ ok: true, notifications });
});

router.post("/notifications/:id/dismiss", (req, res) => {
  const notif = dismissNotification(req.params.id);
  if (!notif) return res.status(404).json({ ok: false, error: "Notification not found" });
  res.json({ ok: true, notification: notif });
});

router.get("/notifications/unread-count", (_req, res) => {
  const count = getUnreadCount();
  res.json({ ok: true, count });
});

router.post("/notifications/check", (req, res) => {
  const newNotifications = checkAndGenerateNotifications();
  const count = getUnreadCount();

  const io = req.app.get("io");
  if (io) {
    for (const notif of newNotifications) {
      io.emit("notification:new", notif);
    }
    io.emit("notification:badge-update", { count });
  }

  res.json({ ok: true, newNotifications, count });
});

export default router;
