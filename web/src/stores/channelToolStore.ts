import { create } from "zustand";
import type {
  ChannelToolData,
  ChannelFlashcardItem,
  ChannelDeepDiveMessage,
  ChannelNoteItem,
  ChannelSprintData,
  ChannelMindMapData,
  ChannelQuizData,
} from "../types";
import { channelToolApi } from "../services/channelToolApi";
import { getCollabSocket } from "../services/collabSocket";

interface ChannelToolState {
  dataByChannel: Record<string, ChannelToolData>;
  loading: Record<string, boolean>;
  error: string | null;

  loadToolData: (channelId: string) => Promise<void>;
  setToolData: (channelId: string, data: ChannelToolData) => void;

  // Convenience updaters
  updateQuiz: (channelId: string, quiz: ChannelQuizData) => void;
  addFlashcardToStore: (channelId: string, card: ChannelFlashcardItem) => void;
  addDeepDiveMessages: (channelId: string, messages: ChannelDeepDiveMessage[]) => void;
  updateMindMap: (channelId: string, mindMap: ChannelMindMapData) => void;
  updateSprint: (channelId: string, sprint: ChannelSprintData) => void;
  addNoteToStore: (channelId: string, note: ChannelNoteItem) => void;
  updateNoteInStore: (channelId: string, note: ChannelNoteItem) => void;
  removeNoteFromStore: (channelId: string, noteId: string) => void;

  setupListeners: () => void;
}

const EMPTY_TOOL_DATA: ChannelToolData = { channelId: "", toolType: "" };

export const useChannelToolStore = create<ChannelToolState>((set, get) => ({
  dataByChannel: {},
  loading: {},
  error: null,

  loadToolData: async (channelId: string) => {
    set((s) => ({ loading: { ...s.loading, [channelId]: true } }));
    try {
      const data = await channelToolApi.getToolData(channelId);
      set((s) => ({
        dataByChannel: { ...s.dataByChannel, [channelId]: data },
        loading: { ...s.loading, [channelId]: false },
        error: null,
      }));
    } catch (err: any) {
      set((s) => ({
        loading: { ...s.loading, [channelId]: false },
        error: err.message,
      }));
    }
  },

  setToolData: (channelId, data) => {
    set((s) => ({
      dataByChannel: { ...s.dataByChannel, [channelId]: data },
    }));
  },

  updateQuiz: (channelId, quiz) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      return {
        dataByChannel: { ...s.dataByChannel, [channelId]: { ...existing, quiz } },
      };
    });
  },

  addFlashcardToStore: (channelId, card) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      const cards = existing.flashcards?.cards ?? [];
      return {
        dataByChannel: {
          ...s.dataByChannel,
          [channelId]: {
            ...existing,
            flashcards: { cards: [...cards, card] },
          },
        },
      };
    });
  },

  addDeepDiveMessages: (channelId, messages) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      const prev = existing.deepDive?.messages ?? [];
      return {
        dataByChannel: {
          ...s.dataByChannel,
          [channelId]: {
            ...existing,
            deepDive: { messages: [...prev, ...messages] },
          },
        },
      };
    });
  },

  updateMindMap: (channelId, mindMap) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      return {
        dataByChannel: { ...s.dataByChannel, [channelId]: { ...existing, mindMap } },
      };
    });
  },

  updateSprint: (channelId, sprint) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      return {
        dataByChannel: { ...s.dataByChannel, [channelId]: { ...existing, sprint } },
      };
    });
  },

  addNoteToStore: (channelId, note) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      const items = existing.notes?.items ?? [];
      return {
        dataByChannel: {
          ...s.dataByChannel,
          [channelId]: {
            ...existing,
            notes: { items: [...items, note] },
          },
        },
      };
    });
  },

  updateNoteInStore: (channelId, note) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      const items = (existing.notes?.items ?? []).map((n) => (n.id === note.id ? note : n));
      return {
        dataByChannel: {
          ...s.dataByChannel,
          [channelId]: { ...existing, notes: { items } },
        },
      };
    });
  },

  removeNoteFromStore: (channelId, noteId) => {
    set((s) => {
      const existing = s.dataByChannel[channelId] || { ...EMPTY_TOOL_DATA, channelId };
      const items = (existing.notes?.items ?? []).filter((n) => n.id !== noteId);
      return {
        dataByChannel: {
          ...s.dataByChannel,
          [channelId]: { ...existing, notes: { items } },
        },
      };
    });
  },

  setupListeners: () => {
    const socket = getCollabSocket();

    socket.on("tool:data:update", (data: { channelId: string; toolData: ChannelToolData }) => {
      get().setToolData(data.channelId, data.toolData);
    });

    socket.on("tool:quiz:answered", (data: { channelId: string; result: any }) => {
      const existing = get().dataByChannel[data.channelId];
      if (existing?.quiz) {
        get().updateQuiz(data.channelId, { ...existing.quiz, scores: data.result.scores });
      }
    });

    socket.on("tool:flashcard:added", (data: { channelId: string; card: ChannelFlashcardItem }) => {
      get().addFlashcardToStore(data.channelId, data.card);
    });

    socket.on("tool:deepdive:newmsg", (data: { channelId: string; userMessage: ChannelDeepDiveMessage; aiMessage: ChannelDeepDiveMessage }) => {
      get().addDeepDiveMessages(data.channelId, [data.userMessage, data.aiMessage]);
    });

    socket.on("tool:mindmap:updated", (data: { channelId: string; mindMap: ChannelMindMapData }) => {
      get().updateMindMap(data.channelId, data.mindMap);
    });

    socket.on("tool:sprint:updated", (data: { channelId: string; sprint: ChannelSprintData }) => {
      get().updateSprint(data.channelId, data.sprint);
    });

    socket.on("tool:notes:added", (data: { channelId: string; note: ChannelNoteItem }) => {
      get().addNoteToStore(data.channelId, data.note);
    });

    socket.on("tool:notes:edited", (data: { channelId: string; note: ChannelNoteItem }) => {
      get().updateNoteInStore(data.channelId, data.note);
    });

    socket.on("tool:notes:deleted", (data: { channelId: string; noteId: string }) => {
      get().removeNoteFromStore(data.channelId, data.noteId);
    });

    socket.on("tool:notes:pinned", (data: { channelId: string; note: ChannelNoteItem }) => {
      get().updateNoteInStore(data.channelId, data.note);
    });
  },
}));
