import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from "@whoshuman/shared-validation";

import { completeOAuth } from "../shared/api/auth";
import { apiError } from "../shared/api/errors";
import { useAuthStore } from "../shared/authStore";

function OAuthCallback() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);
  const started = useRef(false);
  const [params] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const ticket = params.get("ticket") ?? "";
  const requiresDesignation = params.get("requiresDesignation") === "true";
  const callbackError = params.get("error");
  const [username, setUsername] = useState(params.get("suggestedDesignation") ?? "");
  const [error, setError] = useState<string | null>(
    callbackError
      ? t(`oauth.errors.${callbackError}`)
      : ticket
        ? null
        : t("oauth.errors.oauthFailed")
  );
  const [loading, setLoading] = useState(!requiresDesignation && !callbackError && !!ticket);

  useEffect(() => {
    window.history.replaceState(null, "", "/oauth/callback");
  }, []);

  useEffect(() => {
    if (!ticket || requiresDesignation || callbackError || started.current) return;
    started.current = true;
    void finish();
  });

  async function finish(designation?: string) {
    setError(null);
    setLoading(true);
    const language = SUPPORTED_LANGUAGES.includes(
      i18n.language as (typeof SUPPORTED_LANGUAGES)[number]
    )
      ? i18n.language
      : DEFAULT_LANGUAGE;

    try {
      const session = await completeOAuth(ticket, designation, language);
      signIn(session);
      void navigate({ to: "/lobby", replace: true });
    } catch (err) {
      setError(apiError(err, t("oauth.errors.oauthFailed")));
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void finish(username.trim());
  }

  return (
    <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center overflow-hidden p-4">
      <div className="animate-unfold-down relative w-full max-w-md origin-top border border-neon-cyan/50 bg-surface shadow-[0_0_48px_rgba(36,245,255,0.18),inset_0_0_48px_rgba(36,245,255,0.03)]">
        <div className="border-b border-neon-cyan/30 bg-neon-cyan/8 px-5 py-4 sm:px-8">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-cyan">
            // {t("oauth.protocol")}
          </p>
        </div>

        <div className="p-5 sm:p-8">
          <span className="absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-neon-magenta" />
          <span className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-neon-magenta" />
          <span className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-neon-magenta" />
          <span className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-neon-magenta" />

          <h1 className="font-display mb-2 text-3xl font-black uppercase leading-none text-text-main [text-shadow:0_0_28px_rgba(36,245,255,0.55)]">
            {requiresDesignation ? t("oauth.designationTitle") : t("oauth.connectingTitle")}
          </h1>

          {requiresDesignation && ticket && (
            <>
              <p className="mb-7 text-sm text-text-muted">{t("oauth.designationDescription")}</p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label
                    htmlFor="oauth-username"
                    className="mb-2 block text-xs font-bold uppercase tracking-widest text-text-muted"
                  >
                    {t("oauth.designationLabel")}
                  </label>
                  <input
                    id="oauth-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={20}
                    autoFocus
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="box-border w-full border border-neon-cyan/35 bg-white/5 px-4 py-3 text-text-main focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20"
                  />
                  <p className="mt-2 text-xs text-text-muted/70">{t("oauth.designationHint")}</p>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full border-2 border-neon-magenta bg-neon-magenta py-4 font-display text-sm font-black uppercase tracking-widest text-bg shadow-[0_0_24px_rgba(255,43,214,0.5)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? t("oauth.connecting") : t("oauth.confirmDesignation")}
                </button>
              </form>
            </>
          )}

          {!requiresDesignation && !error && (
            <p className="font-display animate-pulse text-sm font-bold uppercase tracking-wider text-neon-cyan">
              {t("oauth.connecting")}
            </p>
          )}

          {error && (
            <div className="mt-6 border border-neon-magenta/50 bg-neon-magenta/8 p-4">
              <p className="text-sm text-neon-magenta">{error}</p>
              {!requiresDesignation && (
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/login", replace: true })}
                  className="mt-4 border border-neon-cyan px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
                >
                  {t("oauth.backToLogin")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default OAuthCallback;
