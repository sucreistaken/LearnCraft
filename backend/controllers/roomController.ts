// controllers/roomController.ts
import path from "path";
import { readJSON, writeJSON, ensureDataFiles } from "../utils/file-Handler";

// ====== Types ======

export interface StudyUser {
  id: string;
  nickname: string;
  avatar: string;
  joinedAt: string;
}

export interface RoomMember {
  userId: string;
  nickname: string;
  avatar: string;
  joinedAt: string;
  lastSeenAt: string;
  contributionCount: number;
}

export interface RoomSettings {
  maxParticipants: number;
  allowChat: boolean;
  lessonId?: string;
  courseCode?: string;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  hostId: string;
  settings: RoomSettings;
  participants: StudyUser[];
  members: RoomMember[];
  lessonId: string;
  lessonTitle: string;
  activity: any | null;
  createdAt: string;
  // No expiresAt - rooms are permanent
}

// ====== Paths ======

const DATA_DIR = path.join(process.cwd(), "backend", "data");
const ROOMS_PATH = path.join(DATA_DIR, "rooms.json");

ensureDataFiles([{ path: ROOMS_PATH, initial: [] }]);

// ====== Helpers ======

function loadRooms(): Room[] {
  return readJSON<Room[]>(ROOMS_PATH) || [];
}

function saveRooms(data: Room[]) {
  writeJSON(ROOMS_PATH, data);
}

/** Generate a 6-char alphanumeric room code like "MATH42" */
function generateCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 2; i++) code += digits[Math.floor(Math.random() * digits.length)];
  return code;
}

function generateId(): string {
  return `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ====== CRUD ======

export function createRoom(
  name: string,
  hostId: string,
  settings: Partial<RoomSettings> = {},
  lessonId: string = "",
  lessonTitle: string = ""
): Room {
  let rooms = loadRooms();

  // Ensure unique code
  let code = generateCode();
  while (rooms.some((r) => r.code === code)) {
    code = generateCode();
  }

  const room: Room = {
    id: generateId(),
    name,
    code,
    hostId,
    settings: {
      maxParticipants: settings.maxParticipants ?? 10,
      allowChat: settings.allowChat ?? true,
      lessonId: lessonId || settings.lessonId,
      courseCode: settings.courseCode,
    },
    participants: [],
    members: [],
    lessonId: lessonId || settings.lessonId || "",
    lessonTitle: lessonTitle || "",
    activity: null,
    createdAt: new Date().toISOString(),
  };

  rooms.unshift(room);
  saveRooms(rooms);
  return room;
}

export function getRoom(id: string): Room | null {
  const rooms = loadRooms();
  return rooms.find((r) => r.id === id) || null;
}

export function getRoomByCode(code: string): Room | null {
  const rooms = loadRooms();
  return rooms.find((r) => r.code === code.toUpperCase()) || null;
}

export function joinRoom(roomId: string, user: StudyUser): Room | null {
  const rooms = loadRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  // Don't add duplicate participants
  if (!room.participants.some((p) => p.id === user.id)) {
    if (room.participants.length >= room.settings.maxParticipants) return null;
    room.participants.push(user);
  }

  // Track as member (all-time)
  const existingMember = room.members.find((m) => m.userId === user.id);
  if (existingMember) {
    existingMember.lastSeenAt = new Date().toISOString();
    existingMember.nickname = user.nickname;
    existingMember.avatar = user.avatar;
  } else {
    room.members.push({
      userId: user.id,
      nickname: user.nickname,
      avatar: user.avatar,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      contributionCount: 0,
    });
  }

  saveRooms(rooms);
  return room;
}

export function leaveRoom(roomId: string, userId: string): Room | null {
  const rooms = loadRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  room.participants = room.participants.filter((p) => p.id !== userId);

  // Update member lastSeenAt
  const member = room.members.find((m) => m.userId === userId);
  if (member) {
    member.lastSeenAt = new Date().toISOString();
  }

  saveRooms(rooms);
  return room;
}

export function updateRoomActivity(roomId: string, activity: any | null): Room | null {
  const rooms = loadRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return null;

  room.activity = activity;
  saveRooms(rooms);
  return room;
}

export function incrementMemberContribution(roomId: string, userId: string): void {
  const rooms = loadRooms();
  const room = rooms.find((r) => r.id === roomId);
  if (!room) return;

  const member = room.members.find((m) => m.userId === userId);
  if (member) {
    member.contributionCount++;
    saveRooms(rooms);
  }
}

export function listActiveRooms(): Room[] {
  return loadRooms();
}

export function getRoomsByUserId(userId: string): Room[] {
  const rooms = loadRooms();
  return rooms.filter((r) => r.members.some((m) => m.userId === userId));
}

export function deleteRoom(roomId: string, requesterId?: string): boolean {
  const rooms = loadRooms();
  const idx = rooms.findIndex((r) => r.id === roomId);
  if (idx < 0) return false;

  // If requesterId provided, only host can delete
  if (requesterId && rooms[idx].hostId !== requesterId) return false;

  rooms.splice(idx, 1);
  saveRooms(rooms);
  return true;
}
