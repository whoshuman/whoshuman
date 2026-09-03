// ── MODO DEBUG ───────────────────────────────────────────────────────────────
// Parte sin componentes del modo practica (ver PracticeMode.tsx, misma carpeta): va
// aparte porque el fast refresh solo funciona si un fichero exporta componentes y
// nada mas. Se retira borrando la carpeta entera.
import { ClientSocketEvents } from "@whoshuman/shared-events";
import type { MatchFoundPayload, PlayerRole } from "@whoshuman/shared-types";

import { connectSocket } from "../network/socket";
import { useGameStore } from "../store/gameStore";
import { useLobbyStore } from "../store/lobbyStore";

export const PRACTICE_LOBBY_ID = "practice";

export function isPracticeQueryPresent(): boolean {
  return new URLSearchParams(window.location.search).has("practice");
}

export function isPracticeMatch(match: MatchFoundPayload | null): boolean {
  return match?.lobbyId === PRACTICE_LOBBY_ID;
}

/** Entra directo a la cola "practice" (arranca con 1 solo jugador) y se marca listo. */
export function startPracticeMatch(): void {
  useLobbyStore.getState().join(PRACTICE_LOBBY_ID);
  useLobbyStore.getState().setReady(true);
}

// Optimista: el servidor hace exactamente este mismo cambio (ver
// GameSession.practiceSwitchRole), y esperar al siguiente snapshot para saberlo
// dejaría un instante con la cámara y los controles del rol viejo.
export function switchPracticeRole(gameId: string): void {
  connectSocket().emit(ClientSocketEvents.gamePracticeSwitchRole, { gameId });
  const current = useGameStore.getState().selfRole;
  const next: PlayerRole = current === "seeker" ? "hider" : "seeker";
  useGameStore.setState({ selfRole: next, selfAlive: true });
}
