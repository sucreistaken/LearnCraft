// controllers/workspaceController.ts
import path from "path";
import { readJSON, writeJSON, ensureDir } from "../utils/file-Handler";

// ====== Types ======

export interface MessageReaction {
  userId: string;
  type: "helpful";
}

export interface SharedChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  authorId: string;
  authorNickname: string;
  authorAvatar: string;
  timestamp: string;
  reactions: MessageReaction[];
  savedAsInsight: boolean;
}

export interface SharedInsight {
  id: string;
  text: string;
  sourceMessageId: string;
  savedBy: string;
  savedByNickname: string;
  tags: string[];
  timestamp: string;
}

export interface SharedDeepDiveState {
  messages: SharedChatMessage[];
  savedInsights: SharedInsight[];
}

export interface FlashcardVote {
  userId: string;
  vote: "up" | "down";
}

export interface SharedFlashcard {
  id: string;
  front: string;
  back: string;
  topicName: string;
  createdBy: string;
  createdByNickname: string;
  createdAt: string;
  editedBy?: string;
  editedByNickname?: string;
  editedAt?: string;
  votes: FlashcardVote[];
  source: "manual" | "ai-generated";
}

export interface AnnotationReply {
  id: string;
  text: string;
  authorId: string;
  authorNickname: string;
  timestamp: string;
}

export interface MindMapAnnotation {
  id: string;
  nodeLabel: string;
  type: "note" | "question" | "example" | "understood";
  text: string;
  authorId: string;
  authorNickname: string;
  authorAvatar: string;
  timestamp: string;
  replies: AnnotationReply[];
}

export interface SharedNote {
  id: string;
  title: string;
  content: string;
  category: "concept" | "formula" | "example" | "tip" | "warning" | "summary";
  authorId: string;
  authorNickname: string;
  authorAvatar: string;
  createdAt: string;
  editedAt?: string;
  editedBy?: string;
  editedByNickname?: string;
  source?: "manual" | "deep-dive" | "mind-map";
  sourceId?: string;
  pinned: boolean;
}

export interface RoomWorkspace {
  deepDive: SharedDeepDiveState;
  flashcards: SharedFlashcard[];
  mindMapAnnotations: MindMapAnnotation[];
  notes: SharedNote[];
}

// ====== Paths ======

const DATA_DIR = path.join(process.cwd(), "backend", "data", "workspaces");
ensureDir(DATA_DIR);

function workspacePath(roomId: string): string {
  return path.join(DATA_DIR, `${roomId}.json`);
}

