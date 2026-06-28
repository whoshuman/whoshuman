// Sonido de click global, optimizado para gastar los minimos recursos:
// - El mp3 se descarga y DECODIFICA una sola vez en un AudioBuffer compartido.
// - Cada click crea un BufferSource efimero (barato, se recolecta solo) sobre ese buffer,
//   asi se pueden solapar clicks rapidos sin recargar ni clonar audio.
// - Un UNICO listener en document (delegacion) cubre toda la pantalla.

const CLICK_SRC = "/sounds/futuristic-ui-click-davies-aguirre-2-2-00-01.mp3";

let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let gain: GainNode | null = null;
let decoding = false;
let installed = false;

// Crea (una vez) el contexto de audio y arranca la decodificacion del buffer.
function ensureAudio() {
  if (!context) {
    context = new AudioContext();
    gain = context.createGain();
    gain.gain.value = 0.35;
    gain.connect(context.destination);
  }
  if (!buffer && !decoding) {
    decoding = true;
    void fetch(CLICK_SRC)
      .then((response) => response.arrayBuffer())
      .then((data) => context!.decodeAudioData(data))
      .then((decoded) => {
        buffer = decoded;
      })
      .catch(() => {
        decoding = false;
      });
  }
}

// Reproduce el click. Hasta que el buffer no este decodificado, no suena (los primeros ms).
function playClick() {
  if (!context || !buffer || !gain) return;
  // Los navegadores arrancan el contexto suspendido; el propio gesto del click lo reanuda.
  if (context.state === "suspended") void context.resume();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(gain);
  source.start(0);
}

// Instala (una sola vez) el listener global de clicks de UI.
export function installGlobalClickSound() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  // Pre-decodifica el buffer ya (el contexto nace suspendido hasta el primer gesto, pero
  // decodificar no lo necesita) para que hasta el primer click suene.
  ensureAudio();

  document.addEventListener(
    "pointerdown",
    (event) => {
      // Solo boton primario y sobre elementos interactivos (no en el fondo 3D vacio).
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      if (!target?.closest("button, a, [role='button'], input, select, label, summary")) return;

      ensureAudio();
      playClick();
    },
    // Captura: garantiza el sonido aunque el handler del elemento detenga la propagacion.
    { capture: true }
  );
}
