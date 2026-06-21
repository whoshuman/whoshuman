import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" }
];

// Selector de idioma estilo terminal: etiqueta de sistema + chips conmutables.
function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <span className="font-display hidden text-[0.6rem] font-bold uppercase tracking-[0.3em] text-neon-cyan/50 lg:inline">
        // IDIOMA
      </span>
      <div className="flex border border-neon-cyan/25 bg-bg/40">
        {LANGUAGES.map(({ code, label }) => {
          const active = i18n.language === code;
          return (
            <button
              key={code}
              type="button"
              onClick={() => {
                localStorage.setItem("lang", code);
                void i18n.changeLanguage(code);
              }}
              className={`relative px-3 py-1.5 font-display text-xs font-bold tracking-wider transition ${
                active
                  ? "bg-neon-cyan/15 text-neon-cyan [text-shadow:0_0_10px_rgb(36_245_255_/_0.7)]"
                  : "text-text-muted/70 hover:bg-neon-cyan/5 hover:text-neon-cyan/80"
              }`}
            >
              {active && <span className="absolute left-1 top-1 h-1 w-1 bg-neon-cyan" />}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default LanguageSelector;
