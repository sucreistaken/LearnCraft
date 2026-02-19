import { API_BASE } from "../config";
import type { StudyServer, ServerMemberInfo, ServerTemplate } from "../types";

const BASE = `${API_BASE}/api/rooms`;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("lc_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const roomsApi = {
  create(name: string, description: string, ownerId: string, iconColor?: string, options?: {
    tags?: string[]; university?: string; isPublic?: boolean; templateId?: string;
  }) {
    return request<StudyServer>(`${BASE}`, {
      method: "POST",
      body: JSON.stringify({ name, description, ownerId, iconColor, ...options }),
    });
  },

  createSolo(name: string, ownerId: string, options?: { topic?: string; templateId?: string; tags?: string[] }) {
    return request<StudyServer>(`${BASE}/solo`, {
      method: "POST",
      body: JSON.stringify({ name, ownerId, ...options }),
    });
  },

  discover(search?: string, tags?: string[]) {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tags?.length) params.set("tag", tags.join(","));
    return request<StudyServer[]>(`${BASE}/discover?${params}`);
  },

  getTemplates() {
    return request<ServerTemplate[]>(`${BASE}/templates`);
  },

  get(id: string) {
    return request<StudyServer>(`${BASE}/${id}`);
  },

  getByInviteCode(code: string) {
    return request<StudyServer>(`${BASE}/invite/${code}`);
  },

  getUserRooms(userId: string) {
    return request<StudyServer[]>(`${BASE}/user/${userId}`);
  },

  update(id: string, userId: string, updates: Record<string, any>) {
    return request<StudyServer>(`${BASE}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ userId, ...updates }),
    });
  },

  updateTopic(id: string, userId: string, topic: string) {
    return request<StudyServer>(`${BASE}/${id}/topic`, {
      method: "PATCH",
      body: JSON.stringify({ userId, topic }),
    });
  },

  join(id: string, userId: string) {
    return request<StudyServer>(`${BASE}/${id}/join`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  joinByInvite(inviteCode: string, userId: string) {
    return request<StudyServer>(`${BASE}/join-invite`, {
      method: "POST",
      body: JSON.stringify({ inviteCode, userId }),
    });
  },

  leave(id: string, userId: string) {
    return request<{ success: boolean }>(`${BASE}/${id}/leave`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  kick(id: string, requesterId: string, targetId: string) {
    return request<{ success: boolean }>(`${BASE}/${id}/kick`, {
      method: "POST",
      body: JSON.stringify({ requesterId, targetId }),
    });
  },

  delete(id: string, userId: string) {
    return request<{ success: boolean }>(`${BASE}/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ userId }),
    });
  },

  archive(id: string, userId: string) {
    return request<StudyServer>(`${BASE}/${id}/archive`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  unarchive(id: string, userId: string) {
    return request<StudyServer>(`${BASE}/${id}/unarchive`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },

  transferOwnership(id: string, currentOwnerId: string, newOwnerId: string) {
    return request<StudyServer>(`${BASE}/${id}/transfer-ownership`, {
      method: "POST",
      body: JSON.stringify({ currentOwnerId, newOwnerId }),
    });
  },

  setMaterial(id: string, userId: string, materialId: string) {
    return request<StudyServer>(`${BASE}/${id}/material`, {
      method: "POST",
      body: JSON.stringify({ userId, materialId }),
    });
  },

  getMembers(id: string) {
    return request<ServerMemberInfo[]>(`${BASE}/${id}/members`);
  },

  regenerateInvite(id: string, userId: string) {
    return request<{ inviteCode: string }>(`${BASE}/${id}/regenerate-invite`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },
};
