import { serverService, getServerTemplates } from "./serverService";
import { serverRepo, StudyServer } from "../repositories/serverRepo";
import { profileRepo } from "../repositories/profileRepo";
import { channelService } from "./channelService";
import { badRequest, notFound, forbidden } from "../middleware/errorHandler";
import { eventBus } from "../events/eventBus";

export { getServerTemplates as getRoomTemplates };

export const roomService = {
  // ---- Delegate to serverService ----
  create: serverService.create.bind(serverService),
  discoverServers: serverService.discoverServers.bind(serverService),
  getById: serverService.getById.bind(serverService),
  getByInviteCode: serverService.getByInviteCode.bind(serverService),
  getUserServers: serverService.getUserServers.bind(serverService),
  update: serverService.update.bind(serverService),
  join: serverService.join.bind(serverService),
  joinByInvite: serverService.joinByInvite.bind(serverService),
  kick: serverService.kick.bind(serverService),
  delete: serverService.delete.bind(serverService),
  addCategory: serverService.addCategory.bind(serverService),
  regenerateInvite: serverService.regenerateInvite.bind(serverService),
  checkPermission: serverService.checkPermission.bind(serverService),
  getMemberProfiles: serverService.getMemberProfiles.bind(serverService),

  // ---- New: Topic + Description update ----
  async updateTopic(roomId: string, userId: string, topic: string): Promise<StudyServer> {
    const room = await serverService.getById(roomId);
    serverService.checkPermission(room, userId, "manage_server");
    const updated = await serverRepo.update(roomId, { description: topic.trim() } as Partial<StudyServer>);
    if (!updated) throw notFound("Room not found");
    return updated;
  },

  // ---- New: Material association ----
  async setMaterial(roomId: string, userId: string, materialId: string): Promise<StudyServer> {
    const room = await serverService.getById(roomId);
    serverService.checkPermission(room, userId, "manage_server");
    // Store materialId in server settings (extend the type)
    const settings = { ...room.settings, materialId };
    const updated = await serverRepo.update(roomId, { settings } as Partial<StudyServer>);
    if (!updated) throw notFound("Room not found");
    return updated;
  },

  // ---- New: Archive ----
  async archive(roomId: string, userId: string): Promise<StudyServer> {
    const room = await serverService.getById(roomId);
    if (room.ownerId !== userId) throw forbidden("Only the owner can archive the room");
    const updated = await serverRepo.update(roomId, {
      settings: { ...room.settings, archivedAt: new Date().toISOString() },
    } as Partial<StudyServer>);
    if (!updated) throw notFound("Room not found");
    return updated;
  },

  async unarchive(roomId: string, userId: string): Promise<StudyServer> {
    const room = await serverService.getById(roomId);
    if (room.ownerId !== userId) throw forbidden("Only the owner can unarchive the room");
    const settings = { ...room.settings };
    delete (settings as any).archivedAt;
    const updated = await serverRepo.update(roomId, { settings } as Partial<StudyServer>);
    if (!updated) throw notFound("Room not found");
    return updated;
  },

  // ---- New: Ownership transfer ----
  async transferOwnership(roomId: string, currentOwnerId: string, newOwnerId: string): Promise<StudyServer> {
    const room = await serverService.getById(roomId);
    if (room.ownerId !== currentOwnerId) throw forbidden("Only the owner can transfer ownership");
    if (!room.memberIds.includes(newOwnerId)) throw badRequest("New owner must be a member");

    // Transfer owner role
    const memberRoles = { ...room.memberRoles };
    memberRoles[currentOwnerId] = (memberRoles[currentOwnerId] || []).filter((r: string) => r !== "role-owner");
    memberRoles[currentOwnerId].push("role-admin");
    memberRoles[newOwnerId] = (memberRoles[newOwnerId] || []).filter((r: string) => r !== "role-member");
    memberRoles[newOwnerId].push("role-owner");

    const updated = await serverRepo.update(roomId, {
      ownerId: newOwnerId,
      memberRoles,
    } as Partial<StudyServer>);
    if (!updated) throw notFound("Room not found");
    return updated;
  },

  // ---- New: Leave with auto-transfer ----
  async leave(roomId: string, userId: string): Promise<void> {
    const room = await serverService.getById(roomId);
    if (!room.memberIds.includes(userId)) throw badRequest("Not a member");

    // If owner leaving, auto-transfer to oldest member
    if (room.ownerId === userId) {
      const otherMembers = room.memberIds.filter((id: string) => id !== userId);
      if (otherMembers.length > 0) {
        await this.transferOwnership(roomId, userId, otherMembers[0]);
      } else {
        // Last member leaving, delete the room
        await serverRepo.delete(roomId);
        return;
      }
    }

    await serverRepo.removeMember(roomId, userId);
    await profileRepo.removeServerFromProfile(userId, roomId);
    eventBus.emit("member:left", { serverId: roomId, userId });
  },

  // ---- New: Create solo room (no members required) ----
  async createSolo(
    name: string,
    ownerId: string,
    options?: { topic?: string; templateId?: string; tags?: string[] }
  ): Promise<StudyServer> {
    return serverService.create(name, options?.topic || "", ownerId, undefined, {
      tags: options?.tags,
      isPublic: false,
      templateId: options?.templateId,
    });
  },
};
