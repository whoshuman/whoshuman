import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

type LoginProps = {
  // En modo embebido se monta como overlay dentro de otra pantalla (la home),
  // con boton de cierre y cambio a registro por callback en vez de navegar por ruta.
  embedded?: boolean;
  onClose?: () => void;
  onSwitch?: () => void;
};

function Login({ embedded = false, onClose, onSwitch }: LoginProps) {
  const { t } = useTranslation();

  return (
    <main
      className={
        embedded
          ? "relative flex h-full w-full items-center justify-center p-8"
          : "relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden"
      }
    >
      {/* Halo detras del panel */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[32rem] w-[32rem] bg-neon-magenta/8 blur-3xl" />
      </div>

      <div className="animate-unfold-down origin-top relative w-full max-w-md border border-neon-magenta/50 bg-surface shadow-[0_0_48px_rgba(255,43,214,0.2),inset_0_0_48px_rgba(255,43,214,0.03)]">
        {/* Cabecera del panel */}
        <div className="flex items-center justify-between border-b border-neon-magenta/30 bg-neon-magenta/10 px-8 py-4">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-magenta">
            // {t("login.protocol")}
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="font-display text-lg leading-none text-neon-magenta/70 transition hover:text-neon-magenta"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-8">
          {/* Esquinas decorativas */}
          <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-cyan" />
          <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-cyan" />
          <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-cyan" />
          <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-cyan" />

          <h1 className="font-display mb-1 text-5xl font-black leading-none text-text-main [text-shadow:0_0_28px_rgba(255,43,214,0.65),0_0_56px_rgba(36,245,255,0.28)]">
            {t("login.title")}
          </h1>
          <p className="mb-8 text-sm text-text-muted">{t("login.subtitle")}</p>

          <div className="flex flex-col gap-5">
            <div>
              <label
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted"
                htmlFor="email"
              >
                {t("login.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                placeholder={t("login.emailPlaceholder")}
                className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 text-text-main focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted"
                htmlFor="password"
              >
                {t("login.passwordLabel")}
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••••"
                className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 text-text-main focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
                <input type="checkbox" className="accent-neon-magenta" />
                {t("login.keepSession")}
              </label>
              <a href="#" className="text-sm text-neon-cyan hover:brightness-125">
                {t("login.recover")}
              </a>
            </div>

            <button
              type="button"
              className="mt-2 w-full border-2 border-neon-magenta bg-neon-magenta py-4 font-display text-lg font-black uppercase tracking-widest text-bg shadow-[0_0_24px_rgba(255,43,214,0.5)] transition hover:brightness-110 hover:shadow-[0_0_40px_rgba(255,43,214,0.7)] active:translate-y-px"
            >
              {t("login.submit")} →
            </button>
          </div>

          <div className="mt-8 border-t border-neon-cyan/15 pt-6">
            <p className="text-center text-sm text-text-muted">
              {t("login.noAccount")}{" "}
              {onSwitch ? (
                <button
                  type="button"
                  onClick={onSwitch}
                  className="font-bold text-neon-cyan hover:brightness-125"
                >
                  {t("login.createProfile")}
                </button>
              ) : (
                <Link to="/register" className="font-bold text-neon-cyan hover:brightness-125">
                  {t("login.createProfile")}
                </Link>
              )}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Login;
