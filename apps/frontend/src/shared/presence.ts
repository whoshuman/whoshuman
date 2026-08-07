import { ClientSocketEvents, ServerSocketEvents } from "@whoshuman/shared-events";
import type { Socket } from "socket.io-client";

import { connectSocket } from "../game/network/socket";
import { usePresenceStore } from "./presenceStore";

// Bind único POR INSTANCIA de socket: tras logout→login el singleton crea uno nuevo
// y hay que volver a enganchar los listeners.
let boundSocket: Socket | null = null;

export function initPresence(): void {
  const socket = connectSocket();
  if (boundSocket === socket) return;
  boundSocket = socket;

  socket.on(ServerSocketEvents.presenceState, (payload: { userIds: string[] }) => {
    usePresenceStore.getState().setAll(payload.userIds);
  });

  socket.on(ServerSocketEvents.presenceChanged, (payload: { userId: string; online: boolean }) => {
    usePresenceStore.getState().setOne(payload.userId, payload.online);
  });

  // Estado inicial: quién está online ahora mismo.
  socket.emit(ClientSocketEvents.presenceList);
}
