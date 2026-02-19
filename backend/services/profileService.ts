import { profileRepo, UserProfile } from "../repositories/profileRepo";
import { eventBus } from "../events/eventBus";
import { badRequest, notFound } from "../middleware/errorHandler";

function generateFriendCode(nickname: string): string {
  const tag = Math.floor(1000 + Math.random() * 9000).toString();
  const clean = nickname.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 16) || "User";
  return `${clean}#${tag}`;
}

function generateId(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const AVATAR_COLORS = [
  "#6C5CE7", "#00B894", "#FDCB6E", "#E17055", "#0984E3",
  "#D63031", "#A29BFE", "#55A3E8", "#F78FB3", "#3DC1D3",
];

export const profileService = {
  async create(nickname: string, avatar?: string): Promise<UserProfile> {
    if (!nickname || nickname.trim().length < 2) {
      throw badRequest("Nickname must be at least 2 characters");
    }

    const profile: UserProfile = {
      id: generateId(),
      nickname: nickname.trim(),
      avatar: avatar || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      bio: "",
      status: "online",
      friendIds: [],
      friendRequestsSent: [],
      friendRequestsReceived: [],
      friendCode: generateFriendCode(nickname.trim()),
      serverIds: [],
      dmChannelIds: [],
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      settings: { notifyMentions: true, notifyDMs: true },
    };

    // Ensure unique friend code (max 100 attempts to avoid infinite loop)
    let existing = await profileRepo.findByFriendCode(profile.friendCode);
    let attempts = 0;
    while (existing && attempts < 100) {
      profile.friendCode = generateFriendCode(nickname.trim());
      existing = await profileRepo.findByFriendCode(profile.friendCode);
      attempts++;
    }
    if (existing) {
      throw badRequest("Could not generate unique friend code. Please try again.");
    }

    return profileRepo.create(profile);
  },

  async getById(id: string): Promise<UserProfile> {
    const profile = await profileRepo.findById(id);
    if (!profile) throw notFound("Profile not found");
    return profile;
  },

  async getByIdOptional(id: string): Promise<UserProfile | null> {
    return profileRepo.findById(id);
  },

  async update(id: string, updates: Partial<Pick<UserProfile, "nickname" | "avatar" | "bio" | "settings">>): Promise<UserProfile> {
    const profile = await profileRepo.findById(id);
    if (!profile) throw notFound("Profile not found");

    // If nickname changed, update friend code
    const patchedUpdates: Partial<UserProfile> = { ...updates };
    if (updates.nickname && updates.nickname !== profile.nickname) {
      patchedUpdates.friendCode = generateFriendCode(updates.nickname);
      let existing = await profileRepo.findByFriendCode(patchedUpdates.friendCode!);
      let attempts = 0;
      while (existing && existing.id !== id && attempts < 100) {
        patchedUpdates.friendCode = generateFriendCode(updates.nickname);
        existing = await profileRepo.findByFriendCode(patchedUpdates.friendCode!);
        attempts++;
      }
    }

    const updated = await profileRepo.update(id, patchedUpdates);
    if (!updated) throw notFound("Profile not found");
    return updated;
  },

  async setStatus(id: string, status: UserProfile["status"]): Promise<UserProfile> {
    const updated = await profileRepo.updateStatus(id, status);
    if (!updated) throw notFound("Profile not found");
    eventBus.emit("profile:statusChanged", { userId: id, status });
    return updated;
  },

  async sendFriendRequest(fromId: string, friendCode: string): Promise<{ success: boolean; message: string }> {
    const sender = await profileRepo.findById(fromId);
    if (!sender) throw notFound("Sender profile not found");

    const target = await profileRepo.findByFriendCode(friendCode);
    if (!target) throw notFound("User not found with that friend code");
    if (target.id === fromId) throw badRequest("Cannot add yourself");
    if (sender.friendIds.includes(target.id)) throw badRequest("Already friends");
    if (sender.friendRequestsSent.includes(target.id)) throw badRequest("Friend request already sent");

    await profileRepo.update(fromId, {
      friendRequestsSent: [...sender.friendRequestsSent, target.id],
    } as Partial<UserProfile>);

    await profileRepo.update(target.id, {
      friendRequestsReceived: [...target.friendRequestsReceived, fromId],
    } as Partial<UserProfile>);

    return { success: true, message: `Friend request sent to ${target.nickname}` };
  },

  async acceptFriendRequest(userId: string, fromId: string): Promise<void> {
    const user = await profileRepo.findById(userId);
    if (!user) throw notFound("Profile not found");
    if (!user.friendRequestsReceived.includes(fromId)) throw badRequest("No pending request from this user");

    await profileRepo.addFriend(userId, fromId);
  },

  async rejectFriendRequest(userId: string, fromId: string): Promise<void> {
    const user = await profileRepo.findById(userId);
    if (!user) throw notFound("Profile not found");

    await profileRepo.update(userId, {
      friendRequestsReceived: user.friendRequestsReceived.filter((id) => id !== fromId),
    } as Partial<UserProfile>);

    const sender = await profileRepo.findById(fromId);
    if (sender) {
      await profileRepo.update(fromId, {
        friendRequestsSent: sender.friendRequestsSent.filter((id) => id !== userId),
      } as Partial<UserProfile>);
    }
  },

  async removeFriend(userId: string, friendId: string): Promise<void> {
    const user = await profileRepo.findById(userId);
    const friend = await profileRepo.findById(friendId);
    if (!user || !friend) throw notFound("Profile not found");

    await profileRepo.update(userId, {
      friendIds: user.friendIds.filter((id) => id !== friendId),
    } as Partial<UserProfile>);
    await profileRepo.update(friendId, {
      friendIds: friend.friendIds.filter((id) => id !== userId),
    } as Partial<UserProfile>);
  },

  async getFriends(userId: string): Promise<UserProfile[]> {
    const user = await profileRepo.findById(userId);
    if (!user) throw notFound("Profile not found");

    const friends: UserProfile[] = [];
    for (const fid of user.friendIds) {
      const f = await profileRepo.findById(fid);
      if (f) friends.push(f);
    }
    return friends;
  },

  async touchActive(id: string): Promise<void> {
    await profileRepo.update(id, { lastActiveAt: new Date().toISOString() } as Partial<UserProfile>);
  },
};
