// Sonidos de UI globales, optimizados para gastar los minimos recursos:
// - Cada mp3 se descarga y DECODIFICA una sola vez en un AudioBuffer compartido.
// - Cada disparo crea un BufferSource efimero (barato, se recolecta solo), asi se pueden
//   solapar sonidos rapidos sin recargar ni clonar audio.
// - Un UNICO listener en document (delegacion) cubre toda la pantalla.
// - Por defecto suena "click"; un elemento con data-sfx="<nombre>" usa ese sonido en su lugar
//   (p. ej. el boton JUGAR usa "access").

const SOUNDS: Record<string, string> = {
  click: "/sounds/futuristic-ui-click-davies-aguirre-2-2-00-01.mp3",
  access: "/sounds/digital-ui-access-granted-alert-vadi-sound-2-2-00-01.mp3",
  hologram: "/sounds/latent-rick-hologram-menu-appear-ui-546562.mp3"
};

let context: AudioContext | null = null;
let gain: GainNode | null = null;
const buffers: Record<string, AudioBuffer> = {};
let installed = false;

// Crea (una vez) el contexto de audio y decodifica todos los sonidos en sus buffers.
function ensureAudio() {
  if (context) return;
  context = new AudioContext();
  gain = context.createGain();
  gain.gain.value = 0.4;
  gain.connect(context.destination);

  for (const [name, url] of Object.entries(SOUNDS)) {
    void fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => context!.decodeAudioData(data))
      .then((decoded) => {
        buffers[name] = decoded;
      })
      .catch(() => {});
  }
}

// Reproduce un sonido por nombre. Si aun no esta decodificado, no suena (los primeros ms).
function playSound(name: string) {
  if (!context || !gain) return;
  const buffer = buffers[name];
  if (!buffer) return;
  // El contexto nace suspendido; el propio gesto del click lo reanuda.
  if (context.state === "suspended") void context.resume();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start(0);
}

// Reproduce un sonido de UI por nombre desde fuera (p. ej. al abrirse un modal holografico).
// Garantiza que el audio este inicializado aunque no haya saltado aun el listener de clicks.
export function playUiSound(name: string) {
  ensureAudio();
  playSound(name);
}

// Instala (una sola vez) el listener global de sonidos de UI.
export function installGlobalClickSound() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  // Pre-decodifica ya (el contexto nace suspendido hasta el primer gesto, pero decodificar
  // no lo necesita) para que hasta el primer click suene.
  ensureAudio();

  document.addEventListener(
    "pointerdown",
    (event) => {
      // Solo boton primario y sobre elementos interactivos (no en el fondo 3D vacio).
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      const interactive = target?.closest(
        "button, a, [role='button'], input, select, label, summary"
      );
      if (!interactive) return;

      ensureAudio();
      // Un ancestro con data-sfx define un sonido propio (p. ej. JUGAR); si no, "click".
      const custom = target?.closest<HTMLElement>("[data-sfx]");
      playSound(custom?.dataset.sfx ?? "click");
    },
    // Captura: garantiza el sonido aunque el handler del elemento detenga la propagacion.
    { capture: true }
  );
}
