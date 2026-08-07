import { create } from "zustand";

interface PresenceState {
  online: Set<string>;
  setAll: (userIds: string[]) => void;
  setOne: (userId: string, online: boolean) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  online: new Set<string>(),

  setAll: (userIds) => set({ online: new Set(userIds) }),

  // Set nuevo en cada cambio: zustand compara por referencia y mutar el Set no repintaría.
  setOne: (userId, online) =>
    set((state) => {
      const next = new Set(state.online);
      if (online) next.add(userId);
      else next.delete(userId);
      return { online: next };
    }),

  reset: () => set({ online: new Set<string>() })
}));
