import { useState } from "react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import LanguageSelector from "./LanguageSelector";
import { useMusic } from "./musicStore";

type SettingsMenuProps = {
  // Lado por el que se ancla el panel desplegable respecto al boton.
  align?: "left" | "right";
};

// Rueda de ajustes para la home: agrupa idioma y herramientas de desarrollo (design system).
// Estilo consistente con el resto de paneles terminal (borde neon, esquinas, despliegue).
function SettingsMenu({ align = "left" }: SettingsMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const musicEnabled = useMusic((state) => state.enabled);
  const toggleMusic = useMusic((state) => state.toggle);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("settings.title")}
        aria-expanded={open}
        title={t("settings.title")}
        className={`group flex h-10 w-10 items-center justify-center border bg-bg/50 backdrop-blur-sm transition ${
          open
            ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_24px_rgb(36_245_255_/_0.45)]"
            : "border-neon-cyan/40 text-neon-cyan/80 hover:border-neon-cyan hover:text-neon-cyan hover:shadow-[0_0_18px_rgb(36_245_255_/_0.35)]"
        }`}
      >
        <Settings
          aria-hidden="true"
          size={19}
          strokeWidth={1.8}
          className={`transition-transform duration-500 ${open ? "rotate-90" : "group-hover:rotate-45"}`}
        />
      </button>

      {open && (
        <>
          {/* Capa para cerrar al pulsar fuera. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />

          <div
            className={`animate-unfold-down origin-top absolute top-full z-50 mt-3 w-64 border border-neon-cyan/40 bg-surface p-5 shadow-[0_0_32px_rgb(36_245_255_/_0.2)] ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {/* Esquinas decorativas. */}
            <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-neon-magenta" />
            <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-neon-magenta" />
            <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-neon-magenta" />
            <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-neon-magenta" />

            <p className="font-display mb-4 text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan [text-shadow:0_0_10px_rgb(36_245_255_/_0.5)]">
              // {t("settings.title")}
            </p>

            {/* Seccion idioma. */}
            <p className="font-display mb-2 text-[0.6rem] font-bold uppercase tracking-[0.3em] text-text-muted/60">
              {t("settings.language")}
            </p>
            <LanguageSelector showLabel={false} />

            {/* Seccion audio: activar/desactivar la musica de fondo. */}
            <div className="mt-5 border-t border-neon-cyan/15 pt-4">
              <p className="font-display mb-2 text-[0.6rem] font-bold uppercase tracking-[0.3em] text-text-muted/60">
                {t("settings.audio")}
              </p>
              <button
                type="button"
                onClick={toggleMusic}
                aria-pressed={musicEnabled}
                className={`flex w-full items-center justify-between border px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition ${
                  musicEnabled
                    ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20"
                    : "border-neon-cyan/30 text-text-muted/60 hover:border-neon-cyan/50"
                }`}
              >
                <span>{t("settings.music")}</span>
                <span>{musicEnabled ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SettingsMenu;
