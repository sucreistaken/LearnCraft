import { Router } from "express";
import { roomController2 } from "../controllers/roomController2";

const router = Router();

// --- Rooms ---
router.post("/rooms", roomController2.create);
router.post("/rooms/solo", roomController2.createSolo);
router.get("/rooms/discover", roomController2.discover);
router.get("/rooms/templates", roomController2.getTemplates);
router.get("/rooms/invite/:code", roomController2.getByInviteCode);
router.get("/rooms/user/:userId", roomController2.getUserRooms);
router.post("/rooms/join-invite", roomController2.joinByInvite);

router.get("/rooms/:id", roomController2.get);
router.patch("/rooms/:id", roomController2.update);
router.patch("/rooms/:id/topic", roomController2.updateTopic);
router.post("/rooms/:id/join", roomController2.join);
router.post("/rooms/:id/leave", roomController2.leave);
router.post("/rooms/:id/kick", roomController2.kick);
router.delete("/rooms/:id", roomController2.delete);
router.post("/rooms/:id/archive", roomController2.archive);
router.post("/rooms/:id/unarchive", roomController2.unarchive);
router.post("/rooms/:id/transfer-ownership", roomController2.transferOwnership);
router.post("/rooms/:id/material", roomController2.setMaterial);
router.post("/rooms/:id/categories", roomController2.addCategory);
router.post("/rooms/:id/regenerate-invite", roomController2.regenerateInvite);
router.get("/rooms/:id/members", roomController2.getMembers);

export default router;
