import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "../types";
import { profilesApi } from "../services/collabApi";
import { connectCollab, disconnectCollab } from "../services/collabSocket";

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;

  // Setup
  createProfile: (nickname: string, avatar?: string) => Promise<UserProfile>;
  loadProfile: (id: string) => Promise<void>;
  updateProfile: (updates: Partial<Pick<UserProfile, "nickname" | "avatar" | "bio">>) => Promise<void>;
  setStatus: (status: UserProfile["status"]) => Promise<void>;

  // Connection
  connectSocket: () => Promise<void>;
  disconnect: () => void;

  // Friends
  friends: UserProfile[];
  loadFriends: () => Promise<void>;
  sendFriendRequest: (friendCode: string) => Promise<string>;
  acceptFriendRequest: (fromId: string) => Promise<void>;
  rejectFriendRequest: (fromId: string) => Promise<void>;
  removeFriend: (friendId: string) => Promise<void>;

  // Misc
  clearError: () => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      loading: false,
      error: null,
      friends: [],

      async createProfile(nickname, avatar) {
        set({ loading: true, error: null });
        try {
          const profile = await profilesApi.create(nickname, avatar);
          set({ profile, loading: false });
          return profile;
        } catch (err: any) {
          set({ error: err.message, loading: false });
          throw err;
        }
      },

      async loadProfile(id) {
        set({ loading: true, error: null });
        try {
          const profile = await profilesApi.get(id);
          set({ profile, loading: false });
        } catch (err: any) {
          set({ error: err.message, loading: false });
        }
      },

      async updateProfile(updates) {
        const { profile } = get();
        if (!profile) return;
        try {
          const updated = await profilesApi.update(profile.id, updates);
          set({ profile: updated });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      async setStatus(status) {
        const { profile } = get();
        if (!profile) return;
        try {
          const updated = await profilesApi.setStatus(profile.id, status);
          set({ profile: updated });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      async connectSocket() {
        const { profile } = get();
        if (!profile) return;
        try {
          await connectCollab(profile.id);
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      disconnect() {
        disconnectCollab();
      },

      async loadFriends() {
        const { profile } = get();
        if (!profile) return;
        try {
          const friends = await profilesApi.getFriends(profile.id);
          set({ friends });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      async sendFriendRequest(friendCode) {
        const { profile } = get();
        if (!profile) throw new Error("No profile");
        const result = await profilesApi.sendFriendRequest(profile.id, friendCode);
        // Reload profile to get updated request lists
        await get().loadProfile(profile.id);
        return result.message;
      },

      async acceptFriendRequest(fromId) {
        const { profile } = get();
        if (!profile) return;
        await profilesApi.acceptFriendRequest(profile.id, fromId);
        await get().loadProfile(profile.id);
        await get().loadFriends();
      },

      async rejectFriendRequest(fromId) {
        const { profile } = get();
        if (!profile) return;
        await profilesApi.rejectFriendRequest(profile.id, fromId);
        await get().loadProfile(profile.id);
      },

      async removeFriend(friendId) {
        const { profile } = get();
        if (!profile) return;
        await profilesApi.removeFriend(profile.id, friendId);
        await get().loadProfile(profile.id);
        await get().loadFriends();
      },

      clearError() {
        set({ error: null });
      },
    }),
    {
      name: "lc.profile",
      partialize: (state) => ({ profile: state.profile }),
    }
  )
);
