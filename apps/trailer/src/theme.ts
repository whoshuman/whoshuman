import { loadFont as loadOrbitron } from "@remotion/google-fonts/Orbitron";
import { loadFont as loadRajdhani } from "@remotion/google-fonts/Rajdhani";

// Las mismas fuentes y colores del juego (apps/frontend/src/index.css).
export const display = loadOrbitron("normal", {
  weights: ["700", "800", "900"],
  subsets: ["latin"]
}).fontFamily;

export const body = loadRajdhani("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"]
}).fontFamily;

export const color = {
  bg: "#050014",
  surface: "#120a2a",
  text: "#fff7ff",
  muted: "#c9b8ff",
  magenta: "#ff2bd6",
  cyan: "#24f5ff",
  violet: "#8b5cf6",
  sun: "#ff9f1c"
};

export type Layout = "feed" | "cinematic";

// Versión 4:5: franjas de texto arriba y abajo y el juego (16:9) en una ventana en medio.
export const FEED = { width: 1080, height: 1350, windowTop: 392, windowHeight: 608 };
export const CINEMATIC = { width: 1920, height: 1080 };
