import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import SceneBackground from "../features/home-3d/SceneBackground";
import { connectSocket, disconnectSocket } from "../game/network/socket";
import { useGameStore } from "../game/store/gameStore";
import { useLobbyStore } from "../game/store/lobbyStore";
import { useAuthStore } from "../shared/authStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import { initNotifications } from "../shared/notifications";
import NotificationCenter from "../shared/NotificationCenter";
import NotificationToasts from "../shared/NotificationToasts";
import { initPresence } from "../shared/presence";
import { usePresenceStore } from "../shared/presenceStore";
import SettingsMenu from "../shared/SettingsMenu";
import { AUTH_UNAUTHORIZED_EVENT } from "../shared/api/httpClient";

// Rutas que muestran el fondo 3D unificado. La home tiene su propia escena (con zoom)
// y el juego tendra su escena de mapa, asi que ninguna de las dos lo usa.
const ROUTES_WITH_BACKGROUND = new Set([
  "/login",
  "/register",
  "/oauth/callback",
  "/lobby",
  "/profile",
  "/friends",
  "/status",
  "/manual",
  "/about",
  "/faq",
  "/support",
  "/privacy",
  "/terms"
]);
// Rutas reconocidas por el router. Si la ruta actual no esta aqui, es un 404.
const KNOWN_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/oauth/callback",
  "/lobby",
  "/game",
  "/profile",
  "/friends",
  "/status",
  "/manual",
  "/about",
  "/faq",
  "/support",
  "/privacy",
  "/terms",
  "/design-system"
]);
const PROTECTED_ROUTES = new Set(["/lobby", "/game", "/profile", "/friends"]);

const PUBLIC_NAV_LINKS = [
  { to: "/", key: "home", exact: true },
  { to: "/login", key: "login", exact: false },
  { to: "/register", key: "register", exact: false }
] as const;

const LOBBY_FOOTER_LINKS = [
  { to: "/about", key: "about" },
  { to: "/manual", key: "manual" },
  { to: "/faq", key: "faq" },
  { to: "/support", key: "support" },
  { to: "/privacy", key: "privacy" },
  { to: "/terms", key: "terms" }
] as const;

const navChipBase =
  "relative shrink-0 border px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition";
const navChipInactive =
  "border-transparent text-text-muted/70 hover:border-neon-cyan/30 hover:text-neon-cyan";
const navChipActive =
  "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan [text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]";

