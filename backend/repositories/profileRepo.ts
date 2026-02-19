import path from "path";
import { BaseRepository } from "./baseRepository";

export interface UserProfile {
  id: string;
  nickname: string;
  avatar: string;
  bio: string;
  status: "online" | "studying" | "idle" | "dnd" | "offline";
  friendIds: string[];
  friendRequestsSent: string[];
  friendRequestsReceived: string[];
  friendCode: string;
  serverIds: string[];
  dmChannelIds: string[];
  lastActiveAt: string;
  createdAt: string;
  settings: {
    notifyMentions: boolean;
    notifyDMs: boolean;
  };
}

const DATA_PATH = path.join(__dirname, "..", "data", "profiles.json");

class ProfileRepository extends BaseRepository<UserProfile> {
  constructor() {
    super(DATA_PATH);
  }

  async findByFriendCode(code: string): Promise<UserProfile | null> {
    return this.findOneBy((p) => p.friendCode.toLowerCase() === code.toLowerCase());
  }

  async findByNickname(nickname: string): Promise<UserProfile[]> {
    return this.findBy((p) => p.nickname.toLowerCase().includes(nickname.toLowerCase()));
  }

  async updateStatus(id: string, status: UserProfile["status"]): Promise<UserProfile | null> {
    return this.update(id, { status } as Partial<UserProfile>);
  }

  async addFriend(userId: string, friendId: string): Promise<void> {
    const user = await this.findById(userId);
    const friend = await this.findById(friendId);
    if (!user || !friend) return;

    if (!user.friendIds.includes(friendId)) {
      await this.update(userId, {
        friendIds: [...user.friendIds, friendId],
        friendRequestsReceived: user.friendRequestsReceived.filter((id) => id !== friendId),
        friendRequestsSent: user.friendRequestsSent.filter((id) => id !== friendId),
      } as Partial<UserProfile>);
    }
    if (!friend.friendIds.includes(userId)) {
      await this.update(friendId, {
        friendIds: [...friend.friendIds, userId],
        friendRequestsReceived: friend.friendRequestsReceived.filter((id) => id !== userId),
        friendRequestsSent: friend.friendRequestsSent.filter((id) => id !== userId),
      } as Partial<UserProfile>);
    }
  }

  async addServerToProfile(userId: string, serverId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    if (!user.serverIds.includes(serverId)) {
      await this.update(userId, {
        serverIds: [...user.serverIds, serverId],
      } as Partial<UserProfile>);
    }
  }

  async removeServerFromProfile(userId: string, serverId: string): Promise<void> {
    const user = await this.findById(userId);
    if (!user) return;
    await this.update(userId, {
      serverIds: user.serverIds.filter((id) => id !== serverId),
    } as Partial<UserProfile>);
  }
}

export const profileRepo = new ProfileRepository();
