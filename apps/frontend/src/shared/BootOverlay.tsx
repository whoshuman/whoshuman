import { useEffect, useState } from "react";
import { useProgress } from "@react-three/drei";
import { useTranslation } from "react-i18next";

// Espera maxima antes de mostrar la app igual: si algo se atasca (red caida, un GLB que
// no responde) no queremos dejar al usuario mirando esta pantalla para siempre.
const MAX_WAIT_MS = 6000;

// Bloquea el primer pintado hasta que fuentes, escena 3D (si la ruta la usa) y sesion
// esten listas, para que la pantalla no aparezca "por fases" al recargar.
export function useBootReady(waitForScene: boolean, authReady: boolean) {
  const { active, progress } = useProgress();
  const [everActive, setEverActive] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (active) setEverActive(true);
  }, [active]);

  useEffect(() => {
    document.fonts.ready.then(() => setFontsReady(true)).catch(() => setFontsReady(true));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setForced(true), MAX_WAIT_MS);
    return () => window.clearTimeout(id);
  }, []);

  const sceneReady = !waitForScene || (everActive && !active) || progress >= 100;
  return forced || (authReady && fontsReady && sceneReady);
}

function BootOverlay({ ready }: { ready: boolean }) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setMounted(false), 700);
    return () => window.clearTimeout(id);
  }, [ready]);

  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-100 flex items-center justify-center bg-bg transition-opacity duration-700 ease-out ${
        ready ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="animate-crt-on text-center">
        <p className="font-display text-2xl font-extrabold tracking-[0.3em] text-neon-cyan [text-shadow:0_0_16px_rgb(36_245_255_/_0.6)] sm:text-3xl">
          ¿WHO&apos;S HUMAN?
        </p>
        <p className="mt-3 font-display text-xs font-bold uppercase tracking-[0.3em] text-text-muted/70">
          {t("boot.loading")}
        </p>
      </div>
    </div>
  );
}

export default BootOverlay;
