import { Server, Socket } from "socket.io";
import { profileService } from "./services/profileService";
import { messageService } from "./services/messageService";
import { serverService } from "./services/serverService";
import { channelService } from "./services/channelService";
import { checkSocketRateLimit } from "./middleware/rateLimiter";

// Track online users: userId -> Set<socketId>
const onlineUsers = new Map<string, Set<string>>();
// Track which channel each socket is viewing: socketId -> channelId
const activeChannels = new Map<string, string>();
// Track typing: channelId -> Map<userId, timeout>
const typingUsers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

export function setupCollabNamespace(io: Server) {
  const collab = io.of("/collab");

  collab.on("connection", (socket: Socket) => {
    let userId: string | null = null;

    // ===== AUTH =====
    socket.on("auth", async (data: { userId: string }, cb) => {
      try {
        const profile = await profileService.getByIdOptional(data.userId);
        if (!profile) {
          cb?.({ ok: false, error: "Profile not found" });
          return;
        }

        userId = data.userId;

        // Track online
        if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
        onlineUsers.get(userId)!.add(socket.id);

        // Join personal room
        socket.join(`user:${userId}`);

        // Join all server rooms
        for (const serverId of profile.serverIds) {
          socket.join(`server:${serverId}`);
        }

        // Set online status
        await profileService.setStatus(userId, "online");
        broadcastPresence(collab, userId, "online", profile.serverIds);

        // Auto-join global lobby room
        socket.join("channel:global-lobby");

        cb?.({ ok: true, profile });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // ===== SERVER EVENTS =====
    socket.on("server:join", async (data: { serverId: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      try {
        const server = await serverService.join(data.serverId, userId);
        socket.join(`server:${server.id}`);

        const profile = await profileService.getById(userId);
        collab.to(`server:${server.id}`).emit("server:member:joined", {
          serverId: server.id,
          member: { id: profile.id, nickname: profile.nickname, avatar: profile.avatar, status: profile.status },
        });

        // Send system message to general channel
        const channels = await channelService.getByServer(server.id);
        const general = channels.find((c) => c.name === "genel" && c.type === "text");
        if (general) {
          const sysMsg = await messageService.sendSystem(general.id, server.id, `${profile.nickname} sunucuya katıldı!`);
          collab.to(`channel:${general.id}`).emit("msg:new", sysMsg);
        }

        cb?.({ ok: true, server });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on("server:leave", async (data: { serverId: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      try {
        await serverService.leave(data.serverId, userId);
        socket.leave(`server:${data.serverId}`);

        collab.to(`server:${data.serverId}`).emit("server:member:left", {
          serverId: data.serverId,
          userId,
        });

        cb?.({ ok: true });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // ===== CHANNEL EVENTS =====
    socket.on("channel:join", async (data: { channelId: string; serverId: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      try {
        // Verify user is a member of the server
        const server = await serverService.getById(data.serverId);
        if (!server.memberIds.includes(userId)) {
          return cb?.({ ok: false, error: "Not a member of this server" });
        }

        // Leave previous channel
        const prevChannel = activeChannels.get(socket.id);
        if (prevChannel) {
          socket.leave(`channel:${prevChannel}`);
          collab.to(`channel:${prevChannel}`).emit("channel:presence", {
            channelId: prevChannel,
            userId,
            action: "left",
          });
        }

        // Join new channel
        socket.join(`channel:${data.channelId}`);
        activeChannels.set(socket.id, data.channelId);

        collab.to(`channel:${data.channelId}`).emit("channel:presence", {
          channelId: data.channelId,
          userId,
          action: "joined",
        });

        cb?.({ ok: true });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on("channel:leave", async (data: { channelId: string }) => {
      socket.leave(`channel:${data.channelId}`);
      activeChannels.delete(socket.id);

      if (userId) {
        collab.to(`channel:${data.channelId}`).emit("channel:presence", {
          channelId: data.channelId,
          userId,
          action: "left",
        });
      }
    });

    // ===== MESSAGE EVENTS =====
    socket.on("msg:send", async (data: { channelId: string; serverId: string; content: string; threadId?: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      if (!checkSocketRateLimit("msg", userId, 5, 1000)) {
        return cb?.({ ok: false, error: "Rate limited" });
      }

      try {
        // Verify user is a member of the server
        const server = await serverService.getById(data.serverId);
        if (!server.memberIds.includes(userId)) {
          return cb?.({ ok: false, error: "Not a member of this server" });
        }

        const message = await messageService.send(
          data.channelId, data.serverId, userId, data.content, "text", [], data.threadId
        );

        // Broadcast to channel
        collab.to(`channel:${data.channelId}`).emit("msg:new", message);

        // Also notify the server room for unread counts
        collab.to(`server:${data.serverId}`).emit("channel:activity", {
          channelId: data.channelId,
          lastMessageAt: message.createdAt,
          preview: message.content.slice(0, 100),
        });

        // Clear typing
        clearTyping(data.channelId, userId, collab);

        cb?.({ ok: true, message });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on("msg:edit", async (data: { channelId: string; messageId: string; content: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      try {
        const message = await messageService.edit(data.channelId, data.messageId, userId, data.content);
        collab.to(`channel:${data.channelId}`).emit("msg:edited", message);
        cb?.({ ok: true, message });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on("msg:delete", async (data: { channelId: string; messageId: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      try {
        await messageService.delete(data.channelId, data.messageId, userId);
        collab.to(`channel:${data.channelId}`).emit("msg:deleted", {
          channelId: data.channelId,
          messageId: data.messageId,
        });
        cb?.({ ok: true });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on("msg:react", async (data: { channelId: string; messageId: string; emoji: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      try {
        const message = await messageService.react(data.channelId, data.messageId, data.emoji, userId);
        collab.to(`channel:${data.channelId}`).emit("msg:reacted", message);
        cb?.({ ok: true });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on("msg:pin", async (data: { channelId: string; serverId: string; messageId: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      try {
        const message = await messageService.pin(data.channelId, data.serverId, data.messageId);
        collab.to(`channel:${data.channelId}`).emit("msg:pinned", message);
        cb?.({ ok: true });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // ===== LOBBY =====
    socket.on("lobby:message", async (data: { content: string }, cb) => {
      if (!userId) return cb?.({ ok: false, error: "Not authenticated" });
      if (!checkSocketRateLimit("msg", userId, 5, 1000)) {
        return cb?.({ ok: false, error: "Rate limited" });
      }

      try {
        const message = await messageService.sendLobby("global-lobby", userId, data.content);
        collab.to("channel:global-lobby").emit("msg:new", message);
        cb?.({ ok: true, message });
      } catch (err: any) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // ===== TYPING =====
    socket.on("typing:start", (data: { channelId: string }) => {
      if (!userId) return;
      if (!checkSocketRateLimit("typing", userId, 3, 3000)) return;

      if (!typingUsers.has(data.channelId)) typingUsers.set(data.channelId, new Map());
      const channelTyping = typingUsers.get(data.channelId)!;

      // Clear existing timeout
      if (channelTyping.has(userId)) clearTimeout(channelTyping.get(userId)!);

      // Set new timeout (stop typing after 5s)
      channelTyping.set(userId, setTimeout(() => {
        channelTyping.delete(userId!);
        socket.to(`channel:${data.channelId}`).emit("typing:stop", {
          channelId: data.channelId,
          userId,
        });
      }, 5000));

      socket.to(`channel:${data.channelId}`).emit("typing:start", {
        channelId: data.channelId,
        userId,
      });
    });

    socket.on("typing:stop", (data: { channelId: string }) => {
      if (!userId) return;
      clearTyping(data.channelId, userId, collab);
    });

    // ===== LESSON LINKING =====
    socket.on("channel:lesson:linked", (data: { channelId: string; lessonId: string; lessonTitle: string }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("channel:lesson:linked", data);
    });

    socket.on("channel:lesson:unlinked", (data: { channelId: string }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("channel:lesson:unlinked", data);
    });

    // ===== TOOL EVENTS (real-time sync for study tool channels) =====
    socket.on("tool:data:update", (data: { channelId: string; toolData: any }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:data:update", data);
    });

    socket.on("tool:quiz:answer", (data: { channelId: string; result: any }) => {
      if (!userId) return;
      collab.to(`channel:${data.channelId}`).emit("tool:quiz:answered", data);
    });

    socket.on("tool:flashcard:add", (data: { channelId: string; card: any }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:flashcard:added", data);
    });

    socket.on("tool:deepdive:msg", (data: { channelId: string; userMessage: any; aiMessage: any }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:deepdive:newmsg", data);
    });

    socket.on("tool:mindmap:update", (data: { channelId: string; mindMap: any }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:mindmap:updated", data);
    });

    socket.on("tool:sprint:update", (data: { channelId: string; sprint: any }) => {
      if (!userId) return;
      collab.to(`channel:${data.channelId}`).emit("tool:sprint:updated", data);
    });

    socket.on("tool:notes:add", (data: { channelId: string; note: any }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:notes:added", data);
    });

    socket.on("tool:notes:edit", (data: { channelId: string; note: any }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:notes:edited", data);
    });

    socket.on("tool:notes:delete", (data: { channelId: string; noteId: string }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:notes:deleted", data);
    });

    socket.on("tool:notes:pin", (data: { channelId: string; note: any }) => {
      if (!userId) return;
      socket.to(`channel:${data.channelId}`).emit("tool:notes:pinned", data);
    });

    // ===== READ RECEIPTS =====
    socket.on("read:mark", async (data: { channelId: string; messageId: string }) => {
      if (!userId) return;
      // Emit to user's other sessions
      socket.to(`user:${userId}`).emit("read:updated", {
        channelId: data.channelId,
        lastReadMessageId: data.messageId,
      });
    });

    // ===== DISCONNECT =====
    socket.on("disconnect", async () => {
      if (!userId) return;

      const sockets = onlineUsers.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(userId);

          // Set offline
          try {
            const profile = await profileService.getByIdOptional(userId);
            if (profile) {
              await profileService.setStatus(userId, "offline");
              broadcastPresence(collab, userId, "offline", profile.serverIds);
            }
          } catch {}
        }
      }

      // Clean up active channel
      const channelId = activeChannels.get(socket.id);
      if (channelId) {
        activeChannels.delete(socket.id);
        clearTyping(channelId, userId, collab);
      }
    });
  });

  return collab;
}

function broadcastPresence(collab: any, userId: string, status: string, serverIds: string[]) {
  for (const serverId of serverIds) {
    collab.to(`server:${serverId}`).emit("presence:update", { userId, status });
  }
}

function clearTyping(channelId: string, userId: string, collab: any) {
  const channelTyping = typingUsers.get(channelId);
  if (channelTyping) {
    if (channelTyping.has(userId)) {
      clearTimeout(channelTyping.get(userId)!);
      channelTyping.delete(userId);
    }
    collab.to(`channel:${channelId}`).emit("typing:stop", { channelId, userId });
  }
}

export function getOnlineUserIds(): string[] {
  return [...onlineUsers.keys()];
}

export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId) && onlineUsers.get(userId)!.size > 0;
}
