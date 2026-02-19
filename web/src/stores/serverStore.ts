import { create } from "zustand";
import type { StudyServer, Channel, ServerMemberInfo } from "../types";
import { serversApi, channelsApi } from "../services/collabApi";
import { getCollabSocket } from "../services/collabSocket";

interface ServerState {
  // Data
  servers: StudyServer[];
  activeServerId: string | null;
  channels: Channel[];
  activeChannelId: string | null;
  activeChatChannelId: string | null;
  members: ServerMemberInfo[];

  // Loading
  loading: boolean;
  error: string | null;

  // Server actions
  loadServers: (userId: string) => Promise<void>;
  createServer: (name: string, description: string, ownerId: string, iconColor?: string, options?: {
    tags?: string[];
    university?: string;
    isPublic?: boolean;
    templateId?: string;
  }) => Promise<StudyServer>;
  joinByInvite: (inviteCode: string, userId: string) => Promise<StudyServer>;
  joinPublicServer: (serverId: string, userId: string) => Promise<StudyServer>;
  leaveServer: (serverId: string, userId: string) => Promise<void>;
  deleteServer: (serverId: string, userId: string) => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  deselectServer: () => void;

  // Channel actions
  loadChannels: (serverId: string) => Promise<void>;
  createChannel: (serverId: string, data: Parameters<typeof channelsApi.create>[1]) => Promise<Channel>;
  selectChannel: (channelId: string) => void;
  selectChatChannel: (channelId: string | null) => void;
  deleteChannel: (serverId: string, channelId: string, userId: string) => Promise<void>;

  // Member actions
  loadMembers: (serverId: string) => Promise<void>;

  // Channel lesson linking
  updateChannelLesson: (channelId: string, lessonId?: string, lessonTitle?: string) => void;

  // Helpers
  activeServer: () => StudyServer | null;
  activeChannel: () => Channel | null;
  clearError: () => void;

  // Socket listeners
  setupListeners: () => void;
  _listenersAttached: boolean;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  activeServerId: null,
  channels: [],
  activeChannelId: null,
  activeChatChannelId: null,
  members: [],
  loading: false,
  error: null,
  _listenersAttached: false,

