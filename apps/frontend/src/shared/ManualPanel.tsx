import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useHologramSound } from "./useHologramSound";

const SECTION_KEYS = ["objective", "cyborg", "hunter", "rounds"] as const;

function ManualPanel({
  onClose,
  withHeader = false
}: {
  onClose: () => void;
  withHeader?: boolean;
}) {
  const { t } = useTranslation();
  useHologramSound(0);

  return (
    <div
      className={`animate-fade-in fixed inset-0 z-40 overflow-y-auto bg-bg/70 px-4 backdrop-blur-sm ${
        withHeader ? "pb-8 pt-20" : "py-8"
      }`}
    >
      <div
        className="panel-neon mx-auto max-w-2xl bg-surface/95 p-6 text-center backdrop-blur-sm sm:p-8"
        style={{ "--accent": "#ff2bd6" } as CSSProperties}
      >
        <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-magenta">
          // {t("manual.eyebrow")}
        </p>
        <h1 className="font-display mt-3 text-2xl font-black uppercase leading-tight text-text-main [text-shadow:0_0_18px_rgb(255_43_214_/_0.5)] sm:text-3xl">
          {t("home.manualJoke")}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
          {t("manual.intro")}
        </p>

        <div className="mt-7 grid gap-3 text-left sm:grid-cols-2">
          {SECTION_KEYS.map((key) => (
            <section key={key} className="border border-neon-cyan/25 bg-neon-cyan/5 p-4">
              <h2 className="font-display text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
                {t(`manual.sections.${key}.title`)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {t(`manual.sections.${key}.description`)}
              </p>
            </section>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 border border-neon-cyan/50 px-6 py-2 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
        >
          <span className="sm:hidden">{t("common.backShort")}</span>
          <span className="hidden sm:inline">{t("common.back")}</span>
        </button>
      </div>
    </div>
  );
}

export default ManualPanel;
