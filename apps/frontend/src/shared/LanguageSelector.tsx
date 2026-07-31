import { useState } from "react";
import { useTranslation } from "react-i18next";

import { updateMe } from "./api/users";
import { useAuthStore } from "./authStore";

const LANGUAGES = [
  { code: "es", label: "ES" },
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" }
];

// Selector de idioma estilo terminal: etiqueta de sistema + chips conmutables.
function LanguageSelector({ showLabel = true }: { showLabel?: boolean }) {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function changeLanguage(code: string) {
    if (saving || i18n.language === code) return;
    setError(false);

    if (!user) {
      localStorage.setItem("lang", code);
      await i18n.changeLanguage(code);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMe({
        username: user.username,
        avatar: user.avatar,
        bio: user.bio,
        language: code
      });
      updateUser(updated);
      localStorage.setItem("lang", updated.language);
      await i18n.changeLanguage(updated.language);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {showLabel && (
          <span className="font-display hidden text-[0.6rem] font-bold uppercase tracking-[0.3em] text-neon-cyan/50 lg:inline">
            // IDIOMA
          </span>
        )}
        <div className="flex border border-neon-cyan/25 bg-bg/40" aria-busy={saving}>
          {LANGUAGES.map(({ code, label }) => {
            const active = i18n.language === code;
            return (
              <button
                key={code}
                type="button"
                disabled={saving}
                onClick={() => void changeLanguage(code)}
                className={`relative px-3 py-1.5 font-display text-xs font-bold tracking-wider transition disabled:cursor-wait disabled:opacity-60 ${
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
      {error && (
        <p role="alert" className="mt-2 text-xs text-neon-magenta">
          {t("settings.languageSaveError")}
        </p>
      )}
    </div>
  );
}

export default LanguageSelector;
