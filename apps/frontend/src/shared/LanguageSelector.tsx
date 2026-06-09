import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" }
];

function LanguageSelector() {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-1">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => {
            localStorage.setItem("lang", code);
            void i18n.changeLanguage(code);
          }}
          className={
            i18n.language === code
              ? "border border-neon-cyan bg-neon-cyan/10 px-3 py-1 text-sm font-bold text-neon-cyan font-display tracking-wider"
              : "border border-neon-cyan/30 bg-transparent px-3 py-1 text-sm font-bold text-text-muted font-display tracking-wider hover:border-neon-cyan/60 hover:text-neon-cyan/60"
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default LanguageSelector;
