import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import CornerBrackets from "../shared/CornerBrackets";
import { useHologramSound } from "../shared/useHologramSound";
import danielPhoto from "../assets/team/daniel.png";
import davidPhoto from "../assets/team/david.png";
import eduPhoto from "../assets/team/edu.png";
import juanPhoto from "../assets/team/juan.png";
import sergioPhoto from "../assets/team/sergio.png";

type AboutTeamProps = {
  onClose: () => void;
  // Atenua las fichas (la camara hace picado cenital sobre el coche).
  dimmed?: boolean;
  // Selecciona una ficha: el coche se desliza al carril bajo esa tarjeta.
  onSelect?: (index: number) => void;
};

type Member = {
  name: string;
  role: string;
  accent: string;
  // Foto real cibernetica; si falta se usa el avatar procedural.
  photo?: string;
  // Perfil de LinkedIn; si falta no se muestra el boton.
  linkedin?: string;
};

// Equipo del proyecto. El color acento da a cada ficha (y su avatar) una identidad propia.
const TEAM: Member[] = [
  {
    name: "Sergio Marin",
    role: "Frontend",
    accent: "#24f5ff",
    photo: sergioPhoto,
    linkedin: "https://www.linkedin.com/in/sergio-marin-alvarez/"
  },
  { name: "Daniel Escamil", role: "Backend & 3D", accent: "#ff2bd6", photo: danielPhoto },
  {
    name: "Edu Zhan",
    role: "Product Owner & Backend",
    accent: "#8b5cf6",
    photo: eduPhoto,
    linkedin: "https://www.linkedin.com/in/edulu/"
  },
  {
    name: "Juan Delorme",
    role: "Product Manager & Frontend",
    accent: "#ff9f1c",
    photo: juanPhoto,
    linkedin: "https://www.linkedin.com/in/jdelorme/"
  },
  {
    name: "Luis David Diaz",
    role: "Arquitecto & Backend",
    accent: "#39ff88",
    photo: davidPhoto,
    linkedin: "https://www.linkedin.com/in/ldiaz-ra/"
  }
];

