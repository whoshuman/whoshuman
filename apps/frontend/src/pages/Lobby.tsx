import { useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useLobbyStore } from "../game/store/lobbyStore";
import { useAuthStore } from "../shared/authStore";
import CornerBrackets from "../shared/CornerBrackets";
import SettingsMenu from "../shared/SettingsMenu";
import { useHologramSound } from "../shared/useHologramSound";
import RoomModal, { type RoomModalMode } from "./RoomModal";

type LobbyProps = {
  // En modo embebido se monta como overlay tras el zoom de la home (no como ruta).
  embedded?: boolean;
  onClose?: () => void;
  // Abre la pantalla de edicion de perfil (tarjeta de perfil).
  onEditProfile?: () => void;
};

// Tarjeta de operacion (desplegar / crear / unirse). Estilo panel neon con acento propio.
function OperationCard({
  accent,
  glyph,
  title,
  description,
  onClick,
  delay
}: {
  accent: string;
  glyph: string;
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="panel-neon animate-crt-on [transform-origin:center] group relative flex flex-col items-center gap-4 bg-surface/90 p-5 text-center transition hover:-translate-y-1 sm:p-8"
      style={{ "--accent": accent, animationDelay: `${delay}s`, opacity: 0 } as CSSProperties}
    >
      <CornerBrackets color={accent} />
      <span
        className="flex h-16 w-16 items-center justify-center border-2 font-display text-3xl font-black transition group-hover:scale-110"
        style={{ borderColor: accent, color: accent, textShadow: `0 0 16px ${accent}` }}
      >
        {glyph}
      </span>
      <span
        className="font-display text-lg font-black uppercase tracking-widest text-text-main"
        style={{ textShadow: `0 0 14px ${accent}88` }}
      >
        {title}
      </span>
      <span className="text-sm text-text-muted">{description}</span>
    </button>
  );
}

