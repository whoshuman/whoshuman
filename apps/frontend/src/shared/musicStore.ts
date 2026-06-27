import { create } from "zustand";

// Pista de musica de fondo. Se sirve desde public/ y se reproduce en bucle al iniciar partida.
const MUSIC_SRC = "/sounds/cold-fire-neozoic-main-version-37473-02-16.mp3";
const STORAGE_KEY = "whoshuman:music";

// Una sola instancia de audio para no cargar/decodificar el mp3 dos veces (regla de rendimiento).
let audio: HTMLAudioElement | null = null;
function getAudio() {
  if (!audio) {
    audio = new Audio(MUSIC_SRC);
    audio.loop = true;
    audio.volume = 0.45;
  }
  return audio;
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
  // Alterna activar/desactivar la musica.
  toggle: () => void;
};

export const useMusic = create<MusicState>((set, get) => ({
  enabled: initialEnabled(),
  started: false,
  start: () => {
    set({ started: true });
    // play() solo funciona tras un gesto del usuario; el navegador lo permite desde el clic.
    if (get().enabled)
      void getAudio()
        .play()
        .catch(() => {});
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
