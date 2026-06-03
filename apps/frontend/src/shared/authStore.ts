import type { PublicUser } from "@whoshuman/shared-types";
import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  user: PublicUser | null;
  setUser: (user: PublicUser | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  isAuthenticated: false,
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated })
}));
