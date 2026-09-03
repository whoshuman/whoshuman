import { Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import MobileGameControls from "../game/components/MobileGameControls";
import { useKeyboardInput } from "../game/hooks/useKeyboardInput";
import { isTouchPrimary } from "../game/input/touchInput";
import { isPracticeMatch } from "../game/practice/practice"; // MODO DEBUG: quitar al retirarlo
import { PracticeSwitchRoleButton } from "../game/practice/PracticeMode"; // MODO DEBUG: quitar al retirarlo
import GameScene from "../game/scenes/GameScene";
import { useGameStore } from "../game/store/gameStore";
import { useLobbyStore } from "../game/store/lobbyStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import GroupChatDock from "../shared/GroupChatDock";

// Un mapa y no un ternario: los motivos los define el servidor y crecen, y con un
// ternario cualquiera nuevo se colaba silenciosamente como "se acabo el tiempo".
const ROUND_REASON_KEYS: Record<string, string> = {
  "all-hiders-found": "game.reasonAllFound",
  "seeker-left": "game.reasonSeekerLeft",
  time: "game.reasonTime"
};

// lock/unlock no estan en lib.dom (siguen siendo experimentales), asi que se declaran aparte.
type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: "landscape") => Promise<void>;
  unlock?: () => void;
};

function MobileGameGate({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const enteredFullscreen = useRef(false);
  const [touchAvailable] = useState(isTouchPrimary);
  const [portrait, setPortrait] = useState(
    () => window.matchMedia("(orientation: portrait)").matches
  );
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const update = () => setPortrait(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(
    () => () => {
      const orientation = screen.orientation as LockableOrientation | undefined;
      orientation?.unlock?.();
      if (enteredFullscreen.current && document.fullscreenElement) {
        void document.exitFullscreen?.();
      }
    },
    []
  );

  async function startGame() {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        enteredFullscreen.current = true;
      }
    } catch {
      // Fullscreen depende del navegador; se intenta igualmente el bloqueo horizontal.
    }
    try {
      const orientation = screen.orientation as LockableOrientation | undefined;
      await orientation?.lock?.("landscape");
    } catch {
      // El giro manual es el fallback cuando la API no existe o rechaza el bloqueo.
    }
    setStarted(true);
  }

  if (!enabled || !touchAvailable || (started && !portrait)) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/95 p-6 text-center backdrop-blur-sm">
      <div className="w-full max-w-sm border border-neon-cyan/60 bg-surface/90 px-6 py-6 shadow-[0_0_40px_rgba(36,245,255,0.2)]">
        <div
          aria-hidden="true"
          className={`mx-auto mb-5 h-20 w-12 rounded-lg border-2 border-neon-cyan transition-transform duration-500 ${portrait ? "rotate-90" : ""}`}
        />
        <h2 className="font-display text-xl font-black uppercase text-neon-cyan">
          {t(portrait ? "game.rotateTitle" : "game.fullscreenTitle")}
        </h2>
        <p className="mt-2 text-sm text-text-muted">
          {t(portrait ? "game.rotateText" : "game.fullscreenText")}
        </p>
        <button
          type="button"
          onClick={() => void startGame()}
          className="mt-5 border-2 border-neon-magenta bg-neon-magenta/15 px-6 py-3 font-display text-sm font-black uppercase text-neon-magenta shadow-[0_0_24px_rgba(255,43,214,0.3)] active:scale-95"
        >
          {t("game.enterFullscreen")}
        </button>
      </div>
    </div>
  );
}

