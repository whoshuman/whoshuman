import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import LanguageSelector from "./LanguageSelector";

type SettingsMenuProps = {
  // Lado por el que se ancla el panel desplegable respecto al boton.
  align?: "left" | "right";
};

// Rueda de ajustes para la home: agrupa idioma y herramientas de desarrollo (design system).
// Estilo consistente con el resto de paneles terminal (borde neon, esquinas, despliegue).
function SettingsMenu({ align = "left" }: SettingsMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t("settings.title")}
        aria-expanded={open}
        className={`group flex h-11 w-11 items-center justify-center border bg-bg/50 backdrop-blur-sm transition ${
          open
            ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_24px_rgb(36_245_255_/_0.45)]"
            : "border-neon-cyan/40 text-neon-cyan/80 hover:border-neon-cyan hover:text-neon-cyan hover:shadow-[0_0_18px_rgb(36_245_255_/_0.35)]"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-5 w-5 transition-transform duration-500 ${open ? "rotate-90" : "group-hover:rotate-45"}`}
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
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

            {/* Seccion herramientas de desarrollo. */}
            <div className="mt-5 border-t border-neon-cyan/15 pt-4">
              <p className="font-display mb-2 text-[0.6rem] font-bold uppercase tracking-[0.3em] text-text-muted/60">
                {t("settings.dev")}
              </p>
              <Link
                to="/design-system"
                onClick={() => setOpen(false)}
                className="block border border-neon-violet/50 bg-neon-violet/10 px-3 py-2 text-center font-display text-xs font-bold uppercase tracking-wider text-neon-violet transition hover:bg-neon-violet/20"
              >
                <span className="mr-1 opacity-60">[DEV]</span>
                {t("nav.designSystem")}
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SettingsMenu;
