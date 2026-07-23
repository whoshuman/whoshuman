import type { AuthSessionResponse, PublicUser } from "@whoshuman/shared-types";
import { create } from "zustand";
import i18n from "../i18n";
import { logout as apiLogout, refresh as apiRefresh } from "./api/auth";

const TOKEN_KEY = "authToken";
const REFRESH_KEY = "refreshToken";
const USER_KEY = "authUser";

interface AuthState {
  restored: boolean;
  isAuthenticated: boolean;
  user: PublicUser | null;
  signIn: (session: AuthSessionResponse) => void;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
  updateUser: (user: PublicUser) => void;
}

function persist(user: PublicUser, accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

// El refresh token es de un solo uso: el StrictMode de React ejecuta el efecto de
// arranque dos veces en dev, así que restore() debe correr UNA sola vez por carga.
let restoreStarted = false;

export const useAuthStore = create<AuthState>((set) => ({
  restored: false,
  isAuthenticated: false,
  user: null,

  signIn: ({ user, tokens }) => {
    persist(user, tokens.accessToken, tokens.refreshToken);
    void i18n.changeLanguage(user.language);
    localStorage.setItem("lang", user.language);
    set({ user, isAuthenticated: true, restored: true });
  },

  updateUser: (user) => {
    const at = localStorage.getItem(TOKEN_KEY) ?? "";
    const rt = localStorage.getItem(REFRESH_KEY) ?? "";
    persist(user, at, rt);
    set({ user });
  },

  signOut: async () => {
    const rt = localStorage.getItem(REFRESH_KEY);
    if (rt) {
      try {
        await apiLogout(rt);
      } catch {
        // best-effort: aunque falle en el back, cerramos sesión local
      }
    }
    clearStorage();
    set({ user: null, isAuthenticated: false });
  },

  restore: async () => {
    if (restoreStarted) return; // evita la doble ejecución del StrictMode (consumiría 2 veces el refresh token)
    restoreStarted = true;
    const rt = localStorage.getItem(REFRESH_KEY);
    const rawUser = localStorage.getItem(USER_KEY);
    if (!rt || !rawUser) {
      set({ restored: true });
      return;
    }
    try {
      const { tokens } = await apiRefresh(rt);
      const user = JSON.parse(rawUser) as PublicUser;
      persist(user, tokens.accessToken, tokens.refreshToken);
      void i18n.changeLanguage(user.language);
      set({ user, isAuthenticated: true, restored: true });
    } catch {
      clearStorage();
      set({ restored: true });
    }
  }
}));
