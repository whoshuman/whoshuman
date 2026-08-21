import { create } from "zustand";

// Pista de musica de fondo. Se sirve desde public/ y se reproduce en bucle al iniciar partida.
const MUSIC_SRC = "/sounds/cold-fire-neozoic-main-version-37473-02-16.mp3";
const STORAGE_KEY = "whoshuman:music";

// Volumen de reproduccion (se restaura tras un fade-out).
const VOLUME = 0.45;

// Una sola instancia de audio para no cargar/decodificar el mp3 dos veces (regla de rendimiento).
let audio: HTMLAudioElement | null = null;
function getAudio() {
  if (!audio) {
    audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = VOLUME;
  }
  return audio;
}

// Arranque aplazado: cuando suena la musiquita de fin de partida no queremos que la musica
// de fondo entre encima, asi que se retiene hasta que aquella termina.
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let holdUntil = 0;
function clearHold() {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
}

// Temporizador del fade-out en curso (para cancelarlo si se reanuda antes de terminar).
let fadeTimer: ReturnType<typeof setInterval> | null = null;
function clearFade() {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

// Baja el volumen progresivamente y, al llegar a 0, pausa y rebobina. Restaura el volumen
// para la proxima reproduccion. Pasos de ~50ms durante DURATION_MS.
function fadeOut(element: HTMLAudioElement, onDone: () => void) {
  clearFade();
  const STEP_MS = 50;
  const DURATION_MS = 900;
  const step = (VOLUME * STEP_MS) / DURATION_MS;
  fadeTimer = setInterval(() => {
    const next = element.volume - step;
    if (next <= 0) {
      clearFade();
      element.pause();
      element.currentTime = 0;
      element.volume = VOLUME;
      onDone();
    } else {
      element.volume = next;
    }
  }, STEP_MS);
}

// Preferencia persistida: por defecto activada, salvo que el usuario la haya apagado.
function initialEnabled() {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "off";
}

type MusicState = {
  // Preferencia del usuario (persistida).
  enabled: boolean;
  // Si la partida ya arranco la musica (para reanudar al reactivar).
  started: boolean;
  // Arranca la musica (llamar tras un gesto del usuario, p. ej. el boton JUGAR).
  start: () => void;
  // Para la musica con un fade-out (al volver a la home, o al empezar la partida).
  stop: () => void;
  // Retiene el proximo arranque los ms indicados (lo que dure el sonido de fin de partida).
  hold: (ms: number) => void;
  // Alterna activar/desactivar la musica.
  toggle: () => void;
};

export const useMusic = create<MusicState>((set, get) => ({
  enabled: initialEnabled(),
  started: false,
  start: () => {
    // started se marca ya: para el resto de la app la musica esta en marcha, aunque su
    // primera nota este esperando a que acabe el sonido de fin de partida.
    set({ started: true });
    const element = getAudio();
    // Si habia un fade-out a medias, lo cancelamos y restauramos el volumen.
    clearFade();
    clearHold();
    element.volume = VOLUME;
    // Siempre desde el principio: entrar al lobby es el arranque de la sesion de juego, no
    // la continuacion de lo que sonaba antes (un fade-out cortado a medias dejaria la pista
    // por donde iba).
    element.currentTime = 0;
    // play() solo funciona tras un gesto del usuario; el navegador lo permite desde el clic.
    const playNow = () => {
      if (get().started && get().enabled) void element.play().catch(() => {});
    };

    const wait = holdUntil - Date.now();
    if (wait > 0) {
      holdTimer = setTimeout(() => {
        holdTimer = null;
        playNow();
      }, wait);
      return;
    }
    playNow();
  },
  stop: () => {
    set({ started: false });
    clearHold();
    if (audio && !audio.paused) {
      fadeOut(audio, () => {});
    }
  },
  hold: (ms) => {
    holdUntil = Date.now() + ms;
  },
  toggle: () => {
    const next = !get().enabled;
    set({ enabled: next });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    }
    const element = getAudio();
    if (next) {
      // Solo reanuda si la partida ya habia arrancado la musica (y sin pisar el sonido
      // de fin de partida, si todavia esta sonando).
      if (get().started && Date.now() >= holdUntil) void element.play().catch(() => {});
    } else {
      element.pause();
    }
  }
}));
