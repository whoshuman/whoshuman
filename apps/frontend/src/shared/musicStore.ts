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
  // Para la musica con un fade-out (al volver a la home).
  stop: () => void;
  // Alterna activar/desactivar la musica.
  toggle: () => void;
};

export const useMusic = create<MusicState>((set, get) => ({
  enabled: initialEnabled(),
  started: false,
  start: () => {
    set({ started: true });
    const element = getAudio();
    // Si habia un fade-out a medias, lo cancelamos y restauramos el volumen.
    clearFade();
    element.volume = VOLUME;
    // play() solo funciona tras un gesto del usuario; el navegador lo permite desde el clic.
    if (get().enabled) void element.play().catch(() => {});
  },
  stop: () => {
    set({ started: false });
    if (audio && !audio.paused) {
      fadeOut(audio, () => {});
    }
  },
  toggle: () => {
    const next = !get().enabled;
    set({ enabled: next });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    }
    const element = getAudio();
    if (next) {
      // Solo reanuda si la partida ya habia arrancado la musica.
      if (get().started) void element.play().catch(() => {});
    } else {
      element.pause();
    }
  }
}));
