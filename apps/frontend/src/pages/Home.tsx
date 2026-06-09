import { useState } from "react";
import type { CSSProperties } from "react";

import skyHome3d from "../assets/sky-home-3d.png";
import HomeScene from "../features/home-3d/HomeScene";

// Opciones visibles tras el zoom a la ciudad. De momento son botones visuales sin navegacion real.
const homeOptions = [
  { label: "Jugar", position: "left-1/2 top-[15%] -translate-x-1/2", tone: "cyan" },
  { label: "Perfil", position: "left-[15%] top-[30%]", tone: "magenta" },
  { label: "Manual", position: "right-[15%] top-[30%]", tone: "magenta" },
  { label: "Logout", position: "left-[23%] top-[62%]", tone: "cyan" },
  { label: "Sobre el proyecto", position: "right-[19%] top-[62%]", tone: "cyan" }
];

const titleWhoStyle: CSSProperties = {
  textShadow: "0 0 18px rgb(255 43 214 / 0.68), 0 0 44px rgb(36 245 255 / 0.38)"
};

const titleHumanStyle: CSSProperties = {
  textShadow: "0 0 18px rgb(36 245 255 / 0.72), 0 0 46px rgb(36 245 255 / 0.45)"
};

const claimStyle: CSSProperties = {
  textShadow: "0 0 14px rgb(36 245 255 / 0.5)"
};

const loginButtonStyle: CSSProperties = {
  boxShadow: "0 0 22px rgb(255 43 214 / 0.42)"
};

const optionButtonShadow = {
  cyan: "0 0 24px rgb(36 245 255 / 0.42)",
  magenta: "0 0 24px rgb(255 43 214 / 0.42)"
} as const;

function Home() {
  // Simula el paso de landing publica a menu principal hasta conectar auth/navegacion real.
  const [isZoomed, setIsZoomed] = useState(false);

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
          isZoomed ? "pointer-events-none translate-y-16 opacity-0" : "translate-y-10 opacity-100"
        }`}
      >
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
          - Engaña · Observa · Sobrevive -
        </p>

        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          className="mt-10 border-2 border-neon-magenta bg-bg/65 px-16 py-4 font-display text-2xl font-bold uppercase text-text-main transition hover:bg-neon-magenta/20"
          style={loginButtonStyle}
        >
          Jugar
        </button>
      </section>

      {/* Menu provisional tras el zoom. Se cambiara cuando definamos rutas/acciones finales. */}
      <section
        className={`absolute inset-0 z-20 transition duration-700 ${
          isZoomed ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {homeOptions.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={option.label === "Logout" ? () => setIsZoomed(false) : undefined}
            className={`absolute ${option.position} min-w-56 border-2 bg-bg/70 px-8 py-3 font-display text-xl font-bold uppercase text-text-main backdrop-blur-sm transition ${
              option.tone === "cyan"
                ? "border-neon-cyan hover:bg-neon-cyan/20"
                : "border-neon-magenta hover:bg-neon-magenta/20"
            }`}
            style={{
              boxShadow:
                option.tone === "cyan" ? optionButtonShadow.cyan : optionButtonShadow.magenta
            }}
          >
            {option.label}
          </button>
        ))}
      </section>
    </main>
  );
}

export default Home;