// Retrato cibernetico procedural: silueta de cabeza con visor y circuitos, teñido por acento.
// Sin foto real: se genera con SVG para mantener el tono cyberpunk del sistema.
function CyberAvatar({ accent, name }: { accent: string; name: string }) {
  // Semilla determinista a partir del nombre para variar los detalles del circuito.
  const seed = name.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const eyeY = 70 + (seed % 6);
  const circuitX = 30 + (seed % 20);

  return (
    <svg
      viewBox="0 0 160 160"
      className="h-full w-full"
      aria-label={`Avatar de ${name}`}
      role="img"
    >
      <defs>
        <linearGradient id={`grad-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor="#04101a" stopOpacity="0.9" />
        </linearGradient>
        <filter id={`glow-${seed}`}>
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fondo de pantalla del retrato. */}
      <rect x="0" y="0" width="160" height="160" fill={`url(#grad-${seed})`} />

      {/* Circuitos de fondo. */}
      <g stroke={accent} strokeOpacity="0.25" strokeWidth="1" fill="none">
        <path d={`M0 ${circuitX} H40 V60`} />
        <path d={`M160 ${circuitX + 30} H120 V90`} />
        <circle cx="40" cy="60" r="2.5" fill={accent} fillOpacity="0.5" />
        <circle cx="120" cy="90" r="2.5" fill={accent} fillOpacity="0.5" />
      </g>

      {/* Silueta de cabeza (cyborg): craneo hexagonal + mandibula. */}
      <g
        filter={`url(#glow-${seed})`}
        stroke={accent}
        strokeWidth="2.5"
        fill="#081019"
        fillOpacity="0.7"
      >
        <path d="M80 28 L112 44 L116 84 L98 120 L62 120 L44 84 L48 44 Z" />
      </g>

      {/* Visor / ojo cibernetico horizontal. */}
      <rect
        x="56"
        y={eyeY}
        width="48"
        height="9"
        rx="0"
        fill={accent}
        filter={`url(#glow-${seed})`}
      />
      <rect x="58" y={eyeY + 2.5} width="44" height="3" fill="#04101a" fillOpacity="0.55" />

      {/* Placas/puertos de la mandibula. */}
      <g stroke={accent} strokeOpacity="0.7" strokeWidth="1.5">
        <line x1="68" y1="104" x2="92" y2="104" />
        <line x1="72" y1="110" x2="88" y2="110" />
      </g>
      {/* Antena lateral. */}
      <line x1="112" y1="44" x2="126" y2="32" stroke={accent} strokeWidth="2" />
      <circle cx="126" cy="32" r="3" fill={accent} filter={`url(#glow-${seed})`} />
    </svg>
  );
}

// Pantalla del equipo: aparece cuando la camara se da la vuelta completa (sobre el proyecto).
function AboutTeam({ onClose, dimmed = false, onSelect }: AboutTeamProps) {
  const { t } = useTranslation();
  // Sonido de aparicion holografica al montar (las tarjetas ya salen tras el viaje de camara),
  // igual que el resto de modales/paneles del sistema.
  useHologramSound(0);

  return (
    <div
      className={`animate-fade-in fixed inset-0 z-40 flex flex-col items-center justify-start overflow-y-auto px-4 pb-8 pt-16 transition-opacity duration-700 sm:px-10 sm:pt-8 ${
        dimmed ? "pointer-events-none invisible opacity-0" : "opacity-100"
      }`}
    >
      {/* Volver: arriba del todo, a la derecha de la pantalla. */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 border border-neon-cyan/40 bg-bg/60 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan backdrop-blur-sm transition hover:bg-neon-cyan/10 sm:right-8 sm:top-6"
      >
        ← <span className="sm:hidden">{t("common.backShort")}</span>
        <span className="hidden sm:inline">{t("common.back")}</span>
      </button>

      {/* Cabecera del equipo, centrada. */}
      <div className="mb-7 w-full max-w-6xl text-center">
        <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-magenta">
          // {t("about.eyebrow")}
        </p>
        <h1 className="font-display mt-2 text-[clamp(1.875rem,6vw,3rem)] font-black leading-none text-text-main [text-shadow:0_0_28px_rgba(255,43,214,0.55),0_0_56px_rgba(36,245,255,0.24)]">
          {t("about.title")}
        </h1>
        <p className="mt-3 text-base text-text-muted">{t("about.subtitle")}</p>
      </div>

      {/* Tarjetas del equipo en la mitad superior. */}
      <div className="grid w-full max-w-6xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
        {TEAM.map((member, index) => (
          <div
            key={member.name}
            onClick={() => onSelect?.(index)}
            className="panel-neon animate-crt-on [transform-origin:center] relative flex cursor-pointer flex-col items-center bg-surface/85 p-5 text-center backdrop-blur-sm transition-transform hover:-translate-y-1"
            style={
              {
                "--accent": member.accent,
                animationDelay: `${index * 0.12}s`,
                opacity: 0
              } as CSSProperties
            }
          >
            {/* Esquinas marcadas (componente reutilizable). */}
            <CornerBrackets color={member.accent} corners={["tl", "br"]} />

            {/* Foto de perfil cibernetica: real si existe, si no avatar procedural. */}
            <div
              className="relative mb-4 w-full overflow-hidden border"
              style={{ borderColor: `${member.accent}66` }}
            >
              {member.photo ? (
                <>
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="aspect-square w-full object-cover"
                  />
                  {/* Tinte de acento + scanlines para integrarla con los avatares neon. */}
                  <span
                    className="pointer-events-none absolute inset-0 mix-blend-overlay"
                    style={{ backgroundColor: `${member.accent}33` }}
                  />
                  <span
                    className="pointer-events-none absolute inset-0 opacity-30"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(0deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 1px, transparent 2px, transparent 4px)"
                    }}
                  />
                </>
              ) : (
                <CyberAvatar accent={member.accent} name={member.name} />
              )}
            </div>

            <p
              className="font-display text-sm font-black uppercase leading-tight tracking-wider text-text-main"
              style={{ textShadow: `0 0 14px ${member.accent}99` }}
            >
              {member.name}
            </p>
            <p
              className="mt-1 font-display text-[0.65rem] font-bold uppercase tracking-[0.15em]"
              style={{ color: member.accent }}
            >
              {member.role}
            </p>

            {/* Boton de LinkedIn con el acento de la unidad (relleno al pasar el raton). */}
            {member.linkedin && (
              <a
                href={member.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="btn-accent mt-4 inline-flex w-full items-center justify-center gap-2 px-3 py-2 font-display text-[0.65rem] font-black uppercase tracking-[0.18em]"
                style={{ "--accent": member.accent } as CSSProperties}
              >
                {/* Icono LinkedIn. */}
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                </svg>
                LinkedIn
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Historia del proyecto: panel entre las tarjetas y el coche (mitad central). */}
      <div
        className="panel-neon mt-8 w-full max-w-3xl bg-surface/85 p-6 text-center backdrop-blur-sm"
        style={{ "--accent": "#24f5ff" } as CSSProperties}
      >
        <p className="font-display text-sm font-bold uppercase tracking-[0.25em] text-neon-cyan [text-shadow:0_0_14px_rgb(36_245_255_/_0.5)]">
          {t("about.storyTitle")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{t("about.story")}</p>
      </div>
    </div>
  );
}

export default AboutTeam;
