import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import ConfirmDialog from "../shared/ConfirmDialog";
import FullscreenButton from "../shared/FullscreenButton";
import { useSceneIntent } from "../features/home-3d/sceneIntentStore";
import SettingsMenu from "../shared/SettingsMenu";
import NotificationCenter from "../shared/NotificationCenter";
import ManualPanel from "../shared/ManualPanel";
import { useMusic } from "../shared/musicStore";
import { useAuthStore } from "../shared/authStore";

// Overlays: solo se montan tras un click del usuario, asi que no tienen por que viajar en el
// bundle inicial. Lobby ademas arrastra medio lobby y sus paneles.
const Login = lazy(() => import("./Login"));
const Register = lazy(() => import("./Register"));
const Lobby = lazy(() => import("./Lobby"));
const ProfileEdit = lazy(() => import("./ProfileEdit"));
const AboutTeam = lazy(() => import("./AboutTeam"));

// Vistas que se montan como overlay sobre la home sin cambiar de ruta.
type HomeView = "home" | "login" | "register" | "lobby";

// Duracion del viaje de camara hacia la ciudad antes de entrar al lobby.
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

// Carriles "ideales" del coche bajo cada tarjeta del equipo (alineados a la rejilla de la
// carretera). El del medio (indice 2) coincide con el reposo por defecto del coche (x=0).
// HomeDeLorean recorta estos valores al ancho realmente visible por la camara en cada
// dispositivo, asi que aqui no hace falta encogerlos a mano para que quepan en movil.
const TEAM_LANE_X = [-24, -12, 0, 12, 24];

// Enlaces secundarios de la esquina inferior izquierda (info / soporte).
const footerLinks = [
  { to: "/about", key: "about" },
  { to: "/manual", key: "manual" },
  { to: "/faq", key: "faq" },
  { to: "/support", key: "support" },
  { to: "/privacy", key: "privacy" },
  { to: "/terms", key: "terms" }
] as const;

// Estilo comun de los enlaces del pie.
const FOOTER_LINK_CLASS =
  "font-display text-[0.7rem] font-bold uppercase tracking-[0.25em] text-text-muted/60 transition hover:text-neon-cyan hover:[text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]";

