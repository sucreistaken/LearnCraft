import { Request, Response } from "express";
import { authService } from "../services/authService";
import { AuthRequest } from "../middleware/auth";

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { email, password, nickname } = req.body;
      if (!email || !password || !nickname) {
        res.status(400).json({ error: "email, password, and nickname are required" });
        return;
      }
      const result = await authService.register(email, password, nickname);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ error: "email and password are required" });
        return;
      }
      const result = await authService.login(email, password);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async me(req: AuthRequest, res: Response) {
    try {
      const user = await authService.getUser(req.user!.userId);
      res.json({ user });
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: "currentPassword and newPassword are required" });
        return;
      }
      const result = await authService.changePassword(req.user!.userId, currentPassword, newPassword);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },

  async deleteAccount(req: AuthRequest, res: Response) {
    try {
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ error: "password is required" });
        return;
      }
      const result = await authService.deleteAccount(req.user!.userId, password);
      res.json(result);
    } catch (err: any) {
      res.status(err.status || 500).json({ error: err.message });
    }
  },
};
