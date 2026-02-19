import { Router } from "express";
import { authController } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.get("/auth/me", requireAuth, authController.me);
router.post("/auth/change-password", requireAuth, authController.changePassword);
router.post("/auth/delete-account", requireAuth, authController.deleteAccount);

export default router;
