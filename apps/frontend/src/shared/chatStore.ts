import type { ChatAuthor } from "@whoshuman/shared-types";
import { create } from "zustand";

interface ChatDialogState {
  peer: ChatAuthor | null;
  openDirect: (peer: ChatAuthor) => void;
  closeDirect: () => void;
}

export const useChatDialogStore = create<ChatDialogState>((set) => ({
  peer: null,
  openDirect: (peer) => set({ peer }),
  closeDirect: () => set({ peer: null })
}));
