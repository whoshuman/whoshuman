import { ServerSocketEvents } from "@whoshuman/shared-events";
import type { NotificationEnvelope } from "@whoshuman/shared-types";
import type { Socket } from "socket.io-client";

import { connectSocket } from "../game/network/socket";
import { useNotificationStore } from "./notificationStore";
import { queryClient } from "./queryClient";

// Bind único POR INSTANCIA de socket (no un booleano): tras logout→login el
// singleton crea un socket nuevo y hay que volver a enganchar el listener.
let boundSocket: Socket | null = null;

export function initNotifications(): void {
  const socket = connectSocket();
  if (boundSocket === socket) return;
  boundSocket = socket;
  socket.on(ServerSocketEvents.notification, (envelope: NotificationEnvelope) => {
    useNotificationStore.getState().push(envelope);

    // Las dos notificaciones existentes son de amistad: refrescamos las listas para
    // que /friends (badge de solicitudes incluido) se actualice en vivo.
    void queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["friends"] });
  });
}
