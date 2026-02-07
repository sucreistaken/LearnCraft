// backend/socketHandler.ts
import { Server as SocketServer, Socket } from "socket.io";
import {
  createRoom,
  getRoom,
  getRoomByCode,
  joinRoom,
  leaveRoom,
  incrementMemberContribution,
  StudyUser,
} from "./controllers/roomController";
import { getUnreadCount } from "./controllers/notificationController";

import {
  loadWorkspace,
  addDeepDiveMessage,
  addDeepDiveReaction,
  saveInsight,
  addFlashcard,
  updateFlashcard,
  deleteFlashcard as deleteFlashcardWs,
  voteFlashcard,
  addBulkFlashcards,
  addMindMapAnnotation,
  addAnnotationReply,
  addNote,
  updateNote,
  deleteNote as deleteNoteWs,
  toggleNotePin,
  SharedChatMessage,
  SharedFlashcard,
} from "./controllers/workspaceController";

// In-memory state for active rooms (faster than JSON reads for real-time)
interface RoomState {
  participants: Map<string, { user: StudyUser; socketId: string; activeTool?: string }>;
  chat: Array<{ id: string; type: string; author: string; authorId: string; text: string; time: string }>;
}

const activeRooms = new Map<string, RoomState>();

function getRoomState(roomId: string): RoomState {
  if (!activeRooms.has(roomId)) {
    activeRooms.set(roomId, {
      participants: new Map(),
      chat: [],
    });
  }
  return activeRooms.get(roomId)!;
}

function broadcastPresence(io: SocketServer, roomId: string) {
  const state = activeRooms.get(roomId);
  if (!state) return;
  const users = Array.from(state.participants.values()).map((p) => ({
    ...p.user,
    activeTool: p.activeTool,
  }));
  io.to(roomId).emit("room:presence", users);
}

function broadcastMemberUpdate(io: SocketServer, roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  io.to(roomId).emit("room:member:update", room.members);
}

function broadcastChat(io: SocketServer, roomId: string, msg: any) {
  io.to(roomId).emit("room:chat", msg);
}

