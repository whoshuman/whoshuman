import { ArrowLeft, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../shared/authStore";
import { useBackTarget } from "../shared/useBackTarget";

const FAQ_KEYS = ["game", "roles", "rounds", "friends"] as const;

function Faq() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  // Respaldo solo para cuando no hay historial (enlace directo): con sesion, el lobby.
  const goBack = useBackTarget(isAuthenticated ? "/lobby" : "/");

  return (
    <main className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
      <section className="animate-unfold-down relative w-full max-w-3xl origin-top border border-neon-cyan/50 bg-surface p-6 shadow-[0_0_48px_rgba(36,245,255,0.18)] sm:p-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
              // {t("faq.eyebrow")}
            </p>
            <h1 className="font-display mt-3 text-[clamp(1.75rem,6vw,3rem)] font-black uppercase leading-none text-text-main">
              {t("faq.title")}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
              {t("faq.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={goBack}
            aria-label={t("common.back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-neon-cyan/40 text-neon-cyan transition hover:bg-neon-cyan/10"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {FAQ_KEYS.map((key) => (
            <details key={key} className="group border border-neon-cyan/25 bg-neon-cyan/4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 font-display text-xs font-black uppercase tracking-[0.14em] text-neon-cyan">
                {t(`faq.items.${key}.question`)}
                <ChevronDown
                  aria-hidden="true"
                  size={17}
                  className="shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="border-t border-neon-cyan/15 px-4 py-4 text-sm leading-relaxed text-text-muted">
                {t(`faq.items.${key}.answer`)}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

export default Faq;
