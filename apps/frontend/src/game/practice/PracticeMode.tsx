// ── MODO DEBUG ───────────────────────────────────────────────────────────────
// Partida en solitario contra la multitud: sin esperar a nadie mas, sin reloj, y
// con el propio rol (cazador <-> infiltrado) alternable en caliente para verla
// desde los dos lados. Solo para desarrollo: no aparece salvo con ?practice=1 en
// /lobby.
//
// Para retirarlo del todo:
//   1. Borra esta carpeta (apps/frontend/src/game/practice/).
//   2. Quita <PracticeEntry /> de pages/Lobby.tsx y <PracticeSwitchRoleButton />
//      de scenes/GameScene.tsx (o de donde se haya montado el HUD de partida).
//   3. Revierte los bloques marcados "MODO DEBUG" en:
//      apps/game-service/src/game/game-session.ts, game.service.ts, game.controller.ts
//      apps/matchmaking-service/src/matchmaking/matchmaking.service.ts
//      apps/realtime-gateway/src/gateways/realtime.gateway.ts
//      packages/shared-events/src/index.ts (switchRole, gamePracticeSwitchRole)
//      packages/shared-types/src/index.ts (GamePracticeSwitchRolePayload)
import { ClientSocketEvents } from "@whoshuman/shared-events";
import type { MatchFoundPayload, PlayerRole } from "@whoshuman/shared-types";

import { connectSocket } from "../network/socket";
import { useGameStore } from "../store/gameStore";
import { useLobbyStore } from "../store/lobbyStore";

const PRACTICE_LOBBY_ID = "practice";

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

/** Ficha discreta en el lobby, visible solo con ?practice=1 en la URL. */
export function PracticeEntry() {
  if (!isPracticeQueryPresent()) return null;
  return (
    <button
      type="button"
      onClick={startPracticeMatch}
      className="mx-auto mt-2 block border border-dashed border-text-muted/40 px-3 py-1.5 font-display text-[0.65rem] font-bold uppercase tracking-widest text-text-muted/60 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
    >
      [debug] Practicar en solitario
    </button>
  );
}

/** Botón flotante para alternar de rol, solo se monta cuando la partida es practice. */
export function PracticeSwitchRoleButton({ gameId }: { gameId: string }) {
  return (
    <button
      type="button"
      onClick={() => switchPracticeRole(gameId)}
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 border border-dashed border-text-muted/40 bg-bg/70 px-3 py-1.5 font-display text-[0.65rem] font-bold uppercase tracking-widest text-text-muted/70 backdrop-blur-sm transition hover:border-neon-cyan/60 hover:text-neon-cyan"
    >
      [debug] Cambiar de rol
    </button>
  );
}
