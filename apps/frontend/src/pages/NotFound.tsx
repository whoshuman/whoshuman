import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden text-center">
      {/* Halo de fondo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[32rem] w-[32rem] bg-error/8 blur-3xl" />
      </div>

      <div className="animate-crt-on [transform-origin:center] relative border border-error/50 bg-surface px-16 py-12 shadow-[0_0_48px_rgba(255,59,107,0.2),inset_0_0_48px_rgba(255,59,107,0.03)]">
        {/* Cabecera terminal */}
        <div className="absolute left-0 right-0 top-0 border-b border-error/30 bg-error/10 px-8 py-3">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-error">
            // {t("notFound.protocol")}
          </p>
        </div>

        {/* Esquinas decorativas */}
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-cyan" />
        <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-cyan" />
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-cyan" />
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-cyan" />

        <div className="mt-8">
          <p className="font-display mb-1 text-xs font-bold uppercase tracking-[0.3em] text-error">
            {t("notFound.errorCode")}
          </p>
          <h1 className="font-display text-[9rem] font-black leading-none text-error [text-shadow:0_0_28px_rgba(255,59,107,0.7),0_0_56px_rgba(255,59,107,0.35)]">
            404
          </h1>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-error/40 to-transparent" />

          <p className="font-display mb-2 text-xl font-bold text-text-main">
            {t("notFound.notLocated")}
          </p>
          <p className="mb-8 text-sm text-text-muted">
            {t("notFound.descLine1")} <br />
            {t("notFound.descLine2")}
          </p>

          <Link
            to="/"
            className="inline-block border-2 border-neon-cyan px-10 py-3 font-display font-black uppercase tracking-widest text-neon-cyan shadow-[0_0_20px_rgba(36,245,255,0.35)] transition hover:brightness-125 hover:shadow-[0_0_36px_rgba(36,245,255,0.55)] active:translate-y-px"
          >
            {t("notFound.back")} →
          </Link>
        </div>
      </div>
    </main>
  );
}

export default NotFound;
