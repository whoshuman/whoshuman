import { ServerSocketEvents } from "@whoshuman/shared-events";
import type { NotificationRecord } from "@whoshuman/shared-types";
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
  socket.on(ServerSocketEvents.notification, (envelope: NotificationRecord) => {
    useNotificationStore.getState().push(envelope);

    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
    void queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
    void queryClient.invalidateQueries({ queryKey: ["friends"] });
  });
}
