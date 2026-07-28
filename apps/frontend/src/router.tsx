import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import AppLayout from "./layout/AppLayout";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import SystemStatus from "./pages/SystemStatus";
import Manual from "./pages/Manual";
import About from "./pages/About";
import Faq from "./pages/Faq";
import Support from "./pages/Support";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import DesignSystem from "./pages/DesignSystem";
import NotFound from "./pages/NotFound";

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
