import type { ChatAuthor } from "@whoshuman/shared-types";
import { create } from "zustand";
import { useAuthStore } from "./authStore";

interface ChatDialogState {
  peers: ChatAuthor[];
  openDirect: (peer: ChatAuthor) => void;
  closeDirect: (peerId: string) => void;
}

export const useChatDialogStore = create<ChatDialogState>((set) => ({
  peers: [],
  openDirect: (peer) => {
    if (peer.id === useAuthStore.getState().user?.id) return;
    set((state) => ({
      peers: state.peers.some((openPeer) => openPeer.id === peer.id)
        ? state.peers
        : [peer, ...state.peers]
    }));
  },
  closeDirect: (peerId) =>
    set((state) => ({ peers: state.peers.filter((peer) => peer.id !== peerId) }))
}));
