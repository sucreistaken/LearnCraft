import { Request, Response, NextFunction } from "express";
import { messageService } from "../services/messageService";

export const messageController = {
  async send(req: Request, res: Response, next: NextFunction) {
    try {
      const { authorId, content, type, embeds, threadId } = req.body;
      const { channelId } = req.params;
      const serverId = req.params.serverId || req.body.serverId;
      const message = await messageService.send(channelId, serverId, authorId, content, type, embeds, threadId);
      res.status(201).json(message);
    } catch (err) { next(err); }
  },

  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string | undefined;
      const messages = await messageService.getMessages(req.params.channelId, limit, before);
      res.json(messages);
    } catch (err) { next(err); }
  },

  async getThread(req: Request, res: Response, next: NextFunction) {
    try {
      const messages = await messageService.getThread(req.params.channelId, req.params.threadId);
      res.json(messages);
    } catch (err) { next(err); }
  },

  async edit(req: Request, res: Response, next: NextFunction) {
    try {
      const message = await messageService.edit(
        req.params.channelId, req.params.messageId, req.body.userId, req.body.content
      );
      res.json(message);
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await messageService.delete(
        req.params.channelId, req.params.messageId, req.body.userId, req.body.isAdmin
      );
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async react(req: Request, res: Response, next: NextFunction) {
    try {
      const message = await messageService.react(
        req.params.channelId, req.params.messageId, req.body.emoji, req.body.userId
      );
      res.json(message);
    } catch (err) { next(err); }
  },

  async pin(req: Request, res: Response, next: NextFunction) {
    try {
      const message = await messageService.pin(
        req.params.channelId, req.body.serverId, req.params.messageId
      );
      res.json(message);
    } catch (err) { next(err); }
  },

  // --- Lobby ---
  async getLobbyMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const before = req.query.before as string | undefined;
      const messages = await messageService.getMessages("global-lobby", limit, before);
      res.json(messages);
    } catch (err) { next(err); }
  },

  async sendLobbyMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const { authorId, content } = req.body;
      const message = await messageService.sendLobby("global-lobby", authorId, content);
      res.status(201).json(message);
    } catch (err) { next(err); }
  },
};
