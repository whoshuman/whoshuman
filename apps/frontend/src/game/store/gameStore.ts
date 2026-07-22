import { ClientSocketEvents, ServerSocketEvents } from "@whoshuman/shared-events";
import type {
  GameJoinResponse,
  GameStateSnapshotPayload,
  PlayerRole
} from "@whoshuman/shared-types";
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
  selfEntityId: string | null;
  selfRole: PlayerRole | null;
  aiming: boolean;
  // Nº de unidades presentes según el último snapshot (baja frecuencia de cambio:
  // solo se escribe cuando cambia, no por tick).
  presentCount: number;
  error: string | null;
  join: (gameId: string) => void;
  leave: () => void;
  setAiming: (aiming: boolean) => void;
  shoot: (targetEntityId: string) => void;
  sendInput: (forward: number, turn: number) => void;
}

let boundSocket: Socket | null = null;
const ACTIVE_GAME_KEY = "activeGameId";

function forgetActiveGame() {
  sessionStorage.removeItem(ACTIVE_GAME_KEY);
}

function bindListeners() {
  const socket = connectSocket();
  if (boundSocket === socket) return;
  boundSocket = socket;
  const set = useGameStore.setState;

  socket.on(ServerSocketEvents.gatewayReady, () => {
    const { gameId } = useGameStore.getState();
    if (!gameId) return;
    set({ phase: "joining", error: null });
    socket.emit(ClientSocketEvents.gameJoin, { gameId });
  });

  socket.on(ServerSocketEvents.gameJoined, (payload: GameJoinResponse) => {
    sessionStorage.setItem(ACTIVE_GAME_KEY, payload.gameId);
    set({
      phase: "playing",
      gameId: payload.gameId,
      selfEntityId: payload.selfEntityId,
      selfRole: payload.role,
      aiming: false,
      error: null
    });
  });

  socket.on(ServerSocketEvents.gameLeft, () => {
    forgetActiveGame();
    clearSnapshots();
    set({
      phase: "idle",
      gameId: null,
      selfEntityId: null,
      selfRole: null,
      aiming: false,
      presentCount: 0
    });
  });

  socket.on(ServerSocketEvents.gameState, (payload: GameStateSnapshotPayload) => {
    if (payload.gameId !== useGameStore.getState().gameId) return;
    pushSnapshot(payload);
    // Solo tocar React state cuando el recuento cambia de verdad.
    const presentCount = payload.entities.length;
    if (presentCount !== useGameStore.getState().presentCount) {
      set({ presentCount });
    }
  });

  socket.on(ServerSocketEvents.gatewayError, (payload: { message: string }) => {
    if (payload.message === "Unable to join game" && useGameStore.getState().gameId) {
      forgetActiveGame();
      clearSnapshots();
      useLobbyStore.setState({ match: null });
      set({
        phase: "idle",
        gameId: null,
        selfEntityId: null,
        selfRole: null,
        aiming: false,
        presentCount: 0,
        error: payload.message
      });
      return;
    }
    set({ error: payload.message });
  });

  socket.on("disconnect", () => {
    if (!useGameStore.getState().gameId) return;
    clearSnapshots();
    set({
      phase: "joining",
      selfEntityId: null,
      selfRole: null,
      aiming: false,
      presentCount: 0
    });
  });
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: "idle",
  gameId: sessionStorage.getItem(ACTIVE_GAME_KEY),
  selfEntityId: null,
  selfRole: null,
  aiming: false,
  presentCount: 0,
  error: null,

  join: (gameId) => {
    const current = get();
    if (current.gameId === gameId && current.phase !== "idle") return;
    bindListeners();
    const socket = connectSocket();
    sessionStorage.setItem(ACTIVE_GAME_KEY, gameId);
    clearSnapshots();
    set({
      phase: "joining",
      gameId,
      selfEntityId: null,
      selfRole: null,
      aiming: false,
      error: null
    });
    if (socket.connected) socket.emit(ClientSocketEvents.gameJoin, { gameId });
  },

  leave: () => {
    forgetActiveGame();
    const socket = connectSocket();
    const { gameId } = get();
    if (gameId) socket.emit(ClientSocketEvents.gameLeave, { gameId });
    clearSnapshots();
    // Limpia también el match del lobby: si no, /game re-entraría en bucle.
    useLobbyStore.setState({ match: null });
    set({
      phase: "idle",
      gameId: null,
      selfEntityId: null,
      selfRole: null,
      aiming: false,
      presentCount: 0,
      error: null
    });
  },

  setAiming: (aiming) => {
    const state = get();
    if (state.selfRole !== "seeker" || state.aiming === aiming) return;
    set({ aiming });
    if (state.phase === "playing" && state.gameId) {
      connectSocket().emit(ClientSocketEvents.gameAim, { gameId: state.gameId, aiming });
    }
  },

  shoot: (targetEntityId) => {
    const { gameId, phase, selfRole, aiming } = get();
    if (phase !== "playing" || !gameId || selfRole !== "seeker" || !aiming) return;
    connectSocket().emit(ClientSocketEvents.gameShoot, { gameId, targetEntityId });
  },

  sendInput: (forward, turn) => {
    const { gameId, phase, selfRole } = get();
    if (phase !== "playing" || !gameId || selfRole === "seeker") return;
    connectSocket().emit(ClientSocketEvents.playerInput, { gameId, forward, turn });
  }
}));
