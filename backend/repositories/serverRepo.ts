import path from "path";
import { BaseRepository } from "./baseRepository";

export interface ServerRole {
  id: string;
  name: string;
  color: string;
  permissions: string[];
  position: number;
}

export interface ServerCategory {
  id: string;
  name: string;
  position: number;
  channelIds: string[];
}

export interface StudyServer {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  inviteCode: string;
  ownerId: string;
  defaultLessonId?: string;
  categories: ServerCategory[];
  roles: ServerRole[];
  memberIds: string[];
  memberRoles: Record<string, string[]>;
  settings: {
    maxMembers: number;
    isPublic: boolean;
    defaultRole: string;
  };
  tags: string[];
  university?: string;
  memberCount: number;
  lastActivityAt: string;
  createdAt: string;
}

const DATA_PATH = path.join(__dirname, "..", "data", "servers.json");

// Default permissions for built-in roles
export const PERMISSIONS = {
  MANAGE_SERVER: "manage_server",
  MANAGE_CHANNELS: "manage_channels",
  MANAGE_ROLES: "manage_roles",
  MANAGE_MEMBERS: "manage_members",
  KICK_MEMBERS: "kick_members",
  SEND_MESSAGES: "send_messages",
  MANAGE_MESSAGES: "manage_messages",
  PIN_MESSAGES: "pin_messages",
  MENTION_EVERYONE: "mention_everyone",
  CREATE_INVITE: "create_invite",
  USE_TOOLS: "use_tools",
} as const;

const DEFAULT_ROLES: ServerRole[] = [
  {
    id: "role-owner",
    name: "Owner",
    color: "#E74C3C",
    permissions: Object.values(PERMISSIONS),
    position: 3,
  },
  {
    id: "role-admin",
    name: "Admin",
    color: "#3498DB",
    permissions: [
      PERMISSIONS.MANAGE_CHANNELS, PERMISSIONS.MANAGE_MEMBERS,
      PERMISSIONS.KICK_MEMBERS, PERMISSIONS.SEND_MESSAGES,
      PERMISSIONS.MANAGE_MESSAGES, PERMISSIONS.PIN_MESSAGES,
      PERMISSIONS.MENTION_EVERYONE, PERMISSIONS.CREATE_INVITE,
      PERMISSIONS.USE_TOOLS,
    ],
    position: 2,
  },
  {
    id: "role-member",
    name: "Member",
    color: "#95A5A6",
    permissions: [
      PERMISSIONS.SEND_MESSAGES, PERMISSIONS.PIN_MESSAGES,
      PERMISSIONS.CREATE_INVITE, PERMISSIONS.USE_TOOLS,
    ],
    position: 0,
  },
];

class ServerRepository extends BaseRepository<StudyServer> {
  constructor() {
    super(DATA_PATH);
  }

  async findByInviteCode(code: string): Promise<StudyServer | null> {
    return this.findOneBy((s) => s.inviteCode.toLowerCase() === code.toLowerCase());
  }

  async findByMemberId(userId: string): Promise<StudyServer[]> {
    return this.findBy((s) => s.memberIds.includes(userId));
  }

  async findPublicServers(search?: string, tags?: string[]): Promise<StudyServer[]> {
    let results = await this.findBy((s) => s.settings.isPublic === true);

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          (s.university && s.university.toLowerCase().includes(q)) ||
          (s.tags && s.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    if (tags && tags.length > 0) {
      const lowerTags = tags.map((t) => t.toLowerCase());
      results = results.filter(
        (s) => s.tags && s.tags.some((t) => lowerTags.includes(t.toLowerCase()))
      );
    }

    // Sort by lastActivityAt (most recent first), then by memberCount
    results.sort((a, b) => {
      const aTime = new Date(a.lastActivityAt || a.createdAt).getTime();
      const bTime = new Date(b.lastActivityAt || b.createdAt).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return (b.memberCount || b.memberIds.length) - (a.memberCount || a.memberIds.length);
    });

    return results;
  }

  async addMember(serverId: string, userId: string): Promise<StudyServer | null> {
    const server = await this.findById(serverId);
    if (!server) return null;
    if (server.memberIds.includes(userId)) return server;

    return this.update(serverId, {
      memberIds: [...server.memberIds, userId],
      memberRoles: {
        ...server.memberRoles,
        [userId]: [server.settings.defaultRole],
      },
    } as Partial<StudyServer>);
  }

  async removeMember(serverId: string, userId: string): Promise<StudyServer | null> {
    const server = await this.findById(serverId);
    if (!server) return null;

    const { [userId]: _, ...restRoles } = server.memberRoles;
    return this.update(serverId, {
      memberIds: server.memberIds.filter((id) => id !== userId),
      memberRoles: restRoles,
    } as Partial<StudyServer>);
  }

  getDefaultRoles(): ServerRole[] {
    return JSON.parse(JSON.stringify(DEFAULT_ROLES));
  }
}

export const serverRepo = new ServerRepository();
