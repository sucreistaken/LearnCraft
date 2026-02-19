import { channelRepo, Channel } from "../repositories/channelRepo";
import { serverRepo } from "../repositories/serverRepo";
import { badRequest, notFound, forbidden } from "../middleware/errorHandler";

function generateId(): string {
  return `ch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const channelService = {
  async create(
    serverId: string,
    categoryId: string,
    name: string,
    type: Channel["type"],
    toolType?: Channel["toolType"],
    lessonId?: string,
    lessonTitle?: string
  ): Promise<Channel> {
    const channel: Channel = {
      id: generateId(),
      serverId,
      categoryId,
      name: name.trim().toLowerCase().replace(/\s+/g, "-"),
      type,
      ...(toolType && { toolType }),
      ...(lessonId && { lessonId }),
      ...(lessonTitle && { lessonTitle }),
      permissionOverrides: [],
      pinnedMessageIds: [],
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    return channelRepo.create(channel);
  },

  async createForServer(
    serverId: string,
    userId: string,
    categoryId: string,
    name: string,
    type: Channel["type"],
    toolType?: Channel["toolType"],
    lessonId?: string,
    lessonTitle?: string
  ): Promise<Channel> {
    const server = await serverRepo.findById(serverId);
    if (!server) throw notFound("Server not found");

    // Check permission
    if (server.ownerId !== userId) {
      const userRoleIds = server.memberRoles[userId] || [];
      const hasPermission = server.roles.some(
        (r) => userRoleIds.includes(r.id) && r.permissions.includes("manage_channels")
      );
      if (!hasPermission) throw forbidden("Missing permission: manage_channels");
    }

    // Validate category exists
    const cat = server.categories.find((c) => c.id === categoryId);
    if (!cat) throw notFound("Category not found");

    const channel = await this.create(serverId, categoryId, name, type, toolType, lessonId, lessonTitle);

    // Add channel to category
    cat.channelIds.push(channel.id);
    await serverRepo.update(serverId, { categories: server.categories } as any);

    return channel;
  },

  async getByServer(serverId: string): Promise<Channel[]> {
    return channelRepo.findAllByServer(serverId);
  },

  async getById(serverId: string, channelId: string): Promise<Channel> {
    const channel = await channelRepo.findById(serverId, channelId);
    if (!channel) throw notFound("Channel not found");
    return channel;
  },

  async getByIdGlobal(channelId: string): Promise<Channel> {
    const channel = await channelRepo.findByIdGlobal(channelId);
    if (!channel) throw notFound("Channel not found");
    return channel;
  },

  async update(serverId: string, channelId: string, userId: string, updates: Partial<Pick<Channel, "name" | "lessonId" | "lessonTitle">>): Promise<Channel> {
    const server = await serverRepo.findById(serverId);
    if (!server) throw notFound("Server not found");

    // Check permission
    if (server.ownerId !== userId) {
      const userRoleIds = server.memberRoles[userId] || [];
      const hasPermission = server.roles.some(
        (r) => userRoleIds.includes(r.id) && r.permissions.includes("manage_channels")
      );
      if (!hasPermission) throw forbidden("Missing permission: manage_channels");
    }

    if (updates.name) {
      updates.name = updates.name.trim().toLowerCase().replace(/\s+/g, "-");
    }

    const updated = await channelRepo.update(serverId, channelId, updates);
    if (!updated) throw notFound("Channel not found");
    return updated;
  },

  async delete(serverId: string, channelId: string, userId: string): Promise<void> {
    const server = await serverRepo.findById(serverId);
    if (!server) throw notFound("Server not found");

    if (server.ownerId !== userId) {
      const userRoleIds = server.memberRoles[userId] || [];
      const hasPermission = server.roles.some(
        (r) => userRoleIds.includes(r.id) && r.permissions.includes("manage_channels")
      );
      if (!hasPermission) throw forbidden("Missing permission: manage_channels");
    }

    // Remove from category
    for (const cat of server.categories) {
      cat.channelIds = cat.channelIds.filter((id) => id !== channelId);
    }
    await serverRepo.update(serverId, { categories: server.categories } as any);

    await channelRepo.delete(serverId, channelId);
  },

  async touchLastMessage(serverId: string, channelId: string): Promise<void> {
    await channelRepo.update(serverId, channelId, {
      lastMessageAt: new Date().toISOString(),
    } as Partial<Channel>);
  },

  async togglePin(serverId: string, channelId: string, messageId: string): Promise<Channel> {
    const channel = await this.getById(serverId, channelId);
    const pinned = channel.pinnedMessageIds.includes(messageId)
      ? channel.pinnedMessageIds.filter((id) => id !== messageId)
      : [...channel.pinnedMessageIds, messageId];

    const updated = await channelRepo.update(serverId, channelId, { pinnedMessageIds: pinned } as Partial<Channel>);
    return updated!;
  },
};
