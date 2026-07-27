import { Link } from "@tanstack/react-router";
import { Activity, ArrowLeft, BookOpen, CircleHelp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../shared/authStore";

const SUPPORT_LINKS = [
  { to: "/status", key: "status", Icon: Activity },
  { to: "/faq", key: "faq", Icon: CircleHelp },
  { to: "/manual", key: "manual", Icon: BookOpen }
] as const;

function Support() {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const backTo = isAuthenticated ? "/lobby" : "/";

  return (
    <main className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
      <section className="animate-unfold-down relative w-full max-w-3xl origin-top border border-neon-cyan/50 bg-surface p-6 shadow-[0_0_48px_rgba(36,245,255,0.18)] sm:p-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-magenta">
              // {t("support.eyebrow")}
            </p>
            <h1 className="font-display mt-3 text-[clamp(1.75rem,6vw,3rem)] font-black uppercase leading-none text-text-main">
              {t("support.title")}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-muted">
              {t("support.subtitle")}
            </p>
          </div>
          <Link
            to={backTo}
            aria-label={isAuthenticated ? t("friends.backToLobby") : t("common.back")}
            className="flex h-10 w-10 shrink-0 items-center justify-center border border-neon-cyan/40 text-neon-cyan transition hover:bg-neon-cyan/10"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {SUPPORT_LINKS.map(({ to, key, Icon }) => (
            <Link
              key={key}
              to={to}
              className="border border-neon-cyan/25 bg-neon-cyan/4 p-5 transition hover:border-neon-cyan/60 hover:bg-neon-cyan/8"
            >
              <Icon aria-hidden="true" size={22} className="text-neon-cyan" />
              <h2 className="font-display mt-4 text-xs font-black uppercase tracking-[0.16em] text-text-main">
                {t(`support.links.${key}.title`)}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">
                {t(`support.links.${key}.description`)}
              </p>
            </Link>
          ))}
        </div>

        <p className="mt-6 border-l-2 border-neon-magenta bg-neon-magenta/5 px-4 py-3 text-sm leading-relaxed text-text-muted">
          {t("support.note")}
        </p>
      </section>
    </main>
  );
}

export default Support;
