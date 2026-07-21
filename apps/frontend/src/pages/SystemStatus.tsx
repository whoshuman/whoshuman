import { useQueries } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getServiceHealth, MONITORED_SERVICES } from "../shared/api/system";
import { useHologramSound } from "../shared/useHologramSound";

// Estado de la red de microservicios: un ping por servicio vía gateway → NATS.
// useQueries lanza las 7 consultas en paralelo, cada una con su propio estado —
// un servicio caído (504) no bloquea a los demás.
function SystemStatus() {
  const { t, i18n } = useTranslation();
  useHologramSound();

  const checks = useQueries({
    queries: MONITORED_SERVICES.map((name) => ({
      queryKey: ["health", name],
      queryFn: () => getServiceHealth(name),
      retry: 0,
      refetchInterval: 30_000
    }))
  });

  const online = checks.filter((c) => c.isSuccess).length;
  const allChecked = checks.every((c) => !c.isPending);

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-10">
      <div className="animate-unfold-down relative w-full max-w-2xl origin-top border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18)]">
        <div className="flex items-center justify-between border-b border-neon-cyan/30 bg-neon-cyan/8 px-6 py-3 sm:px-10">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("status.eyebrow")}
          </p>
          <span
            className={
              allChecked && online === checks.length
                ? "inline-flex border border-current bg-success/10 px-3 py-1 text-xs font-bold text-success"
                : "inline-flex border border-current bg-sun-orange/15 px-3 py-1 text-xs font-bold text-sun-orange"
            }
          >
            {online}/{checks.length} {t("status.online")}
          </span>
        </div>
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-magenta" />
        <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-magenta" />
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-magenta" />
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-magenta" />

        <div className="flex flex-col gap-2 px-6 py-8 sm:px-10">
          {MONITORED_SERVICES.map((name, index) => {
            const check = checks[index];
            const state = check.isPending ? "checking" : check.isSuccess ? "online" : "offline";
            return (
              <div
                key={name}
                className="flex items-center justify-between border border-neon-cyan/20 bg-white/3 px-4 py-3"
              >
                <div>
                  <p className="font-display text-sm font-bold uppercase text-text-main">{name}</p>
                  {check.isSuccess && (
                    <p className="text-xs text-text-muted/70">
                      {new Intl.DateTimeFormat(i18n.language, {
                        timeStyle: "medium"
                      }).format(new Date(check.data.timestamp))}
                    </p>
                  )}
                </div>
                {state === "checking" && (
                  <span className="inline-flex animate-pulse border border-current bg-white/10 px-3 py-1 text-xs font-bold text-text-muted">
                    {t("status.checking")}
                  </span>
                )}
                {state === "online" && (
                  <span className="inline-flex border border-current bg-success/10 px-3 py-1 text-xs font-bold text-success">
                    {t("status.serviceOnline")}
                  </span>
                )}
                {state === "offline" && (
                  <span className="inline-flex border border-current bg-error/15 px-3 py-1 text-xs font-bold text-error">
                    {t("status.serviceOffline")}
                  </span>
                )}
              </div>
            );
          })}
          <p className="mt-3 text-xs text-text-muted/70">{t("status.hint")}</p>
        </div>
      </div>
    </main>
  );
}

export default SystemStatus;
