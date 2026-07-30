// Efectos de sonido globales (UI + partida), optimizados para gastar los minimos recursos:
// - Cada mp3 se descarga y DECODIFICA una sola vez en un AudioBuffer compartido.
// - Cada disparo crea un BufferSource efimero (barato, se recolecta solo), asi se pueden
//   solapar sonidos rapidos sin recargar ni clonar audio.
// - Los sonidos de partida NO se descargan en la home: se piden con preloadGameSfx()
//   al entrar en el juego, para no gastar red en quien solo pasa por el menu.
// - Un UNICO listener en document (delegacion) cubre toda la pantalla.
// - Por defecto suena "click"; un elemento con data-sfx="<nombre>" usa ese sonido en su lugar
//   (p. ej. el boton JUGAR usa "access").

const SOUNDS = {
  click: "/sounds/futuristic-ui-click-davies-aguirre-2-2-00-01.mp3",
  access: "/sounds/digital-ui-access-granted-alert-vadi-sound-2-2-00-01.mp3",
  hologram: "/sounds/latent-rick-hologram-menu-appear-ui-546562.mp3",
  shot: "/sounds/disparo_2.mp3",
  collect: "/sounds/collect_Cell.mp3",
  matchStart: "/sounds/inicio_partida.mp3",
  matchEnd: "/sounds/end_game.mp3"
} as const;

export type SfxName = keyof typeof SOUNDS;

// Sonidos de UI: se decodifican en la primera interaccion, esten donde esten.
const UI_SFX: SfxName[] = ["click", "access", "hologram"];
// Sonidos de partida: solo se decodifican al entrar en una partida.
const GAME_SFX: SfxName[] = ["shot", "collect", "matchStart", "matchEnd"];

// Ganancia relativa por sonido (1 = volumen del bus). Equilibra pistas grabadas a
// distinto nivel sin tener que reeditar los mp3.
const SFX_GAIN: Partial<Record<SfxName, number>> = {
  shot: 0.85,
  matchStart: 0.7,
  matchEnd: 0.7
};

let context: AudioContext | null = null;
let gain: GainNode | null = null;
const buffers: Partial<Record<SfxName, AudioBuffer>> = {};
// Nombres ya pedidos (aunque aun esten descargando): evita fetch/decode duplicados.
const requested = new Set<SfxName>();
let installed = false;

// Crea (una vez) el contexto de audio compartido por todos los efectos.
function ensureContext(): boolean {
  if (context) return true;
  try {
    context = new AudioContext();
  } catch {
    return false;
  }
  gain = context.createGain();
  gain.gain.value = 0.4;
  gain.connect(context.destination);
  return true;
}

// Descarga y decodifica los sonidos que aun no se hayan pedido.
function load(names: readonly SfxName[]) {
  if (!ensureContext()) return;
  for (const name of names) {
    if (requested.has(name)) continue;
    requested.add(name);
    void fetch(SOUNDS[name])
      .then((response) => response.arrayBuffer())
      .then((data) => context!.decodeAudioData(data))
      .then((decoded) => {
        buffers[name] = decoded;
      })
      .catch(() => {
        // Si falla, se permite reintentar en la siguiente peticion del sonido.
        requested.delete(name);
      });
  }
}

// Reproduce un sonido por nombre. Si aun no esta decodificado, no suena (los primeros ms).
function play(name: SfxName) {
  if (!context || !gain) return;
  const buffer = buffers[name];
  if (!buffer) return;
  // El contexto nace suspendido; el propio gesto del usuario lo reanuda.
  if (context.state === "suspended") void context.resume();
  const source = context.createBufferSource();
  source.buffer = buffer;
  const volume = SFX_GAIN[name];
  if (volume === undefined) {
    source.connect(gain);
  } else {
    // Nodo efimero igual que el source: se libera solo cuando termina el sonido.
    const trim = context.createGain();
    trim.gain.value = volume;
    trim.connect(gain);
    source.connect(trim);
  }
  source.start(0);
}

// Reproduce un sonido por nombre desde fuera (p. ej. al abrirse un modal holografico
// o al disparar). Garantiza que el audio este inicializado aunque no haya saltado aun
// el listener de clicks.
export function playSfx(name: SfxName) {
  load([name]);
  play(name);
}

// Prepara los sonidos de partida. Se llama al unirse a una partida: asi el disparo o la
// celula suenan al instante en vez de perderse mientras se descarga el mp3.
export function preloadGameSfx() {
  load(GAME_SFX);
}

// Instala (una sola vez) el listener global de sonidos de UI.
export function installGlobalClickSound() {
  if (installed || typeof document === "undefined") return;
  installed = true;

  // Se inicializa en el primer pointerdown para evitar depender de autoplay policies.

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

      load(UI_SFX);
      // Un ancestro con data-sfx define un sonido propio (p. ej. JUGAR); si no, "click".
      // data-sfx="silent" desactiva el click (p. ej. login/registro, que ya suenan al abrir
      // su modal con el sonido de holograma).
      const custom = target?.closest<HTMLElement>("[data-sfx]");
      const sfx = custom?.dataset.sfx ?? "click";
      if (sfx === "silent") return;
      play(sfx as SfxName);
    },
    // Captura: garantiza el sonido aunque el handler del elemento detenga la propagacion.
    { capture: true }
  );
}
