import { API_BASE } from "../config";

const BASE = `${API_BASE}/api/auth`;

export interface AuthUser {
  id: string;
  email: string;
  profile: {
    nickname: string;
    avatar: string;
    department?: string;
    bio?: string;
  };
  friendCode: string;
  settings?: {
    theme: "dark" | "light";
    notifications: boolean;
    sound: boolean;
  };
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
  expiresIn: string;
}

async function authRequest<T>(url: string, options?: RequestInit): Promise<T> {
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

export const authApi = {
  register(email: string, password: string, nickname: string) {
    return authRequest<AuthResponse>(`${BASE}/register`, {
      method: "POST",
      body: JSON.stringify({ email, password, nickname }),
    });
  },

  login(email: string, password: string) {
    return authRequest<AuthResponse>(`${BASE}/login`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  me() {
    return authRequest<{ user: AuthUser }>(`${BASE}/me`);
  },

  changePassword(currentPassword: string, newPassword: string) {
    return authRequest<{ ok: boolean }>(`${BASE}/change-password`, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  deleteAccount(password: string) {
    return authRequest<{ ok: boolean }>(`${BASE}/delete-account`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
  },
};
