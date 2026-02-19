import { Request, Response, NextFunction } from "express";
import { channelService } from "../services/channelService";

export const channelController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, categoryId, name, type, toolType, lessonId, lessonTitle } = req.body;
      const channel = await channelService.createForServer(
        req.params.serverId, userId, categoryId, name, type, toolType, lessonId, lessonTitle
      );
      res.status(201).json(channel);
    } catch (err) { next(err); }
  },

  async getByServer(req: Request, res: Response, next: NextFunction) {
    try {
      const channels = await channelService.getByServer(req.params.serverId);
      res.json(channels);
    } catch (err) { next(err); }
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const channel = await channelService.getById(req.params.serverId, req.params.channelId);
      res.json(channel);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, ...updates } = req.body;
      const channel = await channelService.update(
        req.params.serverId, req.params.channelId, userId, updates
      );
      res.json(channel);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await channelService.delete(req.params.serverId, req.params.channelId, req.body.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },
};
