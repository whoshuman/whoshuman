import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

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

// Tarjeta de operacion (crear / unirse / buscar). Estilo panel neon con acento propio.
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

function Lobby({ embedded = false, onClose, onEditProfile }: LobbyProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const username = user?.username ?? "";
  const initials = username.slice(0, 2).toUpperCase() || "--";
  // "menu" = las tres fichas; un modo = la pantalla expandida de esa operacion (in-place).
  const [mode, setMode] = useState<RoomModalMode | "menu">("menu");
  // Sonido holografico al aparecer el lobby (perfil + tarjetas).
  useHologramSound(0);
  useHologramSound(180);

  return (
    <main
      className={`relative px-4 py-6 sm:px-10 sm:py-8 ${embedded ? "h-full overflow-y-auto" : "min-h-[calc(100vh-4rem)]"}`}
    >
      {/* Fila superior: tarjeta de perfil (izquierda) y boton SALIR (derecha). */}
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        {/* Tarjeta de perfil del jugador (nivel, XP, stats). Abre la edicion de perfil. */}
        <button
          type="button"
          onClick={onEditProfile}
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
                {t("lobby.level")} 1
              </p>
            </div>
          </div>
          {/* Barra de XP. */}
          <div className="mt-4">
            <div className="h-1.5 w-full bg-white/10">
              <div className="h-full w-1/3 bg-neon-cyan shadow-[0_0_10px_rgba(36,245,255,0.7)]" />
            </div>
          </div>
          {/* Stats. */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-neon-cyan/15 pt-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted">
                {t("lobby.operations")}
              </p>
              <p className="font-display font-bold text-text-main">—</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-text-muted">
                {t("lobby.neutralized")}
              </p>
              <p className="font-display font-bold text-text-main">—</p>
            </div>
          </div>
          <span className="font-display absolute bottom-2 right-3 text-[0.6rem] font-bold uppercase tracking-wider text-neon-magenta opacity-0 transition group-hover:opacity-100">
            {t("profile.title")} →
          </span>
        </button>

        {/* Arriba derecha: SALIR y, debajo, los ajustes (idioma / audio). */}
        <div className="flex flex-col items-end gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="border border-neon-cyan/40 bg-bg/40 px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:border-neon-cyan hover:bg-neon-cyan/10"
            >
              {t("lobby.exit")} ✕
            </button>
          )}
          <SettingsMenu align="right" />
        </div>
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

      {/* Menu: tres fichas. Al elegir una, colapsan y se expande su pantalla en su lugar. */}
      {mode === "menu" ? (
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          <OperationCard
            accent="var(--color-neon-magenta)"
            glyph="+"
            title={t("lobby.createRoom")}
            description={t("lobby.createRoomDesc")}
            onClick={() => setMode("create")}
            delay={0.1}
          />
          <OperationCard
            accent="var(--color-neon-cyan)"
            glyph="→"
            title={t("lobby.joinRoom")}
            description={t("lobby.joinRoomDesc")}
            onClick={() => setMode("join")}
            delay={0.2}
          />
          <OperationCard
            accent="var(--color-neon-violet)"
            glyph="⌕"
            title={t("lobby.searchRooms")}
            description={t("lobby.searchRoomsDesc")}
            onClick={() => setMode("search")}
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