function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setIntent = useSceneIntent((state) => state.setIntent);
  const resetIntent = useSceneIntent((state) => state.resetIntent);
  // La home actua de shell: las vistas de acceso y despliegue se abren aqui mismo.
  const [view, setView] = useState<HomeView>("home");
  const [isZoomed, setIsZoomed] = useState(false);
  // Edicion de perfil: la camara gira a la derecha y se abre el panel sobre el lobby.
  const [profileOpen, setProfileOpen] = useState(false);
  // Sobre el proyecto: la camara se da la vuelta completa y muestra al equipo.
  const [aboutOpen, setAboutOpen] = useState(false);
  // Modal-broma del boton "Manual".
  const [manualOpen, setManualOpen] = useState(false);
  // Cerrar sesión pide confirmación: es fácil pulsarlo sin querer.
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Tras completarse el giro, la camara baja a vista cenital sobre el coche.
  const [carFocus, setCarFocus] = useState(false);
  // Las tarjetas del equipo solo aparecen cuando la camara ya llego (no durante el movimiento).
  const [teamReady, setTeamReady] = useState(false);
  // Carril del coche: se desliza bajo la tarjeta del equipo seleccionada.
  const [carX, setCarX] = useState(0);
  const startMusic = useMusic((state) => state.start);
  const stopMusic = useMusic((state) => state.stop);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signOut = useAuthStore((s) => s.signOut);
  // Viaje de camara en curso hacia el lobby: hay que poder cancelarlo si la home se
  // desmonta antes de que termine (p. ej. el usuario navega a otra pagina).
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // En la home nunca suena la musica: si se vuelve desde el lobby, se apaga con un
  // fade-out hasta el silencio y queda rebobinada para la proxima entrada.
  useEffect(() => {
    stopMusic();
  }, [stopMusic]);

  useEffect(() => {
    return () => {
      if (enterTimer.current) clearTimeout(enterTimer.current);
    };
  }, []);

  // Secuencia de "sobre el proyecto": giro de 180 -> picado al coche (1700ms) -> tarjetas
  // (2900ms, cuando la camara ya se asento). Los reset se hacen al cerrar, no en el effect.
  useEffect(() => {
    if (!aboutOpen) return;
    const focusTimer = setTimeout(() => setCarFocus(true), 1700);
    const cardsTimer = setTimeout(() => setTeamReady(true), 2900);
    return () => {
      clearTimeout(focusTimer);
      clearTimeout(cardsTimer);
    };
  }, [aboutOpen]);

  // El coche se desliza (con retardo propio, ver HomeDeLorean) al carril bajo la tarjeta
  // del equipo seleccionada o enfocada en el carrusel movil.
  function handleTeamSelect(index: number) {
    setCarX(TEAM_LANE_X[index] ?? 0);
  }

  function closeAbout() {
    setAboutOpen(false);
    setCarFocus(false);
    setTeamReady(false);
    setCarX(0);
  }

  function closeView() {
    setView("home");
    setIsZoomed(false);
    setProfileOpen(false);
    // Al volver a la home la musica se apaga con un fade-out.
    stopMusic();
    closeAbout();
  }

  // Entrada al lobby: la camara se lanza hacia la ciudad con la musica ya sonando y, al
  // terminar el viaje, se cambia de pantalla. Se usa al pulsar JUGAR y al completarse el
  // acceso o el registro (ambos ocurren en overlays sobre esta misma escena).
  function enterLobby() {
    if (isZoomed) return;
    // Se llega aqui siempre desde un clic, gesto valido para que el navegador permita el
    // autoplay del audio.
    startMusic();
    setIsZoomed(true);
    enterTimer.current = setTimeout(() => {
      void navigate({ to: "/lobby" });
    }, ZOOM_TO_LOBBY_MS);
  }

  // Tras identificarse o registrarse, se cierra el overlay para que se vea el viaje de
  // camara antes de entrar.
  function handleAuthSuccess() {
    setView("home");
    enterLobby();
  }

  // La camara es de WorldScene (vive en AppLayout): la home solo publica que quiere que
  // haga. Al desmontarse, la escena vuelve a reposo.
  useEffect(() => {
    setIntent({
      isZoomed,
      lookRight: profileOpen,
      lookBack: aboutOpen,
      carFocus,
      carX,
      showRoad: aboutOpen
    });
  }, [aboutOpen, carFocus, carX, isZoomed, profileOpen, setIntent]);

  useEffect(() => resetIntent, [resetIntent]);

  // La interfaz de la landing se desvanece cuando hay zoom, vuelta al equipo o vista abierta.
  const dimmed = isZoomed || aboutOpen || view !== "home";
  // invisible (visibility:hidden) ademas de opacity-0 porque la animacion de entrada
  // (animate-hud-in, fill forwards) fija opacity:1 y anularia solo el opacity-0.
  const overlayFade = dimmed ? "pointer-events-none invisible opacity-0" : "opacity-100";

  return (
    // Sin fondo propio (antes tenia bg-bg y el cielo dentro): de eso se encarga WorldScene
    // desde AppLayout, que sobrevive al cambio de ruta. Aqui cualquier fondo la taparia.
    <main className="relative h-screen overflow-hidden">
      {/* Esquina superior derecha: pantalla completa, avisos y ajustes de cuenta. */}
      <div
        className={`animate-hud-in absolute right-4 top-4 z-20 flex items-start gap-3 transition duration-700 sm:right-8 sm:top-8 ${overlayFade}`}
      >
        <FullscreenButton />
        {isAuthenticated && <NotificationCenter />}
        <SettingsMenu align="right" />
      </div>

      {/* Centro: logo + accesos. El bloque no captura clics; solo los botones. */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex -translate-y-10 flex-col items-center justify-center px-6 text-center transition duration-700 sm:-translate-y-16 sm:px-8 ${
          dimmed ? "scale-110 opacity-0" : "opacity-100"
        }`}
      >
        <p className="font-display mb-4 inline-block border border-neon-cyan/25 bg-bg/55 px-3 py-1.5 text-[0.6rem] font-bold uppercase tracking-[0.3em] text-neon-cyan backdrop-blur-sm [text-shadow:0_0_12px_rgb(36_245_255_/_0.5)] sm:mb-6 sm:px-4 sm:text-xs sm:tracking-[0.45em]">
          // SISTEMA CAZADOR — V.42
        </p>

        <h1 className="flex flex-col items-center font-display text-[clamp(3.25rem,14vw,7.6rem)] font-black uppercase leading-[0.82]">
          <span className="text-text-main" style={titleWhoStyle}>
            Who&apos;s
          </span>
          <span className="text-text-main" style={titleHumanStyle}>
            Human
          </span>
        </h1>

        {/* Accesos bajo el titulo: identificarse, registrar unidad o desplegar como invitado. */}
        <div className="pointer-events-auto mt-8 flex flex-col items-center gap-4 sm:mt-12">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            {isAuthenticated ? (
              // Con sesion iniciada la home ya no es el acceso: el paso natural es jugar.
              <>
                <button
                  type="button"
                  onClick={enterLobby}
                  data-sfx="access"
                  className="border-2 border-neon-magenta bg-neon-magenta/15 px-7 py-3 font-display text-sm font-black uppercase tracking-widest text-text-main shadow-[0_0_18px_rgb(255_43_214_/_0.35)] transition hover:bg-neon-magenta/25 hover:shadow-[0_0_30px_rgb(255_43_214_/_0.55)] sm:px-9 sm:py-3.5"
                >
                  {t("home.play")}
                </button>
                <button
                  type="button"
                  onClick={() => setLogoutOpen(true)}
                  data-sfx="silent"
                  className="border border-neon-cyan/60 bg-bg/40 px-7 py-3 font-display text-sm font-bold uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan/15 hover:shadow-[0_0_24px_rgb(36_245_255_/_0.4)] sm:px-9 sm:py-3.5"
                >
                  {t("home.menu.logout")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setView("login")}
                  data-sfx="silent"
                  className="border-2 border-neon-magenta bg-neon-magenta/15 px-7 py-3 font-display text-sm font-black uppercase tracking-widest text-text-main shadow-[0_0_18px_rgb(255_43_214_/_0.35)] transition hover:bg-neon-magenta/25 hover:shadow-[0_0_30px_rgb(255_43_214_/_0.55)] sm:px-9 sm:py-3.5"
                >
                  {t("home.login")}
                </button>
                <button
                  type="button"
                  onClick={() => setView("register")}
                  data-sfx="silent"
                  className="border border-neon-cyan/60 bg-bg/40 px-7 py-3 font-display text-sm font-bold uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan/15 hover:shadow-[0_0_24px_rgb(36_245_255_/_0.4)] sm:px-9 sm:py-3.5"
                >
                  {t("home.register")}
                </button>
              </>
            )}
          </div>
          {/* Funcionalidad futura: despliegue sin identificar como invitado. */}
          {/*
          <button
            type="button"
            onClick={handlePlay}
            data-sfx="access"
            className="group font-display text-xs font-bold uppercase tracking-[0.3em] text-text-muted/70 transition hover:text-neon-cyan"
          >
            {t("home.playGuest")} <span className="text-neon-cyan">→</span>
          </button>
          */}
        </div>
      </div>

      {/* Esquina inferior izquierda: info y soporte en pequeño. */}
      <nav
        className={`absolute bottom-5 left-4 right-4 z-10 flex flex-wrap items-center gap-x-4 gap-y-1 transition duration-700 sm:bottom-9 sm:left-8 sm:right-auto ${overlayFade}`}
      >
        {footerLinks.map((link, index) => (
          <span key={link.key} className="flex items-center gap-4">
            {index > 0 && <span className="text-neon-cyan/25">/</span>}
            {link.key === "about" ? (
              // "Sobre el proyecto" no navega: gira la camara 180 y muestra al equipo.
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className={FOOTER_LINK_CLASS}
              >
                {t(`home.menu.${link.key}`)}
              </button>
            ) : link.key === "manual" ? (
              // "Manual" no navega: abre un modal-broma.
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className={FOOTER_LINK_CLASS}
              >
                {t(`home.menu.${link.key}`)}
              </button>
            ) : (
              <Link to={link.to} className={FOOTER_LINK_CLASS}>
                {t(`home.menu.${link.key}`)}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Overlays integrados: se abren sobre la home con fundido + despliegue del panel. */}
      <Suspense fallback={null}>
        {view === "login" && (
          <div className="animate-fade-in fixed inset-0 z-30 overflow-y-auto bg-bg/70 backdrop-blur-sm">
            <Login
              embedded
              onClose={closeView}
              onSwitch={() => setView("register")}
              onSuccess={handleAuthSuccess}
            />
          </div>
        )}
        {view === "register" && (
          <div className="animate-fade-in fixed inset-0 z-30 overflow-y-auto bg-bg/70 backdrop-blur-sm">
            <Register
              embedded
              onClose={closeView}
              onSwitch={() => setView("login")}
              onSuccess={handleAuthSuccess}
            />
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

        {/* Sobre el proyecto: la camara se da la vuelta, baja al coche y aparece el equipo
          (las fichas permanecen visibles sobre la vista del coche). */}
        {view === "home" && aboutOpen && teamReady && (
          <AboutTeam onClose={closeAbout} onSelect={handleTeamSelect} />
        )}
      </Suspense>

      {/* Modal-broma del boton Manual. */}
      {manualOpen && <ManualPanel onClose={() => setManualOpen(false)} />}

      {logoutOpen && (
        <ConfirmDialog
          title={t("common.logoutTitle")}
          message={t("common.logoutMessage")}
          confirmLabel={t("profilePage.logout")}
          danger
          onConfirm={() => {
            setLogoutOpen(false);
            void signOut();
          }}
          onCancel={() => setLogoutOpen(false)}
        />
      )}
    </main>
  );
}

export default Home;
