import { useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import skyHome3d from "../assets/sky-home-3d.png";
import HomeScene from "../features/home-3d/HomeScene";

// Opciones del menu tras el zoom a la ciudad. `key` apunta a la traduccion home.menu.<key>.
// Solo "play" tiene ruta destino; el resto son pantallas stub.
const homeOptions = [
  { key: "play", position: "left-1/2 top-[14%] -translate-x-1/2", tone: "magenta" },
  { key: "profile", position: "left-[14%] top-[32%]", tone: "cyan" },
  { key: "manual", position: "right-[14%] top-[32%]", tone: "cyan" },
  { key: "logout", position: "left-[22%] top-[64%]", tone: "cyan" },
  { key: "about", position: "right-[18%] top-[64%]", tone: "cyan" }
] as const;

// El logo combina el encendido de neon (una vez) con una respiracion del glow en bucle.
const titleWhoStyle: CSSProperties = {
  textShadow: "0 0 18px rgb(255 43 214 / 0.6), 0 0 44px rgb(36 245 255 / 0.32)",
  animation: "flicker-in 1.8s ease-out, neon-breathe-magenta 4s ease-in-out 1.8s infinite"
};

const titleHumanStyle: CSSProperties = {
  textShadow: "0 0 18px rgb(36 245 255 / 0.65), 0 0 46px rgb(36 245 255 / 0.4)",
  animation: "flicker-in 1.8s ease-out 0.25s both, neon-breathe-cyan 4s ease-in-out 2.05s infinite"
};

const claimStyle: CSSProperties = {
  textShadow: "0 0 14px rgb(36 245 255 / 0.5)"
};

const optionButtonShadow = {
  cyan: "0 0 24px rgb(36 245 255 / 0.42)",
  magenta: "0 0 24px rgb(255 43 214 / 0.42)"
} as const;

function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Simula el paso de landing publica a menu principal hasta conectar auth/navegacion real.
  const [isZoomed, setIsZoomed] = useState(false);

  // Accion de cada opcion del menu. Lo que no tiene ruta todavia se queda sin handler.
  function handleOption(key: (typeof homeOptions)[number]["key"]) {
    if (key === "play") void navigate({ to: "/lobby" });
    if (key === "profile") void navigate({ to: "/profile" });
    if (key === "manual") void navigate({ to: "/manual" });
    if (key === "about") void navigate({ to: "/about" });
    if (key === "logout") setIsZoomed(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg">
      {/* Cielo 2D: se separa del canvas para evitar cargar una textura 3D innecesaria. */}
      <img
        src={skyHome3d}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-top opacity-80"
      />
      {/* Oscurece el cielo y ayuda a integrar el fondo con el grid y la ciudad. */}
      <div className="absolute inset-0 bg-linear-to-b from-bg/20 via-bg/35 to-bg/80" />

      <HomeScene isZoomed={isZoomed} />

      {/* Landing inicial con titulo, claim y acceso al juego. */}
      <section
        className={`relative z-10 flex min-h-screen flex-col items-center justify-center px-8 pb-20 pt-16 text-center transition duration-700 ${
          isZoomed ? "pointer-events-none translate-y-16 opacity-0" : "translate-y-6 opacity-100"
        }`}
      >
        {/* Etiqueta de sistema sobre el logo. */}
        <p className="font-display mb-6 text-xs font-bold uppercase tracking-[0.45em] text-neon-cyan/70 [text-shadow:0_0_12px_rgb(36_245_255_/_0.5)]">
          // SISTEMA CAZADOR — V.42
        </p>

        <h1 className="flex flex-col items-center font-display text-[7.6rem] font-black uppercase leading-[0.82]">
          <span className="text-text-main" style={titleWhoStyle}>
            Who&apos;s
          </span>
          <span className="text-text-main" style={titleHumanStyle}>
            Human
          </span>
        </h1>

        <p
          className="mt-10 font-display text-2xl font-semibold uppercase tracking-[0.36em] text-text-main"
          style={claimStyle}
        >
          - {t("home.claim")} -
        </p>

        {/* Boton principal estilo terminal: panel con esquinas y eyebrow. */}
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="group relative mt-12 border-2 border-neon-magenta bg-bg/60 px-20 py-5 transition hover:bg-neon-magenta/15 hover:shadow-[0_0_40px_rgb(255_43_214_/_0.5)] active:translate-y-px"
          style={{ boxShadow: "0 0 22px rgb(255 43 214 / 0.42)" }}
        >
          <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-neon-cyan" />
          <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-neon-cyan" />
          <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-neon-cyan" />
          <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-neon-cyan" />
          <span className="font-display block text-[0.6rem] font-bold uppercase tracking-[0.4em] text-neon-cyan/70">
            // INICIAR SECUENCIA
          </span>
          <span className="font-display block text-3xl font-black uppercase tracking-widest text-text-main transition group-hover:[text-shadow:0_0_18px_rgb(255_43_214_/_0.8)]">
            {t("home.play")} →
          </span>
        </button>
      </section>

      {/* Menu principal tras el zoom: cada opcion es un panel terminal. */}
      <section
        className={`absolute inset-0 z-20 transition duration-700 ${
          isZoomed ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {homeOptions.map((option, index) => (
          <button
            key={option.key}
            type="button"
            onClick={() => handleOption(option.key)}
            style={{
              boxShadow:
                option.tone === "cyan" ? optionButtonShadow.cyan : optionButtonShadow.magenta,
              animationDelay: `${index * 0.08}s`
            }}
            className={`group absolute ${option.position} ${
              isZoomed ? "animate-crt-on" : ""
            } min-w-60 border-2 bg-bg/75 px-8 py-4 text-left backdrop-blur-sm transition hover:-translate-y-0.5 ${
              option.tone === "cyan"
                ? "border-neon-cyan hover:bg-neon-cyan/15 hover:shadow-[0_0_32px_rgb(36_245_255_/_0.5)]"
                : "border-neon-magenta hover:bg-neon-magenta/15 hover:shadow-[0_0_32px_rgb(255_43_214_/_0.55)]"
            }`}
          >
            {/* Esquinas decorativas en color complementario al borde. */}
            <span
              className={`absolute left-0 top-0 h-2.5 w-2.5 border-l-2 border-t-2 ${
                option.tone === "cyan" ? "border-neon-magenta" : "border-neon-cyan"
              }`}
            />
            <span
              className={`absolute bottom-0 right-0 h-2.5 w-2.5 border-b-2 border-r-2 ${
                option.tone === "cyan" ? "border-neon-magenta" : "border-neon-cyan"
              }`}
            />
            <span
              className={`font-display block text-[0.55rem] font-bold uppercase tracking-[0.35em] ${
                option.tone === "cyan" ? "text-neon-cyan/60" : "text-neon-magenta/70"
              }`}
            >
              // {String(index + 1).padStart(2, "0")}
            </span>
            <span className="font-display block text-xl font-black uppercase tracking-wider text-text-main">
              {t(`home.menu.${option.key}`)}
            </span>
          </button>
        ))}
      </section>
    </main>
  );
}

export default Home;
