import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, UsersRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { connectSocket, disconnectSocket } from "../game/network/socket";
import { useGameStore } from "../game/store/gameStore";
import { useLobbyStore } from "../game/store/lobbyStore";
import { useAuthStore } from "../shared/authStore";
import { useChatDialogStore } from "../shared/chatStore";
import ConfirmDialog from "../shared/ConfirmDialog";
import DirectChatDialog from "../shared/DirectChatDialog";
import { initNotifications } from "../shared/notifications";
import NotificationCenter from "../shared/NotificationCenter";
import NotificationToasts from "../shared/NotificationToasts";
import { initPresence } from "../shared/presence";
import { usePresenceStore } from "../shared/presenceStore";
import SettingsMenu from "../shared/SettingsMenu";
import { AUTH_UNAUTHORIZED_EVENT } from "../shared/api/httpClient";
import BootOverlay from "../shared/BootOverlay";
import { useBootReady } from "../shared/useBootReady";

// El fondo 3D va en un chunk aparte: arrastra three.js, el postprocesado y los GLB de la
// plaza. AppLayout envuelve TODAS las rutas, asi que importarlo aqui de forma estatica metia
// el motor 3D (y el preload de los modelos) en el bundle inicial hasta en /privacy o /terms,
// que ni siquiera pintan fondo. Con lazy() solo se descarga en las rutas que lo muestran.
// Escena 3D unica de la app: se monta aqui, fuera del Outlet, para que NO se desmonte al
// cambiar de ruta. Antes la home y el resto de pantallas tenian cada una su canvas y el
// cambio destruia el contexto WebGL: de ahi el parpadeo negro al entrar al lobby.
const WorldScene = lazy(() => import("../features/home-3d/WorldScene"));

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
// Pantallas sin barra superior: el juego y la home son inmersivas y llevan su propio HUD de
// esquinas; el lobby tiene sus accesos pegados a la ficha de jugador; y el perfil es una
// pantalla diegetica (montada en la fachada de un edificio) que ya trae su propio boton de
// volver al lobby, igual que contactos.
const HUDLESS_ROUTES = new Set(["/", "/game", "/lobby", "/profile", "/friends"]);

const PUBLIC_NAV_LINKS = [
  { to: "/", key: "home", exact: true },
  { to: "/login", key: "login", exact: false },
  { to: "/register", key: "register", exact: false }
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

  useEffect(() => {
    if (pathname === "/game") useChatDialogStore.setState({ peers: [] });
  }, [pathname]);

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
  const isHome = pathname === "/";
  // La home tambien usa la escena: es la misma, solo cambia la pose de camara.
  const showBackground = ROUTES_WITH_BACKGROUND.has(pathname) || isNotFound || isHome;
  const showHud = !HUDLESS_ROUTES.has(pathname);
  const showFooter = showHud && pathname !== "/about" && pathname !== "/manual";
  const bootReady = useBootReady(showBackground, authRestored);

  async function handleLogout() {
    setLogoutOpen(false);
    await signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <div>
      <BootOverlay ready={bootReady} />
      {showBackground && (
        <Suspense fallback={null}>
          <WorldScene />
        </Suspense>
      )}
      <NotificationToasts />
      {isAuthenticated && <DirectChatDialog />}

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

      {/* Mientras carga no basta con opacity-0: el contenido seguiria montado y
          navegable con el tabulador y por un lector de pantalla, o sea que se podria
          usar a ciegas por debajo de la pantalla de carga. visibility lo saca tambien
          del orden de foco (el fundido sigue funcionando: visibility salta a visible y
          la opacidad es la que se anima). */}
      <div
        aria-hidden={!bootReady}
        style={{ visibility: bootReady ? "visible" : "hidden" }}
        className={`relative z-10 flex min-h-screen flex-col transition-opacity duration-700 ${
          bootReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {showHud && (
          <header className="animate-hud-in sticky top-0 z-50 flex h-16 items-center justify-between gap-2 border-b border-neon-cyan/30 bg-bg/40 px-3 backdrop-blur-md sm:gap-4 sm:px-6">
            {/* Linea de escaneo tipo radar que cruza la barra. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px">
              <div
                className="h-full w-1/4 bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
                style={{ animation: "hud-scan 7s linear infinite" }}
              />
            </div>

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
