import { useState } from "react";
import { useTranslation } from "react-i18next";

function Lobby() {
  const { t } = useTranslation();
  const [glitching, setGlitching] = useState(false);

  function handleMission() {
    setGlitching(true);
    setTimeout(() => setGlitching(false), 400);
  }
  return (
    <main className="main-container">
      <section className="content-section max-w-3xl">
        <p className="font-display mb-3 text-xs font-bold uppercase tracking-[0.3em] text-neon-magenta">
          // {t("lobby.eyebrow")}
        </p>
        <h1 className="font-display mb-4 text-6xl font-black leading-none text-text-main [text-shadow:0_0_28px_rgba(255,43,214,0.55),0_0_56px_rgba(36,245,255,0.24)]">
          {t("lobby.deployTitle")}
        </h1>
        <p className="text-xl text-text-muted">{t("lobby.deploySubtitle")}</p>
      </section>

      <section className="pb-16">
        <div className="grid grid-cols-3 gap-6">
          {/* Panel izquierdo — perfil y matchmaking */}
          <div className="col-span-1 flex flex-col gap-4">
            {/* Datos de unidad */}
            <div className="animate-crt-on [transform-origin:center] relative border border-neon-cyan bg-surface p-6 shadow-[0_0_24px_rgba(36,245,255,0.16)]">
              <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-neon-magenta" />
              <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-neon-magenta" />
              <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-neon-magenta" />
              <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-neon-magenta" />

              <p className="font-display mb-4 text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan">
                // {t("lobby.unitData")}
              </p>
              <div className="mb-4 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center border-2 border-neon-cyan/40 bg-neon-cyan/10 font-display text-2xl font-black text-neon-cyan [text-shadow:0_0_12px_rgba(36,245,255,0.6)]">
                  JD
                </div>
                <div>
                  <p className="font-display font-bold text-text-main">UNIDAD_JD</p>
                  <span className="inline-flex items-center gap-1.5 border border-current bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
                    <span className="h-1.5 w-1.5 animate-pulse bg-current" />
                    {t("lobby.statusActive")}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-neon-cyan/15 pt-4 text-sm">
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
            </div>

            {/* Matchmaking */}
            <div
              className="animate-crt-on [transform-origin:center] relative border border-neon-magenta bg-surface p-6 shadow-[0_0_32px_rgba(255,43,214,0.22)]"
              style={{ animationDelay: "0.15s", opacity: 0 }}
            >
              <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-neon-cyan" />
              <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-neon-cyan" />
              <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-neon-cyan" />
              <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-neon-cyan" />

              <p className="font-display mb-2 text-xs font-bold uppercase tracking-[0.25em] text-neon-magenta">
                // {t("lobby.autoDeployTitle")}
              </p>
              <p className="mb-5 text-sm text-text-muted">{t("lobby.autoDeployText")}</p>
              <button
                type="button"
                onClick={handleMission}
                className={`w-full border-2 border-neon-magenta bg-neon-magenta py-3 font-display font-black uppercase tracking-widest text-bg shadow-[0_0_20px_rgba(255,43,214,0.45)] transition hover:brightness-110 hover:shadow-[0_0_36px_rgba(255,43,214,0.65)] active:translate-y-px ${glitching ? "animate-glitch" : ""}`}
              >
                {t("lobby.requestMission")} →
              </button>
            </div>
          </div>

          {/* Panel derecho — operaciones activas */}
          <div className="col-span-2">
            <div
              className="animate-crt-on [transform-origin:center] relative border border-neon-cyan/30 bg-surface p-6"
              style={{ animationDelay: "0.3s", opacity: 0 }}
            >
              <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-neon-magenta" />
              <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-neon-magenta" />

              <p className="font-display mb-6 text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan">
                // {t("lobby.activeOps")}
              </p>

              <div className="flex flex-col gap-3">
                {[
                  { id: "OP-001", units: "3/6", status: "recruiting", time: "00:42" },
                  { id: "OP-002", units: "6/6", status: "inProgress", time: "01:23" },
                  { id: "OP-003", units: "2/6", status: "recruiting", time: "00:08" }
                ].map((op) => (
                  <div
                    key={op.id}
                    className="flex items-center justify-between border border-neon-cyan/15 bg-white/3 px-5 py-4 transition hover:border-neon-cyan/30 hover:bg-white/5"
                  >
                    <div className="flex items-center gap-6">
                      <span className="font-display text-sm font-black text-neon-cyan [text-shadow:0_0_10px_rgba(36,245,255,0.4)]">
                        {op.id}
                      </span>
                      <span className="text-sm text-text-muted">
                        {op.units} {t("lobby.units")}
                      </span>
                      <span className="font-display text-sm text-text-muted">{op.time}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span
                        className={`inline-flex items-center gap-1.5 border border-current px-3 py-1 text-xs font-bold ${
                          op.status === "inProgress"
                            ? "bg-sun-orange/15 text-sun-orange"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 ${op.status === "recruiting" ? "animate-pulse" : ""} bg-current`}
                        />
                        {op.status === "inProgress"
                          ? t("lobby.statusInProgress")
                          : t("lobby.statusRecruiting")}
                      </span>
                      {op.status === "recruiting" && (
                        <button
                          type="button"
                          className="border border-neon-cyan px-5 py-2 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:brightness-125 active:translate-y-px"
                        >
                          {t("lobby.join")}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default Lobby;