// Vista dentro de una sala: código, unidades conectadas con su estado y acciones.
// Todo lo que se pinta viene del broadcast lobby:state — el cliente no decide nada.
function RoomPanel() {
  const { t } = useTranslation();
  const selfId = useAuthStore((s) => s.user?.id);
  const { status, lobbyId, players, count, min, selfReady, leave, setReady } = useLobbyStore();
  useHologramSound();

  const isMain = lobbyId === "main";

  return (
    <div className="animate-unfold-down origin-top relative mx-auto w-full max-w-lg border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18)]">
      <CornerBrackets color="var(--color-neon-magenta)" />

      <div className="flex items-center justify-between border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-4">
        <p className="font-display text-sm font-black uppercase tracking-[0.2em] text-neon-cyan">
          // {isMain ? t("lobby.autoDeployTitle") : t("room.inRoomTitle")}
        </p>
        <span className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
          {count}/{min}+ {t("lobby.units")}
        </span>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {status === "connecting" && (
          <p className="font-display animate-pulse text-center text-sm font-bold uppercase tracking-[0.25em] text-neon-cyan">
            {t("room.connecting")}
          </p>
        )}

        {/* Código de sala para compartir (las salas privadas no se listan en ningún sitio). */}
        {status === "inLobby" && !isMain && lobbyId && (
          <div>
            <p className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted">
              {t("room.shareCode")}
            </p>
            <p className="border border-neon-cyan/35 bg-black/30 py-3 text-center font-display text-2xl font-black tracking-[0.3em] text-neon-cyan [text-shadow:0_0_18px_rgba(36,245,255,0.6)]">
              {lobbyId}
            </p>
          </div>
        )}

        {status === "inLobby" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-text-muted">
              {t("room.playersConnected")}
            </p>
            {players.map((player) => (
              <div
                key={player.userId}
                className="flex items-center justify-between border border-neon-cyan/20 bg-white/3 px-4 py-2.5"
              >
                <p className="font-display truncate text-sm font-bold text-text-main">
                  {player.username}
                  {player.userId === selfId && (
                    <span className="ml-2 text-xs text-neon-magenta">◄</span>
                  )}
                </p>
                <span
                  className={
                    player.ready
                      ? "inline-flex border border-current bg-success/10 px-3 py-1 text-xs font-bold text-success"
                      : "inline-flex border border-current bg-white/5 px-3 py-1 text-xs font-bold text-text-muted/70"
                  }
                >
                  {player.ready ? t("room.ready") : t("room.waiting")}
                </span>
              </div>
            ))}
          </div>
        )}

        {status === "inLobby" && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setReady(!selfReady)}
              className={
                selfReady
                  ? "flex-1 border-2 border-neon-cyan bg-transparent py-3 font-display font-black uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan/10 active:translate-y-px"
                  : "flex-1 border-2 border-neon-magenta bg-neon-magenta py-3 font-display font-black uppercase tracking-widest text-bg shadow-[0_0_24px_rgba(255,43,214,0.5)] transition hover:brightness-110 active:translate-y-px"
              }
            >
              {selfReady ? t("room.cancelReady") : t("room.ready")}
            </button>
            <button
              type="button"
              onClick={leave}
              className="border-2 border-sun-orange px-6 py-3 font-display font-black uppercase tracking-widest text-sun-orange transition hover:bg-sun-orange/10 active:translate-y-px"
            >
              {t("room.leave")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Lobby({ embedded = false, onClose, onEditProfile }: LobbyProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const username = user?.username ?? "";
  const initials = username.slice(0, 2).toUpperCase() || "--";
  const lobbyStatus = useLobbyStore((s) => s.status);
  const match = useLobbyStore((s) => s.match);
  const error = useLobbyStore((s) => s.error);
  const clearError = useLobbyStore((s) => s.clearError);
  const join = useLobbyStore((s) => s.join);
  // "menu" = las fichas de operaciones; un modo = la pantalla expandida in-place.
  const [mode, setMode] = useState<RoomModalMode | "menu">("menu");
  // Sonido holografico al aparecer el lobby (perfil + tarjetas).
  useHologramSound(0);
  useHologramSound(180);

  // Partida encontrada: el servidor asignó gameId y roles → a la pantalla de juego.
  useEffect(() => {
    if (match) {
      void navigate({ to: "/game" });
    }
  }, [match, navigate]);

  const inRoom = lobbyStatus !== "idle";

  function handleEditProfile() {
    if (onEditProfile) {
      onEditProfile();
      return;
    }
    void navigate({ to: "/profile" });
  }

  return (
    <main
      className={`relative px-4 py-6 sm:px-10 sm:py-8 ${embedded ? "h-full overflow-y-auto" : "min-h-[calc(100vh-11.5rem)] sm:min-h-[calc(100vh-8.5rem)]"}`}
    >
      {/* Fila superior: tarjeta de perfil (izquierda) y boton SALIR (derecha). */}
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        {/* Tarjeta de identidad del jugador. Abre la edicion de perfil. */}
        <button
          type="button"
          onClick={handleEditProfile}
          className="panel-neon animate-crt-on [transform-origin:center] group relative w-full bg-surface/90 p-5 text-left transition hover:-translate-y-0.5 sm:w-80"
          style={{ "--accent": "var(--color-neon-cyan)", opacity: 0 } as CSSProperties}
        >
          <CornerBrackets color="var(--color-neon-magenta)" />
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center border-2 border-neon-cyan/40 bg-neon-cyan/10 font-display text-2xl font-black text-neon-cyan [text-shadow:0_0_12px_rgba(36,245,255,0.6)]">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-display truncate text-lg font-black text-text-main">{username}</p>
              <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-neon-magenta">
                {t("lobby.statusActive")}
              </p>
            </div>
          </div>
          <span className="font-display absolute bottom-2 right-3 text-[0.6rem] font-bold uppercase tracking-wider text-neon-magenta opacity-0 transition group-hover:opacity-100">
            {t("profile.title")} →
          </span>
        </button>

        {/* El modo invitado no tiene la cabecera global: conserva salir y ajustes aquí. */}
        {embedded && (
          <div className="flex self-end border border-neon-cyan/20 bg-surface/75 p-1.5 shadow-[0_0_24px_rgba(36,245,255,0.1)] backdrop-blur-sm sm:self-start">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title={t("lobby.exit")}
                aria-label={t("lobby.exit")}
                className="flex h-10 w-10 items-center justify-center border border-sun-orange/50 bg-sun-orange/8 text-sun-orange transition hover:border-sun-orange hover:bg-sun-orange/18 hover:shadow-[0_0_16px_rgba(255,159,28,0.3)]"
              >
                <LogOut aria-hidden="true" size={19} strokeWidth={1.8} />
              </button>
            )}
            <div className={onClose ? "ml-1.5" : undefined}>
              <SettingsMenu align="right" />
            </div>
          </div>
        )}
      </div>

      {/* Titulo centrado, en una sola linea. */}
      <section className="my-8 text-center sm:my-10">
        <p className="font-display text-xs font-bold uppercase tracking-[0.4em] text-neon-magenta">
          // {t("lobby.eyebrow")}
        </p>
        <h1 className="font-display mt-2 text-[clamp(1.875rem,6vw,3rem)] font-black leading-none text-text-main [text-shadow:0_0_28px_rgba(255,43,214,0.55),0_0_56px_rgba(36,245,255,0.24)] sm:whitespace-nowrap">
          {t("lobby.deployTitle")}
        </h1>
        <p className="mt-3 text-base text-text-muted sm:text-lg">{t("lobby.deploySubtitle")}</p>
      </section>

      {/* Errores del gateway (auth caducada, sala inválida...). */}
      {error && (
        <div className="mx-auto mb-6 flex max-w-lg items-center justify-between border border-error bg-error/10 px-4 py-3">
          <p className="text-sm font-bold text-error">// {error}</p>
          <button
            type="button"
            onClick={clearError}
            className="font-display text-xs font-bold text-error hover:brightness-125"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dentro de una sala (o conectando) → panel de sala. Fuera → menu de operaciones. */}
      {inRoom ? (
        <RoomPanel />
      ) : mode === "menu" ? (
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          <OperationCard
            accent="var(--color-neon-violet)"
            glyph="⚡"
            title={t("lobby.autoDeployTitle")}
            description={t("lobby.autoDeployText")}
            onClick={() => join()}
            delay={0.1}
          />
          <OperationCard
            accent="var(--color-neon-magenta)"
            glyph="+"
            title={t("lobby.createRoom")}
            description={t("lobby.createRoomDesc")}
            onClick={() => setMode("create")}
            delay={0.2}
          />
          <OperationCard
            accent="var(--color-neon-cyan)"
            glyph="→"
            title={t("lobby.joinRoom")}
            description={t("lobby.joinRoomDesc")}
            onClick={() => setMode("join")}
            delay={0.3}
          />
        </div>
      ) : (
        <RoomModal mode={mode} onBack={() => setMode("menu")} />
      )}
    </main>
  );
}

export default Lobby;
