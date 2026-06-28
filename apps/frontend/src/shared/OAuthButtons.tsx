import { useTranslation } from "react-i18next";

// Botones de acceso con proveedores externos (Google y 42). Compartido por Login y Register.
// El flujo real lo gestiona el backend (auth-service); aqui solo redirigimos al endpoint OAuth
// del api-gateway, que inicia el handshake del proveedor correspondiente.

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

function startOAuth(provider: "google" | "42") {
  window.location.href = `${API_BASE}/api/auth/${provider}`;
}

// Logo de Google (G multicolor oficial, simplificado).
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.4 0 10.3-2 13.9-5.3l-6.4-5.4C29.5 34.4 26.9 35.5 24 35.5c-5.2 0-9.6-3.3-11.2-7.9l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.4 5.4C41.4 36.4 43.5 30.7 43.5 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

// Logo de 42 (marca en caja, estilo de la escuela).
function FortyTwoIcon() {
  return (
    <span className="flex h-5 w-7 items-center justify-center border border-current font-display text-xs font-black leading-none">
      42
    </span>
  );
}

function OAuthButtons() {
  const { t } = useTranslation();

  return (
    <div className="mt-6">
      {/* Separador con etiqueta. */}
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-neon-cyan/15" />
        <span className="font-display text-[0.65rem] font-bold uppercase tracking-[0.3em] text-text-muted/60">
          // {t("oauth.continueWith")}
        </span>
        <span className="h-px flex-1 bg-neon-cyan/15" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => startOAuth("google")}
          className="flex items-center justify-center gap-2 border border-neon-cyan/35 bg-white/5 px-3 py-3 font-display text-xs font-bold uppercase tracking-wider text-text-main transition hover:border-neon-cyan hover:bg-neon-cyan/10"
        >
          <GoogleIcon />
          {t("oauth.google")}
        </button>
        <button
          type="button"
          onClick={() => startOAuth("42")}
          className="flex items-center justify-center gap-2 border border-neon-cyan/35 bg-white/5 px-3 py-3 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:border-neon-cyan hover:bg-neon-cyan/10"
        >
          <FortyTwoIcon />
          {t("oauth.school")}
        </button>
      </div>
    </div>
  );
}

export default OAuthButtons;
