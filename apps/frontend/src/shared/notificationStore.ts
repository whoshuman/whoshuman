import type { NotificationEnvelope } from "@whoshuman/shared-types";
import { create } from "zustand";

// Toasts efímeros: el backend no persiste notificaciones (relay puro), así que
// lo que no veas en pantalla se pierde — no hay bandeja que consultar.
const TOAST_TTL_MS = 6000;
const MAX_TOASTS = 4;

export interface Toast {
  id: string;
  envelope: NotificationEnvelope;
}

interface NotificationState {
  toasts: Toast[];
  push: (envelope: NotificationEnvelope) => void;
  dismiss: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  toasts: [],

  push: (envelope) => {
    const toast: Toast = { id: crypto.randomUUID(), envelope };
    // FIFO con tope: si hay 4 visibles, la más antigua sale.
    set((state) => ({ toasts: [...state.toasts.slice(-(MAX_TOASTS - 1)), toast] }));
    setTimeout(() => get().dismiss(toast.id), TOAST_TTL_MS);
  },

  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}));
