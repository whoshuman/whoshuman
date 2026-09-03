// ── MODO DEBUG ───────────────────────────────────────────────────────────────
// Partida en solitario contra la multitud: sin esperar a nadie mas, sin reloj, y
// con el propio rol (cazador <-> infiltrado) alternable en caliente para verla
// desde los dos lados. Solo para desarrollo: no aparece salvo con ?practice=1 en
// /lobby.
//
// Para retirarlo del todo:
//   1. Borra esta carpeta (apps/frontend/src/game/practice/).
//   2. Quita <PracticeEntry /> de pages/Lobby.tsx y <PracticeSwitchRoleButton />
//      de pages/Game.tsx, con sus imports.
//   3. Revierte los bloques marcados "MODO DEBUG" en:
//      apps/game-service/src/game/game-session.ts, game.service.ts, game.controller.ts
//      apps/matchmaking-service/src/matchmaking/matchmaking.service.ts
//      apps/realtime-gateway/src/gateways/realtime.gateway.ts
//      packages/shared-events/src/index.ts (switchRole, gamePracticeSwitchRole)
//      packages/shared-types/src/index.ts (GamePracticeSwitchRolePayload)
import { isPracticeQueryPresent, startPracticeMatch, switchPracticeRole } from "./practice";

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
