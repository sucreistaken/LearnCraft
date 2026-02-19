import { Router } from "express";
import { profileController } from "../controllers/profileController";
import { serverController } from "../controllers/serverController";
import { channelController } from "../controllers/channelController";
import { messageController as msgController } from "../controllers/messageController";
import { channelToolController } from "../controllers/channelToolController";
import { exportController } from "../controllers/exportController";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

// --- Profiles ---
router.post("/profiles", profileController.create);
router.get("/profiles/:id", profileController.get);
router.patch("/profiles/:id", profileController.update);
router.patch("/profiles/:id/status", profileController.setStatus);
router.post("/profiles/:id/friend-request", profileController.sendFriendRequest);
router.post("/profiles/:id/friend-accept", profileController.acceptFriendRequest);
router.post("/profiles/:id/friend-reject", profileController.rejectFriendRequest);
router.delete("/profiles/:id/friends/:friendId", profileController.removeFriend);
router.get("/profiles/:id/friends", profileController.getFriends);

// --- Servers ---
router.post("/servers", serverController.create);
router.get("/servers/discover", serverController.discover);
router.get("/servers/templates", serverController.getTemplates);
router.get("/servers/invite/:code", serverController.getByInviteCode);
router.get("/servers/user/:userId", serverController.getUserServers);
router.post("/servers/join-invite", serverController.joinByInvite);

router.get("/servers/:id", serverController.get);
router.patch("/servers/:id", serverController.update);
router.post("/servers/:id/join", serverController.join);
router.post("/servers/:id/leave", serverController.leave);
router.post("/servers/:id/kick", serverController.kick);
router.delete("/servers/:id", serverController.delete);
router.post("/servers/:id/categories", serverController.addCategory);
router.post("/servers/:id/regenerate-invite", serverController.regenerateInvite);
router.get("/servers/:id/members", serverController.getMembers);

// --- Channels ---
router.post("/servers/:serverId/channels", channelController.create);
router.get("/servers/:serverId/channels", channelController.getByServer);
router.get("/servers/:serverId/channels/:channelId", channelController.get);
router.patch("/servers/:serverId/channels/:channelId", channelController.update);
router.delete("/servers/:serverId/channels/:channelId", channelController.delete);

// --- Lobby ---
router.get("/lobby/messages", msgController.getLobbyMessages);
router.post("/lobby/messages", rateLimiter("lobby", 20, 60000), msgController.sendLobbyMessage);

// --- Messages ---
router.post("/channels/:channelId/messages", rateLimiter("messages", 30, 60000), msgController.send);
router.get("/channels/:channelId/messages", msgController.getMessages);
router.get("/channels/:channelId/threads/:threadId", msgController.getThread);
router.patch("/channels/:channelId/messages/:messageId", msgController.edit);
router.delete("/channels/:channelId/messages/:messageId", msgController.delete);
router.post("/channels/:channelId/messages/:messageId/react", msgController.react);
router.post("/channels/:channelId/messages/:messageId/pin", msgController.pin);

// --- Lessons (for material linking) ---
router.get("/lessons", channelToolController.getLessons);

// --- Channel Lesson Linking ---
router.post("/channels/:channelId/link-lesson", channelToolController.linkLesson);
router.delete("/channels/:channelId/link-lesson", channelToolController.unlinkLesson);
router.get("/channels/:channelId/lesson-context", channelToolController.getLessonContext);
router.get("/channels/:channelId/lesson-detail", channelToolController.getLessonDetail);

// --- Channel Tools ---
router.get("/channels/:channelId/tool-data", channelToolController.getToolData);
router.post("/channels/:channelId/tool/quiz/generate", channelToolController.generateQuiz);
router.post("/channels/:channelId/tool/quiz/answer", channelToolController.answerQuiz);
router.post("/channels/:channelId/tool/flashcards/add", channelToolController.addFlashcard);
router.post("/channels/:channelId/tool/flashcards/generate", channelToolController.generateFlashcards);
router.post("/channels/:channelId/tool/flashcards/extract", channelToolController.extractFlashcards);
router.post("/channels/:channelId/tool/flashcards/review", channelToolController.reviewFlashcard);
router.post("/channels/:channelId/tool/deep-dive/chat", channelToolController.deepDiveChat);
router.post("/channels/:channelId/tool/mind-map/generate", channelToolController.generateMindMap);
router.post("/channels/:channelId/tool/sprint/start", channelToolController.startSprint);
router.post("/channels/:channelId/tool/sprint/status", channelToolController.updateSprintStatus);
router.post("/channels/:channelId/tool/notes/add", channelToolController.addNote);
router.patch("/channels/:channelId/tool/notes/:noteId", channelToolController.editNote);
router.delete("/channels/:channelId/tool/notes/:noteId", channelToolController.deleteNote);
router.post("/channels/:channelId/tool/notes/:noteId/pin", channelToolController.pinNote);

// --- Lock ---
router.post("/channels/:channelId/tool/lock", channelToolController.lockTool);
router.post("/channels/:channelId/tool/unlock", channelToolController.unlockTool);

// --- Export ---
router.get("/channels/:channelId/export/quiz", exportController.exportQuiz);
router.get("/channels/:channelId/export/flashcards", exportController.exportFlashcards);
router.get("/channels/:channelId/export/notes", exportController.exportNotes);
router.get("/channels/:channelId/export/mind-map", exportController.exportMindMap);
router.get("/channels/:channelId/export/all", exportController.exportAll);

export default router;
