/**
 * Auth store (client)
 * -------------------
 * Mirrors the server-side session via /api/auth/me and exposes the current
 * user to all client components. Handles login/register/logout actions.
 */
import { create } from "zustand";

export type CurrentUser = {
  id: string;
  username: string;
  displayName: string;
  role: "BOSS" | "ADMIN" | "USER";
  status: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  bio: string | null;
  totalSeconds: number;
  currentRank: number;
};

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  initialized: boolean;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: CurrentUser | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,
  fetchMe: async () => {
    set({ loading: true });
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) {
        set({ user: null, loading: false, initialized: true });
        return;
      }
      const json = await res.json();
      // /api/auth/me returns { ok, data: { user: {...} } }
      // /api/auth/login & /api/auth/register return { ok, data: {...user} }
      const user = json.data?.user ?? json.data ?? null;
      set({ user, loading: false, initialized: true });
    } catch {
      set({ user: null, loading: false, initialized: true });
    }
  },
  logout: async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      set({ user: null });
    }
  },
  setUser: (u) => set({ user: u }),
}));
