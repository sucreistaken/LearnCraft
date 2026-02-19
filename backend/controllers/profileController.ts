import { Request, Response, NextFunction } from "express";
import { profileService } from "../services/profileService";

export const profileController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { nickname, avatar } = req.body;
      const profile = await profileService.create(nickname, avatar);
      res.status(201).json(profile);
    } catch (err) { next(err); }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await profileService.getById(req.params.id);
      res.json(profile);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await profileService.update(req.params.id, req.body);
      res.json(profile);
    } catch (err) { next(err); }
  },

  async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const profile = await profileService.setStatus(req.params.id, req.body.status);
      res.json(profile);
    } catch (err) { next(err); }
  },

  async sendFriendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await profileService.sendFriendRequest(req.params.id, req.body.friendCode);
      res.json(result);
    } catch (err) { next(err); }
  },

  async acceptFriendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await profileService.acceptFriendRequest(req.params.id, req.body.fromId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async rejectFriendRequest(req: Request, res: Response, next: NextFunction) {
    try {
      await profileService.rejectFriendRequest(req.params.id, req.body.fromId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async removeFriend(req: Request, res: Response, next: NextFunction) {
    try {
      await profileService.removeFriend(req.params.id, req.params.friendId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async getFriends(req: Request, res: Response, next: NextFunction) {
    try {
      const friends = await profileService.getFriends(req.params.id);
      res.json(friends);
    } catch (err) { next(err); }
  },
};
