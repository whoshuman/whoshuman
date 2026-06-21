import { useTranslation } from "react-i18next";

function Game() {
  const { t } = useTranslation();
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-bg pt-16">
      {/* Canvas placeholder — Three.js irá aquí */}
      <div className="relative flex-1 border border-neon-cyan/20">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-display text-lg font-bold uppercase tracking-wider text-neon-cyan/30">
            {t("game.scene")}
          </p>
        </div>
      </div>

      {/* HUD superior */}
      <div className="pointer-events-none absolute left-0 right-0 top-16 z-10 flex items-start justify-between px-6 pt-4">
        {/* Tiempo restante */}
        <div className="border border-neon-cyan/30 bg-bg/80 px-5 py-3 backdrop-blur-sm">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            {t("game.time")}
          </p>
          <p className="font-display text-3xl font-black text-neon-cyan [text-shadow:0_0_14px_rgb(36_245_255_/_0.5)]">
            2:47
          </p>
        </div>

        {/* Ronda */}
        <div className="border border-neon-magenta/30 bg-bg/80 px-6 py-3 text-center backdrop-blur-sm">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            {t("game.round")}
          </p>
          <p className="font-display text-3xl font-black text-neon-magenta [text-shadow:0_0_14px_rgba(255,43,214,0.5)]">
            1 / 3
          </p>
        </div>

        {/* Puntuación */}
        <div className="border border-neon-cyan/30 bg-bg/80 px-5 py-3 backdrop-blur-sm">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            {t("game.points")}
          </p>
          <p className="font-display text-3xl font-black text-success [text-shadow:0_0_14px_rgb(57_255_136_/_0.5)]">
            0
          </p>
        </div>
      </div>

      {/* HUD inferior — rol e item */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between px-6 pb-6">
        {/* Rol del jugador */}
        <div className="border border-neon-magenta/40 bg-bg/80 px-5 py-3 backdrop-blur-sm">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            {t("game.role")}
          </p>
          <p className="font-display text-xl font-black text-neon-magenta">
            {t("game.roleHidden")}
          </p>
        </div>

        {/* Ítem equipado */}
        <div className="border border-neon-cyan/30 bg-bg/80 px-5 py-3 text-center backdrop-blur-sm">
          <p className="font-display text-xs font-bold uppercase tracking-wider text-text-muted">
            {t("game.item")}
          </p>
          <p className="font-display text-xl font-black text-neon-cyan">{t("game.itemSmoke")}</p>
          <button
            type="button"
            className="pointer-events-auto mt-2 border border-neon-cyan px-4 py-1 text-xs font-bold text-neon-cyan hover:brightness-125"
          >
            {t("game.use")}
          </button>
        </div>

        {/* Medidor de sospecha */}
        <div className="w-48 border border-sun-orange/30 bg-bg/80 px-5 py-3 backdrop-blur-sm">
          <p className="font-display mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">
            {t("game.suspicion")}
          </p>
          <div className="h-2 w-full bg-white/10">
            <div className="h-2 w-1/3 bg-sun-orange shadow-[0_0_8px_rgba(255,159,28,0.7)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Game;
