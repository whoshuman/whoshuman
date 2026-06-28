import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import skyHome3d from "../assets/sky-home-3d.png";
import HomeScene from "../features/home-3d/HomeScene";
import SettingsMenu from "../shared/SettingsMenu";
import Login from "./Login";
import Register from "./Register";
import Lobby from "./Lobby";
import ProfileEdit from "./ProfileEdit";
import AboutTeam from "./AboutTeam";
import { useMusic } from "../shared/musicStore";

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
  // Edicion de perfil: la camara gira a la derecha y se abre el panel sobre el lobby.
  const [profileOpen, setProfileOpen] = useState(false);
  // Sobre el proyecto: la camara se da la vuelta completa y muestra al equipo.
  const [aboutOpen, setAboutOpen] = useState(false);
  // Tras completarse el giro, la camara baja a vista cenital sobre el coche.
  const [carFocus, setCarFocus] = useState(false);
  const startMusic = useMusic((state) => state.start);

  // Secuencia de "sobre el proyecto": primero el giro de 180, luego el picado al coche.
  // El reset de carFocus se hace al cerrar (closeAbout/closeView), no en el effect.
  useEffect(() => {
    if (!aboutOpen) return;
    const timer = setTimeout(() => setCarFocus(true), 1700);
    return () => clearTimeout(timer);
  }, [aboutOpen]);

  function closeAbout() {
    setAboutOpen(false);
    setCarFocus(false);
  }

  function closeView() {
    setView("home");
    setIsZoomed(false);
    setProfileOpen(false);
    closeAbout();
  }

  function handlePlay() {
    if (isZoomed) return;
    // El clic es un gesto de usuario valido para arrancar el audio (autoplay permitido).
    startMusic();
    // Zoom de camara hacia la ciudad y, al terminar, abre la zona de despliegue.
    setIsZoomed(true);
    setTimeout(() => setView("lobby"), ZOOM_TO_LOBBY_MS);
  }

  // La interfaz de la landing se desvanece cuando hay zoom, vuelta al equipo o vista abierta.
  const dimmed = isZoomed || aboutOpen || view !== "home";
  // invisible (visibility:hidden) ademas de opacity-0 porque la animacion de entrada
  // (animate-hud-in, fill forwards) fija opacity:1 y anularia solo el opacity-0.
  const overlayFade = dimmed ? "pointer-events-none invisible opacity-0" : "opacity-100";

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

      <HomeScene
        isZoomed={isZoomed}
        lookRight={profileOpen}
        lookBack={aboutOpen}
        carFocus={carFocus}
      />

      {/* Esquina superior derecha: rueda de ajustes (idioma + herramientas dev). */}
      <div
        className={`animate-hud-in absolute right-8 top-8 z-20 transition duration-700 ${overlayFade}`}
      >
        <SettingsMenu align="right" />
      </div>

      {/* Centro: logo + accesos. El bloque no captura clics; solo los botones. */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex -translate-y-16 flex-col items-center justify-center px-8 text-center transition duration-700 ${
          dimmed ? "scale-110 opacity-0" : "opacity-100"
        }`}
      >
        <p className="font-display mb-6 inline-block border border-neon-cyan/25 bg-bg/55 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.45em] text-neon-cyan backdrop-blur-sm [text-shadow:0_0_12px_rgb(36_245_255_/_0.5)]">
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

        {/* Accesos bajo el titulo: identificarse, registrar unidad o desplegar como invitado. */}
        <div className="pointer-events-auto mt-12 flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setView("login")}
              data-sfx="silent"
              className="border-2 border-neon-magenta bg-neon-magenta/15 px-9 py-3.5 font-display text-sm font-black uppercase tracking-widest text-text-main shadow-[0_0_18px_rgb(255_43_214_/_0.35)] transition hover:bg-neon-magenta/25 hover:shadow-[0_0_30px_rgb(255_43_214_/_0.55)]"
            >
              {t("home.login")}
            </button>
            <button
              type="button"
              onClick={() => setView("register")}
              data-sfx="silent"
              className="border border-neon-cyan/60 bg-bg/40 px-9 py-3.5 font-display text-sm font-bold uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan/15 hover:shadow-[0_0_24px_rgb(36_245_255_/_0.4)]"
            >
              {t("home.register")}
            </button>
          </div>
          {/* Despliegue sin identificar (invitado). */}
          <button
            type="button"
            onClick={handlePlay}
            data-sfx="access"
            className="group font-display text-xs font-bold uppercase tracking-[0.3em] text-text-muted/70 transition hover:text-neon-cyan"
          >
            {t("home.playGuest")} <span className="text-neon-cyan">→</span>
          </button>
        </div>
      </div>

      {/* Esquina inferior izquierda: info y soporte en pequeño. */}
      <nav
        className={`absolute bottom-9 left-8 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 transition duration-700 ${overlayFade}`}
      >
        {footerLinks.map((link, index) => (
          <span key={link.key} className="flex items-center gap-4">
            {index > 0 && <span className="text-neon-cyan/25">/</span>}
            {link.key === "about" ? (
              // "Sobre el proyecto" no navega: gira la camara 180 y muestra al equipo.
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="font-display text-[0.7rem] font-bold uppercase tracking-[0.25em] text-text-muted/60 transition hover:text-neon-cyan hover:[text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]"
              >
                {t(`home.menu.${link.key}`)}
              </button>
            ) : (
              <Link
                to={link.to}
                className="font-display text-[0.7rem] font-bold uppercase tracking-[0.25em] text-text-muted/60 transition hover:text-neon-cyan hover:[text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]"
              >
                {t(`home.menu.${link.key}`)}
              </Link>
            )}
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
      {/* Zona de despliegue: se oculta cuando se abre la edicion de perfil. */}
      {view === "lobby" && !profileOpen && (
        <div className="animate-fade-in fixed inset-0 z-30 bg-bg/30">
          <Lobby embedded onClose={closeView} onEditProfile={() => setProfileOpen(true)} />
        </div>
      )}

      {/* Edicion de perfil: pantalla diegetica montada en un edificio (camara apunta a la derecha). */}
      {view === "lobby" && profileOpen && <ProfileEdit onClose={() => setProfileOpen(false)} />}

      {/* Sobre el proyecto: la camara se da la vuelta y aparece la ficha del equipo.
          En el picado cenital sobre el coche, las fichas se atenuan. */}
      {view === "home" && aboutOpen && <AboutTeam onClose={closeAbout} dimmed={carFocus} />}
      {/* Boton de volver siempre disponible durante el picado al coche (las fichas estan atenuadas). */}
      {view === "home" && aboutOpen && carFocus && (
        <button
          type="button"
          onClick={closeAbout}
          className="fixed right-10 top-8 z-50 border border-neon-cyan/40 bg-bg/60 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-cyan backdrop-blur-sm transition hover:bg-neon-cyan/10"
        >
          ← {t("common.back")}
        </button>
      )}
    </main>
  );
}

export default Home;
