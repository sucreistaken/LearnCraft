import { create } from "zustand";
import type { ChannelMessage } from "../types";
import { messagesApi, lobbyApi } from "../services/collabApi";
import { getCollabSocket } from "../services/collabSocket";

interface MessageState {
  // Messages keyed by channelId
  messagesByChannel: Record<string, ChannelMessage[]>;
  loading: boolean;
  hasMore: Record<string, boolean>;
  typingUsers: Record<string, string[]>; // channelId -> userId[]

  // Actions
  loadMessages: (channelId: string) => Promise<void>;
  loadMore: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, serverId: string, content: string, threadId?: string) => Promise<void>;
  editMessage: (channelId: string, messageId: string, userId: string, content: string) => Promise<void>;
  deleteMessage: (channelId: string, messageId: string, userId: string) => Promise<void>;
  reactToMessage: (channelId: string, messageId: string, emoji: string, userId: string) => Promise<void>;
  pinMessage: (channelId: string, serverId: string, messageId: string) => Promise<void>;

  // Typing
  startTyping: (channelId: string) => void;
  stopTyping: (channelId: string) => void;

  // Socket listeners
  setupListeners: () => void;
  _listenersAttached: boolean;

  // Helpers
  getMessages: (channelId: string) => ChannelMessage[];
}

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByChannel: {},
  loading: false,
  hasMore: {},
  typingUsers: {},
  _listenersAttached: false,

  async loadMessages(channelId) {
    set({ loading: true });
    try {
      const messages = channelId === "global-lobby"
        ? await lobbyApi.getMessages(50)
        : await messagesApi.get(channelId, 50);
      set((s) => ({
        messagesByChannel: { ...s.messagesByChannel, [channelId]: messages },
        hasMore: { ...s.hasMore, [channelId]: messages.length >= 50 },
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },

  async loadMore(channelId) {
    const existing = get().messagesByChannel[channelId] || [];
    if (existing.length === 0) return;

    const oldestId = existing[0].id;
    try {
      const older = await messagesApi.get(channelId, 50, oldestId);
      set((s) => ({
        messagesByChannel: {
          ...s.messagesByChannel,
          [channelId]: [...older, ...(s.messagesByChannel[channelId] || [])],
        },
        hasMore: { ...s.hasMore, [channelId]: older.length >= 50 },
      }));
    } catch { /* ignore */ }
  },

  async sendMessage(channelId, serverId, content, threadId) {
    const socket = getCollabSocket();
    // Lobby messages use a different event
    if (channelId === "global-lobby") {
      return new Promise<void>((resolve, reject) => {
        socket.emit("lobby:message", { content }, (res: any) => {
          if (res.ok) resolve();
          else reject(new Error(res.error));
        });
      });
    }
    return new Promise<void>((resolve, reject) => {
      socket.emit("msg:send", { channelId, serverId, content, threadId }, (res: any) => {
        if (res.ok) resolve();
        else reject(new Error(res.error));
      });
    });
  },

  async editMessage(channelId, messageId, userId, content) {
    const socket = getCollabSocket();
    return new Promise<void>((resolve, reject) => {
      socket.emit("msg:edit", { channelId, messageId, content }, (res: any) => {
        if (res.ok) resolve();
        else reject(new Error(res.error));
      });
    });
  },

  async deleteMessage(channelId, messageId, userId) {
    const socket = getCollabSocket();
    return new Promise<void>((resolve, reject) => {
      socket.emit("msg:delete", { channelId, messageId }, (res: any) => {
        if (res.ok) resolve();
        else reject(new Error(res.error));
      });
    });
  },

  async reactToMessage(channelId, messageId, emoji, userId) {
    const socket = getCollabSocket();
    socket.emit("msg:react", { channelId, messageId, emoji });
  },

  async pinMessage(channelId, serverId, messageId) {
    const socket = getCollabSocket();
    socket.emit("msg:pin", { channelId, serverId, messageId });
  },

  startTyping(channelId) {
    const socket = getCollabSocket();
    socket.emit("typing:start", { channelId });
  },

  stopTyping(channelId) {
    const socket = getCollabSocket();
    socket.emit("typing:stop", { channelId });
  },

  setupListeners() {
    if (get()._listenersAttached) return;
    const socket = getCollabSocket();

    socket.on("msg:new", (message: ChannelMessage) => {
      set((s) => {
        const existing = s.messagesByChannel[message.channelId] || [];
        // Prevent duplicates
        if (existing.some((m) => m.id === message.id)) return s;
        return {
          messagesByChannel: {
            ...s.messagesByChannel,
            [message.channelId]: [...existing, message],
          },
        };
      });
    });

    socket.on("msg:edited", (message: ChannelMessage) => {
      set((s) => ({
        messagesByChannel: {
          ...s.messagesByChannel,
          [message.channelId]: (s.messagesByChannel[message.channelId] || []).map((m) =>
            m.id === message.id ? message : m
          ),
        },
      }));
    });

    socket.on("msg:deleted", (data: { channelId: string; messageId: string }) => {
      set((s) => ({
        messagesByChannel: {
          ...s.messagesByChannel,
          [data.channelId]: (s.messagesByChannel[data.channelId] || []).map((m) =>
            m.id === data.messageId ? { ...m, deleted: true, content: "" } : m
          ),
        },
      }));
    });

    socket.on("msg:reacted", (message: ChannelMessage) => {
      set((s) => ({
        messagesByChannel: {
          ...s.messagesByChannel,
          [message.channelId]: (s.messagesByChannel[message.channelId] || []).map((m) =>
            m.id === message.id ? message : m
          ),
        },
      }));
    });

    socket.on("msg:pinned", (message: ChannelMessage) => {
      set((s) => ({
        messagesByChannel: {
          ...s.messagesByChannel,
          [message.channelId]: (s.messagesByChannel[message.channelId] || []).map((m) =>
            m.id === message.id ? message : m
          ),
        },
      }));
    });

    // Typing indicators
    socket.on("typing:start", (data: { channelId: string; userId: string }) => {
      set((s) => {
        const current = s.typingUsers[data.channelId] || [];
        if (current.includes(data.userId)) return s;
        return {
          typingUsers: {
            ...s.typingUsers,
            [data.channelId]: [...current, data.userId],
          },
        };
      });
    });

    socket.on("typing:stop", (data: { channelId: string; userId: string }) => {
      set((s) => ({
        typingUsers: {
          ...s.typingUsers,
          [data.channelId]: (s.typingUsers[data.channelId] || []).filter(
            (id) => id !== data.userId
          ),
        },
      }));
    });

    // Reset listeners flag on disconnect so they re-attach after reconnect
    socket.on("disconnect", () => {
      set({ _listenersAttached: false });
    });

    socket.on("connect", () => {
      if (!get()._listenersAttached) {
        set({ _listenersAttached: true });
      }
    });

    set({ _listenersAttached: true });
  },

  getMessages(channelId) {
    return get().messagesByChannel[channelId] || [];
  },
}));
