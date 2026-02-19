import { Router } from "express";

import lessonRoutes from "./lessonRoutes";
import uploadRoutes from "./uploadRoutes";
import quizRoutes from "./quizRoutes";
import weaknessRoutes from "./weaknessRoutes";
import flashcardRoutes from "./flashcardRoutes";
import sprintRoutes from "./sprintRoutes";
import connectionRoutes from "./connectionRoutes";
import shareRoutes from "./shareRoutes";
import roomRoutes from "./roomRoutes";
import courseRoutes from "./courseRoutes";
import schedulerRoutes from "./schedulerRoutes";
import notificationRoutes from "./notificationRoutes";
import collabRoutes from "./collabRoutes";
import authRoutes from "./authRoutes";
import roomRoutes2 from "./roomRoutes2";

const router = Router();

// Health check
router.get("/health", (_req, res) => res.json({ ok: true }));

// Auth
router.use("/api", authRoutes);

// Core lesson & AI routes
router.use("/api", lessonRoutes);

// Upload (transcribe, slides)
router.use("/api", uploadRoutes);

// Quiz
router.use("/api", quizRoutes);

// Weakness tracker
router.use("/api", weaknessRoutes);

// Flashcards
router.use("/api", flashcardRoutes);

// Sprint / Pomodoro
router.use("/api", sprintRoutes);

// Cross-lesson connections
router.use("/api", connectionRoutes);

// Share
router.use("/api", shareRoutes);

// Legacy rooms
router.use("/api", roomRoutes);

// Courses
router.use("/api", courseRoutes);

// Scheduler
router.use("/api", schedulerRoutes);

// Notifications
router.use("/api", notificationRoutes);

// Collaboration V2 (Discord-style)
router.use("/api/collab", collabRoutes);

// Rooms V2 (Discord-style, /api/rooms/*)
router.use("/api", roomRoutes2);

export default router;
