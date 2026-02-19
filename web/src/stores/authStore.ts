import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, AuthUser } from "../services/authApi";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;

  register: (email: string, password: string, nickname: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  updateProfile: (profile: Partial<AuthUser["profile"]>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,

      register: async (email, password, nickname) => {
        set({ loading: true, error: null });
        try {
          const res = await authApi.register(email, password, nickname);
          localStorage.setItem("lc_token", res.token);
          set({ user: res.user, token: res.token, isAuthenticated: true, loading: false });
        } catch (err: any) {
          set({ error: err.message, loading: false });
          throw err;
        }
      },

      login: async (email, password) => {
        set({ loading: true, error: null });
        try {
          const res = await authApi.login(email, password);
          localStorage.setItem("lc_token", res.token);
          set({ user: res.user, token: res.token, isAuthenticated: true, loading: false });
        } catch (err: any) {
          set({ error: err.message, loading: false });
          throw err;
        }
      },

      logout: () => {
        localStorage.removeItem("lc_token");
        set({ user: null, token: null, isAuthenticated: false, error: null });
      },

      fetchMe: async () => {
        const token = get().token;
        if (!token) return;
        try {
          set({ loading: true });
          const res = await authApi.me();
          set({ user: res.user, isAuthenticated: true, loading: false });
        } catch {
          // Token invalid/expired
          localStorage.removeItem("lc_token");
          set({ user: null, token: null, isAuthenticated: false, loading: false });
        }
      },

      clearError: () => set({ error: null }),

      updateProfile: (profile) => {
        const user = get().user;
        if (user) {
          set({ user: { ...user, profile: { ...user.profile, ...profile } } });
        }
      },
    }),
    {
      name: "lc-auth",
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
