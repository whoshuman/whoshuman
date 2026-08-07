// Datos que el HUD de puntería muestra en vivo. Viven FUERA de React y de Zustand a
// propósito: se escriben en cada fotograma desde el bucle de render, y pasarlos por
// estado provocaría un re-render a 60 Hz. El overlay los lee en su propio
// requestAnimationFrame y los escribe directamente en el DOM.
export interface AimTelemetry {
  /** Distancia en unidades de mundo hasta el punto que marca la retícula. */
  distance: number;
  /** Altura de vuelo de la nave, en unidades de mundo. */
  altitude: number;
  /** Rumbo de la cámara en radianes; 0 = +Z. */
  heading: number;
  /** Hay alguien bajo la retícula. No dice si es humano o NPC: no existe ese dato. */
  locked: boolean;
  /** El haz llega hasta un corte real (suelo o edificio) y no se pierde en el vacío. */
  grounded: boolean;
}

export const aimTelemetry: AimTelemetry = {
  distance: 0,
  altitude: 0,
  heading: 0,
  locked: false,
  grounded: false
};

// Los personajes miden ~0.33 de alto y representan una persona de ~1.70 m, así que
// una unidad de mundo son ~5.15 m. Sirve para que el HUD hable en metros.
export const WORLD_UNITS_TO_METERS = 5.15;

/** Radio alrededor del rayo dentro del cual se considera que alguien está encarado. */
export const AIM_LOCK_RADIUS = 0.12;
