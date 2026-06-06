import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import AppLayout from "./layout/AppLayout";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Lobby from "./pages/Lobby";
import Game from "./pages/Game";
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
  designSystemRoute
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFound
});
