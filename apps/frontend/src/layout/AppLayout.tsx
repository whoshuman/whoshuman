import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import LanguageSelector from "../shared/LanguageSelector";
import SceneBackground from "../features/home-3d/SceneBackground";

// Rutas que muestran el fondo 3D unificado. La home tiene su propia escena (con zoom)
// y el juego tendra su escena de mapa, asi que ninguna de las dos lo usa.
const ROUTES_WITH_BACKGROUND = new Set([
  "/login",
  "/register",
  "/lobby",
  "/profile",
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
  "relative border px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition";
const navChipInactive =
  "border-transparent text-text-muted/70 hover:border-neon-cyan/30 hover:text-neon-cyan";
const navChipActive =
  "border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan [text-shadow:0_0_10px_rgb(36_245_255_/_0.6)]";

function AppLayout() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // El 404 (defaultNotFoundComponent) no es una ruta del arbol: se detecta por descarte.
  const isNotFound = !KNOWN_ROUTES.has(pathname);
  const showBackground = ROUTES_WITH_BACKGROUND.has(pathname) || isNotFound;
  // El juego y la home son pantallas inmersivas con su propio HUD de esquinas,
  // asi que la barra superior no se monta en ellas.
  const showHud = pathname !== "/game" && pathname !== "/";

  return (
    <div>
      {showBackground && <SceneBackground />}

      <div className="relative z-10 flex min-h-screen flex-col">
        {showHud && (
          <header className="animate-hud-in sticky top-0 z-50 flex h-16 items-center justify-between gap-4 overflow-hidden border-b border-neon-cyan/30 bg-bg/75 px-6 backdrop-blur-md">
            {/* Linea de escaneo tipo radar que cruza la barra. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px">
              <div
                className="h-full w-1/4 bg-gradient-to-r from-transparent via-neon-cyan to-transparent"
                style={{ animation: "hud-scan 7s linear infinite" }}
              />
            </div>

            {/* Logo / marca a la izquierda. */}
            <Link to="/" className="group flex items-center gap-2">
              <span className="text-lg leading-none text-neon-magenta [text-shadow:0_0_12px_rgb(255_43_214_/_0.7)]">
                ◢
              </span>
              <span className="font-display text-sm font-black uppercase tracking-[0.22em] text-text-main transition group-hover:[text-shadow:0_0_14px_rgb(36_245_255_/_0.6)]">
                WHO<span className="text-neon-cyan">/</span>HUMAN
              </span>
            </Link>

            {/* Navegacion central estilo HUD. */}
            <nav className="flex items-center gap-1">
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

            {/* Idioma + acceso de desarrollo. */}
            <div className="flex items-center gap-3">
              <LanguageSelector />
              <span className="h-5 w-px bg-neon-cyan/20" />
              <Link
                to="/design-system"
                className="border border-neon-violet/50 bg-neon-violet/10 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-violet transition hover:bg-neon-violet/20"
                activeProps={{
                  className:
                    "border border-neon-violet bg-neon-violet/25 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-neon-violet"
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
            <p className="font-display text-[0.65rem] font-bold uppercase tracking-[0.3em] text-text-muted/50">
              {t("footer.system")}
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}

export default AppLayout;
