import { useState } from "react";
import { useProgress } from "@react-three/drei";
import { useEffect } from "react";

// Espera maxima antes de mostrar la app igual: si algo se atasca (red caida, un GLB que
// no responde) no queremos dejar al usuario mirando esta pantalla para siempre.
const MAX_WAIT_MS = 6000;

// Minimo antes de poder quitarla: si todo carga casi al instante, un parpadeo de negro
// se ve peor que un segundo de pantalla de carga.
const MIN_WAIT_MS = 1000;

/**
 * Bloquea el primer pintado hasta que fuentes, escena 3D (si la ruta la usa) y sesion
 * esten listas, para que la pantalla no aparezca "por fases" al recargar.
 *
 * El resultado se ENCLAVA: una vez listo, listo para siempre. Sin eso podia volver a
 * false y esconder la app ya arrancada, porque sus dos entradas van y vienen —
 * `waitForScene` cambia al navegar a una ruta con fondo 3D, y el `active`/`progress`
 * de drei se reactivan con cada lote nuevo de assets. Camino real: entrar por /login
 * (sin fondo), verlo listo al segundo, y al pasar a / antes del tope de 6 s se
 * desvanecia la interfaz entera hasta que cargaba la escena.
 */
export function useBootReady(waitForScene: boolean, authReady: boolean) {
  const { active, progress } = useProgress();
  const [everActive, setEverActive] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [forced, setForced] = useState(false);
  const [minWaited, setMinWaited] = useState(false);
  const [latched, setLatched] = useState(false);

  useEffect(() => {
    // document.fonts no existe en todos los entornos (navegadores viejos, jsdom en los
    // tests). Sin el guard, esto revienta dentro del efecto y las fuentes no se darian
    // nunca por listas: la pantalla de carga se quedaria puesta hasta el tope de 6s.
    const fuentes = (document as Partial<Document>).fonts;
    if (!fuentes) {
      setFontsReady(true);
      return;
    }
    fuentes.ready.then(() => setFontsReady(true)).catch(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setForced(true), MAX_WAIT_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setMinWaited(true), MIN_WAIT_MS);
    return () => window.clearTimeout(id);
  }, []);

  // Ajuste de estado durante el render (patron soportado por React), no en un efecto:
  // en un efecto seria un render en cascada, y ademas llegaria un fotograma tarde.
  if (active && !everActive) setEverActive(true);

  const sceneReady = !waitForScene || (everActive && !active) || progress >= 100;
  const ready = forced || (minWaited && authReady && fontsReady && sceneReady);
  if (ready && !latched) setLatched(true);
  return latched || ready;
}
