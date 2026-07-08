import { ClientSocketEvents, ServerSocketEvents } from "@whoshuman/shared-events";
import type { GameStateSnapshotPayload, PlayerRole } from "@whoshuman/shared-types";
import type { Socket } from "socket.io-client";
import { create } from "zustand";

import { connectSocket } from "../network/socket";
import { clearSnapshots, pushSnapshot } from "../systems/interpolation";
import { useLobbyStore } from "./lobbyStore";

// Estado de partida en el cliente. Igual que el lobby: espejo del servidor.
// Las posiciones NO viven aquí (llegan a 20 Hz): van al buffer de interpolación
// y solo las lee el bucle de render. Aquí solo lo que la UI de React necesita.
type GamePhase = "idle" | "joining" | "playing";

interface GameState {
  phase: GamePhase;
  gameId: string | null;
  // Rol de cada jugador según matchmaking (dato real del match-found).
  roles: Record<string, PlayerRole>;
  // Nº de unidades presentes según el último snapshot (baja frecuencia de cambio:
  // solo se escribe cuando cambia, no por tick).
  presentCount: number;
  error: string | null;
  join: (gameId: string) => void;
  leave: () => void;
  sendInput: (forward: number, turn: number) => void;
}

let boundSocket: Socket | null = null;

function bindListeners() {
  const socket = connectSocket();
  if (boundSocket === socket) return;
  boundSocket = socket;
  const set = useGameStore.setState;

  socket.on(ServerSocketEvents.gameJoined, (payload: { gameId: string }) => {
    set({ phase: "playing", gameId: payload.gameId, error: null });
  });

  socket.on(ServerSocketEvents.gameLeft, () => {
    clearSnapshots();
    set({ phase: "idle", gameId: null, presentCount: 0 });
  });

  socket.on(ServerSocketEvents.gameState, (payload: GameStateSnapshotPayload) => {
    if (payload.gameId !== useGameStore.getState().gameId) return;
    pushSnapshot(payload);
    // Solo tocar React state cuando el recuento cambia de verdad.
    if (payload.players.length !== useGameStore.getState().presentCount) {
      set({ presentCount: payload.players.length });
    }
  });

  socket.on(ServerSocketEvents.gatewayError, (payload: { message: string }) => {
    set({ error: payload.message });
  });
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: "idle",
  gameId: null,
  roles: {},
  presentCount: 0,
  error: null,

  join: (gameId) => {
    bindListeners();
    const socket = connectSocket();
    clearSnapshots();
    // Roles del match-found que guardó el lobby: única fuente del rol de cada uno.
    const match = useLobbyStore.getState().match;
    const roles: Record<string, PlayerRole> = {};
    for (const player of match?.players ?? []) roles[player.userId] = player.role;
    set({ phase: "joining", gameId, roles, error: null });
    socket.emit(ClientSocketEvents.gameJoin, { gameId });
  },

  leave: () => {
    const socket = connectSocket();
    const { gameId } = get();
    if (gameId) socket.emit(ClientSocketEvents.gameLeave, { gameId });
    clearSnapshots();
    // Limpia también el match del lobby: si no, /game re-entraría en bucle.
    useLobbyStore.setState({ match: null });
    set({ phase: "idle", gameId: null, roles: {}, presentCount: 0, error: null });
  },

  sendInput: (forward, turn) => {
    const { gameId, phase } = get();
    if (phase !== "playing" || !gameId) return;
    connectSocket().emit(ClientSocketEvents.playerInput, { gameId, forward, turn });
  }
}));