function msgId(): string {
  return `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function setupSocketHandler(io: SocketServer) {
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ========== ROOM LIFECYCLE ==========

    socket.on("room:create", (data: { name: string; user: StudyUser; settings?: any; lessonId?: string; lessonTitle?: string }, callback) => {
      const room = createRoom(data.name, data.user.id, data.settings, data.lessonId || "", data.lessonTitle || "");
      const state = getRoomState(room.id);

      socket.join(room.id);
      state.participants.set(data.user.id, { user: data.user, socketId: socket.id });
      socket.data.roomId = room.id;
      socket.data.userId = data.user.id;

      // Persist join
      joinRoom(room.id, data.user);

      // Load workspace
      const workspace = loadWorkspace(room.id);

      // System message
      const sysMsg = {
        id: msgId(),
        type: "system" as const,
        author: "System",
        authorId: "system",
        text: `${data.user.nickname} created the room`,
        time: new Date().toISOString(),
      };
      state.chat.push(sysMsg);

      if (callback) callback({ ok: true, room, workspace });
      broadcastPresence(io, room.id);
      broadcastChat(io, room.id, sysMsg);
      console.log(`[Socket] ${data.user.nickname} created room ${room.code}`);
    });

    socket.on("room:join", (data: { roomId: string; user: StudyUser }, callback) => {
      const room = getRoom(data.roomId);
      if (!room) {
        if (callback) callback({ ok: false, error: "Room not found" });
        return;
      }

      const state = getRoomState(room.id);
      if (room.settings.maxParticipants && state.participants.size >= room.settings.maxParticipants) {
        if (callback) callback({ ok: false, error: "Room is full" });
        return;
      }

      socket.join(room.id);
      state.participants.set(data.user.id, { user: data.user, socketId: socket.id });
      socket.data.roomId = room.id;
      socket.data.userId = data.user.id;

      joinRoom(room.id, data.user);

      // Load workspace for the joining user
      const workspace = loadWorkspace(room.id);

      const sysMsg = {
        id: msgId(),
        type: "system" as const,
        author: "System",
        authorId: "system",
        text: `${data.user.nickname} joined the room`,
        time: new Date().toISOString(),
      };
      state.chat.push(sysMsg);

      if (callback) callback({ ok: true, room, chat: state.chat, workspace });
      broadcastPresence(io, room.id);
      broadcastMemberUpdate(io, room.id);
      broadcastChat(io, room.id, sysMsg);
      console.log(`[Socket] ${data.user.nickname} joined room ${room.code}`);
    });

    socket.on("room:leave", () => {
      handleLeave(io, socket);
    });

    socket.on("room:chat", (data: { text: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      if (!state) return;

      const participant = state.participants.get(userId);
      if (!participant) return;

      const msg = {
        id: msgId(),
        type: "text" as const,
        author: participant.user.nickname,
        authorId: userId,
        text: data.text,
        time: new Date().toISOString(),
      };
      state.chat.push(msg);
      if (state.chat.length > 200) state.chat = state.chat.slice(-200);
      broadcastChat(io, roomId, msg);
    });

    // ========== TOOL PRESENCE ==========

    socket.on("room:cursor:tool", (data: { tool: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      if (!state) return;

      const participant = state.participants.get(userId);
      if (participant) {
        participant.activeTool = data.tool;
        broadcastPresence(io, roomId);
      }
    });

    // ========== DEEP DIVE EVENTS ==========

    socket.on("deepdive:ask", (data: { text: string, authorNickname: string, authorAvatar: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      // Create and save user message
      const userMsg: SharedChatMessage = {
        id: genId("ddmsg"),
        role: "user",
        text: data.text,
        authorId: userId,
        authorNickname: data.authorNickname,
        authorAvatar: data.authorAvatar,
        timestamp: new Date().toISOString(),
        reactions: [],
        savedAsInsight: false,
      };

      addDeepDiveMessage(roomId, userMsg);
      incrementMemberContribution(roomId, userId);

      // Broadcast user question to all
      io.to(roomId).emit("deepdive:message", { message: userMsg });

      // AI response will be handled via REST endpoint and then broadcast
    });

    socket.on("deepdive:ai-response", (data: { message: SharedChatMessage }) => {
      const { roomId } = socket.data;
      if (!roomId) return;

      addDeepDiveMessage(roomId, data.message);
      io.to(roomId).emit("deepdive:response", { message: data.message });
    });

    socket.on("deepdive:react", (data: { messageId: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const reactions = addDeepDiveReaction(roomId, data.messageId, userId);
      io.to(roomId).emit("deepdive:reacted", { messageId: data.messageId, reactions });
    });

    socket.on("deepdive:save-insight", (data: { messageId: string; tags: string[] }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      const participant = state?.participants.get(userId);
      const nickname = participant?.user.nickname || "Unknown";

      const insight = saveInsight(roomId, data.messageId, userId, nickname, data.tags);
      if (insight) {
        incrementMemberContribution(roomId, userId);
        io.to(roomId).emit("deepdive:insight-saved", { insight });
      }
    });

    // ========== FLASHCARD EVENTS ==========

    socket.on("fc:add", (data: { front: string; back: string; topicName: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      const participant = state?.participants.get(userId);
      if (!participant) return;

      const card = addFlashcard(roomId, {
        front: data.front,
        back: data.back,
        topicName: data.topicName,
        createdBy: userId,
        createdByNickname: participant.user.nickname,
        source: "manual",
      });

      incrementMemberContribution(roomId, userId);
      io.to(roomId).emit("fc:added", { card });
    });

    socket.on("fc:edit", (data: { cardId: string; front?: string; back?: string; topicName?: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      const participant = state?.participants.get(userId);
      if (!participant) return;

      const card = updateFlashcard(roomId, data.cardId, {
        front: data.front,
        back: data.back,
        topicName: data.topicName,
      }, userId, participant.user.nickname);

      if (card) {
        io.to(roomId).emit("fc:edited", { card });
      }
    });

    socket.on("fc:delete", (data: { cardId: string }) => {
      const { roomId } = socket.data;
      if (!roomId) return;

      const ok = deleteFlashcardWs(roomId, data.cardId);
      if (ok) {
        io.to(roomId).emit("fc:deleted", { cardId: data.cardId });
      }
    });

    socket.on("fc:vote", (data: { cardId: string; vote: "up" | "down" }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const votes = voteFlashcard(roomId, data.cardId, userId, data.vote);
      io.to(roomId).emit("fc:voted", { cardId: data.cardId, votes });
    });

    socket.on("fc:ai-generate", () => {
      // AI generation is handled via REST endpoint
      // The client calls the REST endpoint, gets cards, then emits fc:ai-generated
    });

    socket.on("fc:ai-generated", (data: { cards: SharedFlashcard[] }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      addBulkFlashcards(roomId, data.cards);
      incrementMemberContribution(roomId, userId);
      io.to(roomId).emit("fc:ai-generated", { cards: data.cards });
    });

    // ========== MIND MAP EVENTS ==========

    socket.on("mindmap:annotate", (data: { nodeLabel: string; type: "note" | "question" | "example" | "understood"; text: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      const participant = state?.participants.get(userId);
      if (!participant) return;

      const annotation = addMindMapAnnotation(roomId, {
        nodeLabel: data.nodeLabel,
        type: data.type,
        text: data.text,
        authorId: userId,
        authorNickname: participant.user.nickname,
        authorAvatar: participant.user.avatar,
      });

      incrementMemberContribution(roomId, userId);
      io.to(roomId).emit("mindmap:annotated", { annotation });
    });

    socket.on("mindmap:reply", (data: { annotationId: string; text: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      const participant = state?.participants.get(userId);
      if (!participant) return;

      const reply = addAnnotationReply(roomId, data.annotationId, {
        text: data.text,
        authorId: userId,
        authorNickname: participant.user.nickname,
      });

      if (reply) {
        io.to(roomId).emit("mindmap:replied", { annotationId: data.annotationId, reply });
      }
    });

    socket.on("mindmap:ai-response", (data: { annotation: any }) => {
      const { roomId } = socket.data;
      if (!roomId) return;

      io.to(roomId).emit("mindmap:ai-response", { annotation: data.annotation });
    });

    // ========== NOTES EVENTS ==========

    socket.on("notes:add", (data: { title: string; content: string; category: string; source?: string; sourceId?: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      const participant = state?.participants.get(userId);
      if (!participant) return;

      const note = addNote(roomId, {
        title: data.title,
        content: data.content,
        category: data.category as any,
        authorId: userId,
        authorNickname: participant.user.nickname,
        authorAvatar: participant.user.avatar,
        source: (data.source as any) || "manual",
        sourceId: data.sourceId,
      });

      incrementMemberContribution(roomId, userId);
      io.to(roomId).emit("notes:added", { note });
    });

    socket.on("notes:edit", (data: { noteId: string; title?: string; content?: string; category?: string }) => {
      const { roomId, userId } = socket.data;
      if (!roomId || !userId) return;

      const state = activeRooms.get(roomId);
      const participant = state?.participants.get(userId);
      if (!participant) return;

      const note = updateNote(roomId, data.noteId, {
        title: data.title,
        content: data.content,
        category: data.category as any,
      }, userId, participant.user.nickname);

      if (note) {
        io.to(roomId).emit("notes:edited", { note });
      }
    });

    socket.on("notes:delete", (data: { noteId: string }) => {
      const { roomId } = socket.data;
      if (!roomId) return;

      const ok = deleteNoteWs(roomId, data.noteId);
      if (ok) {
        io.to(roomId).emit("notes:deleted", { noteId: data.noteId });
      }
    });

    socket.on("notes:pin", (data: { noteId: string }) => {
      const { roomId } = socket.data;
      if (!roomId) return;

      const pinned = toggleNotePin(roomId, data.noteId);
      if (pinned !== null) {
        io.to(roomId).emit("notes:pinned", { noteId: data.noteId, pinned });
      }
    });

    // ========== NOTIFICATIONS ==========

    socket.on("notification:request-count", () => {
      const count = getUnreadCount();
      socket.emit("notification:badge-update", { count });
    });

    // ========== DISCONNECT ==========

    socket.on("disconnect", () => {
      handleLeave(io, socket);
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}

function handleLeave(io: SocketServer, socket: Socket) {
  const { roomId, userId } = socket.data;
  if (!roomId || !userId) return;

  const state = activeRooms.get(roomId);
  if (!state) return;

  const participant = state.participants.get(userId);
  const nickname = participant?.user.nickname || "Someone";

  socket.leave(roomId);
  state.participants.delete(userId);
  leaveRoom(roomId, userId);

  const sysMsg = {
    id: msgId(),
    type: "system" as const,
    author: "System",
    authorId: "system",
    text: `${nickname} left the room`,
    time: new Date().toISOString(),
  };
  state.chat.push(sysMsg);
  broadcastChat(io, roomId, sysMsg);

  if (state.participants.size === 0) {
    activeRooms.delete(roomId);
  } else {
    broadcastPresence(io, roomId);
    broadcastMemberUpdate(io, roomId);
  }

  socket.data.roomId = null;
  socket.data.userId = null;
}
