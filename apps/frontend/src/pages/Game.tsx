import { Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useKeyboardInput } from "../game/hooks/useKeyboardInput";
import GameScene from "../game/scenes/GameScene";
import { useGameStore } from "../game/store/gameStore";
import { useLobbyStore } from "../game/store/lobbyStore";

// Pantalla de partida. Renderiza EXACTAMENTE lo que el servidor simula hoy:
// jugadores moviéndose por el mapa lógico con colisiones. Sin tiempo, rondas,
// puntos ni ítems: ese HUD volverá cuando el backend los implemente.
function Game() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const match = useLobbyStore((s) => s.match);
  const gameId = useGameStore((s) => s.gameId);
  const phase = useGameStore((s) => s.phase);
  const presentCount = useGameStore((s) => s.presentCount);
  const selfRole = useGameStore((s) => s.selfRole);
  const error = useGameStore((s) => s.error);
  const join = useGameStore((s) => s.join);
  const leave = useGameStore((s) => s.leave);

  const playing = phase === "playing";
  const targetGameId = match?.gameId ?? gameId;
  useKeyboardInput(playing && selfRole !== "seeker");

  // El match cubre la entrada normal; gameId persiste en sessionStorage y cubre
  // refresh/reconexión. Salir de la ruta no equivale a abandonar la partida.
  useEffect(() => {
    if (targetGameId) join(targetGameId);
  }, [targetGameId, join]);

  // Sin match nuevo ni partida recordada no hay nada que recuperar.
  if (!targetGameId) return <Navigate to="/lobby" />;

  function handleLeave() {
    leave();
    void navigate({ to: "/lobby" });
  }

  return (
    <div className="relative h-screen w-full bg-bg">
      <div className="absolute inset-0">
        <GameScene />
      </div>

      {/* HUD superior: solo datos reales — rol asignado y unidades presentes. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
        <div className="border border-neon-cyan/40 bg-bg/70 px-4 py-2 backdrop-blur-sm">
          <p className="font-display text-[0.6rem] font-bold uppercase tracking-[0.25em] text-text-muted">
            {t("game.role")}
          </p>
          <p
            className={
              selfRole === "seeker"
                ? "font-display text-sm font-black uppercase text-sun-orange [text-shadow:0_0_12px_rgba(255,159,28,0.6)]"
                : "font-display text-sm font-black uppercase text-neon-magenta [text-shadow:0_0_12px_rgba(255,43,214,0.6)]"
            }
          >
            {selfRole === "seeker" ? t("game.roleSeeker") : t("game.roleHider")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="border border-neon-cyan/40 bg-bg/70 px-4 py-2 backdrop-blur-sm">
            <p className="font-display text-[0.6rem] font-bold uppercase tracking-[0.25em] text-text-muted">
              {t("game.units")}
            </p>
            <p className="font-display text-center text-sm font-black text-neon-cyan">
              {presentCount}
            </p>
          </div>
          <button
            type="button"
            onClick={handleLeave}
            className="pointer-events-auto border border-sun-orange/60 bg-bg/70 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-sun-orange backdrop-blur-sm transition hover:bg-sun-orange/10"
          >
            {t("game.leave")}
          </button>
        </div>
      </div>

      {/* Estado de conexión / errores del gateway. */}
      {!playing && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="font-display animate-pulse border border-neon-cyan/40 bg-bg/80 px-6 py-3 text-sm font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("game.connecting")}
          </p>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 top-20 z-10 flex justify-center">
          <p className="border border-error bg-error/10 px-4 py-2 text-sm font-bold text-error">
            // {error}
          </p>
        </div>
      )}

      {/* Controles. */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <p className="border border-neon-cyan/25 bg-bg/70 px-4 py-1.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.2em] text-text-muted backdrop-blur-sm">
          {t(selfRole === "seeker" ? "game.controlsSeeker" : "game.controls")}
        </p>
      </div>
    </div>
  );
}

export default Game;
