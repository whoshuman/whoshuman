import { ClientSocketEvents, ServerSocketEvents } from "@whoshuman/shared-events";
import type {
  GameCollectibleState,
  GameJoinResponse,
  GameRoundState,
  GameScoreState,
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
type ConnectionPhase = "idle" | "joining" | "playing";

interface GameState {
  phase: ConnectionPhase;
  gameId: string | null;
  selfUserId: string | null;
  selfEntityId: string | null;
  selfRole: PlayerRole | null;
  selfAlive: boolean;
  aiming: boolean;
  round: GameRoundState | null;
  scores: GameScoreState[];
  collectibles: GameCollectibleState[];
  // Nº de unidades presentes según el último snapshot (baja frecuencia de cambio:
  // solo se escribe cuando cambia, no por tick).
  presentCount: number;
  error: string | null;
  join: (gameId: string) => void;
  leave: () => void;
  reset: () => void;
  setAiming: (aiming: boolean) => void;
  shoot: (targetEntityId: string) => void;
  sendInput: (forward: number, turn: number) => void;
}

let boundSocket: Socket | null = null;
let lastUiSignature = "";
const ACTIVE_GAME_KEY = "activeGameId";

function forgetActiveGame() {
  sessionStorage.removeItem(ACTIVE_GAME_KEY);
  lastUiSignature = "";
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
      selfUserId: payload.selfUserId,
      selfEntityId: payload.selfEntityId,
      selfRole: payload.role,
      selfAlive: true,
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
      selfUserId: null,
      selfEntityId: null,
      selfRole: null,
      selfAlive: false,
      aiming: false,
      round: null,
      scores: [],
      collectibles: [],
      presentCount: 0
    });
  });

  socket.on(ServerSocketEvents.gameState, (payload: GameStateSnapshotPayload) => {
    if (payload.gameId !== useGameStore.getState().gameId) return;
    pushSnapshot(payload);
    const current = useGameStore.getState();
    const presentCount = payload.entities.length;
    const self = payload.scores.find((entry) => entry.userId === current.selfUserId);
    const signature = JSON.stringify([
      presentCount,
      payload.round,
      payload.scores,
      payload.collectibles.map((item) => item.collectibleId)
    ]);
    if (signature === lastUiSignature) return;
    lastUiSignature = signature;
    const roleChanged = !!self && self.role !== current.selfRole;
    set({
      presentCount,
      round: payload.round,
      scores: payload.scores,
      collectibles: payload.collectibles,
      selfRole: self?.role ?? current.selfRole,
      selfAlive: self?.alive ?? current.selfAlive,
      aiming: roleChanged || payload.round.phase !== "playing" ? false : current.aiming
    });
  });

  socket.on(ServerSocketEvents.gatewayError, (payload: { message: string }) => {
    if (payload.message === "Unable to join game" && useGameStore.getState().gameId) {
      forgetActiveGame();
      clearSnapshots();
      useLobbyStore.setState({ match: null });
      set({
        phase: "idle",
        gameId: null,
        selfUserId: null,
        selfEntityId: null,
        selfRole: null,
        selfAlive: false,
        aiming: false,
        round: null,
        scores: [],
        collectibles: [],
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
      selfUserId: null,
      selfEntityId: null,
      selfRole: null,
      selfAlive: false,
      aiming: false,
      round: null,
      scores: [],
      collectibles: [],
      presentCount: 0
    });
  });
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: "idle",
  gameId: sessionStorage.getItem(ACTIVE_GAME_KEY),
  selfUserId: null,
  selfEntityId: null,
  selfRole: null,
  selfAlive: false,
  aiming: false,
  round: null,
  scores: [],
  collectibles: [],
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
      selfUserId: null,
      selfEntityId: null,
      selfRole: null,
      selfAlive: false,
      aiming: false,
      round: null,
      scores: [],
      collectibles: [],
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
    const lobbyId = useLobbyStore.getState().lobbyId;
    useLobbyStore.setState({
      status: lobbyId ? "connecting" : "idle",
      players: [],
      count: 0,
      selfReady: false,
      match: null,
      error: null
    });
    set({
      phase: "idle",
      gameId: null,
      selfUserId: null,
      selfEntityId: null,
      selfRole: null,
      selfAlive: false,
      aiming: false,
      round: null,
      scores: [],
      collectibles: [],
      presentCount: 0,
      error: null
    });
  },

  reset: () => {
    forgetActiveGame();
    clearSnapshots();
    set({
      phase: "idle",
      gameId: null,
      selfUserId: null,
      selfEntityId: null,
      selfRole: null,
      selfAlive: false,
      aiming: false,
      round: null,
      scores: [],
      collectibles: [],
      presentCount: 0,
      error: null
    });
  },

  setAiming: (aiming) => {
    const state = get();
    if (
      state.selfRole !== "seeker" ||
      state.round?.phase !== "playing" ||
      state.aiming === aiming
    ) {
      return;
    }
    set({ aiming });
    if (state.phase === "playing" && state.gameId) {
      connectSocket().emit(ClientSocketEvents.gameAim, { gameId: state.gameId, aiming });
    }
  },

  shoot: (targetEntityId) => {
    const { gameId, phase, selfRole, aiming, round } = get();
    if (
      phase !== "playing" ||
      !gameId ||
      selfRole !== "seeker" ||
      !aiming ||
      round?.phase !== "playing"
    ) {
      return;
    }
    connectSocket().emit(ClientSocketEvents.gameShoot, { gameId, targetEntityId });
  },

  sendInput: (forward, turn) => {
    const { gameId, phase, selfRole, selfAlive, round } = get();
    if (
      phase !== "playing" ||
      !gameId ||
      selfRole === "seeker" ||
      !selfAlive ||
      round?.phase !== "playing"
    ) {
      return;
    }
    connectSocket().emit(ClientSocketEvents.playerInput, { gameId, forward, turn });
  }
}));
