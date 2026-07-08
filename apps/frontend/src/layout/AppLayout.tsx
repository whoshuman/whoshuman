import { useEffect } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import LanguageSelector from "../shared/LanguageSelector";
import SceneBackground from "../features/home-3d/SceneBackground";
import { connectSocket, disconnectSocket } from "../game/network/socket";
import { useLobbyStore } from "../game/store/lobbyStore";
import { useAuthStore } from "../shared/authStore";
import { initNotifications } from "../shared/notifications";
import NotificationToasts from "../shared/NotificationToasts";

// Rutas que muestran el fondo 3D unificado. La home tiene su propia escena (con zoom)
// y el juego tendra su escena de mapa, asi que ninguna de las dos lo usa.
const ROUTES_WITH_BACKGROUND = new Set([
  "/login",
  "/register",
  "/lobby",
  "/profile",
  "/friends",
  "/status",
  "/manual",
  "/about",
  "/faq",
  "/support"
]);
// Rutas reconocidas por el router. Si la ruta actual no esta aqui, es un 404.
const KNOWN_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/lobby",
  "/game",
  "/profile",
  "/friends",
  "/status",
  "/manual",
  "/about",
  "/faq",
  "/support",
  "/design-system"
]);

// Enlaces del HUD superior. `exact` evita que "/" quede activo en todas las rutas.
const NAV_LINKS = [
  { to: "/", key: "home", exact: true },
  { to: "/login", key: "login", exact: false },
  { to: "/register", key: "register", exact: false },
  { to: "/lobby", key: "lobby", exact: false },
  { to: "/game", key: "game", exact: false }
] as const;

const navChipBase =
  "relative shrink-0 border px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition";
const navChipInactive =
  "border-transparent text-text-muted/70 hover:border-neon-cyan/30 hover:text-neon-cyan";
const navChipActive =
  "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan [text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]";

function AppLayout() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const restore = useAuthStore((s) => s.restore);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    void restore();
  }, [restore]);

  // El socket vive ligado a la sesión, no al lobby: el room personal user:<id>
  // (donde llegan las notificaciones) se une al conectar. Logout → desconexión.
  useEffect(() => {
    if (isAuthenticated) {
      connectSocket();
      initNotifications();
    } else {
      disconnectSocket();
      useLobbyStore.getState().reset();
    }
  }, [isAuthenticated]);

  // El 404 (defaultNotFoundComponent) no es una ruta del arbol: se detecta por descarte.
  const isNotFound = !KNOWN_ROUTES.has(pathname);
  const showBackground = ROUTES_WITH_BACKGROUND.has(pathname) || isNotFound;
  // El juego y la home son pantallas inmersivas con su propio HUD de esquinas,
  // asi que la barra superior no se monta en ellas.
  const showHud = pathname !== "/game" && pathname !== "/";

  return (
    <div>
      {showBackground && <SceneBackground />}
      <NotificationToasts />

      <div className="relative z-10 flex min-h-screen flex-col">
        {showHud && (
          <header className="animate-hud-in sticky top-0 z-50 flex h-16 items-center justify-between gap-2 overflow-hidden border-b border-neon-cyan/30 bg-bg/75 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
            {/* Linea de escaneo tipo radar que cruza la barra. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px">
              <div
                className="h-full w-1/4 bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
                style={{ animation: "hud-scan 7s linear infinite" }}
              />
            </div>

            {/* Logo / marca a la izquierda. El texto se oculta en movil para dejar sitio. */}
            <Link to="/" className="group flex shrink-0 items-center gap-2">
              <span className="text-lg leading-none text-neon-magenta [text-shadow:0_0_12px_rgb(255_43_214_/_0.7)]">
                ◢
              </span>
              <span className="font-display hidden text-sm font-black uppercase tracking-[0.22em] text-text-main transition group-hover:[text-shadow:0_0_14px_rgb(36_245_255_/_0.6)] sm:inline">
                WHO<span className="text-neon-cyan">/</span>HUMAN
              </span>
            </Link>

            {/* Navegacion central estilo HUD. Scroll horizontal si no caben en movil. */}
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.key}
                  to={link.to}
                  activeOptions={{ exact: link.exact }}
                  className={`${navChipBase} ${navChipInactive}`}
                  activeProps={{ className: `${navChipBase} ${navChipActive}` }}
                >
                  {t(`nav.${link.key}`)}
                </Link>
              ))}
            </nav>

            {/* Idioma + acceso de desarrollo (el enlace dev se oculta en movil por espacio). */}
            <div className="flex shrink-0 items-center gap-3">
              <LanguageSelector />
              <span className="hidden h-5 w-px bg-neon-cyan/20 sm:block" />
              <Link
                to="/design-system"
                className="hidden border border-neon-violet/50 bg-neon-violet/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-violet transition hover:bg-neon-violet/20 sm:block"
                activeProps={{
                  className:
                    "hidden border border-neon-violet bg-neon-violet/25 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-violet sm:block"
                }}
              >
                <span className="mr-1 opacity-60">[DEV]</span>
                {t("nav.designSystem")}
              </Link>
            </div>
          </header>
        )}

        <div className="flex-1">
          <Outlet />
        </div>

        {showHud && (
          <footer className="border-t border-neon-cyan/15 bg-bg/60 px-6 py-3 text-center backdrop-blur-sm">
            <Link
              to="/status"
              className="font-display text-[0.65rem] font-bold uppercase tracking-[0.3em] text-text-muted/50 transition hover:text-neon-cyan"
            >
              {t("footer.system")}
            </Link>
          </footer>
        )}
      </div>
    </div>
  );
}

export default AppLayout;
