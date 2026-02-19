import { create } from "zustand";
import type { StudyServer, ServerMemberInfo, ServerTemplate } from "../types";
import { roomsApi } from "../services/roomsApi";

interface RoomState {
  rooms: StudyServer[];
  activeRoomId: string | null;
  members: ServerMemberInfo[];
  templates: ServerTemplate[];
  loading: boolean;
  error: string | null;

  // Room actions
  loadRooms: (userId: string) => Promise<void>;
  createRoom: (name: string, description: string, ownerId: string, iconColor?: string, options?: {
    tags?: string[]; university?: string; isPublic?: boolean; templateId?: string;
  }) => Promise<StudyServer>;
  createSoloRoom: (name: string, ownerId: string, options?: { topic?: string; templateId?: string; tags?: string[] }) => Promise<StudyServer>;
  joinByInvite: (inviteCode: string, userId: string) => Promise<StudyServer>;
  joinPublicRoom: (roomId: string, userId: string) => Promise<StudyServer>;
  leaveRoom: (roomId: string, userId: string) => Promise<void>;
  deleteRoom: (roomId: string, userId: string) => Promise<void>;
  archiveRoom: (roomId: string, userId: string) => Promise<void>;
  transferOwnership: (roomId: string, currentOwnerId: string, newOwnerId: string) => Promise<void>;
  selectRoom: (roomId: string) => Promise<void>;
  deselectRoom: () => void;
  discoverRooms: (search?: string, tags?: string[]) => Promise<StudyServer[]>;
  loadTemplates: () => Promise<void>;
  loadMembers: (roomId: string) => Promise<void>;
  clearError: () => void;
}

export const useRoomStore2 = create<RoomState>((set, get) => ({
  rooms: [],
  activeRoomId: null,
  members: [],
  templates: [],
  loading: false,
  error: null,

  loadRooms: async (userId) => {
    set({ loading: true, error: null });
    try {
      const rooms = await roomsApi.getUserRooms(userId);
      set({ rooms, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  createRoom: async (name, description, ownerId, iconColor, options) => {
    set({ loading: true, error: null });
    try {
      const room = await roomsApi.create(name, description, ownerId, iconColor, options);
      set((s) => ({ rooms: [...s.rooms, room], loading: false }));
      return room;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  createSoloRoom: async (name, ownerId, options) => {
    set({ loading: true, error: null });
    try {
      const room = await roomsApi.createSolo(name, ownerId, options);
      set((s) => ({ rooms: [...s.rooms, room], loading: false }));
      return room;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  joinByInvite: async (inviteCode, userId) => {
    set({ loading: true, error: null });
    try {
      const room = await roomsApi.joinByInvite(inviteCode, userId);
      set((s) => ({
        rooms: s.rooms.some((r) => r.id === room.id) ? s.rooms : [...s.rooms, room],
        loading: false,
      }));
      return room;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  joinPublicRoom: async (roomId, userId) => {
    set({ loading: true, error: null });
    try {
      const room = await roomsApi.join(roomId, userId);
      set((s) => ({
        rooms: s.rooms.some((r) => r.id === room.id) ? s.rooms : [...s.rooms, room],
        loading: false,
      }));
      return room;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  leaveRoom: async (roomId, userId) => {
    try {
      await roomsApi.leave(roomId, userId);
      set((s) => ({
        rooms: s.rooms.filter((r) => r.id !== roomId),
        activeRoomId: s.activeRoomId === roomId ? null : s.activeRoomId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteRoom: async (roomId, userId) => {
    try {
      await roomsApi.delete(roomId, userId);
      set((s) => ({
        rooms: s.rooms.filter((r) => r.id !== roomId),
        activeRoomId: s.activeRoomId === roomId ? null : s.activeRoomId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  archiveRoom: async (roomId, userId) => {
    try {
      await roomsApi.archive(roomId, userId);
      set((s) => ({
        rooms: s.rooms.filter((r) => r.id !== roomId),
        activeRoomId: s.activeRoomId === roomId ? null : s.activeRoomId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  transferOwnership: async (roomId, currentOwnerId, newOwnerId) => {
    try {
      const updated = await roomsApi.transferOwnership(roomId, currentOwnerId, newOwnerId);
      set((s) => ({
        rooms: s.rooms.map((r) => (r.id === roomId ? updated : r)),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  selectRoom: async (roomId) => {
    set({ activeRoomId: roomId });
    await get().loadMembers(roomId);
  },

  deselectRoom: () => {
    set({ activeRoomId: null, members: [] });
  },

  discoverRooms: async (search, tags) => {
    try {
      return await roomsApi.discover(search, tags);
    } catch (err: any) {
      set({ error: err.message });
      return [];
    }
  },

  loadTemplates: async () => {
    try {
      const templates = await roomsApi.getTemplates();
      set({ templates });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  loadMembers: async (roomId) => {
    try {
      const members = await roomsApi.getMembers(roomId);
      set({ members });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearError: () => set({ error: null }),
}));
