import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent
} from "@tanstack/react-router";

import AppLayout from "./layout/AppLayout";

// Home y el 404 entran en el bundle inicial: son el primer render de la app.
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// El resto viaja en chunks propios (lazyRouteComponent hace el import() al navegar). Lo que
// mas pesa es /game, que arrastra la escena de juego entera: sin esto, quien abre /privacy
// se descarga el motor 3D y el mapa igual que quien va a jugar.
// Login y Register tambien: la home los abre como overlay con su propio import diferido, y
// tenerlos aqui de forma estatica anulaba ese split (el bundler los devolvia al chunk comun).
const Login = lazyRouteComponent(() => import("./pages/Login"));
const Register = lazyRouteComponent(() => import("./pages/Register"));
const OAuthCallback = lazyRouteComponent(() => import("./pages/OAuthCallback"));
const Lobby = lazyRouteComponent(() => import("./pages/Lobby"));
const Game = lazyRouteComponent(() => import("./pages/Game"));
const Profile = lazyRouteComponent(() => import("./pages/Profile"));
const Friends = lazyRouteComponent(() => import("./pages/Friends"));
const SystemStatus = lazyRouteComponent(() => import("./pages/SystemStatus"));
const Manual = lazyRouteComponent(() => import("./pages/Manual"));
const About = lazyRouteComponent(() => import("./pages/About"));
const Faq = lazyRouteComponent(() => import("./pages/Faq"));
const Support = lazyRouteComponent(() => import("./pages/Support"));
const Privacy = lazyRouteComponent(() => import("./pages/Privacy"));
const Terms = lazyRouteComponent(() => import("./pages/Terms"));
const DesignSystem = lazyRouteComponent(() => import("./pages/DesignSystem"));

const rootRoute = createRootRoute({
  component: AppLayout
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: Login
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/register",
  component: Register
});

const oauthCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/oauth/callback",
  component: OAuthCallback
});

const lobbyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lobby",
  component: Lobby
});

const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/game",
  component: Game
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profile",
  component: Profile
});

const friendsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/friends",
  component: Friends
});

const statusRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/status",
  component: SystemStatus
});

const manualRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/manual",
  component: Manual
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  component: About
});

const faqRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/faq",
  component: Faq
});

const supportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/support",
  component: Support
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: Privacy
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: Terms
});

const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-system",
  component: DesignSystem
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  oauthCallbackRoute,
  lobbyRoute,
  gameRoute,
  profileRoute,
  friendsRoute,
  statusRoute,
  manualRoute,
  aboutRoute,
  faqRoute,
  supportRoute,
  privacyRoute,
  termsRoute,
  designSystemRoute
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound
});
