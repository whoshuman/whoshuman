import { useEffect } from "react";

import { playSfx } from "./sfx";

// Reproduce el sonido de aparicion holografica cuando el componente se monta, sincronizado
// con el arranque de su animacion. delayMs permite cuadrarlo con animaciones escalonadas
// (p. ej. los paneles del lobby, que entran con retardos distintos).
export function useHologramSound(delayMs = 0) {
  useEffect(() => {
    if (delayMs <= 0) {
      playSfx("hologram");
      return;
    }
    const timer = setTimeout(() => playSfx("hologram"), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
}
