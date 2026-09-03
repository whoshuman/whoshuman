export const TOUCH_CAMERA_EVENT = "game:touch-camera";
export const TOUCH_SEEKER_SHOOT_EVENT = "game:touch-seeker-shoot";

/**
 * ¿El aparato se maneja con el dedo? Mira el puntero PRINCIPAL, no si hay tactil por
 * algun lado: `navigator.maxTouchPoints > 0` y `any-pointer: coarse` dan positivo en
 * cualquier portatil con pantalla tactil, y ahi el juego se maneja con raton.
 *
 * Daba falsos positivos con consecuencias gordas: se pintaban los mandos tactiles
 * encima del canvas (dos zonas de medio ancho que se comen el clic, por eso el clic
 * derecho sacaba el joystick en vez de apuntar) y el aviso de pantalla completa tapaba
 * la partida entera. Lo usan los dos sitios, para que no vuelvan a divergir.
 *
 * La segunda condicion es la red de seguridad: hay moviles que declaran el puntero
 * principal `fine` (el modo "sitio de escritorio" del navegador, algunos WebView). Ahi
 * el primer test falla y el jugador se queda sin mandos, sin nada con que jugar. Si el
 * aparato tiene tactil y NINGUN puntero fino, es un movil, diga lo que diga.
 */
export function isTouchPrimary(): boolean {
  if (window.matchMedia("(pointer: coarse)").matches) return true;
  return navigator.maxTouchPoints > 0 && !window.matchMedia("(any-pointer: fine)").matches;
}

export interface TouchCameraDetail {
  x: number;
  y: number;
}

export interface JoystickVector {
  knobX: number;
  knobY: number;
  x: number;
  y: number;
}

export function normalizeJoystick(
  rawX: number,
  rawY: number,
  radius: number,
  deadZone: number
): JoystickVector {
  const distance = Math.hypot(rawX, rawY);
  const scale = distance > radius ? radius / distance : 1;
  const knobX = rawX * scale;
  const knobY = rawY * scale;
  const axisX = Math.max(-1, Math.min(1, rawX / radius));
  const axisY = Math.max(-1, Math.min(1, rawY / radius));
  const x = Math.abs(axisX) < deadZone ? 0 : axisX;
  const y = Math.abs(axisY) < deadZone ? 0 : axisY;
  return { knobX, knobY, x, y };
}

export function setTouchCamera(x: number, y: number): void {
  window.dispatchEvent(
    new CustomEvent<TouchCameraDetail>(TOUCH_CAMERA_EVENT, {
      detail: { x, y }
    })
  );
}

export function shootTouchSeeker(): void {
  window.dispatchEvent(new Event(TOUCH_SEEKER_SHOOT_EVENT));
}
