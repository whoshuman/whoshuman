import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { SUPPORTED_LANGUAGES } from "@whoshuman/shared-validation";
import { apiError } from "../shared/api/errors";
import { updateMe } from "../shared/api/users";
import { useAuthStore } from "../shared/authStore";
import { useHologramSound } from "../shared/useHologramSound";

type ProfileEditProps = {
  onClose: () => void;
};

const BIO_MAX = 140;

// Capa de scanlines fijas (lineas oscuras horizontales) que dan textura de tubo CRT.
const scanlinesStyle: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.32) 0px, rgba(0,0,0,0.32) 1px, transparent 2px, transparent 4px)"
};

// Pantalla de edicion de perfil presentada como un display gigante montado en un edificio
// de la ciudad. La camara apunta a la derecha y este panel simula la pantalla del edificio.
function ProfileEdit({ onClose }: ProfileEditProps) {
  const { t, i18n } = useTranslation();
  // Sonido de aparicion holografica al abrirse la pantalla.
  useHologramSound();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  // Estado local de formulario, inicializado con los datos reales del usuario.
  const [callsign, setCallsign] = useState(user?.username ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [lang, setLang] = useState<string>(user?.language ?? i18n.language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.language) setLang(user.language);
  }, [user?.language]);

  const initials =
    callsign
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "JD";

  async function handleSave() {
    if (!user) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateMe({
        username: callsign,
        bio,
        avatar: user.avatar,
        language: lang
      });
      updateUser(updated);
      void i18n.changeLanguage(updated.language);
      localStorage.setItem("lang", updated.language);
      onClose();
    } catch (err) {
      setError(apiError(err, t("profile.save")));
    } finally {
      setSaving(false);
    }
  }

  return (
    // perspective da profundidad para que la pantalla se sienta inclinada sobre la fachada.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-bg p-4"
      style={{ perspective: "1800px" }}
    >
      {/* Carcasa de la pantalla: bisel oscuro grueso, ligeramente girada como sobre un muro.
          En movil ocupa casi todo el ancho y se endereza (sin giro) para no salirse. */}
      <div
        className="animate-crt-on pointer-events-auto relative w-[min(760px,94vw)] border-[10px] border-[#080612] bg-[#080612] shadow-[0_0_4px_#000,0_0_60px_rgba(36,245,255,0.25),0_40px_80px_rgba(0,0,0,0.6)] sm:w-[min(760px,60vw)] sm:border-[14px] sm:[transform:rotateY(-11deg)_rotateX(1.5deg)]"
        style={{ transformOrigin: "center right" }}
      >
        {/* Tornillos de montaje en las esquinas del bisel. */}
        <span className="absolute -left-2.5 -top-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />
        <span className="absolute -right-2.5 -top-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />
        <span className="absolute -bottom-2.5 -left-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />
        <span className="absolute -bottom-2.5 -right-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />

        {/* Superficie de la pantalla: fondo fosforo cian, borde neon interior y parpadeo. */}
        <div
          className="relative overflow-hidden border border-neon-cyan/40 bg-[#04101a] px-5 py-6 sm:px-10 sm:py-9"
          style={{ animation: "screen-flicker 5s ease-in-out infinite" }}
        >
          {/* Linea de scan que recorre la pantalla en bucle. */}
          <span
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-24 bg-linear-to-b from-transparent via-neon-cyan/10 to-transparent"
            style={{ animation: "screen-scan 4.5s linear infinite" }}
          />
          {/* Rejilla de scanlines fija sobre todo el contenido. */}
          <span
            className="pointer-events-none absolute inset-0 z-20 opacity-70"
            style={scanlinesStyle}
          />
          {/* Vineta en los bordes para dar curvatura de tubo. */}
          <span className="pointer-events-none absolute inset-0 z-20 shadow-[inset_0_0_80px_rgba(0,0,0,0.7)]" />

          <div className="relative z-10">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-magenta">
                  // {t("profile.eyebrow")}
                </p>
                <h1 className="font-display mt-2 text-[clamp(1.875rem,6vw,2.25rem)] font-black leading-none text-neon-cyan [text-shadow:0_0_18px_rgba(36,245,255,0.7)]">
                  {t("profile.title")}
                </h1>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="border border-neon-cyan/40 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
              >
                ← <span className="sm:hidden">{t("common.backShort")}</span>
                <span className="hidden sm:inline">{t("common.back")}</span>
              </button>
            </div>

            <p className="mb-7 text-sm text-text-muted">{t("profile.subtitle")}</p>

            {/* Avatar + ID */}
            <div className="mb-7 flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center border-2 border-neon-cyan/40 bg-neon-cyan/10 font-display text-2xl font-black text-neon-cyan [text-shadow:0_0_14px_rgba(36,245,255,0.6)]">
                {initials}
              </div>
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
                  // {t("profile.avatar")}
                </p>
                <p className="mt-1 font-display text-xl font-black text-text-main">
                  {callsign || "—"}
                </p>
              </div>
            </div>

            {/* Distintivo */}
            <label className="mb-5 block">
              <span className="font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
                {t("profile.callsign")}
              </span>
              <input
                type="text"
                value={callsign}
                maxLength={24}
                onChange={(event) => setCallsign(event.target.value)}
                className="mt-2 w-full border border-neon-cyan/35 bg-black/30 px-4 py-2.5 font-display uppercase tracking-wider text-text-main outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
              />
              <span className="mt-1 block text-xs text-text-muted/70">
                {t("profile.callsignHint")}
              </span>
            </label>

            {/* Bio / notas */}
            <label className="mb-7 block">
              <span className="font-display text-xs font-bold uppercase tracking-[0.25em] text-neon-cyan/80">
                {t("profile.bio")}
              </span>
              <textarea
                value={bio}
                maxLength={BIO_MAX}
                rows={2}
                onChange={(event) => setBio(event.target.value)}
                className="mt-2 w-full resize-none border border-neon-cyan/35 bg-black/30 px-4 py-2.5 text-text-main outline-none transition focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20"
              />
              <span className="mt-1 flex justify-between text-xs text-text-muted/70">
                <span>{t("profile.bioHint")}</span>
                <span>
                  {bio.length}/{BIO_MAX}
                </span>
              </span>
            </label>

            {/* Idioma */}
            <div className="mb-6 flex gap-2">
              {SUPPORTED_LANGUAGES.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={
                    lang === code
                      ? "border border-neon-cyan px-3 py-1 font-display text-xs text-neon-cyan"
                      : "border border-neon-cyan/30 px-3 py-1 font-display text-xs text-text-muted"
                  }
                >
                  {code.toUpperCase()}
                </button>
              ))}
            </div>

            {error && <p className="mb-4 text-sm text-neon-magenta">{error}</p>}

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 border-2 border-neon-magenta bg-neon-magenta py-3 font-display font-black uppercase tracking-widest text-bg shadow-[0_0_20px_rgba(255,43,214,0.45)] transition hover:brightness-110 hover:shadow-[0_0_36px_rgba(255,43,214,0.65)] active:translate-y-px"
              >
                <span className="sm:hidden">{t("profile.saveShort")}</span>
                <span className="hidden sm:inline">{t("profile.save")}</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border border-neon-cyan/50 px-6 py-3 font-display font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
              >
                {t("profile.cancel")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfileEdit;