function Game() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const match = useLobbyStore((s) => s.match);
  const gameId = useGameStore((s) => s.gameId);
  const phase = useGameStore((s) => s.phase);
  const presentCount = useGameStore((s) => s.presentCount);
  const round = useGameStore((s) => s.round);
  const scores = useGameStore((s) => s.scores);
  const selfUserId = useGameStore((s) => s.selfUserId);
  const selfRole = useGameStore((s) => s.selfRole);
  const selfAlive = useGameStore((s) => s.selfAlive);
  const error = useGameStore((s) => s.error);
  const join = useGameStore((s) => s.join);
  const leave = useGameStore((s) => s.leave);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const connected = phase === "playing";
  const playing = connected && round?.phase === "playing";
  const targetGameId = match?.gameId ?? gameId;
  const ownScore = scores.find((entry) => entry.userId === selfUserId)?.score ?? 0;
  const ranking = [...scores].sort((a, b) => b.score - a.score);
  const winner = ranking[0];
  // La ronda se repite porque se fue el cazador; la partida se corto porque no queda
  // gente suficiente. Los dos motivos los decide el servidor.
  const restartedRound = round?.endReason === "seeker-left";
  const abandoned = round?.endReason === "abandoned";
  const minutes = Math.floor((round?.remainingSeconds ?? 0) / 60);
  const seconds = String((round?.remainingSeconds ?? 0) % 60).padStart(2, "0");
  useKeyboardInput(playing && selfAlive && selfRole !== "seeker");

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
    <div className="relative h-dvh w-full touch-none overflow-hidden overscroll-none bg-bg">
      <div className="absolute inset-0">
        <GameScene />
      </div>

      {/* HUD autoritativo: todos los valores llegan en el snapshot del servidor. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 grid grid-cols-[1fr_1fr_1.1fr_auto] items-start gap-2 p-2 sm:flex sm:justify-between sm:p-4">
        <div className="contents sm:flex sm:gap-3">
          <div className="border border-neon-cyan/40 bg-bg/70 px-2 py-2 backdrop-blur-sm sm:px-4">
            <p className="font-display text-[0.6rem] font-bold uppercase text-text-muted">
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
          <div className="border border-neon-magenta/40 bg-bg/70 px-2 py-2 backdrop-blur-sm sm:px-4">
            <p className="font-display text-[0.6rem] font-bold uppercase text-text-muted">
              {t("game.score")}
            </p>
            <p className="font-display text-center text-sm font-black text-neon-magenta">
              {ownScore}
            </p>
          </div>
        </div>

        <div className="border border-neon-cyan/50 bg-bg/80 px-2 py-2 text-center backdrop-blur-sm sm:px-6">
          <p className="font-display text-[0.6rem] font-bold uppercase tracking-[0.25em] text-text-muted">
            {t("game.round", { current: round?.current ?? 1, total: round?.total ?? 3 })}
          </p>
          <p className="font-display text-xl font-black tabular-nums text-neon-cyan">
            {minutes}:{seconds}
          </p>
        </div>

        <div className="contents sm:flex sm:items-center sm:gap-3">
          <div className="hidden border border-neon-cyan/40 bg-bg/70 px-4 py-2 backdrop-blur-sm sm:block">
            <p className="font-display text-[0.6rem] font-bold uppercase tracking-[0.25em] text-text-muted">
              {t("game.units")}
            </p>
            <p className="font-display text-center text-sm font-black text-neon-cyan">
              {presentCount}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLeaveOpen(true)}
            className="pointer-events-auto border border-sun-orange/60 bg-bg/70 px-2 py-2 font-display text-[0.55rem] font-bold uppercase text-sun-orange backdrop-blur-sm transition hover:bg-sun-orange/10 sm:px-4 sm:text-xs"
          >
            {t("game.leave")}
          </button>
        </div>
      </div>

      {scores.length > 0 && (
        <div className="pointer-events-none absolute left-4 top-24 z-10 w-56 border border-neon-cyan/30 bg-bg/75 p-3 backdrop-blur-sm">
          <p className="mb-2 font-display text-[0.65rem] font-bold uppercase text-neon-cyan">
            {t("game.scoreboard")}
          </p>
          <div className="space-y-1">
            {ranking.map((entry, index) => (
              <div
                key={entry.userId}
                className={`flex items-center justify-between text-xs ${
                  entry.userId === selfUserId ? "text-neon-magenta" : "text-text"
                }`}
              >
                <span className="min-w-0 truncate">
                  {index + 1}. {entry.username}
                </span>
                <span className="ml-3 font-display font-black tabular-nums">{entry.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estado de conexión / errores del gateway. */}
      {!connected && !error && (
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

      {connected && round?.phase === "playing" && !selfAlive && selfRole === "hider" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="border border-sun-orange/60 bg-bg/85 px-8 py-5 text-center backdrop-blur-sm">
            <p className="font-display text-xl font-black uppercase text-sun-orange">
              {t("game.eliminated")}
            </p>
            <p className="mt-1 text-sm text-text-muted">{t("game.waitNextRound")}</p>
          </div>
        </div>
      )}

      {connected && round?.phase === "intermission" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-bg/35">
          <div className="border border-neon-cyan/60 bg-bg/90 px-10 py-6 text-center backdrop-blur-sm">
            <p className="font-display text-2xl font-black uppercase text-neon-cyan">
              {t(restartedRound ? "game.roundRestarted" : "game.roundComplete")}
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {t(ROUND_REASON_KEYS[round.endReason ?? "time"] ?? "game.reasonTime")}
            </p>
            <p className="mt-3 font-display text-sm font-bold text-neon-magenta">
              {t(restartedRound ? "game.restartingRound" : "game.nextRound", {
                seconds: round.remainingSeconds
              })}
            </p>
          </div>
        </div>
      )}

      {connected && round?.phase === "finished" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md border border-neon-magenta/70 bg-bg px-8 py-7 text-center">
            <p className="font-display text-[0.7rem] font-bold uppercase text-text-muted">
              {t(abandoned ? "game.matchAbandoned" : "game.operationComplete")}
            </p>
            {abandoned ? (
              // Sin ganador que proclamar: lo que hay que explicar es por que se corto.
              <p className="mt-2 text-sm text-text-muted">{t("game.abandonedText")}</p>
            ) : (
              <>
                <h1 className="mt-2 font-display text-3xl font-black uppercase text-neon-magenta">
                  {winner?.username ?? t("game.noWinner")}
                </h1>
                <p className="mt-1 text-sm text-text-muted">
                  {t("game.winnerScore", { score: winner?.score ?? 0 })}
                </p>
              </>
            )}
            <div className="my-6 space-y-2 text-left">
              {ranking.map((entry, index) => (
                <div
                  key={entry.userId}
                  className="flex items-center justify-between border-b border-neon-cyan/15 pb-2 text-sm"
                >
                  <span>
                    {index + 1}. {entry.username}
                  </span>
                  <span className="font-display font-black text-neon-cyan">{entry.score}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleLeave}
              className="border border-neon-cyan px-6 py-3 font-display text-sm font-bold uppercase text-neon-cyan transition hover:bg-neon-cyan/10"
            >
              {t(abandoned ? "game.accept" : "game.returnLobby")}
            </button>
          </div>
        </div>
      )}

      {/* Irse con la ronda en marcha deja al equipo en inferioridad, asi que se avisa antes.
          Solo cuelga del boton del HUD: el marcador final lo tapa (inset-0 z-30 sobre z-10),
          asi que cuando esto es alcanzable la partida esta viva por definicion. */}
      {leaveOpen && (
        <ConfirmDialog
          danger
          title={t("game.leaveTitle")}
          message={t("game.leaveWarning")}
          confirmLabel={t("game.leaveConfirm")}
          cancelLabel={t("game.leaveKeepPlaying")}
          onConfirm={handleLeave}
          onCancel={() => setLeaveOpen(false)}
        />
      )}

      <MobileGameControls enabled={playing && selfAlive} />
      <MobileGameGate enabled={playing} />
      {gameId && <GroupChatDock scope="game" channelId={gameId} game />}
      {/* MODO DEBUG: quitar junto con game/practice/PracticeMode.tsx */}
      {targetGameId && isPracticeMatch(match) && <PracticeSwitchRoleButton gameId={targetGameId} />}

      {/* Controles. */}
      {round?.phase === "playing" && selfAlive && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 [@media(pointer:coarse)]:hidden">
          <p className="border border-neon-cyan/25 bg-bg/70 px-4 py-1.5 font-display text-[0.65rem] font-bold uppercase tracking-[0.2em] text-text-muted backdrop-blur-sm">
            {t(selfRole === "seeker" ? "game.controlsSeeker" : "game.controls")}
          </p>
        </div>
      )}
    </div>
  );
}

export default Game;
