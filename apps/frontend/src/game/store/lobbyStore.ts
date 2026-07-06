import { ClientSocketEvents, ServerSocketEvents } from "@whoshuman/shared-events";
import type { LobbyStatePayload, MatchFoundPayload } from "@whoshuman/shared-types";
import { create } from "zustand";

import { useAuthStore } from "../../shared/authStore";
import { connectSocket } from "../network/socket";

// Estado del lobby en el cliente. Es un espejo de lo que el servidor emite por
// socket: aquí no se decide nada, solo se refleja (`lobby:state` es la verdad).
type LobbyStatus = "idle" | "connecting" | "inLobby";

interface LobbyState {
  status: LobbyStatus;
  lobbyId: string | null;
  players: LobbyStatePayload["players"];
  count: number;
  min: number;
  max: number;
  selfReady: boolean;
  match: MatchFoundPayload | null;
  error: string | null;
  join: (lobbyId?: string) => void;
  leave: () => void;
  setReady: (ready: boolean) => void;
  clearError: () => void;
}

// El servidor solo procesa `lobby:join` cuando ya verificó el JWT (emite
// `gateway:ready` al terminar). Si el usuario pulsa antes, guardamos el destino
// aquí y lo emitimos al recibir el ready. Flags a nivel de módulo, como
// `restoreStarted` en authStore: sobreviven a re-renders y a StrictMode.
let pendingLobbyId: string | undefined;
let listenersBound = false;

function bindListeners() {
  if (listenersBound) return;
  listenersBound = true;
  const socket = connectSocket();
  const set = useLobbyStore.setState;

  socket.on(ServerSocketEvents.gatewayReady, () => {
    // Conexión (o reconexión) autenticada. Si había un join pendiente o estábamos
    // en una sala antes de caernos, (re)entramos: el server olvida las rooms de un
    // socket desconectado.
    const target = pendingLobbyId ?? useLobbyStore.getState().lobbyId ?? undefined;
    pendingLobbyId = undefined;
    if (target !== undefined) {
      socket.emit(ClientSocketEvents.lobbyJoin, { lobbyId: target });
    }
  });

  socket.on(ServerSocketEvents.lobbyJoined, (payload: { lobbyId: string }) => {
    set({ status: "inLobby", lobbyId: payload.lobbyId, error: null });
  });

  socket.on(ServerSocketEvents.lobbyLeft, () => {
    set({
      status: "idle",
      lobbyId: null,
      players: [],
      count: 0,
      selfReady: false
    });
  });

  socket.on(ServerSocketEvents.lobbyState, (payload: LobbyStatePayload) => {
    const selfId = useAuthStore.getState().user?.id;
    set({
      players: payload.players,
      count: payload.count,
      min: payload.min,
      max: payload.max,
      selfReady: payload.players.some((p) => p.userId === selfId && p.ready)
    });
  });

  socket.on(ServerSocketEvents.matchFound, (payload: MatchFoundPayload) => {
    set({ match: payload });
  });

  socket.on(ServerSocketEvents.gatewayError, (payload: { message: string }) => {
    set({ error: payload.message });
  });

  socket.on("disconnect", () => {
    // No borramos lobbyId: se usa para re-entrar al reconectar (gateway:ready).
    set({ status: "connecting", players: [], count: 0, selfReady: false });
  });
}

export const useLobbyStore = create<LobbyState>((set, get) => ({
  status: "idle",
  lobbyId: null,
  players: [],
  count: 0,
  min: 2,
  max: 8,
  selfReady: false,
  match: null,
  error: null,

  join: (lobbyId) => {
    bindListeners();
    const socket = connectSocket();
    set({ status: "connecting", error: null, match: null });
    if (socket.connected) {
      socket.emit(ClientSocketEvents.lobbyJoin, { lobbyId });
    } else {
      // Aún sin autenticar: gateway:ready hará el join.
      pendingLobbyId = lobbyId ?? "";
    }
  },

  leave: () => {
    pendingLobbyId = undefined;
    const socket = connectSocket();
    const { lobbyId } = get();
    if (socket.connected && lobbyId) {
      socket.emit(ClientSocketEvents.lobbyLeave, { lobbyId });
    }
    set({ status: "idle", lobbyId: null, players: [], count: 0, selfReady: false });
  },

  setReady: (ready) => {
    const socket = connectSocket();
    // Sin ack directo: el server responde a todos con lobby:state, que actualizará
    // selfReady. Optimista aquí para que el botón reaccione al instante.
    socket.emit(ClientSocketEvents.lobbyReady, { ready });
    set({ selfReady: ready });
  },

  clearError: () => set({ error: null })
}));
