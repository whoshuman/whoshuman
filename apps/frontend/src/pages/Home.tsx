import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import skyHome3d from "../assets/sky-home-3d.png";
import HomeScene from "../features/home-3d/HomeScene";
import Login from "./Login";
import Register from "./Register";
import Lobby from "./Lobby";

// Vistas que se montan como overlay sobre la home sin cambiar de ruta.
type HomeView = "home" | "login" | "register" | "lobby";

// Duracion del zoom de camara antes de mostrar la zona de despliegue (lobby).
const ZOOM_TO_LOBBY_MS = 1100;

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

// Enlaces secundarios de la esquina inferior izquierda (info / soporte).
const footerLinks = [
  { to: "/about", key: "about" },
  { to: "/manual", key: "manual" },
  { to: "/faq", key: "faq" },
  { to: "/support", key: "support" }
] as const;

function Home() {
  const { t } = useTranslation();
  // La home actua de shell: las vistas de acceso y despliegue se abren aqui mismo.
  const [view, setView] = useState<HomeView>("home");
  const [isZoomed, setIsZoomed] = useState(false);

  function closeView() {
    setView("home");
    setIsZoomed(false);
  }

  function handlePlay() {
    if (isZoomed) return;
    // Zoom de camara hacia la ciudad y, al terminar, abre la zona de despliegue.
    setIsZoomed(true);
    setTimeout(() => setView("lobby"), ZOOM_TO_LOBBY_MS);
  }

  // La interfaz de la landing se desvanece cuando hay zoom o una vista abierta.
  const dimmed = isZoomed || view !== "home";
  const overlayFade = dimmed ? "pointer-events-none opacity-0" : "opacity-100";

  return (
    <main className="relative h-screen overflow-hidden bg-bg">
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

      {/* Esquina superior izquierda: acceso de unidad. */}
      <div
        className={`animate-hud-in absolute left-8 top-8 z-10 flex flex-col gap-2 transition duration-700 ${overlayFade}`}
      >
        <span className="font-display text-[0.6rem] font-bold uppercase tracking-[0.4em] text-neon-cyan/70">
          // ACCESO
        </span>
        <button
          type="button"
          onClick={() => setView("login")}
          className="border-2 border-neon-magenta bg-neon-magenta/15 px-6 py-2.5 text-left font-display text-sm font-black uppercase tracking-widest text-text-main shadow-[0_0_18px_rgb(255_43_214_/_0.35)] transition hover:bg-neon-magenta/25 hover:shadow-[0_0_30px_rgb(255_43_214_/_0.55)]"
        >
          {t("home.login")}
        </button>
        <button
          type="button"
          onClick={() => setView("register")}
          className="border border-neon-cyan/60 bg-bg/40 px-6 py-2.5 text-left font-display text-sm font-bold uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan/15 hover:shadow-[0_0_24px_rgb(36_245_255_/_0.4)]"
        >
          {t("home.register")}
        </button>
      </div>

      {/* Centro: logo y claim. No captura clics para no tapar el fondo 3D. */}
      <div
        className={`pointer-events-none absolute inset-0 z-0 flex -translate-y-8 flex-col items-center justify-center px-8 text-center transition duration-700 ${
          dimmed ? "scale-110 opacity-0" : "opacity-100"
        }`}
      >
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
          className="mt-8 font-display text-xl font-semibold uppercase tracking-[0.36em] text-text-main"
          style={claimStyle}
        >
          - {t("home.claim")} -
        </p>
      </div>

      {/* Esquina inferior derecha: lanzar partida (zoom + zona de despliegue). */}
      <button
        type="button"
        onClick={handlePlay}
        className={`group animate-hud-in absolute bottom-10 right-10 z-10 block border-2 border-neon-magenta bg-bg/65 px-16 py-5 text-right transition duration-700 hover:bg-neon-magenta/15 hover:shadow-[0_0_44px_rgb(255_43_214_/_0.55)] active:translate-y-px ${overlayFade}`}
        style={{ boxShadow: "0 0 24px rgb(255 43 214 / 0.42)" }}
      >
        <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-neon-cyan" />
        <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-neon-cyan" />
        <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-neon-cyan" />
        <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-neon-cyan" />
        <span className="font-display block text-[0.6rem] font-bold uppercase tracking-[0.4em] text-neon-cyan/70">
          // INICIAR SECUENCIA
        </span>
        <span className="font-display block text-4xl font-black uppercase tracking-widest text-text-main transition group-hover:[text-shadow:0_0_20px_rgb(255_43_214_/_0.85)]">
          {t("home.play")} →
        </span>
      </button>

      {/* Esquina inferior izquierda: info y soporte en pequeño. */}
      <nav
        className={`absolute bottom-9 left-8 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 transition duration-700 ${overlayFade}`}
      >
        {footerLinks.map((link, index) => (
          <span key={link.key} className="flex items-center gap-4">
            {index > 0 && <span className="text-neon-cyan/25">/</span>}
            <Link
              to={link.to}
              className="font-display text-[0.7rem] font-bold uppercase tracking-[0.25em] text-text-muted/60 transition hover:text-neon-cyan hover:[text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]"
            >
              {t(`home.menu.${link.key}`)}
            </Link>
          </span>
        ))}
      </nav>

      {/* Overlays integrados: se abren sobre la home con fundido + despliegue del panel. */}
      {view === "login" && (
        <div className="animate-fade-in fixed inset-0 z-30 bg-bg/70 backdrop-blur-sm">
          <Login embedded onClose={closeView} onSwitch={() => setView("register")} />
        </div>
      )}
      {view === "register" && (
        <div className="animate-fade-in fixed inset-0 z-30 bg-bg/70 backdrop-blur-sm">
          <Register embedded onClose={closeView} onSwitch={() => setView("login")} />
        </div>
      )}
      {view === "lobby" && (
        <div className="animate-fade-in fixed inset-0 z-30 bg-bg/90 backdrop-blur-sm">
          <Lobby embedded onClose={closeView} />
        </div>
      )}
    </main>
  );
}

export default Home;
