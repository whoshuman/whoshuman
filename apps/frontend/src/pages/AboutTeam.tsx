import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
  backLabel?: string;
  withHeader?: boolean;
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

// Ficha de un miembro del equipo. Unica para rejilla (escritorio/tablet) y carrusel (movil):
// el contenido es el mismo, solo cambia el contenedor que la envuelve.
function TeamCard({
  member,
  index,
  onSelect
}: {
  member: Member;
  index: number;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className="panel-neon animate-crt-on [transform-origin:center] relative flex h-full cursor-pointer flex-col items-center bg-surface/85 p-5 text-center backdrop-blur-sm transition-transform hover:-translate-y-1"
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
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
          </svg>
          LinkedIn
        </a>
      )}
    </div>
  );
}

// Pantalla del equipo: aparece cuando la camara se da la vuelta completa (sobre el proyecto).
function AboutTeam({
  onClose,
  backLabel,
  withHeader = false,
  dimmed = false,
  onSelect
}: AboutTeamProps) {
  const { t } = useTranslation();
  // Sonido de aparicion holografica al montar (las tarjetas ya salen tras el viaje de camara),
  // igual que el resto de modales/paneles del sistema.
  useHologramSound(0);
  const teamSectionRef = useRef<HTMLElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // Referencia siempre al onSelect mas reciente: evita reenganchar el listener de scroll
  // cada vez que el padre pasa una funcion nueva (no siempre memoizada).
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  function scrollToTeam() {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    teamSectionRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start"
    });
  }

  // Carrusel movil: cada ficha lleva un --focus (0 a 1) segun su cercania al centro del
  // carrusel, para que la que esta enfocada "en camara" resalte al recorrerlo con scroll.
  useEffect(() => {
    const container = carouselRef.current;
    if (!container) return;

    let frame = 0;
    // El primer calculo (al montar) solo fija el foco visual de la primera ficha: no mueve
    // el coche, que debe arrancar centrado en la carretera. Solo a partir de que el usuario
    // interactua de verdad (flechas, puntos o swipe) el coche empieza a seguir la seleccion.
    let isInitialCalc = true;

    function recalcFocus() {
      const containerRect = container!.getBoundingClientRect();
      // Ancho 0: el carrusel esta oculto (tablet/escritorio usan la rejilla). No hay nada
      // que enfocar ni carril de coche que mover.
      if (containerRect.width === 0) return;
      const containerCenter = containerRect.left + containerRect.width / 2;
      let closestIndex = 0;
      let closestDistance = Infinity;

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const cardCenter = rect.left + rect.width / 2;
        const distance = Math.abs(cardCenter - containerCenter);
        const focus = 1 - Math.min(distance / (containerRect.width * 0.55), 1);
        card.style.setProperty("--focus", String(focus));
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      setActiveIndex(closestIndex);
      if (isInitialCalc) {
        isInitialCalc = false;
      } else {
        // El coche seguira a la ficha enfocada (carril bajo esa tarjeta), con retardo propio
        // aplicado en la escena 3D (HomeDeLorean interpola su x cada frame).
        onSelectRef.current?.(closestIndex);
      }
    }

    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recalcFocus);
    }

    frame = requestAnimationFrame(recalcFocus);
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  function scrollToMember(index: number) {
    const clamped = Math.max(0, Math.min(index, TEAM.length - 1));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cardRefs.current[clamped]?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center"
    });
  }

  return (
    <div
      className={`animate-fade-in fixed inset-0 z-40 flex flex-col items-center justify-start overflow-y-auto px-4 pb-8 transition-opacity duration-700 sm:px-10 ${
        withHeader ? "pt-32 sm:pt-24" : "pt-16 sm:pt-8"
      } ${dimmed ? "pointer-events-none invisible opacity-0" : "opacity-100"}`}
    >
      {/* Volver: flotante, fijo en la pantalla — acompaña al usuario durante el scroll en vez
          de desplazarse con el contenido (el contenedor padre ya es un scroll interno). */}
      <button
        type="button"
        onClick={onClose}
        className={`fixed right-4 z-10 border border-neon-cyan/40 bg-bg/60 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan backdrop-blur-sm transition hover:bg-neon-cyan/10 sm:right-8 ${
          withHeader ? "top-20" : "top-4 sm:top-6"
        }`}
      >
        ← <span className="sm:hidden">{t("common.backShort")}</span>
        <span className="hidden sm:inline">{backLabel ?? t("common.back")}</span>
      </button>

      {/* Origen del proyecto: primera pantalla. Mismo panel-neon + esquinas que el resto de
          fichas del sistema (en vez del panel flotante sin borde de antes, que sin fondo propio
          no garantizaba contraste contra la escena 3D). Ocupa la mayor parte del viewport para
          dar paso al gesto de scroll. */}
      <section className="flex min-h-[60dvh] w-full max-w-3xl flex-col items-center justify-center px-2 text-center sm:min-h-[68dvh]">
        <div
          className="panel-neon relative flex flex-col items-center bg-surface/90 px-5 py-8 backdrop-blur-md sm:px-10 sm:py-10"
          style={{ "--accent": "#24f5ff" } as CSSProperties}
        >
          <CornerBrackets color="#24f5ff" corners={["tl", "br"]} />
          <h1 className="font-display text-[clamp(2.25rem,7.5vw,4.25rem)] font-black leading-[1.05] text-text-main [text-shadow:0_0_28px_rgba(36,245,255,0.5),0_0_56px_rgba(255,43,214,0.22)]">
            {t("about.storyTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-text-muted sm:mt-6 sm:text-lg sm:leading-relaxed">
            {t("about.story")}
          </p>
        </div>

        {/* Sugerencia de scroll: lleva a la seccion del equipo. */}
        <button
          type="button"
          onClick={scrollToTeam}
          className="group mt-10 flex flex-col items-center gap-2 text-text-muted/70 transition hover:text-neon-cyan sm:mt-14"
        >
          <span className="font-display text-[0.65rem] font-bold uppercase tracking-[0.3em] [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">
            {t("about.scrollHint")}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-5 w-5 animate-bounce text-neon-cyan [filter:drop-shadow(0_0_6px_rgba(36,245,255,0.7))]"
          />
        </button>
      </section>

      {/* Equipo: segunda pantalla. A partir de tablet, rejilla de siempre. En movil, un
          carrusel horizontal con scroll-snap: la ficha centrada queda "enfocada" (escala,
          opacidad y desenfoque via --focus) como si una camara panease de unidad en unidad. */}
      <section ref={teamSectionRef} className="w-full max-w-6xl scroll-mt-4 pb-4 sm:scroll-mt-8">
        <div className="mb-5 text-center sm:mb-7">
          <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-neon-magenta">
            // {t("about.eyebrow")}
          </p>
          <h2 className="font-display mt-2 text-[clamp(1.875rem,6vw,3rem)] font-black leading-none text-text-main [text-shadow:0_0_28px_rgba(255,43,214,0.55),0_0_56px_rgba(36,245,255,0.24)]">
            {t("about.title")}
          </h2>
          <p className="mt-3 text-base text-text-muted">{t("about.subtitle")}</p>
        </div>

        {/* Tablet / escritorio: rejilla, sin cambios. */}
        <div className="hidden w-full grid-cols-3 gap-5 sm:grid lg:grid-cols-5">
          {TEAM.map((member, index) => (
            <TeamCard
              key={member.name}
              member={member}
              index={index}
              onSelect={() => onSelect?.(index)}
            />
          ))}
        </div>

        {/* Movil: carrusel de tarjeta en tarjeta. */}
        <div className="sm:hidden">
          <div
            ref={carouselRef}
            role="region"
            aria-roledescription="carousel"
            aria-label={t("about.title")}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-[11%] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TEAM.map((member, index) => (
              <div
                key={member.name}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} / ${TEAM.length}`}
                className="team-carousel-card w-[78%] shrink-0 snap-center"
              >
                <TeamCard member={member} index={index} onSelect={() => onSelect?.(index)} />
              </div>
            ))}
          </div>

          {/* Anuncio para lectores de pantalla del miembro enfocado (el carrusel no tiene
              foco de teclado propio: la navegacion accesible va por los botones de abajo). */}
          <p className="sr-only" aria-live="polite">
            {t("about.memberCounter", {
              current: activeIndex + 1,
              total: TEAM.length,
              name: TEAM[activeIndex].name
            })}
          </p>

          {/* Controles: anterior / puntos de posicion / siguiente. */}
          <div className="mt-4 flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => scrollToMember(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label={t("about.prevMember")}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-neon-cyan/30 text-neon-cyan transition hover:border-neon-cyan hover:bg-neon-cyan/10 disabled:pointer-events-none disabled:opacity-20"
            >
              <ChevronLeft aria-hidden="true" className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              {TEAM.map((member, index) => (
                <button
                  key={member.name}
                  type="button"
                  onClick={() => scrollToMember(index)}
                  aria-label={member.name}
                  aria-current={index === activeIndex}
                  className="h-2 w-2 shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor:
                      index === activeIndex
                        ? member.accent
                        : "color-mix(in srgb, var(--color-text-muted) 40%, transparent)",
                    boxShadow: index === activeIndex ? `0 0 8px ${member.accent}` : "none",
                    transform: index === activeIndex ? "scale(1.5)" : "scale(1)"
                  }}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollToMember(activeIndex + 1)}
              disabled={activeIndex === TEAM.length - 1}
              aria-label={t("about.nextMember")}
              className="flex h-9 w-9 shrink-0 items-center justify-center border border-neon-cyan/30 text-neon-cyan transition hover:border-neon-cyan hover:bg-neon-cyan/10 disabled:pointer-events-none disabled:opacity-20"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AboutTeam;
