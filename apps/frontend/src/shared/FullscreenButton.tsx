import { useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { useTranslation } from "react-i18next";

// Safari (y iPadOS) solo exponen la API de pantalla completa con prefijo webkit. Se declaran
// aparte porque no estan en los tipos del DOM.
type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function fullscreenElement() {
  const doc = document as WebkitDocument;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

// Hay navegadores que no necesitan el boton (o donde no funcionaria): en iPhone la API no
// existe para elementos normales, y sin soporte el boton solo seria un adorno muerto. Por
// eso el componente no se pinta si el navegador no puede entrar en pantalla completa.
function isFullscreenAvailable() {
  if (typeof document === "undefined") return false;
  const doc = document as WebkitDocument;
  return Boolean(document.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

// Alterna la pantalla completa del documento entero (no de un elemento suelto), que es lo que
// interesa aqui: el juego ocupa toda la ventana, incluido el canvas 3D y el HUD.
function FullscreenButton() {
  const { t } = useTranslation();
  const [available] = useState(isFullscreenAvailable);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(fullscreenElement()));

  // El estado tiene que seguir al navegador, no solo a nuestros clics: se puede salir con
  // Escape o con F11 y el icono quedaria mintiendo. Ambos prefijos, por Safari.
  useEffect(() => {
    if (!available) return;
    const sync = () => setIsFullscreen(Boolean(fullscreenElement()));

    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, [available]);

  if (!available) return null;

  // Si la peticion falla (el navegador puede rechazarla si no viene de un gesto) no se toca
  // el estado: lo pondra al dia el evento fullscreenchange si de verdad ha cambiado algo.
  async function toggle() {
    const doc = document as WebkitDocument;
    try {
      if (fullscreenElement()) {
        await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
        return;
      }
      const root = document.documentElement as WebkitElement;
      await (root.requestFullscreen?.() ?? root.webkitRequestFullscreen?.());
    } catch {
      // Sin pantalla completa se sigue jugando en ventana: no hay nada que avisar.
    }
  }

  const label = isFullscreen ? t("common.exitFullscreen") : t("common.enterFullscreen");

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      title={label}
      aria-label={label}
      aria-pressed={isFullscreen}
      className="flex h-10 w-10 items-center justify-center border border-neon-cyan/60 bg-bg/60 text-neon-cyan backdrop-blur-sm transition hover:border-neon-cyan hover:bg-neon-cyan/18 hover:shadow-[0_0_16px_rgba(36,245,255,0.3)]"
    >
      {isFullscreen ? (
        <Minimize aria-hidden="true" size={19} strokeWidth={1.8} />
      ) : (
        <Maximize aria-hidden="true" size={19} strokeWidth={1.8} />
      )}
    </button>
  );
}

export default FullscreenButton;
