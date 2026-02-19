import { Request, Response, NextFunction } from "express";
import { roomService, getRoomTemplates } from "../services/roomService";

export const roomController2 = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, ownerId, iconColor, tags, university, isPublic, templateId } = req.body;
      const room = await roomService.create(name, description, ownerId, iconColor, {
        tags, university, isPublic, templateId,
      });
      res.status(201).json(room);
    } catch (err) { next(err); }
  },

  async createSolo(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, ownerId, topic, templateId, tags } = req.body;
      const room = await roomService.createSolo(name, ownerId, { topic, templateId, tags });
      res.status(201).json(room);
    } catch (err) { next(err); }
  },

  async discover(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const tag = req.query.tag as string | undefined;
      const tags = tag ? tag.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
      const rooms = await roomService.discoverServers(search, tags);
      res.json(rooms);
    } catch (err) { next(err); }
  },

  getTemplates(_req: Request, res: Response) {
    res.json(getRoomTemplates());
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.getById(req.params.id);
      res.json(room);
    } catch (err) { next(err); }
  },

  async getByInviteCode(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.getByInviteCode(req.params.code);
      res.json(room);
    } catch (err) { next(err); }
  },

  async getUserRooms(req: Request, res: Response, next: NextFunction) {
    try {
      const rooms = await roomService.getUserServers(req.params.userId);
      res.json(rooms);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, ...updates } = req.body;
      const room = await roomService.update(req.params.id, userId, updates);
      res.json(room);
    } catch (err) { next(err); }
  },

  async updateTopic(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.updateTopic(req.params.id, req.body.userId, req.body.topic);
      res.json(room);
    } catch (err) { next(err); }
  },

  async join(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.join(req.params.id, req.body.userId);
      res.json(room);
    } catch (err) { next(err); }
  },

  async joinByInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.joinByInvite(req.body.inviteCode, req.body.userId);
      res.json(room);
    } catch (err) { next(err); }
  },

  async leave(req: Request, res: Response, next: NextFunction) {
    try {
      await roomService.leave(req.params.id, req.body.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async kick(req: Request, res: Response, next: NextFunction) {
    try {
      await roomService.kick(req.params.id, req.body.requesterId, req.body.targetId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await roomService.delete(req.params.id, req.body.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.archive(req.params.id, req.body.userId);
      res.json(room);
    } catch (err) { next(err); }
  },

  async unarchive(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.unarchive(req.params.id, req.body.userId);
      res.json(room);
    } catch (err) { next(err); }
  },

  async transferOwnership(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.transferOwnership(req.params.id, req.body.currentOwnerId, req.body.newOwnerId);
      res.json(room);
    } catch (err) { next(err); }
  },

  async setMaterial(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.setMaterial(req.params.id, req.body.userId, req.body.materialId);
      res.json(room);
    } catch (err) { next(err); }
  },

  async addCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const room = await roomService.addCategory(req.params.id, req.body.userId, req.body.name);
      res.json(room);
    } catch (err) { next(err); }
  },

  async regenerateInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const code = await roomService.regenerateInvite(req.params.id, req.body.userId);
      res.json({ inviteCode: code });
    } catch (err) { next(err); }
  },

  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await roomService.getMemberProfiles(req.params.id);
      res.json(members);
    } catch (err) { next(err); }
  },
};