function defaultWorkspace(): RoomWorkspace {
  return {
    deepDive: { messages: [], savedInsights: [] },
    flashcards: [],
    mindMapAnnotations: [],
    notes: [],
  };
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ====== Workspace CRUD ======

export function loadWorkspace(roomId: string): RoomWorkspace {
  const data = readJSON<RoomWorkspace>(workspacePath(roomId));
  return data || defaultWorkspace();
}

export function saveWorkspace(roomId: string, workspace: RoomWorkspace): void {
  writeJSON(workspacePath(roomId), workspace);
}

export function deleteWorkspaceFile(roomId: string): void {
  const fs = require("fs");
  const p = workspacePath(roomId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ====== Deep Dive ======

export function addDeepDiveMessage(roomId: string, message: SharedChatMessage): void {
  const ws = loadWorkspace(roomId);
  ws.deepDive.messages.push(message);
  // Limit to 500 messages
  if (ws.deepDive.messages.length > 500) {
    ws.deepDive.messages = ws.deepDive.messages.slice(-500);
  }
  saveWorkspace(roomId, ws);
}

export function addDeepDiveReaction(roomId: string, messageId: string, userId: string): MessageReaction[] {
  const ws = loadWorkspace(roomId);
  const msg = ws.deepDive.messages.find((m) => m.id === messageId);
  if (!msg) return [];

  // Toggle reaction
  const existingIdx = msg.reactions.findIndex((r) => r.userId === userId);
  if (existingIdx >= 0) {
    msg.reactions.splice(existingIdx, 1);
  } else {
    msg.reactions.push({ userId, type: "helpful" });
  }
  saveWorkspace(roomId, ws);
  return msg.reactions;
}

export function saveInsight(roomId: string, messageId: string, savedBy: string, savedByNickname: string, tags: string[]): SharedInsight | null {
  const ws = loadWorkspace(roomId);
  const msg = ws.deepDive.messages.find((m) => m.id === messageId);
  if (!msg) return null;

  msg.savedAsInsight = true;

  const insight: SharedInsight = {
    id: genId("insight"),
    text: msg.text,
    sourceMessageId: messageId,
    savedBy,
    savedByNickname,
    tags,
    timestamp: new Date().toISOString(),
  };
  ws.deepDive.savedInsights.push(insight);
  saveWorkspace(roomId, ws);
  return insight;
}

// ====== Flashcards ======

export function addFlashcard(roomId: string, card: Omit<SharedFlashcard, "id" | "createdAt" | "votes">): SharedFlashcard {
  const ws = loadWorkspace(roomId);
  const newCard: SharedFlashcard = {
    ...card,
    id: genId("fc"),
    createdAt: new Date().toISOString(),
    votes: [],
  };
  ws.flashcards.push(newCard);
  saveWorkspace(roomId, ws);
  return newCard;
}

export function updateFlashcard(roomId: string, cardId: string, updates: { front?: string; back?: string; topicName?: string }, editedBy: string, editedByNickname: string): SharedFlashcard | null {
  const ws = loadWorkspace(roomId);
  const card = ws.flashcards.find((c) => c.id === cardId);
  if (!card) return null;

  if (updates.front !== undefined) card.front = updates.front;
  if (updates.back !== undefined) card.back = updates.back;
  if (updates.topicName !== undefined) card.topicName = updates.topicName;
  card.editedBy = editedBy;
  card.editedByNickname = editedByNickname;
  card.editedAt = new Date().toISOString();

  saveWorkspace(roomId, ws);
  return card;
}

export function deleteFlashcard(roomId: string, cardId: string): boolean {
  const ws = loadWorkspace(roomId);
  const idx = ws.flashcards.findIndex((c) => c.id === cardId);
  if (idx < 0) return false;
  ws.flashcards.splice(idx, 1);
  saveWorkspace(roomId, ws);
  return true;
}

export function voteFlashcard(roomId: string, cardId: string, userId: string, vote: "up" | "down"): FlashcardVote[] {
  const ws = loadWorkspace(roomId);
  const card = ws.flashcards.find((c) => c.id === cardId);
  if (!card) return [];

  const existingIdx = card.votes.findIndex((v) => v.userId === userId);
  if (existingIdx >= 0) {
    if (card.votes[existingIdx].vote === vote) {
      // Same vote: remove it (toggle off)
      card.votes.splice(existingIdx, 1);
    } else {
      // Different vote: update
      card.votes[existingIdx].vote = vote;
    }
  } else {
    card.votes.push({ userId, vote });
  }

  saveWorkspace(roomId, ws);
  return card.votes;
}

export function addBulkFlashcards(roomId: string, cards: SharedFlashcard[]): SharedFlashcard[] {
  const ws = loadWorkspace(roomId);
  ws.flashcards.push(...cards);
  saveWorkspace(roomId, ws);
  return cards;
}

// ====== Mind Map Annotations ======

export function addMindMapAnnotation(roomId: string, annotation: Omit<MindMapAnnotation, "id" | "timestamp" | "replies">): MindMapAnnotation {
  const ws = loadWorkspace(roomId);
  const newAnnotation: MindMapAnnotation = {
    ...annotation,
    id: genId("ann"),
    timestamp: new Date().toISOString(),
    replies: [],
  };
  ws.mindMapAnnotations.push(newAnnotation);
  saveWorkspace(roomId, ws);
  return newAnnotation;
}

export function addAnnotationReply(roomId: string, annotationId: string, reply: Omit<AnnotationReply, "id" | "timestamp">): AnnotationReply | null {
  const ws = loadWorkspace(roomId);
  const annotation = ws.mindMapAnnotations.find((a) => a.id === annotationId);
  if (!annotation) return null;

  const newReply: AnnotationReply = {
    ...reply,
    id: genId("reply"),
    timestamp: new Date().toISOString(),
  };
  annotation.replies.push(newReply);
  saveWorkspace(roomId, ws);
  return newReply;
}

export function getAnnotationsForNode(roomId: string, nodeLabel: string): MindMapAnnotation[] {
  const ws = loadWorkspace(roomId);
  return ws.mindMapAnnotations.filter((a) => a.nodeLabel === nodeLabel);
}

// ====== Notes ======

export function addNote(roomId: string, note: Omit<SharedNote, "id" | "createdAt" | "pinned">): SharedNote {
  const ws = loadWorkspace(roomId);
  const newNote: SharedNote = {
    ...note,
    id: genId("note"),
    createdAt: new Date().toISOString(),
    pinned: false,
  };
  ws.notes.push(newNote);
  saveWorkspace(roomId, ws);
  return newNote;
}

export function updateNote(roomId: string, noteId: string, updates: { title?: string; content?: string; category?: SharedNote["category"] }, editedBy: string, editedByNickname: string): SharedNote | null {
  const ws = loadWorkspace(roomId);
  const note = ws.notes.find((n) => n.id === noteId);
  if (!note) return null;

  if (updates.title !== undefined) note.title = updates.title;
  if (updates.content !== undefined) note.content = updates.content;
  if (updates.category !== undefined) note.category = updates.category;
  note.editedBy = editedBy;
  note.editedByNickname = editedByNickname;
  note.editedAt = new Date().toISOString();

  saveWorkspace(roomId, ws);
  return note;
}

export function deleteNote(roomId: string, noteId: string): boolean {
  const ws = loadWorkspace(roomId);
  const idx = ws.notes.findIndex((n) => n.id === noteId);
  if (idx < 0) return false;
  ws.notes.splice(idx, 1);
  saveWorkspace(roomId, ws);
  return true;
}

export function toggleNotePin(roomId: string, noteId: string): boolean | null {
  const ws = loadWorkspace(roomId);
  const note = ws.notes.find((n) => n.id === noteId);
  if (!note) return null;

  note.pinned = !note.pinned;
  saveWorkspace(roomId, ws);
  return note.pinned;
}
