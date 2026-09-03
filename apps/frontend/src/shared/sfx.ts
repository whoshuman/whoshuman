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
  matchEnd: "/sounds/end_game.mp3",
  // Zumbido de la nave del cazador. Se reproduce en BUCLE mientras se mueve, no como
  // disparo suelto: ver setSfxLoop.
  shipMove: "/sounds/nave-cazador.mp3"
} as const;

export type SfxName = keyof typeof SOUNDS;

// Sonidos de UI: se decodifican en la primera interaccion, esten donde esten.
const UI_SFX: SfxName[] = ["click", "access", "hologram"];
// Sonidos de partida: solo se decodifican al entrar en una partida.
const GAME_SFX: SfxName[] = ["shot", "collect", "matchStart", "matchEnd", "shipMove"];

// Ganancia relativa por sonido (1 = volumen del bus). Equilibra pistas grabadas a
// distinto nivel sin tener que reeditar los mp3.
const SFX_GAIN: Partial<Record<SfxName, number>> = {
  shot: 0.85,
  matchStart: 0.7,
  // La musiquita de cierre estaba grabada bastante mas alta que el resto y pegaba un
  // susto al acabar la partida.
  matchEnd: 0.4,
  // Suena continuo mientras vuela: bastante por debajo del resto para no tapar disparos
  // ni voces. Es un zumbido de fondo, no un protagonista.
  shipMove: 0.3
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

// Cuanto dura un sonido, en milisegundos (0 si aun no se ha decodificado). Sirve para
// encadenar cosas detras de un sonido, como esperar a que acabe la musiquita de fin de
// partida antes de devolver la musica de fondo.
export function sfxDurationMs(name: SfxName): number {
  const buffer = buffers[name];
  return buffer ? buffer.duration * 1000 : 0;
}

// --- Sonidos en bucle -------------------------------------------------------------------
// Los efectos normales son de usar y tirar. El zumbido de la nave, en cambio, tiene que
// sostenerse mientras el cazador se mueve y apagarse al parar, con fundidos: sin ellos el
// arranque y el corte suenan a chasquido.
// El fundido de entrada es corto (el motor responde al acelerar) y el de salida bastante
// mas largo. Esa asimetria es lo que hace llevadero el virar a izquierda y derecha sin
// parar: cada hueco de un par de decimas apenas baja el volumen antes de que vuelva a
// subir, asi que se oye un vaiven suave en vez de un motor arrancando y parando.
const LOOP_FADE_IN_SECONDS = 0.25;
const LOOP_FADE_OUT_SECONDS = 0.7;

type Loop = {
  source: AudioBufferSourceNode;
  trim: GainNode;
  near: GainNode;
  stopping: boolean;
  // Temporizador que cortara la fuente cuando termine el fundido de salida. El corte NO
  // se programa en el nodo (source.stop(cuando)) porque eso no se puede deshacer, y hace
  // falta poder reanudar si el sonido vuelve antes de que el fundido acabe.
  stopTimer: ReturnType<typeof setTimeout> | null;
};
const loops: Partial<Record<SfxName, Loop>> = {};

/**
 * Enciende o apaga un sonido en bucle. Es declarativo e idempotente: se puede llamar en
 * cada fotograma con el estado actual y solo actua cuando cambia de verdad. Si el mp3 aun
 * no esta decodificado no hace nada, y la siguiente llamada lo reintenta.
 */
export function setSfxLoop(name: SfxName, active: boolean) {
  load([name]);
  if (!context || !gain) return;

  const current = loops[name];

  if (active) {
    // Ya sonando y sin apagarse: nada que hacer.
    if (current && !current.stopping) return;
    const buffer = buffers[name];
    if (!buffer) return;
    if (context.state === "suspended") void context.resume();

    // Estaba en pleno fundido de salida: se le da la vuelta al fundido y sigue sonando.
    // Antes se cortaba y se relanzaba, y el bucle volvia al principio del mp3: por eso un
    // cazador virando a izquierda y derecha reiniciaba el zumbido en cada toque. La fuente
    // no llega a pararse, asi que el motor continua desde donde iba.
    if (current) {
      if (current.stopTimer !== null) clearTimeout(current.stopTimer);
      current.stopTimer = null;
      current.stopping = false;
      const resumeAt = context.currentTime;
      current.trim.gain.cancelScheduledValues(resumeAt);
      current.trim.gain.setValueAtTime(current.trim.gain.value, resumeAt);
      current.trim.gain.linearRampToValueAtTime(
        SFX_GAIN[name] ?? 1,
        resumeAt + LOOP_FADE_IN_SECONDS
      );
      return;
    }

    const trim = context.createGain();
    trim.gain.value = 0;
    trim.connect(gain);
    // Nodo aparte para la atenuacion por distancia: asi se puede mover en cada fotograma
    // sin cancelar las rampas de fundido, que viven en `trim`.
    const near = context.createGain();
    near.gain.value = 1;
    near.connect(trim);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(near);
    source.start(0);
    trim.gain.linearRampToValueAtTime(
      SFX_GAIN[name] ?? 1,
      context.currentTime + LOOP_FADE_IN_SECONDS
    );
    loops[name] = { source, trim, near, stopping: false, stopTimer: null };
    return;
  }

  if (!current || current.stopping) return;
  current.stopping = true;
  const now = context.currentTime;
  // Se parte del volumen real de este instante: si aun estaba subiendo, el fundido de
  // salida arranca donde estuviera y no da un salto.
  current.trim.gain.cancelScheduledValues(now);
  current.trim.gain.setValueAtTime(current.trim.gain.value, now);
  current.trim.gain.linearRampToValueAtTime(0, now + LOOP_FADE_OUT_SECONDS);
  current.stopTimer = setTimeout(() => {
    current.source.stop();
    if (loops[name] === current) delete loops[name];
  }, LOOP_FADE_OUT_SECONDS * 1000);
}

/**
 * Volumen por cercania de un bucle ya sonando (0 = lejos, 1 = encima). Se suaviza con
 * setTargetAtTime para que un cambio brusco de distancia no chasquee.
 */
export function setSfxLoopProximity(name: SfxName, value: number) {
  const loop = loops[name];
  if (!loop || !context) return;
  loop.near.gain.setTargetAtTime(Math.max(0, Math.min(1, value)), context.currentTime, 0.08);
}

/** Corta todos los bucles de golpe. Al salir de la partida no puede quedar nada sonando. */
export function stopAllSfxLoops() {
  for (const name of Object.keys(loops) as SfxName[]) setSfxLoop(name, false);
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
