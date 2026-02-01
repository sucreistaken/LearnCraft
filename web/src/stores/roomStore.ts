// src/stores/roomStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  StudyUser,
  StudyRoom,
  RoomChatMessage,
  RoomMember,
  RoomWorkspace,
  WorkspaceTool,
  SharedChatMessage,
  SharedInsight,
  SharedFlashcard,
  FlashcardVote,
  MindMapAnnotation,
  AnnotationReply,
  SharedNote,
  MessageReaction,
} from "../types";
import { getSocket } from "../services/socket";
import { roomsApi, roomWorkspaceApi } from "../services/api";

// Avatar color palette
const AVATAR_COLORS = [
  "#4f46e5", "#0891b2", "#059669", "#d97706",
  "#dc2626", "#7c3aed", "#db2777", "#2563eb",
];

function randomAvatar(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

function generateUserId(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

interface RoomState {
  // Identity
  identity: StudyUser | null;
  setNickname: (nickname: string) => void;

  // Connection
  connected: boolean;
  connecting: boolean;

  // Room
  currentRoom: StudyRoom | null;
  chat: RoomChatMessage[];
  participants: (StudyUser & { activeTool?: string })[];
  members: RoomMember[];
  myRooms: StudyRoom[];

  // Workspace
  workspace: RoomWorkspace;
  activeTool: WorkspaceTool;

  // UI state
  showCreateModal: boolean;
  showJoinModal: boolean;
  chatOpen: boolean;
  error: string | null;

  // Actions
  setShowCreateModal: (show: boolean) => void;
  setShowJoinModal: (show: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setError: (error: string | null) => void;
  setActiveTool: (tool: WorkspaceTool) => void;

  // Room actions
  createRoom: (name: string, lessonId: string, lessonTitle: string, settings?: any) => Promise<void>;
  joinRoomByCode: (code: string) => Promise<void>;
  joinRoom: (roomId: string) => Promise<void>;
  leaveRoom: () => void;
  sendChat: (text: string) => void;
  loadMyRooms: () => Promise<void>;

  // Deep Dive actions
  askDeepDive: (text: string) => Promise<void>;
  reactToMessage: (messageId: string) => void;
  saveAsInsight: (messageId: string, tags: string[]) => void;

  // Flashcard actions
  addFlashcard: (front: string, back: string, topicName: string) => void;
  editFlashcard: (cardId: string, front?: string, back?: string, topicName?: string) => void;
  deleteFlashcard: (cardId: string) => void;
  voteFlashcard: (cardId: string, vote: "up" | "down") => void;
  generateFlashcards: () => Promise<void>;

  // Mind Map actions
  addAnnotation: (nodeLabel: string, type: "note" | "question" | "example" | "understood", text: string) => void;
  replyToAnnotation: (annotationId: string, text: string) => void;
  askMindMapAI: (nodeLabel: string, question?: string) => Promise<void>;

  // Notes actions
  addNote: (title: string, content: string, category: string, source?: string, sourceId?: string) => void;
  editNote: (noteId: string, title?: string, content?: string, category?: string) => void;
  deleteNote: (noteId: string) => void;
  pinNote: (noteId: string) => void;

  // Socket listeners setup
  _listenersAttached: boolean;
  _attachListeners: () => void;
}

const defaultWorkspace: RoomWorkspace = {
  deepDive: { messages: [], savedInsights: [] },
  flashcards: [],
  mindMapAnnotations: [],
  notes: [],
};

export const useRoomStore = create<RoomState>()(
  persist(
    (set, get) => ({
      // Identity
      identity: null,
      setNickname: (nickname: string) => {
        const existing = get().identity;
        const identity: StudyUser = {
          id: existing?.id || generateUserId(),
          nickname,
          avatar: existing?.avatar || randomAvatar(),
          joinedAt: existing?.joinedAt || new Date().toISOString(),
        };
        set({ identity });
      },

      // Connection
      connected: false,
      connecting: false,

      // Room
      currentRoom: null,
      chat: [],
      participants: [],
      members: [],
      myRooms: [],

      // Workspace
      workspace: { ...defaultWorkspace },
      activeTool: "deep-dive" as WorkspaceTool,

      // UI
      showCreateModal: false,
      showJoinModal: false,
      chatOpen: true,
      error: null,

      setShowCreateModal: (show) => set({ showCreateModal: show }),
      setShowJoinModal: (show) => set({ showJoinModal: show }),
      setChatOpen: (open) => set({ chatOpen: open }),
      setError: (error) => set({ error }),
      setActiveTool: (tool) => {
        set({ activeTool: tool });
        const socket = getSocket();
        socket.emit("room:cursor:tool", { tool });
      },

      // ======== Room Actions ========

      createRoom: async (name, lessonId, lessonTitle, settings) => {
        const identity = get().identity;
        if (!identity) return;

        set({ connecting: true, error: null });
        get()._attachListeners();

        const socket = getSocket();
        socket.emit(
          "room:create",
          { name, user: identity, settings, lessonId, lessonTitle },
          (res: any) => {
            if (res.ok) {
              set({
                currentRoom: res.room,
                chat: [],
                participants: [identity],
                members: res.room.members || [],
                workspace: res.workspace || { ...defaultWorkspace },
                connecting: false,
                showCreateModal: false,
              });
            } else {
              set({ error: res.error || "Failed to create room", connecting: false });
            }
          }
        );
      },

      joinRoomByCode: async (code) => {
        set({ connecting: true, error: null });
        try {
          const res = await roomsApi.getByCode(code);
          if (res.ok && res.room) {
            await get().joinRoom(res.room.id);
          } else {
            set({ error: res.error || "Room not found", connecting: false });
          }
        } catch {
          set({ error: "Failed to find room", connecting: false });
        }
      },

      joinRoom: async (roomId) => {
        const identity = get().identity;
        if (!identity) return;

        set({ connecting: true, error: null });
        get()._attachListeners();

        const socket = getSocket();
        socket.emit(
          "room:join",
          { roomId, user: identity },
          (res: any) => {
            if (res.ok) {
              set({
                currentRoom: res.room,
                chat: res.chat || [],
                members: res.room.members || [],
                workspace: res.workspace || { ...defaultWorkspace },
                connecting: false,
                showJoinModal: false,
              });
            } else {
              set({ error: res.error || "Failed to join room", connecting: false });
            }
          }
        );
      },

      leaveRoom: () => {
        const socket = getSocket();
        socket.emit("room:leave");
        set({
          currentRoom: null,
          chat: [],
          participants: [],
          members: [],
          workspace: { ...defaultWorkspace },
          connected: false,
          activeTool: "deep-dive",
        });
      },

      sendChat: (text) => {
        if (!text.trim()) return;
        const socket = getSocket();
        socket.emit("room:chat", { text: text.trim() });
      },

      loadMyRooms: async () => {
        const identity = get().identity;
        if (!identity) return;
        try {
          const res = await roomsApi.getMyRooms(identity.id);
          if (res.ok && res.rooms) {
            set({ myRooms: res.rooms });
          }
        } catch {
          // silent fail
        }
      },

      // ======== Deep Dive Actions ========

      askDeepDive: async (text) => {
        const identity = get().identity;
        const room = get().currentRoom;
        if (!identity || !room) return;

        const socket = getSocket();

        // Emit user question via socket
        socket.emit("deepdive:ask", {
          text,
          authorNickname: identity.nickname,
          authorAvatar: identity.avatar,
        });

        // Call REST API for AI response
        try {
          const history = get().workspace.deepDive.messages.map((m) => ({
            role: m.role,
            content: m.text,
          }));

          const res = await roomWorkspaceApi.deepDiveAsk(room.id, text, history);
          if (res.ok && res.text) {
            const aiMsg: SharedChatMessage = {
              id: `ddmsg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              role: "assistant",
              text: res.text,
              authorId: "ai",
              authorNickname: "AI Assistant",
              authorAvatar: "#6366f1",
              timestamp: new Date().toISOString(),
              reactions: [],
              savedAsInsight: false,
            };

            // Save and broadcast AI response via socket
            socket.emit("deepdive:ai-response", { message: aiMsg });
          }
        } catch (err) {
          console.error("Deep dive AI error:", err);
        }
      },

      reactToMessage: (messageId) => {
        const socket = getSocket();
        socket.emit("deepdive:react", { messageId });
      },

      saveAsInsight: (messageId, tags) => {
        const socket = getSocket();
        socket.emit("deepdive:save-insight", { messageId, tags });
      },

      // ======== Flashcard Actions ========

      addFlashcard: (front, back, topicName) => {
        const socket = getSocket();
        socket.emit("fc:add", { front, back, topicName });
      },

      editFlashcard: (cardId, front, back, topicName) => {
        const socket = getSocket();
        socket.emit("fc:edit", { cardId, front, back, topicName });
      },

      deleteFlashcard: (cardId) => {
        const socket = getSocket();
        socket.emit("fc:delete", { cardId });
      },

      voteFlashcard: (cardId, vote) => {
        const socket = getSocket();
        socket.emit("fc:vote", { cardId, vote });
      },

      generateFlashcards: async () => {
        const room = get().currentRoom;
        const identity = get().identity;
        if (!room || !identity) return;

        try {
          const res = await roomWorkspaceApi.generateFlashcards(room.id);
          if (res.ok && res.cards) {
            const cards: SharedFlashcard[] = res.cards.map((c: any) => ({
              id: `fc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
              front: c.front,
              back: c.back,
              topicName: c.topicName || "",
              createdBy: identity.id,
              createdByNickname: identity.nickname,
              createdAt: new Date().toISOString(),
              votes: [],
              source: "ai-generated" as const,
            }));

            const socket = getSocket();
            socket.emit("fc:ai-generated", { cards });
          }
        } catch (err) {
          console.error("Flashcard generation error:", err);
        }
      },

      // ======== Mind Map Actions ========

      addAnnotation: (nodeLabel, type, text) => {
        const socket = getSocket();
        socket.emit("mindmap:annotate", { nodeLabel, type, text });
      },

      replyToAnnotation: (annotationId, text) => {
        const socket = getSocket();
        socket.emit("mindmap:reply", { annotationId, text });
      },

      askMindMapAI: async (nodeLabel, question) => {
        const room = get().currentRoom;
        const identity = get().identity;
        if (!room || !identity) return;

        try {
          const res = await roomWorkspaceApi.mindMapAsk(room.id, nodeLabel, question);
          if (res.ok && res.text) {
            // Create annotation from AI response
            const socket = getSocket();
            socket.emit("mindmap:annotate", {
              nodeLabel,
              type: "example",
              text: res.text,
            });
          }
        } catch (err) {
          console.error("Mind map AI error:", err);
        }
      },

      // ======== Notes Actions ========

      addNote: (title, content, category, source, sourceId) => {
        const socket = getSocket();
        socket.emit("notes:add", { title, content, category, source, sourceId });
      },

      editNote: (noteId, title, content, category) => {
        const socket = getSocket();
        socket.emit("notes:edit", { noteId, title, content, category });
      },

      deleteNote: (noteId) => {
        const socket = getSocket();
        socket.emit("notes:delete", { noteId });
      },

      pinNote: (noteId) => {
        const socket = getSocket();
        socket.emit("notes:pin", { noteId });
      },

      // ======== Socket Listeners ========

      _listenersAttached: false,
      _attachListeners: () => {
        if (get()._listenersAttached) return;
        set({ _listenersAttached: true });

        const socket = getSocket();

        socket.on("connect", () => set({ connected: true }));
        socket.on("disconnect", () => set({ connected: false }));

        socket.on("room:presence", (users: (StudyUser & { activeTool?: string })[]) => {
          set({ participants: users });
        });

        socket.on("room:member:update", (members: RoomMember[]) => {
          set({ members });
        });

        socket.on("room:chat", (msg: RoomChatMessage) => {
          set((s) => ({ chat: [...s.chat, msg] }));
        });

        // Deep Dive events
        socket.on("deepdive:message", (data: { message: SharedChatMessage }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              deepDive: {
                ...s.workspace.deepDive,
                messages: [...s.workspace.deepDive.messages, data.message],
              },
            },
          }));
        });

        socket.on("deepdive:response", (data: { message: SharedChatMessage }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              deepDive: {
                ...s.workspace.deepDive,
                messages: [...s.workspace.deepDive.messages, data.message],
              },
            },
          }));
        });

        socket.on("deepdive:reacted", (data: { messageId: string; reactions: MessageReaction[] }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              deepDive: {
                ...s.workspace.deepDive,
                messages: s.workspace.deepDive.messages.map((m) =>
                  m.id === data.messageId ? { ...m, reactions: data.reactions } : m
                ),
              },
            },
          }));
        });

        socket.on("deepdive:insight-saved", (data: { insight: SharedInsight }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              deepDive: {
                ...s.workspace.deepDive,
                savedInsights: [...s.workspace.deepDive.savedInsights, data.insight],
                messages: s.workspace.deepDive.messages.map((m) =>
                  m.id === data.insight.sourceMessageId ? { ...m, savedAsInsight: true } : m
                ),
              },
            },
          }));
        });

        // Flashcard events
        socket.on("fc:added", (data: { card: SharedFlashcard }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              flashcards: [...s.workspace.flashcards, data.card],
            },
          }));
        });

        socket.on("fc:edited", (data: { card: SharedFlashcard }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              flashcards: s.workspace.flashcards.map((c) =>
                c.id === data.card.id ? data.card : c
              ),
            },
          }));
        });

        socket.on("fc:deleted", (data: { cardId: string }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              flashcards: s.workspace.flashcards.filter((c) => c.id !== data.cardId),
            },
          }));
        });

        socket.on("fc:voted", (data: { cardId: string; votes: FlashcardVote[] }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              flashcards: s.workspace.flashcards.map((c) =>
                c.id === data.cardId ? { ...c, votes: data.votes } : c
              ),
            },
          }));
        });

        socket.on("fc:ai-generated", (data: { cards: SharedFlashcard[] }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              flashcards: [...s.workspace.flashcards, ...data.cards],
            },
          }));
        });

        // Mind Map events
        socket.on("mindmap:annotated", (data: { annotation: MindMapAnnotation }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              mindMapAnnotations: [...s.workspace.mindMapAnnotations, data.annotation],
            },
          }));
        });

        socket.on("mindmap:replied", (data: { annotationId: string; reply: AnnotationReply }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              mindMapAnnotations: s.workspace.mindMapAnnotations.map((a) =>
                a.id === data.annotationId
                  ? { ...a, replies: [...a.replies, data.reply] }
                  : a
              ),
            },
          }));
        });

        socket.on("mindmap:ai-response", (data: { annotation: MindMapAnnotation }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              mindMapAnnotations: [...s.workspace.mindMapAnnotations, data.annotation],
            },
          }));
        });

        // Notes events
        socket.on("notes:added", (data: { note: SharedNote }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              notes: [...s.workspace.notes, data.note],
            },
          }));
        });

        socket.on("notes:edited", (data: { note: SharedNote }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              notes: s.workspace.notes.map((n) =>
                n.id === data.note.id ? data.note : n
              ),
            },
          }));
        });

        socket.on("notes:deleted", (data: { noteId: string }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              notes: s.workspace.notes.filter((n) => n.id !== data.noteId),
            },
          }));
        });

        socket.on("notes:pinned", (data: { noteId: string; pinned: boolean }) => {
          set((s) => ({
            workspace: {
              ...s.workspace,
              notes: s.workspace.notes.map((n) =>
                n.id === data.noteId ? { ...n, pinned: data.pinned } : n
              ),
            },
          }));
        });
      },
    }),
    {
      name: "lc.identity",
      partialize: (state) => ({
        identity: state.identity,
      }),
    }
  )
);
