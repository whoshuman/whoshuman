import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "./authStore";

type LegalPageProps = {
  namespace: "privacy" | "terms";
  itemKeys: readonly string[];
};

export function LegalPage({ namespace, itemKeys }: LegalPageProps) {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const backTo = isAuthenticated ? "/lobby" : "/";

  return (
    <main className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
      <section className="animate-unfold-down relative w-full max-w-3xl origin-top border border-neon-cyan/50 bg-surface p-6 shadow-[0_0_48px_rgba(36,245,255,0.18)] sm:p-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
              // {t(`${namespace}.eyebrow`)}
            </p>
            <h1 className="font-display mt-3 text-[clamp(1.75rem,6vw,3rem)] font-black uppercase leading-none text-text-main">
              {t(`${namespace}.title`)}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
              {t(`${namespace}.subtitle`)}
            </p>
            <p className="mt-2 font-display text-[0.65rem] font-bold uppercase tracking-[0.2em] text-text-muted/50">
              {t(`${namespace}.lastUpdated`)}
            </p>
          </div>
          <Link
            to={backTo}
            aria-label={t("common.back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-neon-cyan/40 text-neon-cyan transition hover:bg-neon-cyan/10"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          {itemKeys.map((key) => (
            <article key={key} className="border-l-2 border-neon-cyan/30 pl-4">
              <h2 className="font-display text-xs font-black uppercase tracking-[0.14em] text-neon-cyan">
                {t(`${namespace}.items.${key}.title`)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {t(`${namespace}.items.${key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
