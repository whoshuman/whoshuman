import { Link, useNavigate } from "@tanstack/react-router";
import { House, LogOut, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { preloadGameModels } from "../game/gameAssets";
import { useLobbyStore } from "../game/store/lobbyStore";
import { useAuthStore } from "../shared/authStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import CornerBrackets from "../shared/CornerBrackets";
import GroupChatDock from "../shared/GroupChatDock";
import { useMusic } from "../shared/musicStore";
import FullscreenButton from "../shared/FullscreenButton";
import NotificationCenter from "../shared/NotificationCenter";
import PlayerCard from "../shared/PlayerCard";
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

// Teclea un texto caracter a caracter, como una consola. Si el usuario pide menos
// movimiento, el texto aparece completo de golpe.
function useTypewriter(text: string, charMs = 60) {
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTyped(text);
      return;
    }
    setTyped("");
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTyped(text.slice(0, index));
      if (index >= text.length) clearInterval(timer);
    }, charMs);
    return () => clearInterval(timer);
  }, [text, charMs]);

  return typed;
}

// Cartel colgado de una fachada: dos brazos de anclaje salen por el lateral y se pierden
// fuera de pantalla, como los letreros de la ciudad. `side` indica de que edificio cuelga
// (izquierda o derecha de la calle); el ligero giro en falso 3D lo da .hanging-sign-* en
// index.css. En movil no hay brazos ni giro: no hay sitio, y queda como panel normal.
function HangingSign({
  side,
  className = "",
  children
}: {
  side: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  // El tirante llega hasta el borde de la ventana en vez de cortarse a 2rem: se ancla al
  // canto del cartel (right-full / left-full) y se estira 50vw, que siempre pasa del borde.
  // El sobrante lo recorta el overflow-x-hidden del contenedor del lobby.
  const arm = (
    <span className="hidden items-center sm:flex">
      {side === "right" && (
        <span className="h-1.5 w-[50vw] bg-neon-cyan/80 shadow-[0_0_10px_rgba(36,245,255,0.7)]" />
      )}
      <span className="h-3.5 w-1.5 shrink-0 bg-neon-cyan shadow-[0_0_10px_rgba(36,245,255,0.7)]" />
      {side === "left" && (
        <span className="h-1.5 w-[50vw] bg-neon-cyan/80 shadow-[0_0_10px_rgba(36,245,255,0.7)]" />
      )}
    </span>
  );
  // El anclaje invierte el orden visual: a la izquierda el tirante sale hacia -x (y el
  // remache queda pegado al marco), y a la derecha hacia +x.
  const armPosition = side === "left" ? "right-full" : "left-full";

  return (
    <div
      className={`${side === "left" ? "hanging-sign-left" : "hanging-sign-right"} relative ${className}`}
    >
      <span className={`absolute ${armPosition} top-7`}>{arm}</span>
      <span className={`absolute ${armPosition} bottom-7`}>{arm}</span>
      {children}
    </div>
  );
}

// Iconos propios de cada operacion (nada de glifos/emoji genericos): trazo fino a juego con
// el resto del HUD, construidos sobre el mismo vocabulario visual que ya usa el sistema.

// Despliegue automatico: reticula de puntero con esquinas marcadas — el sistema "bloquea"
// tu operacion por ti, como el objetivo de una mira. Reutiliza el motivo de CornerBrackets.
function AutoDeployIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <path
        d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 8.7v2.3M12 13v2.3M8.7 12H11M13 12h2.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}

// Crear sala: nodo emitiendo una señal nueva en anillos concentricos — la sala aun no
// existe, la estas generando tu (por eso "irradia" hacia fuera, al contrario que unirse).
function CreateRoomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle
        cx="12"
        cy="12"
        r="5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="2.2 3"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 4"
        opacity="0.55"
      />
    </svg>
  );
}

// Unirse a sala: flecha atracando en una compuerta — entras en una señal que ya existe
// (al contrario que crear: aqui el movimiento va hacia dentro, no irradia hacia fuera).
function JoinRoomIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
      <path
        d="M15 4.5h3A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3.5 12h10.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M10.5 8l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Tarjeta de operacion (desplegar / crear / unirse). Estilo panel neon con acento propio.
