import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { getCombatStats } from "./api/users";
import { useAuthStore } from "./authStore";
import CornerBrackets from "./CornerBrackets";
import ProfileAvatarHead from "./ProfileAvatarHead";

type PlayerCardProps = {
  // Que hacer al pulsar la ficha (normalmente, abrir la edicion de perfil).
  onClick: () => void;
};

// Ficha de identidad de la unidad: foto (o retrato 3D del elenco si no hay) asomando por la
// esquina, nombre y un par de estadisticas de combate. Se usa en el lobby y en la home.
function PlayerCard({ onClick }: PlayerCardProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const username = user?.username ?? "";
  // Respaldo del avatar 3D mientras carga el modelo.
  const initials = username.slice(0, 2).toUpperCase() || "--";

  const { data: combatStats } = useQuery({
    queryKey: ["me", "combat-stats"],
    queryFn: getCombatStats,
    enabled: Boolean(user)
  });
  const winRatePercent =
    combatStats && combatStats.totalGames > 0
      ? Math.round((combatStats.wins / combatStats.totalGames) * 1000) / 10
      : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="panel-neon animate-crt-on [transform-origin:center] group relative w-full bg-surface/90 py-3 pl-24 pr-3 text-left transition hover:-translate-y-0.5 sm:py-6 sm:pl-36 sm:pr-5"
      style={{ "--accent": "var(--color-neon-cyan)", opacity: 0 } as CSSProperties}
    >
      <CornerBrackets color="var(--color-neon-magenta)" />
      {/* Foto de perfil circular: sobresale de la esquina superior izquierda de la ficha.
          Sin foto propia, un retrato 3D animado de un personaje del elenco. */}
      <div className="absolute -top-6 left-2 h-20 w-20 overflow-hidden rounded-full border-2 border-neon-cyan bg-neon-cyan/10 font-display font-black text-neon-cyan shadow-[0_0_16px_rgba(36,245,255,0.5)] sm:-top-9 sm:left-3 sm:h-28 sm:w-28">
        {user?.avatar ? (
          <img src={user.avatar} alt={username} className="h-full w-full object-cover" />
        ) : (
          <ProfileAvatarHead initials={initials} />
        )}
      </div>

      <p className="font-display truncate text-base font-black text-text-main sm:text-lg">
        {username}
      </p>
      {/* Stats compactas: % de victorias y partidas jugadas. Envuelven antes que desbordar
          la ficha si la traduccion es larga. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="font-display text-xs font-black text-neon-cyan sm:text-sm">
          {winRatePercent}%
          <span className="ml-1 font-bold text-text-muted/70">{t("lobby.statsWinRate")}</span>
        </span>
        <span className="font-display text-xs font-black text-text-main sm:text-sm">
          {combatStats?.totalGames ?? 0}
          <span className="ml-1 font-bold text-text-muted/70">{t("profilePage.statsGames")}</span>
        </span>
      </div>
      <span className="font-display absolute bottom-2 right-3 text-[0.6rem] font-bold uppercase tracking-wider text-neon-magenta opacity-0 transition group-hover:opacity-100">
        {t("profile.title")} →
      </span>
    </button>
  );
}

export default PlayerCard;
