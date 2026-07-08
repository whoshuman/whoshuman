import { useEffect } from "react";

import { useGameStore } from "../store/gameStore";

// Teclas → {forward, turn} del contrato del servidor: W/S = forward +1/-1,
// A/D = turn +1/-1 (A gira a la izquierda). El servidor integra el ÚLTIMO input
// recibido en cada tick, así que basta emitir cuando el valor cambia — no hace
// falta bombardear a 20 Hz (WebSocket es fiable, nada se pierde).
export function useKeyboardInput(enabled: boolean): void {
  const sendInput = useGameStore((s) => s.sendInput);

  useEffect(() => {
    if (!enabled) return;

    const pressed = new Set<string>();
    let forward = 0;
    let turn = 0;

    const KEY_MAP: Record<string, string> = {
      KeyW: "up",
      ArrowUp: "up",
      KeyS: "down",
      ArrowDown: "down",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right"
    };

    function recompute() {
      const nextForward = (pressed.has("up") ? 1 : 0) + (pressed.has("down") ? -1 : 0);
      const nextTurn = (pressed.has("left") ? 1 : 0) + (pressed.has("right") ? -1 : 0);
      if (nextForward !== forward || nextTurn !== turn) {
        forward = nextForward;
        turn = nextTurn;
        sendInput(forward, turn);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const direction = KEY_MAP[event.code];
      if (!direction || event.repeat) return;
      pressed.add(direction);
      recompute();
    }

    function onKeyUp(event: KeyboardEvent) {
      const direction = KEY_MAP[event.code];
      if (!direction) return;
      pressed.delete(direction);
      recompute();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      // Al salir de la pantalla, frena al personaje en el servidor.
      if (forward !== 0 || turn !== 0) sendInput(0, 0);
    };
  }, [enabled, sendInput]);
}