// En movil es una fila compacta (icono a la izquierda) para que las tres quepan en
// pantalla sin scroll; a partir de sm vuelve a la tarjeta vertical centrada original.
function OperationCard({
  accent,
  icon,
  title,
  description,
  onClick,
  delay,
  featured = false
}: {
  accent: string;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  delay: number;
  // Despliegue automatico: la operacion "por defecto", con mas presencia que crear/unirse.
  featured?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`panel-neon animate-crt-on group relative flex items-center gap-3 bg-surface/90 p-3 text-left transition hover:-translate-y-1 ${
        featured
          ? "gap-4 p-4 sm:gap-6 sm:p-6"
          : "sm:flex-col sm:items-center sm:gap-4 sm:p-8 sm:text-center"
      }`}
      style={
        {
          "--accent": accent,
          animationDelay: `${delay}s`,
          opacity: 0,
          // Esquinas achaflanadas (silueta de panel de juego, no un rectangulo plano). Los
          // otros dos vertices los marca CornerBrackets, que por eso solo pinta tr/bl.
          clipPath:
            "polygon(14px 0%, 100% 0%, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0% 100%, 0% 14px)"
        } as CSSProperties
      }
    >
      <CornerBrackets color={accent} corners={["tr", "bl"]} />
      <span
        className={`flex shrink-0 items-center justify-center border-2 transition group-hover:scale-110 ${
          featured
            ? "h-14 w-14 p-3 sm:h-20 sm:w-20 sm:p-4"
            : "h-11 w-11 p-2.5 sm:h-16 sm:w-16 sm:p-3.5"
        }`}
        style={{ borderColor: accent, color: accent, filter: `drop-shadow(0 0 6px ${accent}99)` }}
      >
        {icon}
      </span>
      <span
        className={`flex min-w-0 flex-col gap-0.5 ${featured ? "" : "sm:items-center sm:gap-2"}`}
      >
        <span
          className={`font-display font-black uppercase tracking-widest text-text-main ${
            featured ? "text-base sm:text-2xl" : "text-sm sm:text-lg"
          }`}
          style={{ textShadow: `0 0 14px ${accent}88` }}
        >
          {title}
        </span>
        <span
          className={`text-text-muted ${
            featured ? "text-xs sm:text-base" : "line-clamp-2 text-xs sm:line-clamp-none sm:text-sm"
          }`}
        >
          {description}
        </span>
      </span>
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
  const signOut = useAuthStore((s) => s.signOut);
  // El titulo se teclea al entrar, como un comando escrito en la consola.
  const typedTitle = useTypewriter(t("lobby.deployTitle"));
  const lobbyStatus = useLobbyStore((s) => s.status);
  const lobbyId = useLobbyStore((s) => s.lobbyId);
  const match = useLobbyStore((s) => s.match);
  const error = useLobbyStore((s) => s.error);
  const clearError = useLobbyStore((s) => s.clearError);
  const join = useLobbyStore((s) => s.join);
  // "menu" = las fichas de operaciones; un modo = la pantalla expandida in-place.
  const [mode, setMode] = useState<RoomModalMode | "menu">("menu");
  // Cerrar sesión pide confirmación: es fácil pulsarlo sin querer y pierdes la partida en curso.
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Sonido holografico al aparecer el lobby (perfil + tarjetas).
  useHologramSound(0);
  useHologramSound(180);

  // La musica la arranca normalmente la home, durante el viaje de camara. Aqui se cubren
  // las entradas que no pasan por ella (acceso desde /login, vuelta de OAuth, URL directa):
  // si aun no sonaba, empieza; si ya venia sonando, no se reinicia.
  useEffect(() => {
    const music = useMusic.getState();
    if (!music.started) music.start();
  }, []);

  // Los modelos de la partida pesan y hasta ahora no se empezaban a pedir hasta navegar a
  // /game, que es el peor momento: la ronda ya corre en el servidor mientras tu bajas la
  // manzana. Aqui hay tiempo muerto de sobra (esperando a que se llene la sala) y el
  // cargador GLTF ya esta en memoria por la escena del lobby, asi que la descarga sale
  // gratis en percepcion. Si la partida salta antes de terminar, no se pierde nada: lo que
  // haya bajado queda en cache y el resto sigue por su cuenta.
  useEffect(() => {
    preloadGameModels();
  }, []);

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

  async function handleLogout() {
    setLogoutOpen(false);
    await signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <main
      className={`relative overflow-x-hidden px-4 py-4 sm:px-10 sm:py-8 ${embedded ? "h-full overflow-y-auto" : "min-h-[calc(100vh-4rem)]"}`}
    >
      {logoutOpen && (
        <ConfirmDialog
          title={t("common.logoutTitle")}
          message={t("common.logoutMessage")}
          confirmLabel={t("profilePage.logout")}
          danger
          onConfirm={() => void handleLogout()}
          onCancel={() => setLogoutOpen(false)}
        />
      )}

      {/* Dos carteles colgados a la misma altura, uno en cada lado de la calle: la ficha de
          identidad a la izquierda y la terminal de operaciones a la derecha. El margen
          superior deja sitio a la burbuja del avatar, que asoma por encima de su cartel. */}
      <div className="mt-6 flex flex-col gap-6 sm:mt-10 sm:flex-row sm:items-start sm:gap-14">
        {/* Tarjeta de identidad: fila de accesos pegada encima (a la derecha) y, debajo, la
          ficha con la foto de perfil circular asomando por la esquina superior. Sin cabecera
          global en el lobby: estos son los unicos accesos a amigos/ajustes/notificaciones/salir. */}
        <div className="mx-auto w-full sm:mx-0 sm:w-[26rem] sm:shrink-0">
          <div className="mb-3 flex items-center justify-end gap-1.5">
            {embedded ? (
              <>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    title={t("lobby.exit")}
                    aria-label={t("lobby.exit")}
                    className="group flex h-10 w-10 items-center justify-center border border-sun-orange/60 bg-bg/60 text-sun-orange backdrop-blur-sm transition hover:border-sun-orange hover:bg-sun-orange/18 hover:shadow-[0_0_16px_rgba(255,159,28,0.3)]"
                  >
                    <LogOut
                      aria-hidden="true"
                      size={19}
                      strokeWidth={1.8}
                      className="group-hover:animate-icon-exit"
                    />
                  </button>
                )}
                <FullscreenButton />
                <SettingsMenu align="right" />
              </>
            ) : (
              <>
                {/* Volver a la pantalla de inicio (la escena de la ciudad). */}
                <Link
                  to="/"
                  title={t("nav.home")}
                  aria-label={t("nav.home")}
                  className="group flex h-10 w-10 items-center justify-center border border-neon-cyan/60 bg-bg/60 text-neon-cyan backdrop-blur-sm transition hover:border-neon-cyan hover:bg-neon-cyan/18 hover:shadow-[0_0_16px_rgba(36,245,255,0.3)]"
                >
                  <House
                    aria-hidden="true"
                    size={19}
                    strokeWidth={1.8}
                    className="group-hover:animate-icon-hop"
                  />
                </Link>
                <NotificationCenter />
                <Link
                  to="/friends"
                  title={t("profilePage.contacts")}
                  aria-label={t("profilePage.contacts")}
                  className="group flex h-10 w-10 items-center justify-center border border-neon-violet/60 bg-bg/60 text-neon-violet backdrop-blur-sm transition hover:border-neon-violet hover:bg-neon-violet/18 hover:shadow-[0_0_16px_rgba(157,78,221,0.3)]"
                >
                  <UsersRound
                    aria-hidden="true"
                    size={19}
                    strokeWidth={1.8}
                    className="transition-transform duration-300 group-hover:-scale-x-100"
                  />
                </Link>
                <FullscreenButton />
                <SettingsMenu align="right" />
                <button
                  type="button"
                  onClick={() => setLogoutOpen(true)}
                  title={t("profilePage.logout")}
                  aria-label={t("profilePage.logout")}
                  className="group flex h-10 w-10 items-center justify-center border border-sun-orange/60 bg-bg/60 text-sun-orange backdrop-blur-sm transition hover:border-sun-orange hover:bg-sun-orange/18 hover:shadow-[0_0_16px_rgba(255,159,28,0.3)]"
                >
                  <LogOut
                    aria-hidden="true"
                    size={19}
                    strokeWidth={1.8}
                    className="group-hover:animate-icon-exit"
                  />
                </button>
              </>
            )}
          </div>

          {/* Ficha del jugador, colgada del edificio de la izquierda. Abre la edicion de perfil. */}
          <HangingSign side="left">
            <PlayerCard onClick={handleEditProfile} />
          </HangingSign>
        </div>

        {/* Terminal de operaciones: cartel colgado del edificio de la derecha, a la altura de
          la ficha de identidad (de ahi el margen superior en escritorio, que compensa la fila
          de accesos que la ficha lleva encima). El titulo se teclea al entrar, con cursor
          parpadeante, como un comando escrito en una consola. */}
        <HangingSign
          side="right"
          className="w-full sm:ml-auto sm:mt-[3.25rem] sm:min-w-0 sm:max-w-md sm:flex-1"
        >
          <div
            className="panel-neon relative bg-bg/85 backdrop-blur-md"
            style={{ "--accent": "var(--color-neon-cyan)" } as CSSProperties}
          >
            {/* Barra de titulo de la ventana. */}
            <div className="flex min-w-0 items-center gap-2.5 border-b border-neon-cyan/30 bg-neon-cyan/8 px-3 py-2 sm:px-4">
              <span className="flex shrink-0 gap-1.5">
                <span className="h-2 w-2 bg-neon-magenta shadow-[0_0_8px_rgba(255,43,214,0.8)]" />
                <span className="h-2 w-2 bg-sun-orange shadow-[0_0_8px_rgba(255,159,28,0.8)]" />
                <span className="h-2 w-2 bg-success shadow-[0_0_8px_rgba(57,255,136,0.8)]" />
              </span>
              <p className="font-display truncate text-[0.6rem] font-bold uppercase tracking-[0.2em] text-neon-cyan sm:text-xs sm:tracking-[0.3em]">
                {t("lobby.eyebrow")}
              </p>
            </div>

            {/* Cuerpo de la consola: linea de comando tecleada. */}
            <div className="px-4 py-4 sm:px-5 sm:py-5">
              <h1 className="font-display flex items-baseline gap-2 text-[clamp(1.125rem,4.5vw,1.75rem)] font-black uppercase leading-tight text-text-main">
                <span
                  aria-hidden="true"
                  className="shrink-0 text-neon-cyan [text-shadow:0_0_12px_rgba(36,245,255,0.8)]"
                >
                  &gt;
                </span>
                {/* El lector de pantalla recibe el titulo entero; lo que se teclea es decorativo. */}
                <span className="sr-only">{t("lobby.deployTitle")}</span>
                <span
                  aria-hidden="true"
                  style={{
                    textShadow: "0 0 18px rgb(255 43 214 / 0.6), 0 0 44px rgb(36 245 255 / 0.32)"
                  }}
                >
                  {typedTitle}
                  {/* Cursor de bloque, como una consola real. */}
                  <span
                    aria-hidden="true"
                    className="ml-1 inline-block h-[0.85em] w-[0.5em] translate-y-[0.06em] bg-neon-cyan align-middle shadow-[0_0_12px_rgba(36,245,255,0.8)]"
                    style={{ animation: "terminal-caret 1.05s steps(1) infinite" }}
                  />
                </span>
              </h1>
            </div>
          </div>
        </HangingSign>
      </div>

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

      {/* Dentro de una sala (o conectando) → panel de sala. Fuera → menu de operaciones:
          despliegue automatico como opcion destacada (la que usa la mayoria), crear/unirse
          como par de opciones secundarias debajo — un menu de juego, no tres fichas iguales. */}
      {inRoom ? (
        <RoomPanel />
      ) : mode === "menu" ? (
        <div className="mx-auto mt-6 flex max-w-5xl flex-col gap-2 sm:mt-10 sm:gap-4">
          <OperationCard
            accent="var(--color-neon-violet)"
            icon={<AutoDeployIcon />}
            title={t("lobby.autoDeployTitle")}
            description={t("lobby.autoDeployText")}
            onClick={() => join()}
            delay={0.1}
            featured
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
            <OperationCard
              accent="var(--color-neon-magenta)"
              icon={<CreateRoomIcon />}
              title={t("lobby.createRoom")}
              description={t("lobby.createRoomDesc")}
              onClick={() => setMode("create")}
              delay={0.2}
            />
            <OperationCard
              accent="var(--color-neon-cyan)"
              icon={<JoinRoomIcon />}
              title={t("lobby.joinRoom")}
              description={t("lobby.joinRoomDesc")}
              onClick={() => setMode("join")}
              delay={0.3}
            />
          </div>
        </div>
      ) : (
        <RoomModal mode={mode} onBack={() => setMode("menu")} />
      )}

      {lobbyStatus === "inLobby" && lobbyId && <GroupChatDock scope="lobby" channelId={lobbyId} />}
    </main>
  );
}

export default Lobby;
