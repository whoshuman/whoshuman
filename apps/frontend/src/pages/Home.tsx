import { useState } from "react";

import skyHome3d from "../assets/sky-home-3d.png";
import HomeScene from "../features/home-3d/HomeScene";

const homeOptions = [
  { label: "Jugar", position: "left-1/2 top-[15%] -translate-x-1/2", tone: "cyan" },
  { label: "Perfil", position: "left-[15%] top-[30%]", tone: "magenta" },
  { label: "Manual", position: "right-[15%] top-[30%]", tone: "magenta" },
  { label: "Logout", position: "left-[23%] top-[62%]", tone: "cyan" },
  { label: "Sobre el proyecto", position: "right-[19%] top-[62%]", tone: "cyan" }
];

function Home() {
  const [isZoomed, setIsZoomed] = useState(false);

  return (
    <main className="relative min-h-screen overflow-hidden bg-bg">
      <img
        src={skyHome3d}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover object-top opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-bg/35 to-bg/80" />

      <HomeScene isZoomed={isZoomed} />

      <section
        className={`relative z-10 flex min-h-screen flex-col items-center justify-center px-8 pb-20 pt-16 text-center transition duration-700 ${
          isZoomed ? "pointer-events-none translate-y-16 opacity-0" : "translate-y-10 opacity-100"
        }`}
      >
        <h1 className="flex flex-col items-center font-display text-[7.6rem] font-black uppercase leading-[0.82]">
          <span className="text-text-main [text-shadow:0_0_18px_rgb(255_43_214_/_0.68),0_0_44px_rgb(36_245_255_/_0.38)]">
            Who&apos;s
          </span>
          <span className="text-text-main [text-shadow:0_0_18px_rgb(36_245_255_/_0.72),0_0_46px_rgb(36_245_255_/_0.45)]">
            Human
          </span>
        </h1>

        <p className="mt-10 font-display text-2xl font-semibold uppercase tracking-[0.36em] text-text-main [text-shadow:0_0_14px_rgb(36_245_255_/_0.5)]">
          - Engaña · Observa · Sobrevive -
        </p>

        <div className="mt-12 flex items-center gap-8">
          <button
            type="button"
            onClick={() => setIsZoomed(true)}
            className="min-w-64 border-2 border-neon-magenta bg-bg/65 px-10 py-4 font-display text-2xl font-bold uppercase text-text-main shadow-[0_0_22px_rgb(255_43_214_/_0.42)] transition hover:bg-neon-magenta/20 hover:shadow-[0_0_34px_rgb(255_43_214_/_0.72)]"
          >
            Login
          </button>

          <button
            type="button"
            onClick={() => setIsZoomed(true)}
            className="min-w-64 border-2 border-neon-cyan bg-bg/65 px-10 py-4 font-display text-2xl font-bold uppercase text-text-main shadow-[0_0_22px_rgb(36_245_255_/_0.38)] transition hover:bg-neon-cyan/20 hover:shadow-[0_0_34px_rgb(36_245_255_/_0.68)]"
          >
            Registro
          </button>
        </div>
      </section>

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
                ? "border-neon-cyan shadow-[0_0_24px_rgb(36_245_255_/_0.42)] hover:bg-neon-cyan/20"
                : "border-neon-magenta shadow-[0_0_24px_rgb(255_43_214_/_0.42)] hover:bg-neon-magenta/20"
            }`}
          >
            {option.label}
          </button>
        ))}
      </section>
    </main>
  );
}

export default Home;
