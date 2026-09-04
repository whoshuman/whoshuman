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

// Con F5 dentro de la partida se pierde el `match`: vive en el store de lobby, que es
// memoria, y al recargar arranca vacío. La partida sí vuelve, porque su id se guarda en
// sessionStorage (ACTIVE_GAME_KEY de gameStore), pero sin `match` no había forma de saber
// que era de práctica y el botón de cambiar de rol desaparecía hasta salir y volver a
// entrar. Se recuerda igual que la partida: el id, en sessionStorage.
const PRACTICE_GAME_KEY = "practiceGameId";

/** Apunta que esta partida es de práctica, para que sobreviva a un refresco. */
export function rememberPracticeGame(gameId: string): void {
  try {
    sessionStorage.setItem(PRACTICE_GAME_KEY, gameId);
  } catch {
    // Navegación privada o almacenamiento bloqueado: sin memoria, el botón se irá al
    // refrescar. Es modo debug: no vale la pena romper la partida por esto.
  }
}

/** ¿La partida recordada como de práctica es esta? */
export function isRememberedPracticeGame(gameId: string | null): boolean {
  if (!gameId) return false;
  try {
    return sessionStorage.getItem(PRACTICE_GAME_KEY) === gameId;
  } catch {
    return false;
  }
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