function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const restore = useAuthStore((s) => s.restore);
  const clearSession = useAuthStore((s) => s.clearSession);
  const signOut = useAuthStore((s) => s.signOut);
  const authRestored = useAuthStore((s) => s.restored);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasAccessToken = Boolean(localStorage.getItem("authToken"));
  const isProtectedRoute = PROTECTED_ROUTES.has(pathname);
  const canRenderRoute = !isProtectedRoute || (isAuthenticated && hasAccessToken);
  const navLinks = !isAuthenticated && authRestored ? PUBLIC_NAV_LINKS : [];
  // Cerrar sesión pide confirmación: es fácil pulsarlo sin querer y pierdes la partida en curso.
  const [logoutOpen, setLogoutOpen] = useState(false);

  useEffect(() => {
    void restore();
  }, [restore]);

  useEffect(() => {
    const handleUnauthorized = () => clearSession();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [clearSession]);

  useEffect(() => {
    if (!authRestored || !isProtectedRoute || (isAuthenticated && hasAccessToken)) return;
    clearSession();
    void navigate({ to: "/", replace: true });
  }, [authRestored, clearSession, hasAccessToken, isAuthenticated, isProtectedRoute, navigate]);

  // El socket vive ligado a la sesión, no al lobby: el room personal user:<id>
  // (donde llegan las notificaciones) se une al conectar. Logout → desconexión.
  useEffect(() => {
    if (!authRestored) return;
    if (isAuthenticated) {
      connectSocket();
      initNotifications();
      initPresence();
    } else {
      disconnectSocket();
      useLobbyStore.getState().reset();
      useGameStore.getState().reset();
      usePresenceStore.getState().reset();
    }
  }, [authRestored, isAuthenticated]);

  // El 404 (defaultNotFoundComponent) no es una ruta del arbol: se detecta por descarte.
  const isNotFound = !KNOWN_ROUTES.has(pathname);
  const showBackground = ROUTES_WITH_BACKGROUND.has(pathname) || isNotFound;
  // El juego y la home son pantallas inmersivas con su propio HUD de esquinas,
  // asi que la barra superior no se monta en ellas.
  const showHud = pathname !== "/game" && pathname !== "/";
  const showFooter = showHud && pathname !== "/about" && pathname !== "/manual";

  async function handleLogout() {
    setLogoutOpen(false);
    await signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <div>
      {showBackground && <SceneBackground />}
      <NotificationToasts />

      {logoutOpen && (
        <ConfirmDialog
          title={t("common.logoutTitle")}
          message={t("common.logoutMessage")}
          confirmLabel={t("profilePage.logout")}
          danger
          onConfirm={() => void handleLogout()}
          onCancel={() => setLogoutOpen(false)}
        />
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        {showHud && (
          <header className="animate-hud-in sticky top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-neon-cyan/30 bg-bg/75 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
            {/* Linea de escaneo tipo radar que cruza la barra. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px">
              <div
                className="h-full w-1/4 bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
                style={{ animation: "hud-scan 7s linear infinite" }}
              />
            </div>

            {/* Logo / marca a la izquierda. El texto se oculta en movil para dejar sitio. */}
            <Link
              to={isAuthenticated ? "/lobby" : "/"}
              className="group flex shrink-0 items-center gap-2"
            >
              <span className="text-lg leading-none text-neon-magenta [text-shadow:0_0_12px_rgb(255_43_214_/_0.7)]">
                ◢
              </span>
              <span className="font-display hidden text-sm font-black uppercase tracking-[0.22em] text-text-main transition group-hover:[text-shadow:0_0_14px_rgb(36_245_255_/_0.6)] sm:inline">
                WHO<span className="text-neon-cyan">/</span>HUMAN
              </span>
            </Link>

            {/* Navegacion central estilo HUD. Scroll horizontal si no caben en movil. */}
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navLinks.map((link) => (
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

            {/* Acciones de cuenta. Ajustes agrupa idioma, audio y acceso de desarrollo. */}
            <div className="flex shrink-0 items-center gap-1.5">
              {isAuthenticated && (
                <>
                  <NotificationCenter />
                  <Link
                    to="/friends"
                    title={t("profilePage.contacts")}
                    aria-label={t("profilePage.contacts")}
                    className="flex h-10 w-10 items-center justify-center border border-neon-violet/50 bg-neon-violet/8 text-neon-violet transition hover:border-neon-violet hover:bg-neon-violet/18 hover:shadow-[0_0_16px_rgba(157,78,221,0.3)]"
                  >
                    <UsersRound aria-hidden="true" size={19} strokeWidth={1.8} />
                  </Link>
                </>
              )}
              <SettingsMenu align="right" />
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setLogoutOpen(true)}
                  title={t("profilePage.logout")}
                  aria-label={t("profilePage.logout")}
                  className="flex h-10 w-10 items-center justify-center border border-sun-orange/50 bg-sun-orange/8 text-sun-orange transition hover:border-sun-orange hover:bg-sun-orange/18 hover:shadow-[0_0_16px_rgba(255,159,28,0.3)]"
                >
                  <LogOut aria-hidden="true" size={19} strokeWidth={1.8} />
                </button>
              )}
            </div>
          </header>
        )}

        <div className="flex-1">{authRestored && canRenderRoute && <Outlet />}</div>

        {showFooter && (
          <footer className="flex flex-col items-center gap-2 border-t border-neon-cyan/15 bg-bg/60 px-6 py-3 text-center backdrop-blur-sm">
            {(pathname === "/lobby" || pathname === "/friends") && (
              <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                {LOBBY_FOOTER_LINKS.map((link, index) => (
                  <span key={link.key} className="flex items-center gap-3">
                    {index > 0 && <span className="text-neon-cyan/25">/</span>}
                    <Link
                      to={link.to}
                      className="font-display text-[0.65rem] font-bold uppercase tracking-[0.2em] text-text-muted/60 transition hover:text-neon-cyan hover:[text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]"
                    >
                      {t(`home.menu.${link.key}`)}
                    </Link>
                  </span>
                ))}
              </nav>
            )}
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
