import { serverRepo, StudyServer, ServerCategory } from "../repositories/serverRepo";
import { profileRepo } from "../repositories/profileRepo";
import { channelService } from "./channelService";
import { eventBus } from "../events/eventBus";
import { badRequest, notFound, forbidden } from "../middleware/errorHandler";

function generateId(): string {
  return `srv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function generateCategoryId(): string {
  return `cat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 4)}`;
}

// Server templates for quick creation
interface TemplateChannel {
  name: string;
  type: "text" | "announcement" | "study-tool";
  toolType?: string;
}

interface TemplateCategory {
  name: string;
  channels: TemplateChannel[];
}

interface ServerTemplate {
  id: string;
  label: string;
  description: string;
  categories: TemplateCategory[];
}

const SERVER_TEMPLATES: ServerTemplate[] = [
  {
    id: "study-group",
    label: "Ders Çalışma Grubu",
    description: "Ders çalışma araçları ve sohbet kanalları",
    categories: [
      {
        name: "Genel",
        channels: [
          { name: "genel", type: "text" },
          { name: "duyurular", type: "announcement" },
          { name: "kaynaklar", type: "text" },
        ],
      },
      {
        name: "Çalışma Araçları",
        channels: [
          { name: "deep-dive", type: "study-tool", toolType: "deep-dive" },
          { name: "flashcards", type: "study-tool", toolType: "flashcards" },
          { name: "quiz-yarışması", type: "study-tool", toolType: "quiz" },
          { name: "zihin-haritası", type: "study-tool", toolType: "mind-map" },
        ],
      },
      {
        name: "Sprint",
        channels: [
          { name: "pomodoro", type: "study-tool", toolType: "sprint" },
          { name: "notlar", type: "study-tool", toolType: "notes" },
        ],
      },
    ],
  },
  {
    id: "exam-prep",
    label: "Sınav Hazırlık Odası",
    description: "Sınav hazırlığı için odaklanmış çalışma ortamı",
    categories: [
      {
        name: "Genel",
        channels: [
          { name: "genel", type: "text" },
          { name: "sınav-tarihi", type: "announcement" },
        ],
      },
      {
        name: "Soru Çözüm",
        channels: [
          { name: "soru-cevap", type: "text" },
          { name: "deep-dive", type: "study-tool", toolType: "deep-dive" },
        ],
      },
      {
        name: "Yarışma",
        channels: [
          { name: "quiz-yarışması", type: "study-tool", toolType: "quiz" },
          { name: "flashcards", type: "study-tool", toolType: "flashcards" },
        ],
      },
      {
        name: "Özet",
        channels: [
          { name: "notlar", type: "study-tool", toolType: "notes" },
          { name: "zihin-haritası", type: "study-tool", toolType: "mind-map" },
        ],
      },
    ],
  },
  {
    id: "project-group",
    label: "Proje Grubu",
    description: "Proje çalışması için organize çalışma alanı",
    categories: [
      {
        name: "Genel",
        channels: [
          { name: "genel", type: "text" },
          { name: "görevler", type: "announcement" },
        ],
      },
      {
        name: "Çalışma",
        channels: [
          { name: "deep-dive", type: "study-tool", toolType: "deep-dive" },
          { name: "notlar", type: "study-tool", toolType: "notes" },
        ],
      },
      {
        name: "Sprint",
        channels: [
          { name: "pomodoro", type: "study-tool", toolType: "sprint" },
        ],
      },
    ],
  },
];

export function getServerTemplates(): ServerTemplate[] {
  return SERVER_TEMPLATES;
}

export const serverService = {
  async create(
    name: string,
    description: string,
    ownerId: string,
    iconColor?: string,
    options?: { tags?: string[]; university?: string; isPublic?: boolean; templateId?: string }
  ): Promise<StudyServer> {
    if (!name || name.trim().length < 2) throw badRequest("Server name must be at least 2 characters");

    const owner = await profileRepo.findById(ownerId);
    if (!owner) throw notFound("Owner profile not found");

    let inviteCode = generateInviteCode();
    while (await serverRepo.findByInviteCode(inviteCode)) {
      inviteCode = generateInviteCode();
    }

    const now = new Date().toISOString();

    // Determine template or use default categories
    const template = options?.templateId
      ? SERVER_TEMPLATES.find((t) => t.id === options.templateId)
      : null;

    const categories: ServerCategory[] = template
      ? template.categories.map((tc, i) => ({
          id: generateCategoryId(),
          name: tc.name,
          position: i,
          channelIds: [],
        }))
      : [
          { id: generateCategoryId(), name: "Genel", position: 0, channelIds: [] },
          { id: generateCategoryId(), name: "Çalışma", position: 1, channelIds: [] },
        ];

    const server: StudyServer = {
      id: generateId(),
      name: name.trim(),
      description: description?.trim() || "",
      iconColor: iconColor || "#6C5CE7",
      inviteCode,
      ownerId,
      categories,
      roles: serverRepo.getDefaultRoles(),
      memberIds: [ownerId],
      memberRoles: { [ownerId]: ["role-owner"] },
      settings: {
        maxMembers: 50,
        isPublic: options?.isPublic ?? false,
        defaultRole: "role-member",
      },
      tags: options?.tags || [],
      university: options?.university,
      memberCount: 1,
      lastActivityAt: now,
      createdAt: now,
    };

    const created = await serverRepo.create(server);

    // Create channels based on template or defaults
    if (template) {
      for (let catIdx = 0; catIdx < template.categories.length; catIdx++) {
        const templateCat = template.categories[catIdx];
        const serverCat = created.categories[catIdx];

        for (const ch of templateCat.channels) {
          const channel = await channelService.create(
            created.id,
            serverCat.id,
            ch.name,
            ch.type as any,
            ch.toolType as any
          );
          serverCat.channelIds.push(channel.id);
        }
      }
    } else {
      const generalCat = created.categories[0];
      const studyCat = created.categories[1];

      const generalChannel = await channelService.create(created.id, generalCat.id, "genel", "text");
      const duyuruChannel = await channelService.create(created.id, generalCat.id, "duyurular", "announcement");
      const deepDiveChannel = await channelService.create(created.id, studyCat.id, "deep-dive", "study-tool", "deep-dive");

      generalCat.channelIds = [generalChannel.id, duyuruChannel.id];
      studyCat.channelIds = [deepDiveChannel.id];
    }

    await serverRepo.update(created.id, { categories: created.categories } as Partial<StudyServer>);

    // Add server to owner's profile
    await profileRepo.addServerToProfile(ownerId, created.id);

    eventBus.emit("server:created", { serverId: created.id, ownerId });

    return (await serverRepo.findById(created.id))!;
  },

  async discoverServers(search?: string, tags?: string[]): Promise<StudyServer[]> {
    return serverRepo.findPublicServers(search, tags);
  },

  async getById(id: string): Promise<StudyServer> {
    const server = await serverRepo.findById(id);
    if (!server) throw notFound("Server not found");
    return server;
  },

  async getByInviteCode(code: string): Promise<StudyServer> {
    const server = await serverRepo.findByInviteCode(code);
    if (!server) throw notFound("Invalid invite code");
    return server;
  },

  async getUserServers(userId: string): Promise<StudyServer[]> {
    return serverRepo.findByMemberId(userId);
  },

  async update(serverId: string, userId: string, updates: Partial<Pick<StudyServer, "name" | "description" | "iconColor" | "settings" | "tags" | "university">>): Promise<StudyServer> {
    const server = await this.getById(serverId);
    this.checkPermission(server, userId, "manage_server");

    const updated = await serverRepo.update(serverId, updates as Partial<StudyServer>);
    if (!updated) throw notFound("Server not found");
    return updated;
  },

  async join(serverId: string, userId: string): Promise<StudyServer> {
    const server = await this.getById(serverId);
    if (server.memberIds.includes(userId)) return server;
    if (server.memberIds.length >= server.settings.maxMembers) throw badRequest("Server is full");

    const profile = await profileRepo.findById(userId);
    if (!profile) throw notFound("Profile not found");

    await serverRepo.addMember(serverId, userId);
    await profileRepo.addServerToProfile(userId, serverId);

    // Update cached member count
    const updatedServer = await serverRepo.findById(serverId);
    if (updatedServer) {
      await serverRepo.update(serverId, { memberCount: updatedServer.memberIds.length } as Partial<StudyServer>);
    }

    eventBus.emit("member:joined", { serverId, userId });

    return (await serverRepo.findById(serverId))!;
  },

  async joinByInvite(inviteCode: string, userId: string): Promise<StudyServer> {
    const server = await this.getByInviteCode(inviteCode);
    return this.join(server.id, userId);
  },

  async leave(serverId: string, userId: string): Promise<void> {
    const server = await this.getById(serverId);
    if (server.ownerId === userId) throw badRequest("Owner cannot leave. Transfer ownership or delete the server.");
    if (!server.memberIds.includes(userId)) throw badRequest("Not a member");

    await serverRepo.removeMember(serverId, userId);
    await profileRepo.removeServerFromProfile(userId, serverId);

    eventBus.emit("member:left", { serverId, userId });
  },

  async kick(serverId: string, requesterId: string, targetId: string): Promise<void> {
    const server = await this.getById(serverId);
    this.checkPermission(server, requesterId, "kick_members");
    if (targetId === server.ownerId) throw forbidden("Cannot kick the owner");
    if (targetId === requesterId) throw badRequest("Cannot kick yourself");

    await serverRepo.removeMember(serverId, targetId);
    await profileRepo.removeServerFromProfile(targetId, serverId);

    eventBus.emit("member:left", { serverId, userId: targetId });
  },

  async delete(serverId: string, userId: string): Promise<void> {
    const server = await this.getById(serverId);
    if (server.ownerId !== userId) throw forbidden("Only the owner can delete the server");

    // Remove server from all members' profiles
    for (const memberId of server.memberIds) {
      await profileRepo.removeServerFromProfile(memberId, serverId);
    }

    await serverRepo.delete(serverId);
    eventBus.emit("server:deleted", { serverId });
  },

  async addCategory(serverId: string, userId: string, name: string): Promise<StudyServer> {
    const server = await this.getById(serverId);
    this.checkPermission(server, userId, "manage_channels");

    const cat: ServerCategory = {
      id: generateCategoryId(),
      name: name.trim(),
      position: server.categories.length,
      channelIds: [],
    };

    const updated = await serverRepo.update(serverId, {
      categories: [...server.categories, cat],
    } as Partial<StudyServer>);

    return updated!;
  },

  async regenerateInvite(serverId: string, userId: string): Promise<string> {
    const server = await this.getById(serverId);
    this.checkPermission(server, userId, "manage_server");

    let code = generateInviteCode();
    while (await serverRepo.findByInviteCode(code)) code = generateInviteCode();

    await serverRepo.update(serverId, { inviteCode: code } as Partial<StudyServer>);
    return code;
  },

  checkPermission(server: StudyServer, userId: string, permission: string): void {
    if (server.ownerId === userId) return; // Owner has all permissions
    const userRoleIds = server.memberRoles[userId] || [];
    const hasPermission = server.roles.some(
      (r) => userRoleIds.includes(r.id) && r.permissions.includes(permission)
    );
    if (!hasPermission) throw forbidden(`Missing permission: ${permission}`);
  },

  async getMemberProfiles(serverId: string): Promise<any[]> {
    const server = await this.getById(serverId);
    const profiles = [];
    for (const memberId of server.memberIds) {
      const profile = await profileRepo.findById(memberId);
      if (profile) {
        profiles.push({
          id: profile.id,
          nickname: profile.nickname,
          avatar: profile.avatar,
          status: profile.status,
          roles: server.memberRoles[memberId] || [],
        });
      }
    }
    return profiles;
  },
};
