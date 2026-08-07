import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@whoshuman/shared-validation";

import { register } from "../shared/api/auth";
import { apiError } from "../shared/api/errors";
import { useAuthStore } from "../shared/authStore";
import OAuthButtons from "../shared/OAuthButtons";
import { useHologramSound } from "../shared/useHologramSound";

type RegisterProps = {
  // En modo embebido se monta como overlay dentro de otra pantalla (la home),
  // con boton de cierre y cambio a login por callback en vez de navegar por ruta.
  embedded?: boolean;
  onClose?: () => void;
  onSwitch?: () => void;
  // Se llama tras registrar con éxito (p. ej. para ir al lobby). Si no se pasa, usa onClose.
  onSuccess?: () => void;
};

function Register({ embedded = false, onClose, onSwitch, onSuccess }: RegisterProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Sonido de aparicion holografica al abrirse el panel.
  useHologramSound();

  const signIn = useAuthStore((s) => s.signIn);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError(t("register.passwordMismatch"));
      return;
    }
    const lang = SUPPORTED_LANGUAGES.includes(i18n.language as (typeof SUPPORTED_LANGUAGES)[number])
      ? i18n.language
      : DEFAULT_LANGUAGE;
    setLoading(true);
    try {
      const session = await register(email, username, password, lang);
      signIn(session);
      if (onSuccess || onClose) {
        (onSuccess ?? onClose)?.();
      } else {
        void navigate({ to: "/lobby" });
      }
    } catch (err) {
      setError(apiError(err, t("register.submit")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={
        embedded
          ? "relative flex min-h-full w-full items-center justify-center p-4 sm:p-8"
          : "relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden p-4 sm:p-0"
      }
    >
      {/* Halo detras del panel */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[32rem] w-[32rem] bg-neon-cyan/6 blur-3xl" />
      </div>

      <div className="animate-unfold-down origin-top relative w-full max-w-md border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18),inset_0_0_48px_rgba(36,245,255,0.03)]">
        {/* Cabecera del panel */}
        <div className="flex items-center justify-between border-b border-neon-cyan/30 bg-neon-cyan/8 px-5 py-4 sm:px-8">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("register.protocol")}
          </p>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="font-display text-lg leading-none text-neon-cyan/70 transition hover:text-neon-cyan"
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-5 sm:p-8">
          {/* Esquinas decorativas */}
          <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-magenta" />
          <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-magenta" />
          <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-magenta" />
          <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-magenta" />

          <h1 className="font-display mb-1 text-[clamp(2.25rem,7vw,3rem)] font-black leading-none text-text-main [text-shadow:0_0_28px_rgba(36,245,255,0.55),0_0_56px_rgba(255,43,214,0.2)]">
            {t("register.title")}
          </h1>
          <p className="mb-8 text-sm text-text-muted">{t("register.subtitle")}</p>

          <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-5">
            <div>
              <label
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted"
                htmlFor="username"
              >
                {t("register.usernameLabel")}
              </label>
              <input
                id="username"
                type="text"
                placeholder="UNIDAD_7749"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 text-text-main focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted"
                htmlFor="email"
              >
                {t("register.emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                placeholder={t("register.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 text-text-main focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted"
                htmlFor="password"
              >
                {t("register.passwordLabel")}
              </label>
              <input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 text-text-main focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
              />
            </div>

            <div>
              <label
                className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted"
                htmlFor="confirm-password"
              >
                {t("register.confirmLabel")}
              </label>
              <input
                id="confirm-password"
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 text-text-main focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
              />
            </div>

            {error && <p className="text-sm text-neon-magenta">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full border-2 border-neon-magenta bg-neon-magenta py-4 font-display text-lg font-black uppercase tracking-widest text-bg shadow-[0_0_24px_rgba(255,43,214,0.5)] transition hover:brightness-110 hover:shadow-[0_0_40px_rgba(255,43,214,0.7)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "…" : t("register.submit")} →
            </button>
          </form>

          {/* Acceso con proveedores externos (Google / 42). */}
          <OAuthButtons />

          <div className="mt-8 border-t border-neon-cyan/15 pt-6">
            <p className="text-center text-sm text-text-muted">
              {t("register.haveAccount")}{" "}
              {onSwitch ? (
                <button
                  type="button"
                  onClick={onSwitch}
                  className="font-bold text-neon-cyan hover:brightness-125"
                >
                  {t("register.access")}
                </button>
              ) : (
                <Link to="/login" className="font-bold text-neon-cyan hover:brightness-125">
                  {t("register.access")}
                </Link>
              )}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Register;
