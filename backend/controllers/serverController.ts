import { Request, Response, NextFunction } from "express";
import { serverService, getServerTemplates } from "../services/serverService";

export const serverController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description, ownerId, iconColor, tags, university, isPublic, templateId } = req.body;
      const server = await serverService.create(name, description, ownerId, iconColor, {
        tags, university, isPublic, templateId,
      });
      res.status(201).json(server);
    } catch (err) { next(err); }
  },

  async discover(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string | undefined;
      const tag = req.query.tag as string | undefined;
      const tags = tag ? tag.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
      const servers = await serverService.discoverServers(search, tags);
      res.json(servers);
    } catch (err) { next(err); }
  },

  getTemplates(_req: Request, res: Response) {
    res.json(getServerTemplates());
  },

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serverService.getById(req.params.id);
      res.json(server);
    } catch (err) { next(err); }
  },

  async getByInviteCode(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serverService.getByInviteCode(req.params.code);
      res.json(server);
    } catch (err) { next(err); }
  },

  async getUserServers(req: Request, res: Response, next: NextFunction) {
    try {
      const servers = await serverService.getUserServers(req.params.userId);
      res.json(servers);
    } catch (err) { next(err); }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, ...updates } = req.body;
      const server = await serverService.update(req.params.id, userId, updates);
      res.json(server);
    } catch (err) { next(err); }
  },

  async join(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serverService.join(req.params.id, req.body.userId);
      res.json(server);
    } catch (err) { next(err); }
  },

  async joinByInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serverService.joinByInvite(req.body.inviteCode, req.body.userId);
      res.json(server);
    } catch (err) { next(err); }
  },

  async leave(req: Request, res: Response, next: NextFunction) {
    try {
      await serverService.leave(req.params.id, req.body.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async kick(req: Request, res: Response, next: NextFunction) {
    try {
      await serverService.kick(req.params.id, req.body.requesterId, req.body.targetId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await serverService.delete(req.params.id, req.body.userId);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async addCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const server = await serverService.addCategory(req.params.id, req.body.userId, req.body.name);
      res.json(server);
    } catch (err) { next(err); }
  },

  async regenerateInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const code = await serverService.regenerateInvite(req.params.id, req.body.userId);
      res.json({ inviteCode: code });
    } catch (err) { next(err); }
  },

  async getMembers(req: Request, res: Response, next: NextFunction) {
    try {
      const members = await serverService.getMemberProfiles(req.params.id);
      res.json(members);
    } catch (err) { next(err); }
  },
};
