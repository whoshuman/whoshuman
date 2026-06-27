import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();
  // Estado local de formulario (mock, sin backend todavia).
  const [callsign, setCallsign] = useState("UNIDAD_JD");
  const [bio, setBio] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  const initials =
    callsign
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 2)
      .toUpperCase() || "JD";

  function handleSave() {
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1400);
  }

  return (
    // perspective da profundidad para que la pantalla se sienta inclinada sobre la fachada.
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
      style={{ perspective: "1800px" }}
    >
      {/* Carcasa de la pantalla: bisel oscuro grueso, ligeramente girada como sobre un muro. */}
      <div
        className="animate-crt-on pointer-events-auto relative w-[min(760px,60vw)] border-[14px] border-[#080612] bg-[#080612] shadow-[0_0_4px_#000,0_0_60px_rgba(36,245,255,0.25),0_40px_80px_rgba(0,0,0,0.6)]"
        style={{ transform: "rotateY(-11deg) rotateX(1.5deg)", transformOrigin: "center right" }}
      >
        {/* Tornillos de montaje en las esquinas del bisel. */}
        <span className="absolute -left-2.5 -top-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />
        <span className="absolute -right-2.5 -top-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />
        <span className="absolute -bottom-2.5 -left-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />
        <span className="absolute -bottom-2.5 -right-2.5 h-2.5 w-2.5 bg-neon-cyan/60 shadow-[0_0_8px_rgba(36,245,255,0.8)]" />

        {/* Superficie de la pantalla: fondo fosforo cian, borde neon interior y parpadeo. */}
        <div
          className="relative overflow-hidden border border-neon-cyan/40 bg-[#04101a] px-10 py-9"
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
                <h1 className="font-display mt-2 text-4xl font-black leading-none text-neon-cyan [text-shadow:0_0_18px_rgba(36,245,255,0.7)]">
                  {t("profile.title")}
                </h1>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="border border-neon-cyan/40 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/10"
              >
                ← {t("common.back")}
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

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 border-2 border-neon-magenta bg-neon-magenta py-3 font-display font-black uppercase tracking-widest text-bg shadow-[0_0_20px_rgba(255,43,214,0.45)] transition hover:brightness-110 hover:shadow-[0_0_36px_rgba(255,43,214,0.65)] active:translate-y-px"
              >
                {justSaved ? `✓ ${t("profile.saved")}` : t("profile.save")}
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