  async loadServers(userId) {
    set({ loading: true, error: null });
    try {
      const servers = await serversApi.getUserServers(userId);
      set({ servers, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  async createServer(name, description, ownerId, iconColor, options) {
    set({ loading: true, error: null });
    try {
      const server = await serversApi.create(name, description, ownerId, iconColor, options);
      set((s) => ({ servers: [...s.servers, server], loading: false }));

      // Join server room via socket
      const socket = getCollabSocket();
      socket.emit("server:join", { serverId: server.id });

      return server;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  async joinByInvite(inviteCode, userId) {
    set({ loading: true, error: null });
    try {
      const server = await serversApi.joinByInvite(inviteCode, userId);
      set((s) => {
        const exists = s.servers.some((srv) => srv.id === server.id);
        return {
          servers: exists ? s.servers : [...s.servers, server],
          loading: false,
        };
      });

      const socket = getCollabSocket();
      socket.emit("server:join", { serverId: server.id });

      return server;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  async joinPublicServer(serverId, userId) {
    set({ loading: true, error: null });
    try {
      const server = await serversApi.join(serverId, userId);
      set((s) => {
        const exists = s.servers.some((srv) => srv.id === server.id);
        return {
          servers: exists ? s.servers : [...s.servers, server],
          loading: false,
        };
      });

      const socket = getCollabSocket();
      socket.emit("server:join", { serverId: server.id });

      return server;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  deselectServer() {
    set({ activeServerId: null, activeChannelId: null, activeChatChannelId: null, channels: [], members: [] });
  },

  async leaveServer(serverId, userId) {
    try {
      await serversApi.leave(serverId, userId);
      const socket = getCollabSocket();
      socket.emit("server:leave", { serverId });

      set((s) => ({
        servers: s.servers.filter((srv) => srv.id !== serverId),
        activeServerId: s.activeServerId === serverId ? null : s.activeServerId,
        channels: s.activeServerId === serverId ? [] : s.channels,
        activeChannelId: s.activeServerId === serverId ? null : s.activeChannelId,
        activeChatChannelId: s.activeServerId === serverId ? null : s.activeChatChannelId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  async deleteServer(serverId, userId) {
    try {
      await serversApi.delete(serverId, userId);
      set((s) => ({
        servers: s.servers.filter((srv) => srv.id !== serverId),
        activeServerId: s.activeServerId === serverId ? null : s.activeServerId,
        channels: s.activeServerId === serverId ? [] : s.channels,
        activeChannelId: s.activeServerId === serverId ? null : s.activeChannelId,
        activeChatChannelId: s.activeServerId === serverId ? null : s.activeChatChannelId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  async selectServer(serverId) {
    set({ activeServerId: serverId, activeChannelId: null, activeChatChannelId: null, channels: [], members: [] });
    await Promise.all([
      get().loadChannels(serverId),
      get().loadMembers(serverId),
    ]);

    // Auto-select first study-tool channel for main content
    const { channels } = get();
    const firstTool = channels.find((c) => c.type === "study-tool");
    if (firstTool) {
      get().selectChannel(firstTool.id);
    }

    // Auto-select first text channel for mini chat
    const firstText = channels.find((c) => c.type === "text");
    if (firstText) {
      set({ activeChatChannelId: firstText.id });
    }
  },

  async loadChannels(serverId) {
    try {
      const channels = await channelsApi.getByServer(serverId);
      set({ channels });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  async createChannel(serverId, data) {
    try {
      const channel = await channelsApi.create(serverId, data);
      set((s) => ({ channels: [...s.channels, channel] }));
      return channel;
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  selectChannel(channelId) {
    const prev = get().activeChannelId;
    const socket = getCollabSocket();
    const serverId = get().activeServerId;

    // Leave previous channel socket room
    if (prev) {
      socket.emit("channel:leave", { channelId: prev });
    }

    set({ activeChannelId: channelId });

    // Join new channel socket room
    if (channelId && serverId) {
      socket.emit("channel:join", { channelId, serverId });
    }
  },

  selectChatChannel(channelId) {
    set({ activeChatChannelId: channelId });
  },

  async deleteChannel(serverId, channelId, userId) {
    try {
      await channelsApi.delete(serverId, channelId, userId);
      set((s) => ({
        channels: s.channels.filter((c) => c.id !== channelId),
        activeChannelId: s.activeChannelId === channelId ? null : s.activeChannelId,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  async loadMembers(serverId) {
    try {
      const members = await serversApi.getMembers(serverId);
      set({ members });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  updateChannelLesson(channelId, lessonId, lessonTitle) {
    set((s) => ({
      channels: s.channels.map((ch) =>
        ch.id === channelId
          ? { ...ch, lessonId, lessonTitle }
          : ch
      ),
    }));
  },

  activeServer() {
    const { servers, activeServerId } = get();
    return servers.find((s) => s.id === activeServerId) ?? null;
  },

  activeChannel() {
    const { channels, activeChannelId } = get();
    return channels.find((c) => c.id === activeChannelId) ?? null;
  },

  clearError() {
    set({ error: null });
  },

  setupListeners() {
    if (get()._listenersAttached) return;
    const socket = getCollabSocket();

    socket.on("server:member:joined", (data: { serverId: string; member: ServerMemberInfo }) => {
      const { activeServerId } = get();
      if (data.serverId === activeServerId) {
        set((s) => ({
          members: [...s.members.filter((m) => m.id !== data.member.id), data.member],
        }));
      }
    });

    socket.on("server:member:left", (data: { serverId: string; userId: string }) => {
      const { activeServerId } = get();
      if (data.serverId === activeServerId) {
        set((s) => ({ members: s.members.filter((m) => m.id !== data.userId) }));
      }
    });

    socket.on("presence:update", (data: { userId: string; status: string }) => {
      set((s) => ({
        members: s.members.map((m) =>
          m.id === data.userId ? { ...m, status: data.status as any } : m
        ),
      }));
    });

    socket.on("channel:lesson:linked", (data: { channelId: string; lessonId: string; lessonTitle: string }) => {
      get().updateChannelLesson(data.channelId, data.lessonId, data.lessonTitle);
    });

    socket.on("channel:lesson:unlinked", (data: { channelId: string }) => {
      get().updateChannelLesson(data.channelId, undefined, undefined);
    });

    // Reset listeners flag on disconnect so they re-attach after reconnect
    socket.on("disconnect", () => {
      set({ _listenersAttached: false });
    });

    // Re-attach listeners after reconnect
    socket.on("connect", () => {
      if (!get()._listenersAttached) {
        // Listeners are already registered on the socket instance,
        // just mark as attached again
        set({ _listenersAttached: true });
      }
    });

    set({ _listenersAttached: true });
  },
}));
