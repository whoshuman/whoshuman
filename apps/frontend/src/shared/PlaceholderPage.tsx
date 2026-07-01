import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

type PlaceholderPageProps = {
  // Clave i18n del titulo (p. ej. "home.menu.profile"). Reutiliza las etiquetas del menu.
  titleKey: string;
};

// Pantalla stub para modulos aun sin implementar (perfil, manual, sobre el proyecto).
// Reutiliza el patron de panel terminal del resto de pantallas.
function PlaceholderPage({ titleKey }: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-10 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[32rem] w-[32rem] bg-neon-cyan/8 blur-3xl" />
      </div>

      <div className="animate-unfold-down origin-top relative w-full max-w-lg border border-neon-cyan/50 bg-surface px-6 py-12 shadow-[0_0_48px_rgba(36,245,255,0.18),inset_0_0_48px_rgba(36,245,255,0.03)] sm:px-16">
        {/* Cabecera terminal */}
        <div className="absolute left-0 right-0 top-0 border-b border-neon-cyan/30 bg-neon-cyan/8 px-8 py-3">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("common.underConstruction")}
          </p>
        </div>

        {/* Esquinas decorativas */}
        <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-magenta" />
        <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-magenta" />
        <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-magenta" />
        <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-magenta" />

        <div className="mt-8">
          <h1 className="font-display mb-4 text-[clamp(1.875rem,7vw,3rem)] font-black uppercase leading-none text-text-main [text-shadow:0_0_28px_rgba(36,245,255,0.55),0_0_56px_rgba(255,43,214,0.2)]">
            {t(titleKey)}
          </h1>
          <p className="mb-8 max-w-md text-sm text-text-muted">
            {t("common.underConstructionDesc")}
          </p>

          <Link
            to="/"
            className="inline-block border-2 border-neon-cyan px-10 py-3 font-display font-black uppercase tracking-widest text-neon-cyan shadow-[0_0_20px_rgba(36,245,255,0.35)] transition hover:brightness-125 hover:shadow-[0_0_36px_rgba(36,245,255,0.55)] active:translate-y-px"
          >
            <span className="sm:hidden">{t("common.backShort")}</span>
            <span className="hidden sm:inline">{t("common.back")}</span> →
          </Link>
        </div>
      </div>
    </main>
  );
}

export default PlaceholderPage;
